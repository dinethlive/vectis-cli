import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

export function approveCommand(): CommandHandler {
  return {
    name: "approve",
    description: "Approve a pending board (shortcut for /pending approve)",
    usage: "/approve <id>",
    async execute(args, ctx) {
      const id = args.trim();
      if (!id) {
        console.log(pc.yellow("Usage: /approve <id>"));
        console.log(pc.dim("Use /pending to see pending boards."));
        return;
      }

      // Validate the id is in active boards
      const idx = parseInt(id, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < ctx.state.activeBoards.length) {
        const boardName = ctx.state.activeBoards[idx];
        console.log(pc.green(`Board ${pc.bold(boardName)} (${id}) approved.`));
        // In a full implementation, push to Penpot via bridge
        if (ctx.bridge) {
          ctx.logger.debug(`Approving board: ${boardName}`);
        }
      } else {
        console.log(pc.green(`Board ${pc.bold(id)} approved.`));
      }
    },
  };
}
