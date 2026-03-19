import readline from "node:readline";
import { randomUUID } from "node:crypto";
import pc from "picocolors";
import type { VectisConfig } from "../types/config.js";
import type { SessionContext, SessionInfo, ConversationTurn } from "../types/repl.js";
import { createInitialState } from "../types/repl.js";
import { ClaudeClient } from "../ai/client.js";
import { TokenTracker } from "../ai/token-counter.js";
import { PenpotBridge } from "../bridge/penpot.js";
import { SkillRegistry } from "../skills/registry.js";
import { SlashRouter } from "./slash-router.js";
import { getPrompt } from "./prompt.js";
import { writeStreamDelta, endStream } from "./output.js";
import { setShutdownContext, handleCtrlC } from "./signals.js";
import { formatError, formatUnknownError } from "./error-formatter.js";
import { resolveReferences } from "../references/resolver.js";
import { assembleContext } from "../workspace/context-assembler.js";
import { registerAllCommands } from "./commands/index.js";
import { VectisError } from "../types/errors.js";
import type { Logger } from "../utils/logger.js";
import { getGlobalSkillsDir, findProjectRoot } from "../config/paths.js";
import { installBuiltInSkills } from "../skills/installer.js";
import { createCompleter } from "./completer.js";
import { showCommandHints, clearHints } from "./hints.js";
import path from "node:path";

export interface ReplOptions {
  config: VectisConfig;
  logger: Logger;
  verbose: boolean;
}

export async function startRepl(options: ReplOptions): Promise<void> {
  const { config, logger, verbose } = options;

  // Init session
  const session: SessionInfo = {
    id: randomUUID(),
    startedAt: new Date(),
    turns: [],
  };

  // Init AI client if key available
  let client: ClaudeClient | null = null;
  if (config.apiKey) {
    client = new ClaudeClient({
      apiKey: config.apiKey,
      model: config.model,
      logger,
    });
    logger.debug(`AI client initialized with model ${config.model}`);
  } else {
    logger.debug("No API key — AI features disabled. Run /init to configure.");
  }

  // Init Penpot bridge if project has a file ID configured
  let bridge: PenpotBridge | null = null;
  if (config.project.penpotFileId) {
    bridge = new PenpotBridge({
      mcpUrl: config.mcpServerUrl,
      wsUrl: config.wsServerUrl,
      fileId: config.project.penpotFileId,
      logger,
    });
    try {
      const ok = await bridge.testConnection();
      if (ok) {
        logger.debug(`Penpot bridge connected (file ${config.project.penpotFileId})`);
      } else {
        logger.debug("Penpot MCP server not reachable — bridge inactive");
        bridge = null;
      }
    } catch {
      logger.debug("Penpot bridge connection failed — bridge inactive");
      bridge = null;
    }
  }

  // Init skills — ensure built-in skills exist, then discover
  const skills = new SkillRegistry(logger);
  installBuiltInSkills(getGlobalSkillsDir());
  skills.discoverFromDir(getGlobalSkillsDir());
  if (config.projectRoot) {
    skills.discoverFromDir(path.join(config.projectRoot, ".vectis", "skills"));
    skills.discoverFromDir(path.join(config.projectRoot, "context", "skills"));
  }

  // Init state
  const state = createInitialState();
  const tokenTracker = new TokenTracker();

  // Router
  const router = new SlashRouter();

  // Build context
  const ctx: SessionContext = {
    config,
    client,
    bridge,
    db: null,
    state,
    session,
    skills,
    logger,
    tokenTracker,
    rl: null,
    pendingInput: null,
    pendingAction: null,
  };

  registerAllCommands(router, ctx);
  setShutdownContext(ctx);

  // Readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(state),
    completer: createCompleter(router, ctx),
  });
  ctx.rl = rl;

  // Show command hints as user types /
  let hintDebounce: ReturnType<typeof setTimeout> | null = null;
  process.stdin.on("keypress", () => {
    // Debounce to avoid flickering
    if (hintDebounce) clearTimeout(hintDebounce);
    hintDebounce = setTimeout(() => {
      const line = (rl as any).line as string | undefined;
      if (!line) {
        clearHints();
        return;
      }
      if (line.startsWith("/") && !line.includes(" ")) {
        clearHints();
        showCommandHints(line, router);
      } else {
        clearHints();
      }
    }, 50);
  });

  // Handle Ctrl+C
  rl.on("SIGINT", () => {
    handleCtrlC(ctx);
    rl.setPrompt(getPrompt(state));
    rl.prompt();
  });

  // Helper: re-display prompt after async work completes
  const reprompt = (): void => {
    rl.setPrompt(getPrompt(state));
    rl.prompt();
  };

  // IMPORTANT: handler must be synchronous — Bun's readline serializes
  // async handlers and won't deliver new line events until the previous
  // async handler fully resolves. Use .then() for async work instead.
  rl.on("line", (input: string) => {
    clearHints();

    // If a command is waiting for input (e.g. /init asking questions), route to it
    if (ctx.pendingInput) {
      const resolve = ctx.pendingInput;
      ctx.pendingInput = null;
      resolve(input);
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      reprompt();
      return;
    }

    // Multi-step action (e.g. /create preview p/e/r/s/q)
    if (ctx.pendingAction) {
      ctx.pendingAction.handle(trimmed, ctx)
        .then(() => reprompt())
        .catch((err) => {
          if (err instanceof VectisError) {
            console.log(formatError(err));
          } else {
            console.log(formatUnknownError(err));
          }
          reprompt();
        });
      return;
    }

    // Multi-line continuation
    if (trimmed.endsWith("\\")) {
      // TODO: accumulate multi-line input
      rl.setPrompt(pc.gray("... "));
      rl.prompt();
      return;
    }

    // Slash command
    if (router.isCommand(trimmed)) {
      router.dispatch(trimmed, ctx)
        .then(() => reprompt())
        .catch((err) => {
          if (err instanceof VectisError) {
            console.log(formatError(err));
          } else {
            console.log(formatUnknownError(err));
          }
          reprompt();
        });
      return;
    }

    // Freeform → send to Claude
    handleFreeformInput(trimmed, ctx)
      .then(() => reprompt())
      .catch((err) => {
        if (err instanceof VectisError) {
          console.log(formatError(err));
        } else {
          console.log(formatUnknownError(err));
        }
        reprompt();
      });
  });

  rl.on("close", () => {
    console.log(pc.dim("\nGoodbye!"));
    process.exit(0);
  });

  // Print initial status hints
  if (!config.apiKey) {
    console.log(pc.yellow("No API key configured. Run /init to get started."));
  }
  if (!config.projectRoot) {
    console.log(pc.yellow("No .vectis/ project found. Run /init to initialize."));
  }

  rl.prompt();
}

async function handleFreeformInput(input: string, ctx: SessionContext): Promise<void> {
  if (!ctx.client) {
    console.log(pc.yellow("No API key configured. Run /init to set up."));
    return;
  }

  try {
    // Resolve @references
    const refs = await resolveReferences(input, ctx);
    const { messages, system } = assembleContext(input, refs, ctx);

    // Record user turn
    ctx.session.turns.push({
      role: "user",
      content: input,
      timestamp: new Date(),
    });

    // Stream response
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

    // Record assistant turn + tokens
    ctx.session.turns.push({
      role: "assistant",
      content: result.content,
      timestamp: new Date(),
      tokenCount: result.outputTokens,
    });

    ctx.tokenTracker.record(result.inputTokens, result.outputTokens);
    ctx.logger.debug(
      `Tokens: ${result.inputTokens} in / ${result.outputTokens} out`,
    );
  } catch (err) {
    ctx.state.isStreaming = false;
    ctx.state.abortController = null;

    if (err instanceof VectisError) {
      console.log(formatError(err));
    } else {
      console.log(formatUnknownError(err));
    }
  }
}
