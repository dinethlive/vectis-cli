import pc from "picocolors";
import type { CommandHandler } from "../../types/repl.js";

export function contextCommand(): CommandHandler {
  return {
    name: "context",
    description: "Show current context state",
    async execute(args, ctx) {
      console.log(pc.bold("Context State"));
      console.log(`  Mode:         ${ctx.state.mode}`);
      console.log(`  Flow:         ${ctx.state.currentFlow || "(none)"}`);
      console.log(`  Boards:       ${ctx.state.activeBoards.join(", ") || "(none)"}`);
      console.log(`  Streaming:    ${ctx.state.isStreaming}`);
      console.log(`  Project root: ${ctx.config.projectRoot || "(not initialized)"}`);
      console.log(`  Model:        ${ctx.config.model}`);
      console.log(`  API key:      ${ctx.config.apiKey ? "configured" : "not set"}`);
      console.log(`  MCP server:   ${ctx.config.mcpServerUrl}`);
    },
  };
}
