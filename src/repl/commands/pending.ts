import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";

interface PendingBoard {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

export function pendingCommand(): CommandHandler {
  return {
    name: "pending",
    description: "List or manage pending boards",
    usage: "/pending [approve|reject <id>]",
    async execute(args, ctx) {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();

      // For now, pending boards are tracked in state.activeBoards
      // A full implementation would query a database or MCP server

      if (subcommand === "approve" || subcommand === "reject") {
        const id = parts[1];
        if (!id) {
          console.log(pc.yellow(`Usage: /pending ${subcommand} <id>`));
          return;
        }

        if (subcommand === "approve") {
          console.log(pc.green(`Board ${pc.bold(id)} approved.`));
          // In a full implementation, this would push the design to Penpot
          if (ctx.bridge) {
            ctx.logger.debug(`Approving board ${id}`);
          }
        } else {
          console.log(pc.red(`Board ${pc.bold(id)} rejected.`));
          ctx.logger.debug(`Rejecting board ${id}`);
        }
        return;
      }

      // List pending boards
      if (ctx.state.activeBoards.length === 0) {
        console.log(pc.dim("No pending boards."));
        console.log(pc.dim("Generate designs with /ask to create pending boards."));
        return;
      }

      const table = new Table({
        head: [pc.bold("ID"), pc.bold("Board"), pc.bold("Status")],
        style: { head: [], border: [] },
      });

      for (let i = 0; i < ctx.state.activeBoards.length; i++) {
        const board = ctx.state.activeBoards[i];
        table.push([
          pc.dim(String(i + 1)),
          pc.cyan(board),
          pc.yellow("pending"),
        ]);
      }

      console.log(table.toString());
      console.log(pc.dim("\nUse /pending approve <id> or /pending reject <id> to manage."));
    },
  };
}
