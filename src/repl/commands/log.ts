import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

const DEFAULT_SHOW_TURNS = 20;

export function logCommand(): CommandHandler {
  return {
    name: "log",
    description: "Show conversation history for this session",
    usage: "/log [count]",
    async execute(args, ctx) {
      const turns = ctx.session.turns;

      if (turns.length === 0) {
        console.log(pc.dim("No conversation history yet."));
        return;
      }

      const count = args.trim() ? parseInt(args.trim(), 10) : DEFAULT_SHOW_TURNS;
      const showCount = isNaN(count) ? DEFAULT_SHOW_TURNS : Math.min(count, turns.length);
      const startIdx = Math.max(0, turns.length - showCount);

      console.log(pc.bold(`Conversation log (showing ${showCount} of ${turns.length} turns)\n`));

      for (let i = startIdx; i < turns.length; i++) {
        const turn = turns[i];
        const timestamp = turn.timestamp.toLocaleTimeString();
        const roleLabel =
          turn.role === "user"
            ? pc.blue("You")
            : pc.green("Assistant");
        const tokenInfo = turn.tokenCount
          ? pc.dim(` (${turn.tokenCount.toLocaleString()} tokens)`)
          : "";

        console.log(`${pc.dim(`[${timestamp}]`)} ${roleLabel}${tokenInfo}`);

        // Show truncated content
        const maxLen = 200;
        const content = turn.content.length > maxLen
          ? turn.content.slice(0, maxLen) + pc.dim("...")
          : turn.content;
        console.log(`  ${content}\n`);
      }
    },
  };
}
