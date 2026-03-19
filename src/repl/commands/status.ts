import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

export function statusCommand(): CommandHandler {
  return {
    name: "status",
    description: "Show current session status",
    async execute(args, ctx) {
      const flow = ctx.state.currentFlow || "(none)";
      const boards = ctx.state.activeBoards.length;
      const penpot = ctx.bridge?.mcpConnected ? pc.green("connected") : pc.red("disconnected");
      const skills = ctx.skills.count();
      const turns = ctx.session.turns.length;
      const usage = ctx.tokenTracker.getUsage();

      console.log(pc.bold("Session Status"));
      console.log(`  Flow:    ${flow}`);
      console.log(`  Boards:  ${boards}`);
      console.log(`  Penpot:  ${penpot}`);
      console.log(`  Skills:  ${skills} loaded`);
      console.log(`  Turns:   ${turns}`);
      console.log(`  Tokens:  ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out (~$${usage.estimatedCost.toFixed(4)})`);
    },
  };
}
