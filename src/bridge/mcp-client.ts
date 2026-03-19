import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Logger } from "../utils/logger.js";

export class McpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private _connected = false;
  private logger: Logger;
  private serverUrl: string;

  constructor(serverUrl: string, logger: Logger) {
    this.serverUrl = serverUrl;
    this.logger = logger;
    this.client = new Client({
      name: "vectis-cli",
      version: "0.1.0",
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    try {
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.serverUrl),
      );
      await this.client.connect(this.transport);
      this._connected = true;
      this.logger.debug(`MCP connected to ${this.serverUrl}`);
    } catch (err) {
      this._connected = false;
      throw err;
    }
  }

  /** Tear down and create a fresh connection (handles server restarts). */
  async reconnect(): Promise<void> {
    // Close old transport silently
    if (this.transport) {
      try { await this.transport.close(); } catch { /* ignore */ }
      this.transport = null;
    }
    this._connected = false;

    // Fresh client + transport (old Client may hold stale session state)
    this.client = new Client({
      name: "vectis-cli",
      version: "0.1.0",
    });
    this.transport = new StreamableHTTPClientTransport(
      new URL(this.serverUrl),
    );
    await this.client.connect(this.transport);
    this._connected = true;
    this.logger.debug(`MCP reconnected to ${this.serverUrl}`);
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try { await this.transport.close(); } catch { /* ignore */ }
      this.transport = null;
    }
    this._connected = false;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this._connected) {
      throw new Error("MCP client not connected");
    }

    try {
      return await this.client.callTool({ name, arguments: args });
    } catch (err) {
      // Mark disconnected so next call triggers reconnect
      this._connected = false;
      throw err;
    }
  }

  async listTools(): Promise<string[]> {
    if (!this._connected) {
      throw new Error("MCP client not connected");
    }

    try {
      const result = await this.client.listTools();
      return result.tools.map((t) => t.name);
    } catch (err) {
      this._connected = false;
      throw err;
    }
  }
}
