import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";
import { resolveReferences } from "../../references/resolver.js";
import { assembleContext } from "../../workspace/context-assembler.js";
import { writeStreamDelta, endStream } from "../output.js";
import { VectisError } from "../../types/errors.js";
import { formatError } from "../error-formatter.js";

export function askCommand(): CommandHandler {
  return {
    name: "ask",
    description: "Ask Claude a question with optional @references",
    usage: '/ask "question" @file @penpot:Board',
    async execute(args, ctx) {
      if (!args.trim()) {
        console.log(pc.yellow("Usage: /ask <question> [@references...]"));
        return;
      }

      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      try {
        const refs = await resolveReferences(args, ctx);
        if (refs.length > 0) {
          console.log(pc.dim(`Resolved ${refs.length} reference(s), ~${refs.reduce((s, r) => s + r.tokenEstimate, 0).toLocaleString()} tokens`));
        }

        const { messages, system } = assembleContext(args, refs, ctx);

        ctx.session.turns.push({ role: "user", content: args, timestamp: new Date() });

        const abortController = new AbortController();
        ctx.state.isStreaming = true;
        ctx.state.abortController = abortController;

        const gen = ctx.client.streamMessage(messages, {
          system,
          signal: abortController.signal,
        });

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
