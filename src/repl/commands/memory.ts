import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import { estimateTokens } from "../../ai/token-counter.js";

export function memoryCommand(): CommandHandler {
  return {
    name: "memory",
    description: "Show loaded files and skills with token counts",
    async execute(args, ctx) {
      const skills = ctx.skills.getAllMetadata();

      if (skills.length === 0) {
        console.log(pc.dim("No skills loaded."));
        return;
      }

      const table = new Table({
        head: [pc.bold("Type"), pc.bold("Name"), pc.bold("Status")],
        style: { head: [], border: [] },
      });

      for (const skill of skills) {
        table.push([
          "skill",
          pc.green(skill.name),
          skill.always ? pc.cyan("always-on") : pc.dim("on-demand"),
        ]);
      }

      console.log(table.toString());

      const usage = ctx.tokenTracker.getUsage();
      console.log(pc.dim(`\nSession tokens: ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out`));
    },
  };
}
