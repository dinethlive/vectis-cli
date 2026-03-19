import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

export function flowCommand(): CommandHandler {
  return {
    name: "flow",
    description: "Set or show the active flow",
    usage: "/flow [name]",
    async execute(args, ctx) {
      if (!args.trim()) {
        const flow = ctx.state.currentFlow;
        console.log(flow ? `Active flow: ${pc.cyan(flow)}` : pc.dim("No active flow. Use /flow <name> to set one."));
        return;
      }
      ctx.state.currentFlow = args.trim();
      console.log(pc.green(`Active flow set to: ${args.trim()}`));
    },
  };
}
