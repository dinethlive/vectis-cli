import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

export function exitCommand(): CommandHandler {
  return {
    name: "exit",
    description: "Exit Vectis",
    async execute(args, ctx) {
      console.log(pc.dim("Saving session and shutting down..."));
      if (ctx.rl) ctx.rl.close();
    },
  };
}
