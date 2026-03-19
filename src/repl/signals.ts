import type { SessionContext } from "../types/repl.js";

let shutdownContext: SessionContext | null = null;
let isShuttingDown = false;

export function setShutdownContext(ctx: SessionContext): void {
  shutdownContext = ctx;
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (shutdownContext) {
    const ctx = shutdownContext;

    // Abort any active stream
    if (ctx.state.isStreaming && ctx.state.abortController) {
      ctx.state.abortController.abort();
    }

    // Close readline
    if (ctx.rl) {
      ctx.rl.close();
    }

    ctx.logger.debug(`Shutting down on ${signal}...`);
  }

  process.exit(0);
}

export function setupSignalHandlers(): void {
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("beforeExit", () => {
    if (!isShuttingDown) gracefulShutdown("beforeExit");
  });
}

export function handleCtrlC(ctx: SessionContext): void {
  if (ctx.state.isStreaming && ctx.state.abortController) {
    ctx.state.abortController.abort();
    ctx.state.isStreaming = false;
    ctx.state.abortController = null;
    process.stdout.write("\n");
  } else if (ctx.state.mode !== "NORMAL") {
    ctx.state.mode = "NORMAL";
    console.log("\nReturned to normal mode.");
  }
  // NORMAL idle: do nothing (readline handles the hint)
}
