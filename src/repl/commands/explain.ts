import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler, SessionContext } from "../../types/repl.js";
import { getBoardsWithPage } from "../../graph/queries.js";
import { getAllComponents, getAllFlows } from "../../graph/nodes.js";
import { writeStreamDelta, endStream } from "../output.js";
import { VectisError } from "../../types/errors.js";
import { formatError } from "../error-formatter.js";
import type { Database } from "bun:sqlite";

// ─── Command ────────────────────────────────────────────────────────────────

export function explainCommand(): CommandHandler {
  return {
    name: "explain",
    description: "Explain a layer's role, relationships, and design intent",
    usage: "/explain @penpot:Shape/Name  or  /explain <board-name>",
    async execute(args, ctx) {
      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      const target = args.trim();
      if (!target) {
        console.log(pc.yellow("Usage: /explain @penpot:Shape/Name  or  /explain <board-name>"));
        return;
      }

      const sp = spinner(`Resolving "${target}"...`).start();

      try {
        // Resolve the target: could be a @penpot: reference or a board name
        const isPenpotRef = target.startsWith("@penpot:") || target.startsWith("penpot:");
        const shapeName = isPenpotRef
          ? target.replace(/^@?penpot:/, "")
          : target;

        // Try to get shape data from Penpot
        let shapeData: string = "";
        if (ctx.bridge?.mcpConnected) {
          try {
            const shape = await ctx.bridge.getShapeByName(shapeName);
            if (shape) {
              shapeData = JSON.stringify(shape, null, 2);
            }
          } catch {
            // Penpot may not be available
          }
        }

        // Get graph context
        const graphContext = gatherGraphContext(shapeName, ctx);

        if (!shapeData && !graphContext) {
          sp.fail(`Could not find "${shapeName}" in Penpot or graph DB`);
          console.log(pc.gray("Make sure the element exists and Penpot is connected, or run /pull first."));
          return;
        }

        sp.succeed(`Resolved "${shapeName}"`);

        const systemPrompt = buildExplainSystemPrompt();
        const userPrompt = buildExplainUserPrompt(
          shapeName,
          shapeData,
          graphContext,
        );

        // Store the turn
        ctx.session.turns.push({
          role: "user",
          content: `/explain ${target}`,
          timestamp: new Date(),
        });

        // Stream the response
        const abortController = new AbortController();
        ctx.state.isStreaming = true;
        ctx.state.abortController = abortController;

        console.log("");

        const gen = ctx.client.streamMessage(
          [{ role: "user", content: userPrompt }],
          {
            system: systemPrompt,
            maxTokens: 2048,
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
        sp.fail("Explain failed");
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

function gatherGraphContext(
  shapeName: string,
  ctx: SessionContext,
): string {
  const parts: string[] = [];

  if (!ctx.db) return "";

  const db = ctx.db as Database;

  // Check if it matches a board
  try {
    const boards = getBoardsWithPage(db);
    const matchedBoard = boards.find(
      (b) => b.board_name.toLowerCase() === shapeName.toLowerCase(),
    );
    if (matchedBoard) {
      parts.push(`Board: ${matchedBoard.board_name}`);
      parts.push(`Page: ${matchedBoard.page_name}`);
      parts.push(`Layout: ${matchedBoard.layout_type ?? "none"}`);
      parts.push(`Layers: ${matchedBoard.layer_count}`);
      parts.push(`Tracked: ${matchedBoard.is_tracked ? "yes" : "no"}`);
    }
  } catch {
    // Ignore query errors
  }

  // Check if it matches a component
  try {
    const components = getAllComponents(db);
    const matchedComp = components.find(
      (c) => c.name.toLowerCase() === shapeName.toLowerCase(),
    );
    if (matchedComp) {
      parts.push(`\nComponent: ${matchedComp.name}`);
      if (matchedComp.variants) {
        parts.push(`Variants: ${matchedComp.variants}`);
      }
      if (matchedComp.annotation) {
        parts.push(`Annotation: ${matchedComp.annotation}`);
      }
    }
  } catch {
    // Ignore query errors
  }

  // Check which flows this might belong to
  try {
    const flows = getAllFlows(db);
    if (flows.length > 0) {
      parts.push(`\nAvailable flows: ${flows.map((f) => f.name).join(", ")}`);
    }

    // If there's an active flow, note it
    if (ctx.state.currentFlow) {
      parts.push(`Active flow: ${ctx.state.currentFlow}`);
    }
  } catch {
    // Ignore query errors
  }

  return parts.join("\n");
}

// ─── Prompt Building ────────────────────────────────────────────────────────

function buildExplainSystemPrompt(): string {
  return `You are Vectis, an AI design engineering assistant for Penpot.

When asked to explain a design element, provide:

1. **Role**: What this element does in the design — its purpose and function.
2. **Relationships**: How it connects to other elements — parent containers, sibling elements, and child contents. What page/flow it belongs to.
3. **Design Intent**: Why this element exists — the UX goal it serves, the user need it addresses.
4. **Implementation Notes**: Technical details relevant to developers — component usage, token references, layout properties.

Be concise but thorough. If you can infer the element's purpose from its name, hierarchy, or properties, do so. Reference specific properties from the shape data when available.`;
}

function buildExplainUserPrompt(
  shapeName: string,
  shapeData: string,
  graphContext: string,
): string {
  const parts = [`Explain the design element "${shapeName}".`];

  if (shapeData) {
    parts.push("", "--- Shape Data from Penpot ---", shapeData);
  }

  if (graphContext) {
    parts.push("", "--- Graph Context ---", graphContext);
  }

  if (!shapeData && !graphContext) {
    parts.push(
      "",
      "No detailed data available. Explain based on the element name and common design conventions.",
    );
  }

  parts.push(
    "",
    "Explain its role, relationships, design intent, and any implementation notes.",
  );

  return parts.join("\n");
}
