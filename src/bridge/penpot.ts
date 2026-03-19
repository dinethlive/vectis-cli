import { McpClient } from "./mcp-client.js";
import { WsListener } from "./ws-listener.js";
import type {
  PenpotPage,
  PenpotShape,
  PenpotComponent,
  PenpotDesignTokens,
  PenpotEvent,
} from "./types.js";
import type { Logger } from "../utils/logger.js";

export class PenpotBridge {
  private mcp: McpClient;
  private ws: WsListener;
  private logger: Logger;
  private fileId: string;

  constructor(options: {
    mcpUrl: string;
    wsUrl: string;
    fileId: string;
    logger: Logger;
  }) {
    this.mcp = new McpClient(options.mcpUrl, options.logger);
    this.ws = new WsListener(options.wsUrl, options.logger);
    this.logger = options.logger;
    this.fileId = options.fileId;
  }

  get mcpConnected(): boolean {
    return this.mcp.connected;
  }

  get wsConnected(): boolean {
    return this.ws.connected;
  }

  async connect(): Promise<void> {
    await this.mcp.connect();
    // WS connection is optional — port 4402 is the plugin bridge,
    // not a general event bus. Don't auto-connect.
  }

  async connectWs(): Promise<void> {
    this.ws.connect();
  }

  async disconnect(): Promise<void> {
    await this.mcp.disconnect();
    this.ws.disconnect();
  }

  onEvent(cb: (event: PenpotEvent) => void): void {
    this.ws.onEvent(cb);
  }

  /** Ensure MCP is connected, reconnecting if the session went stale. */
  private async ensureConnected(): Promise<void> {
    if (!this.mcp.connected) {
      this.logger.debug("MCP not connected — reconnecting...");
      await this.mcp.reconnect();
    }
  }

  /**
   * Execute JavaScript code in the Penpot plugin context via the MCP server.
   * The code has access to: penpot, penpotUtils, storage, console.
   * Auto-reconnects once on stale connection.
   */
  private async executeCode(code: string): Promise<unknown> {
    await this.ensureConnected();

    let response: { content: Array<{ type: string; text: string }>; isError?: boolean };
    try {
      response = (await this.mcp.callTool("execute_code", { code })) as typeof response;
    } catch {
      // Stale connection — reconnect and retry once
      this.logger.debug("execute_code failed — reconnecting and retrying...");
      await this.mcp.reconnect();
      response = (await this.mcp.callTool("execute_code", { code })) as typeof response;
    }

    if (response.isError) {
      const errorText = response.content?.[0]?.text ?? "Unknown error";
      throw new Error(`Penpot execute_code failed: ${errorText}`);
    }

    const text = response.content?.[0]?.text;
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      // Handle { data: { result, log } } format from ExecuteCodeTool
      if (parsed?.data?.result !== undefined) return parsed.data.result;
      // Handle { result, log } format
      if (parsed?.result !== undefined) return parsed.result;
      // Return as-is
      return parsed;
    } catch {
      return text;
    }
  }

  async getPages(): Promise<PenpotPage[]> {
    const result = await this.executeCode(`
      return penpotUtils.getPages();
    `);
    return (result as PenpotPage[]) ?? [];
  }

  async getShapeTree(pageId: string): Promise<PenpotShape[]> {
    const safeId = JSON.stringify(pageId);
    const result = await this.executeCode(`
      const page = penpotUtils.getPageById(${safeId});
      if (!page || !page.root) return [];
      const children = page.root.children || [];
      return children.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        children: (s.children || []).map(c => ({
          id: c.id, name: c.name, type: c.type
        }))
      }));
    `);
    return (result as PenpotShape[]) ?? [];
  }

  async getShapeDetails(shapeId: string): Promise<PenpotShape> {
    const safeId = JSON.stringify(shapeId);
    const result = await this.executeCode(`
      const shape = penpotUtils.findShapeById(${safeId});
      if (!shape) return null;
      return penpotUtils.shapeStructure(shape, 5);
    `);
    return result as PenpotShape;
  }

  async getSelection(): Promise<PenpotShape[] | null> {
    try {
      const result = await this.executeCode(`
        const sel = penpot.selection;
        if (!sel || sel.length === 0) return null;
        return sel.map(s => ({ id: s.id, name: s.name, type: s.type }));
      `);
      return (result as PenpotShape[] | null) ?? null;
    } catch {
      return null;
    }
  }

  async getPageByName(name: string): Promise<PenpotPage | null> {
    const safeName = JSON.stringify(name);
    const result = await this.executeCode(`
      const page = penpotUtils.getPageByName(${safeName});
      if (!page) return null;
      return { id: page.id, name: page.name };
    `);
    return (result as PenpotPage | null) ?? null;
  }

  async getShapeByName(name: string): Promise<PenpotShape | null> {
    const safeName = JSON.stringify(name);
    try {
      const result = await this.executeCode(`
        const shape = penpotUtils.findShape(
          s => s.name.toLowerCase() === ${safeName}.toLowerCase()
        );
        if (!shape) return null;
        return penpotUtils.shapeStructure(shape, 3);
      `);
      return (result as PenpotShape | null) ?? null;
    } catch {
      return null;
    }
  }

  async getComponents(): Promise<PenpotComponent[]> {
    const result = await this.executeCode(`
      const lib = penpot.library.local;
      if (!lib || !lib.components) return [];
      return lib.components.map(c => ({
        id: c.id,
        name: c.name,
        variants: [],
        annotation: ''
      }));
    `);
    return (result as PenpotComponent[]) ?? [];
  }

  async getDesignTokens(): Promise<PenpotDesignTokens> {
    const result = await this.executeCode(`
      try {
        const catalog = penpot.library.local.tokens;
        if (!catalog) return {};
        const sets = catalog.sets;
        if (!sets || !sets.length) return {};
        const result = {};
        for (const set of sets) {
          const tokensObj = {};
          if (set.tokens) {
            for (const token of set.tokens) {
              tokensObj[token.name] = { type: token.type, value: token.value };
            }
          }
          result[set.name] = tokensObj;
        }
        return result;
      } catch(e) {
        return {};
      }
    `);
    return (result as PenpotDesignTokens) ?? {};
  }

  /** Public entry point for arbitrary plugin code execution. */
  async runCode(code: string): Promise<unknown> {
    return this.executeCode(code);
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.mcp.connected) {
        await this.mcp.connect();
      }
      const tools = await this.mcp.listTools();
      return tools.length > 0;
    } catch {
      // Connection stale or failed — try fresh reconnect
      try {
        await this.mcp.reconnect();
        const tools = await this.mcp.listTools();
        return tools.length > 0;
      } catch {
        return false;
      }
    }
  }
}
