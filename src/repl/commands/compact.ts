import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler } from "../../types/repl.js";
import { estimateTokens } from "../../ai/token-counter.js";

export function compactCommand(): CommandHandler {
  return {
    name: "compact",
    description: "Compact conversation history or show token usage",
    usage: "/compact [status]",
    async execute(args, ctx) {
      const subcommand = args.trim().toLowerCase();

      if (subcommand === "status") {
        showTokenStatus(ctx);
        return;
      }

      // Perform conversation compaction
      const turns = ctx.session.turns;

      if (turns.length < 4) {
        console.log(pc.dim("Not enough conversation history to compact."));
        showTokenStatus(ctx);
        return;
      }

      const sp = spinner("Compacting conversation...").start();

      try {
        // Estimate current token usage from turns
        const totalTokensBefore = turns.reduce(
          (sum, t) => sum + (t.tokenCount || estimateTokens(t.content)),
          0,
        );

        // Keep the last 2 turns and summarize the rest
        const turnsToCompact = turns.slice(0, -2);
        const keptTurns = turns.slice(-2);

        // Build a summary of compacted turns
        const summaryParts: string[] = [];
        for (const turn of turnsToCompact) {
          const role = turn.role === "user" ? "User" : "Assistant";
          const truncated = turn.content.length > 100
            ? turn.content.slice(0, 100) + "..."
            : turn.content;
          summaryParts.push(`${role}: ${truncated}`);
        }

        const summary = `[Compacted ${turnsToCompact.length} turns]\n${summaryParts.join("\n")}`;

        // Replace turns with compacted summary + kept turns
        ctx.session.turns = [
          {
            role: "assistant",
            content: summary,
            timestamp: new Date(),
            tokenCount: estimateTokens(summary),
          },
          ...keptTurns,
        ];

        const totalTokensAfter = ctx.session.turns.reduce(
          (sum, t) => sum + (t.tokenCount || estimateTokens(t.content)),
          0,
        );

        sp.succeed("Conversation compacted");
        console.log(pc.dim(`  Turns: ${turns.length} -> ${ctx.session.turns.length}`));
        console.log(pc.dim(`  Estimated tokens: ~${totalTokensBefore.toLocaleString()} -> ~${totalTokensAfter.toLocaleString()}`));
        console.log(pc.dim(`  Saved: ~${(totalTokensBefore - totalTokensAfter).toLocaleString()} tokens`));
      } catch (err) {
        sp.fail("Compaction failed");
        if (err instanceof Error) {
          console.log(pc.red(`Error: ${err.message}`));
        }
      }
    },
  };
}

function showTokenStatus(ctx: import("../../types/repl.js").SessionContext): void {
  const usage = ctx.tokenTracker.getUsage();
  const turnTokens = ctx.session.turns.reduce(
    (sum, t) => sum + (t.tokenCount || estimateTokens(t.content)),
    0,
  );

  console.log(pc.bold("Token Usage"));
  console.log(`  Session input:  ${usage.inputTokens.toLocaleString()}`);
  console.log(`  Session output: ${usage.outputTokens.toLocaleString()}`);
  console.log(`  Est. cost:      $${usage.estimatedCost.toFixed(4)}`);
  console.log(`  Turns:          ${ctx.session.turns.length}`);
  console.log(`  Turn tokens:    ~${turnTokens.toLocaleString()} (estimated)`);
}
