import pc from "picocolors";
import type { CommandHandler, SessionContext } from "../../types/repl.js";
import { getBoardsByFlow, getFlowWithScreenCount } from "../../graph/queries.js";
import { getAllTokenSets } from "../../graph/nodes.js";
import { VectorStore } from "../../ai/rag.js";
import { writeStreamDelta, endStream } from "../output.js";
import { VectisError } from "../../types/errors.js";
import { formatError } from "../error-formatter.js";
import type { Database } from "bun:sqlite";

// ─── Command ────────────────────────────────────────────────────────────────

export function analyzeCommand(): CommandHandler {
  return {
    name: "analyze",
    description: "Deep analysis of a flow or the current flow",
    usage: "/analyze [flow-name]",
    async execute(args, ctx) {
      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      const flowName = args.trim() || ctx.state.currentFlow;

      if (!flowName) {
        console.log(pc.yellow("Usage: /analyze <flow-name>"));
        console.log(pc.gray("  Or set an active flow with /flow <name>, then run /analyze"));
        return;
      }

      console.log(pc.dim(`Analyzing flow "${flowName}"...`));

      try {
        // Gather flow context
        const flowContext = gatherFlowContext(flowName, ctx);

        // Gather boards in this flow
        const boardsContext = gatherFlowBoards(flowName, ctx);

        // Run RAG search for relevant documents
        const ragContext = gatherRagContext(flowName, ctx);

        const systemPrompt = buildAnalyzeSystemPrompt();
        const userPrompt = buildAnalyzeUserPrompt(
          flowName,
          flowContext,
          boardsContext,
          ragContext,
        );

        // Store the turn
        ctx.session.turns.push({
          role: "user",
          content: `/analyze ${flowName}`,
          timestamp: new Date(),
        });

        // Stream the response
        const abortController = new AbortController();
        ctx.state.isStreaming = true;
        ctx.state.abortController = abortController;

        console.log("");
        console.log(pc.bold(`Flow Analysis: ${flowName}`));
        console.log(pc.dim("─".repeat(50)));
        console.log("");

        const gen = ctx.client.streamMessage(
          [{ role: "user", content: userPrompt }],
          {
            system: systemPrompt,
            maxTokens: 4096,
            signal: abortController.signal,
          },
        );

        let result;
        for (;;) {
          const next = await gen.next();
          if (next.done) {
            result = next.value;
            break;
          }
          writeStreamDelta(next.value);
        }
        endStream();

        ctx.state.isStreaming = false;
        ctx.state.abortController = null;

        ctx.session.turns.push({
          role: "assistant",
          content: result.content,
          timestamp: new Date(),
          tokenCount: result.outputTokens,
        });
        ctx.tokenTracker.record(result.inputTokens, result.outputTokens);
      } catch (err) {
        ctx.state.isStreaming = false;
        ctx.state.abortController = null;
        if (err instanceof VectisError) {
          console.log(formatError(err));
        } else if (err instanceof Error) {
          console.log(pc.red(`Error: ${err.message}`));
        }
      }
    },
  };
}

// ─── Data Gathering ─────────────────────────────────────────────────────────

function gatherFlowContext(flowName: string, ctx: SessionContext): string {
  const parts: string[] = [];

  if (ctx.db) {
    try {
      const db = ctx.db as Database;
      const flow = getFlowWithScreenCount(db, flowName);
      if (flow) {
        parts.push(`Flow: ${flow.name}`);
        parts.push(`Expected screens: ${flow.screen_count}`);
        parts.push(`Actual boards: ${flow.actual_board_count}`);
        if (flow.context_path) {
          parts.push(`Context path: ${flow.context_path}`);
        }
      }
    } catch {
      // DB may not be available
    }
  }

  if (parts.length === 0) {
    parts.push(`Flow "${flowName}" — no metadata in graph DB.`);
  }

  return parts.join("\n");
}

function gatherFlowBoards(flowName: string, ctx: SessionContext): string {
  if (!ctx.db) return "No board data available (no graph DB).";

  try {
    const db = ctx.db as Database;
    const boards = getBoardsByFlow(db, flowName);

    if (boards.length === 0) {
      return `No boards found for flow "${flowName}".`;
    }

    const lines = boards.map(
      (b) =>
        `  - ${b.board_name} (page: ${b.page_name}, layers: ${b.layer_count}, layout: ${b.layout_type ?? "none"})`,
    );
    return `Boards in flow (${boards.length}):\n${lines.join("\n")}`;
  } catch {
    return "Failed to query boards for flow.";
  }
}

function gatherRagContext(flowName: string, ctx: SessionContext): string {
  if (!ctx.config.projectRoot) return "";

  try {
    const store = new VectorStore();
    store.buildIndex(ctx.config.projectRoot);

    if (store.size === 0) return "";

    const results = store.search(flowName, 3);
    if (results.length === 0) return "";

    const parts = results.map(
      (r) =>
        `--- ${r.document.metadata.type}: ${r.document.metadata.name} (relevance: ${r.score.toFixed(2)}) ---\n${r.document.content.slice(0, 1000)}`,
    );
    return "Relevant context from project:\n" + parts.join("\n\n");
  } catch {
    return "";
  }
}

// ─── Prompt Building ────────────────────────────────────────────────────────

function buildAnalyzeSystemPrompt(): string {
  return `You are Vectis, an AI design engineering analyst for Penpot.

Perform a deep analysis of the given flow. Structure your response with these sections:

## Overview
Brief summary of the flow's purpose and scope.

## Friction Points
Identify UX friction points — steps that are confusing, redundant, or require unnecessary effort.

## Inconsistencies
Flag visual or interaction inconsistencies across boards in the flow (spacing, naming, patterns).

## Missing States
Identify missing states: loading, empty, error, edge cases, confirmation dialogs.

## Accessibility
Flag accessibility concerns: contrast, text sizing, touch targets, keyboard navigation, screen reader support.

## Recommendations
Prioritized list of concrete improvements.

Be specific — reference board names and elements. Use concise language.`;
}

function buildAnalyzeUserPrompt(
  flowName: string,
  flowContext: string,
  boardsContext: string,
  ragContext: string,
): string {
  const parts = [
    `Analyze the flow "${flowName}" in depth.`,
    "",
    "--- Flow Metadata ---",
    flowContext,
    "",
    "--- Boards ---",
    boardsContext,
  ];

  if (ragContext) {
    parts.push("", "--- Additional Context ---", ragContext);
  }

  parts.push(
    "",
    "Provide a structured analysis covering: friction points, inconsistencies, missing states, accessibility, and recommendations.",
  );

  return parts.join("\n");
}
