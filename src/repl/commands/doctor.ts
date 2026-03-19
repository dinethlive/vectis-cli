import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";
import { getGlobalConfigDir, getGlobalSkillsDir } from "../../config/paths.js";

interface Check {
  name: string;
  run: () => Promise<{ ok: boolean; detail: string; suggestion?: string }>;
}

export function doctorCommand(): CommandHandler {
  return {
    name: "doctor",
    description: "Check system health",
    usage: "/doctor",
    async execute(args, ctx) {
      console.log(pc.bold("\nVectis Doctor\n"));

      const checks: Check[] = [
        {
          name: "API key",
          async run() {
            if (!ctx.config.apiKey) {
              return { ok: false, detail: "Not configured", suggestion: "Run /init or set ANTHROPIC_API_KEY" };
            }
            if (ctx.client) {
              try {
                await ctx.client.countTokens([{ role: "user", content: "test" }]);
                return { ok: true, detail: "Valid" };
              } catch {
                return { ok: false, detail: "Invalid or expired", suggestion: "Check your key at console.anthropic.com" };
              }
            }
            return { ok: true, detail: `Set (${ctx.config.apiKey.slice(0, 10)}...)` };
          },
        },
        {
          name: "Project directory",
          async run() {
            if (!ctx.config.projectRoot) {
              return { ok: false, detail: "No .vectis/ found", suggestion: "Run /init" };
            }
            return { ok: true, detail: ctx.config.projectRoot };
          },
        },
        {
          name: "MCP server",
          async run() {
            if (!ctx.bridge) {
              return { ok: false, detail: "Not connected", suggestion: "Ensure Penpot MCP server is running" };
            }
            const reachable = await ctx.bridge.testConnection();
            return reachable
              ? { ok: true, detail: "Connected" }
              : { ok: false, detail: "Unreachable", suggestion: "Check MCP server at " + ctx.config.mcpServerUrl };
          },
        },
        {
          name: "Penpot plugin",
          async run() {
            if (!ctx.bridge) {
              return { ok: false, detail: "No bridge", suggestion: "MCP connection required first" };
            }
            try {
              const pages = await ctx.bridge.getPages();
              return { ok: true, detail: `Connected — ${pages.length} page(s)` };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("No Penpot plugin")) {
                return { ok: false, detail: "Plugin not connected", suggestion: "Open Penpot in browser and connect the MCP plugin" };
              }
              return { ok: false, detail: "Plugin unreachable", suggestion: "Ensure Penpot is open with the MCP plugin connected" };
            }
          },
        },
        {
          name: "Global config",
          async run() {
            const dir = getGlobalConfigDir();
            return fs.existsSync(dir)
              ? { ok: true, detail: dir }
              : { ok: false, detail: "Not found", suggestion: "Run /init" };
          },
        },
        {
          name: "Skills directory",
          async run() {
            const dir = getGlobalSkillsDir();
            if (!fs.existsSync(dir)) {
              return { ok: false, detail: "Not found", suggestion: "Run /init to install built-in skills" };
            }
            const count = fs.readdirSync(dir).filter(f => f.endsWith(".md")).length;
            return { ok: true, detail: `${count} skills` };
          },
        },
        {
          name: "SQLite (bun:sqlite)",
          async run() {
            try {
              const { Database } = await import("bun:sqlite");
              const db = new Database(":memory:");
              db.run("SELECT 1");
              db.close();
              return { ok: true, detail: "Working" };
            } catch (err) {
              return { ok: false, detail: `Failed: ${err}`, suggestion: "Ensure you're running with Bun" };
            }
          },
        },
        {
          name: "ANSI colors",
          async run() {
            const supported = process.stdout.hasColors?.() ?? process.env.TERM !== "dumb";
            return supported
              ? { ok: true, detail: "Supported" }
              : { ok: true, detail: "Limited (dumb terminal)" };
          },
        },
      ];

      let allPassed = true;
      for (const check of checks) {
        try {
          const result = await check.run();
          const icon = result.ok ? pc.green("✓") : pc.red("✗");
          console.log(`  ${icon} ${pc.bold(check.name)}: ${result.detail}`);
          if (!result.ok && result.suggestion) {
            console.log(pc.yellow(`    → ${result.suggestion}`));
            allPassed = false;
          }
        } catch (err) {
          console.log(`  ${pc.red("✗")} ${pc.bold(check.name)}: Error — ${err}`);
          allPassed = false;
        }
      }

      console.log("");
      if (allPassed) {
        console.log(pc.green("All checks passed!"));
      } else {
        console.log(pc.yellow("Some checks failed. Fix the issues above and run /doctor again."));
      }
    },
  };
}
