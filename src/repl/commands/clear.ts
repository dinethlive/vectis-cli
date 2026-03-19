import type { CommandHandler } from "../../types/repl.js";

export function clearCommand(): CommandHandler {
  return {
    name: "clear",
    description: "Clear the terminal",
    async execute() {
      console.clear();
    },
  };
}
