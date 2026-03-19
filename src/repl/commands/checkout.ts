import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler } from "../../types/repl.js";

export function checkoutCommand(): CommandHandler {
  return {
    name: "checkout",
    description: "Switch to a flow and load its context",
    usage: "/checkout <flow>",
    async execute(args, ctx) {
      const flowName = args.trim();
      if (!flowName) {
        console.log(pc.yellow("Usage: /checkout <flow>"));
        console.log(pc.dim("Use /flows to see available flows."));
        return;
      }

      if (!ctx.config.projectRoot) {
        console.log(pc.yellow("No project initialized. Run /init first."));
        return;
      }

      // Look for the flow file
      const flowFile = path.join(ctx.config.projectRoot, "context", "flows", `${flowName}.md`);
      const vectisFlowFile = path.join(ctx.config.projectRoot, ".vectis", "flows", `${flowName}.md`);

      let resolvedPath: string | null = null;
      if (fs.existsSync(flowFile)) {
        resolvedPath = flowFile;
      } else if (fs.existsSync(vectisFlowFile)) {
        resolvedPath = vectisFlowFile;
      }

      if (!resolvedPath) {
        console.log(pc.red(`Flow "${flowName}" not found.`));
        console.log(pc.dim("Use /flows to see available flows, or create context/flows/" + flowName + ".md"));
        return;
      }

      const sp = spinner(`Loading flow: ${flowName}`).start();

      try {
        // Read the flow file to verify it's valid
        const content = fs.readFileSync(resolvedPath, "utf-8");

        // Set the active flow
        ctx.state.currentFlow = flowName;

        sp.succeed(`Switched to flow: ${pc.cyan(flowName)}`);

        // Show a brief summary of the flow content
        const lines = content.split("\n").filter((l) => l.trim());
        const heading = lines.find((l) => l.startsWith("#"));
        if (heading) {
          console.log(pc.dim(`  ${heading.replace(/^#+\s*/, "")}`));
        }

        const wordCount = content.split(/\s+/).length;
        console.log(pc.dim(`  ${wordCount} words loaded into context`));
      } catch (err) {
        sp.fail("Failed to load flow");
        if (err instanceof Error) {
          console.log(pc.red(`Error: ${err.message}`));
        }
      }
    },
  };
}
