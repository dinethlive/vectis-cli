import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler, SessionContext } from "../../types/repl.js";
import { saveGlobalConfig, saveProjectConfig, getGlobalConfigDir, getGlobalSkillsDir } from "../../config/index.js";
import { ClaudeClient } from "../../ai/client.js";
import { PenpotBridge } from "../../bridge/penpot.js";
import { installBuiltInSkills } from "../../skills/installer.js";

/**
 * Parse a Penpot workspace URL to extract file-id.
 * Handles both formats:
 *   - Query params in hash: .../#/workspace?team-id=X&file-id=Y&page-id=Z
 *   - Path-based (legacy):  .../#/workspace/PROJECT_UUID/FILE_UUID
 */
function parsePenpotUrl(raw: string): { fileId: string; teamId?: string; pageId?: string } {
  // Try query-param format first (in hash fragment)
  try {
    const url = new URL(raw);
    const hash = url.hash; // "#/workspace?team-id=...&file-id=..."
    const qIndex = hash.indexOf("?");
    if (qIndex !== -1) {
      const params = new URLSearchParams(hash.slice(qIndex + 1));
      const fileId = params.get("file-id") || "";
      if (fileId) {
        return {
          fileId,
          teamId: params.get("team-id") || undefined,
          pageId: params.get("page-id") || undefined,
        };
      }
    }
  } catch {
    // Not a valid URL — fall through
  }

  // Fallback: extract UUIDs positionally
  const uuidPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  const matches = raw.match(uuidPattern);
  if (matches && matches.length >= 2) {
    return { fileId: matches[1] };
  }
  if (matches && matches.length === 1) {
    return { fileId: matches[0] };
  }

  // Treat as raw UUID
  return { fileId: raw };
}

export function initCommand(): CommandHandler {
  return {
    name: "init",
    description: "Initialize Vectis project",
    usage: "/init <penpot-file-url> [mcp-server-url]",
    async execute(args, ctx) {
      const cwd = process.cwd();
      const vectisDir = path.join(cwd, ".vectis");

      if (fs.existsSync(vectisDir)) {
        console.log(pc.yellow(".vectis/ already exists. Reconfiguring...\n"));
      }

      // --- API Key ---
      const apiKey = ctx.config.apiKey;
      if (!apiKey) {
        console.log(pc.red("No API key found."));
        console.log(pc.yellow("Set it via: ANTHROPIC_API_KEY env var, or add to ~/.vectis/config.json"));
        return;
      }
      console.log(pc.green("✓") + ` API key: ${apiKey.slice(0, 12)}...`);

      // Validate
      const keySpinner = spinner("Validating API key...").start();
      try {
        const testClient = new ClaudeClient({ apiKey, model: ctx.config.model, logger: ctx.logger });
        await testClient.countTokens([{ role: "user", content: "test" }]);
        keySpinner.succeed("API key valid");
      } catch {
        keySpinner.fail("API key invalid — check your key and try again");
        return;
      }

      // --- Parse args ---
      const parts = args.trim().split(/\s+/);
      const penpotUrl = parts[0] || "";
      const mcpUrlArg = parts[1] || "";

      // --- Penpot file ID ---
      let penpotFileId = "";
      if (penpotUrl) {
        const parsed = parsePenpotUrl(penpotUrl);
        penpotFileId = parsed.fileId;

        if (parsed.teamId) {
          console.log(pc.green("✓") + ` Penpot team:  ${parsed.teamId}`);
        }
        console.log(pc.green("✓") + ` Penpot file:  ${penpotFileId}`);
        if (parsed.pageId) {
          console.log(pc.dim(`  Page ID: ${parsed.pageId}`));
        }
      } else {
        console.log(pc.yellow("⚠ No Penpot URL provided — Penpot commands will be unavailable"));
        console.log(pc.dim("  Usage: /init <penpot-file-url> [mcp-server-url]"));
        console.log(pc.dim("  Example: /init http://localhost:9001/#/workspace?file-id=abc-123"));
      }

      // --- MCP server ---
      const finalMcpUrl = mcpUrlArg || ctx.config.mcpServerUrl;

      if (penpotFileId) {
        const sp = spinner("Testing MCP connection...").start();
        try {
          const bridge = new PenpotBridge({
            mcpUrl: finalMcpUrl,
            wsUrl: ctx.config.wsServerUrl,
            fileId: penpotFileId,
            logger: ctx.logger,
          });
          const ok = await bridge.testConnection();
          if (ok) {
            sp.succeed(`MCP connected at ${finalMcpUrl}`);
            // Persist bridge to session context
            if (ctx.bridge) {
              await ctx.bridge.disconnect();
            }
            ctx.bridge = bridge;
          } else {
            sp.warn("MCP server not reachable — start it and try again");
            await bridge.disconnect();
          }
        } catch {
          sp.warn("MCP server not reachable — continuing anyway");
        }
      }

      // --- Create directories ---
      const dirs = [
        vectisDir,
        path.join(vectisDir, "conversations"),
        path.join(cwd, "context"),
        path.join(cwd, "context", "flows"),
        path.join(cwd, "context", "skills"),
        path.join(cwd, "specs"),
      ];
      for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // --- Save configs ---
      saveProjectConfig(cwd, {
        penpotFileId: penpotFileId || undefined,
        penpotFileUrl: penpotUrl || undefined,
        mcpServerUrl: finalMcpUrl !== ctx.config.mcpServerUrl ? finalMcpUrl : undefined,
      });

      // Install built-in skills on first run
      const globalSkillsDir = getGlobalSkillsDir();
      if (!fs.existsSync(globalSkillsDir)) {
        installBuiltInSkills(globalSkillsDir);
        console.log(pc.dim(`Installed built-in skills to ${globalSkillsDir}`));
      }

      // --- Update running context ---
      ctx.config.projectRoot = cwd;
      if (penpotFileId) ctx.config.project.penpotFileId = penpotFileId;

      if (!ctx.client) {
        ctx.client = new ClaudeClient({ apiKey, model: ctx.config.model, logger: ctx.logger });
      }

      console.log(pc.green("\n✓ Project initialized!"));
      console.log(pc.dim("  /doctor  — verify setup"));
      console.log(pc.dim("  /pull    — scan Penpot file"));
      console.log(pc.dim("  /help    — all commands"));
    },
  };
}
