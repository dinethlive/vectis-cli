import pc from "picocolors";
import type { CommandHandler, SessionContext } from "../types/repl.js";
import { VectisError } from "../types/errors.js";
import { formatError } from "./error-formatter.js";

export class SlashRouter {
  private commands = new Map<string, CommandHandler>();

  register(handler: CommandHandler): void {
    this.commands.set(handler.name, handler);
  }

  getCommand(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): CommandHandler[] {
    return Array.from(this.commands.values());
  }

  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  isCommand(input: string): boolean {
    return input.startsWith("/");
  }

  parse(input: string): { command: string; args: string } | null {
    if (!this.isCommand(input)) return null;
    const trimmed = input.slice(1).trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) {
      return { command: trimmed, args: "" };
    }
    return {
      command: trimmed.slice(0, spaceIdx),
      args: trimmed.slice(spaceIdx + 1).trim(),
    };
  }

  async dispatch(input: string, ctx: SessionContext): Promise<boolean> {
    const parsed = this.parse(input);
    if (!parsed) return false;

    const handler = this.commands.get(parsed.command);
    if (!handler) {
      console.log(
        pc.red(`Unknown command: /${parsed.command}`) +
          "\n" +
          pc.gray("Type /help to see available commands."),
      );
      return true;
    }

    try {
      await handler.execute(parsed.args, ctx);
    } catch (err) {
      if (err instanceof VectisError) {
        console.log(formatError(err));
      } else if (err instanceof Error) {
        console.log(pc.red(`Error: ${err.message}`));
      }
    }

    return true;
  }
}
