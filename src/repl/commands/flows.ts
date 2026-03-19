import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";

export function flowsCommand(): CommandHandler {
  return {
    name: "flows",
    description: "List all available flows",
    usage: "/flows",
    async execute(args, ctx) {
      const flows: Array<{ name: string; source: string; description: string }> = [];

      // Discover flows from context/flows directory
      if (ctx.config.projectRoot) {
        const flowsDir = path.join(ctx.config.projectRoot, "context", "flows");
        if (fs.existsSync(flowsDir)) {
          try {
            const files = fs.readdirSync(flowsDir).filter((f) => f.endsWith(".md"));
            for (const file of files) {
              const name = file.replace(/\.md$/, "");
              let description = "";
              try {
                const content = fs.readFileSync(path.join(flowsDir, file), "utf-8");
                // Extract first line or heading as description
                const firstLine = content.split("\n").find((l) => l.trim() && !l.startsWith("#"));
                const heading = content.match(/^#\s+(.+)$/m);
                description = heading?.[1] || firstLine?.trim().slice(0, 60) || "";
              } catch {
                // ignore read errors
              }
              flows.push({ name, source: "context/flows", description });
            }
          } catch {
            // ignore directory read errors
          }
        }

        // Also check .vectis/flows if it exists
        const vectisFlowsDir = path.join(ctx.config.projectRoot, ".vectis", "flows");
        if (fs.existsSync(vectisFlowsDir)) {
          try {
            const files = fs.readdirSync(vectisFlowsDir).filter((f) => f.endsWith(".md"));
            for (const file of files) {
              const name = file.replace(/\.md$/, "");
              // Skip if already found in context/flows
              if (flows.some((f) => f.name === name)) continue;
              flows.push({ name, source: ".vectis/flows", description: "" });
            }
          } catch {
            // ignore
          }
        }
      }

      if (flows.length === 0) {
        console.log(pc.dim("No flows found."));
        console.log(pc.dim("Create flow files in context/flows/ as Markdown files."));
        return;
      }

      const table = new Table({
        head: [pc.bold("Flow"), pc.bold("Source"), pc.bold("Description")],
        style: { head: [], border: [] },
      });

      const currentFlow = ctx.state.currentFlow;
      for (const flow of flows) {
        const marker = flow.name === currentFlow ? pc.green(" (active)") : "";
        table.push([
          pc.cyan(flow.name) + marker,
          pc.dim(flow.source),
          flow.description,
        ]);
      }

      console.log(table.toString());
    },
  };
}
