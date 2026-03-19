import pc from "picocolors";
import os from "node:os";
import type { CommandHandler } from "../../types/repl.js";

export function terminalSetupCommand(): CommandHandler {
  return {
    name: "terminal-setup",
    description: "Show terminal configuration tips",
    async execute(args, ctx) {
      const platform = os.platform();
      const termProgram = process.env.TERM_PROGRAM || "unknown";

      console.log(pc.bold("\nTerminal Setup\n"));
      console.log(`  Platform: ${platform}`);
      console.log(`  Terminal: ${termProgram}`);
      console.log("");

      console.log(pc.bold("Multi-line input:"));
      console.log("  End a line with \\ to continue on the next line");
      console.log("");

      if (platform === "win32") {
        console.log(pc.bold("Windows tips:"));
        console.log("  - Use Windows Terminal for best experience");
        console.log("  - Alt key works as modifier (not Option)");
        console.log("  - Ctrl+C to interrupt, Ctrl+D to exit");
      } else if (platform === "darwin") {
        console.log(pc.bold("macOS tips:"));
        console.log("  - Option+Enter for Shift+Enter in most terminals");
        console.log("  - iTerm2: Preferences > Keys > map Option+Enter");
      } else {
        console.log(pc.bold("Linux tips:"));
        console.log("  - Alt key works as modifier");
        console.log("  - Ctrl+C to interrupt, Ctrl+D to exit");
      }
    },
  };
}
