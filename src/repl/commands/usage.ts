import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import { calculateCost } from "../../ai/token-counter.js";

// ─── Command ────────────────────────────────────────────────────────────────

export function usageCommand(): CommandHandler {
  return {
    name: "usage",
    description: "Show token usage and estimated cost for current session",
    usage: "/usage [total]",
    async execute(args, ctx) {
      const subcommand = args.trim().toLowerCase();

      if (subcommand === "total") {
        displayTotalUsage(ctx);
      } else {
        displaySessionUsage(ctx);
      }
    },
  };
}

// ─── Session Usage ──────────────────────────────────────────────────────────

function displaySessionUsage(ctx: import("../../types/repl.js").SessionContext): void {
  const usage = ctx.tokenTracker.getUsage();

  console.log("");
  console.log(pc.bold("Session Token Usage"));
  console.log(pc.dim("─".repeat(50)));

  // Summary table
  const summaryTable = new Table({
    style: { head: [], border: [] },
  });

  summaryTable.push(
    [pc.gray("Model"), pc.cyan(ctx.config.model)],
    [pc.gray("Session ID"), pc.dim(ctx.session.id.slice(0, 12) + "...")],
    [
      pc.gray("Session started"),
      pc.dim(ctx.session.startedAt.toLocaleTimeString()),
    ],
    ["", ""],
    [pc.gray("Input tokens"), formatTokens(usage.inputTokens)],
    [pc.gray("Output tokens"), formatTokens(usage.outputTokens)],
    [
      pc.gray("Total tokens"),
      pc.bold(formatTokens(usage.inputTokens + usage.outputTokens)),
    ],
    ["", ""],
    [pc.gray("Estimated cost"), pc.bold(formatCost(usage.estimatedCost))],
  );

  console.log(summaryTable.toString());

  // Per-turn breakdown (last 10 turns)
  const turns = ctx.session.turns;
  const assistantTurns = turns.filter((t) => t.role === "assistant");
  const recentTurns = assistantTurns.slice(-10);

  if (recentTurns.length > 0) {
    console.log("");
    console.log(pc.bold("Recent Turns (last 10)"));

    const turnTable = new Table({
      head: [
        pc.gray("#"),
        pc.gray("Time"),
        pc.gray("Output Tokens"),
        pc.gray("Est. Cost"),
      ],
      style: { head: [] },
    });

    let turnIndex = Math.max(0, assistantTurns.length - 10);
    for (const turn of recentTurns) {
      turnIndex++;
      const tokens = turn.tokenCount ?? 0;
      // Estimate input tokens as ~2x output for a rough per-turn breakdown
      const estInputTokens = tokens * 2;
      const turnCost = calculateCost(estInputTokens, tokens);

      turnTable.push([
        pc.dim(String(turnIndex)),
        pc.dim(turn.timestamp.toLocaleTimeString()),
        formatTokens(tokens),
        formatCost(turnCost),
      ]);
    }

    console.log(turnTable.toString());
  } else {
    console.log(pc.dim("\nNo conversation turns yet."));
  }

  console.log("");
  console.log(
    pc.dim(
      "Costs are estimated using Anthropic Claude Sonnet 4 pricing ($3/M input, $15/M output).",
    ),
  );
  console.log("");
}

// ─── Total/Cumulative Usage ─────────────────────────────────────────────────

function displayTotalUsage(ctx: import("../../types/repl.js").SessionContext): void {
  // For now, total usage is the same as session usage since we don't persist
  // across sessions yet. When DB tracking is added, this will query historical data.
  const usage = ctx.tokenTracker.getUsage();

  console.log("");
  console.log(pc.bold("Cumulative Token Usage"));
  console.log(pc.dim("─".repeat(50)));

  const table = new Table({
    style: { head: [], border: [] },
  });

  table.push(
    [pc.gray("Model"), pc.cyan(ctx.config.model)],
    ["", ""],
    [pc.gray("Total input tokens"), formatTokens(usage.inputTokens)],
    [pc.gray("Total output tokens"), formatTokens(usage.outputTokens)],
    [
      pc.gray("Total tokens"),
      pc.bold(formatTokens(usage.inputTokens + usage.outputTokens)),
    ],
    ["", ""],
    [pc.gray("Total estimated cost"), pc.bold(formatCost(usage.estimatedCost))],
  );

  console.log(table.toString());
  console.log("");
  console.log(
    pc.dim(
      "Note: Cumulative tracking across sessions is not yet persisted. Showing current session only.",
    ),
  );
  console.log("");
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatTokens(count: number): string {
  if (count === 0) return pc.dim("0");
  return count.toLocaleString();
}

function formatCost(cost: number): string {
  if (cost === 0) return pc.dim("$0.0000");
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
