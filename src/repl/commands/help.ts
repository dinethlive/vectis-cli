import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import type { SlashRouter } from "../slash-router.js";

export function helpCommand(router: SlashRouter): CommandHandler {
  return {
    name: "help",
    description: "Show available commands",
    usage: "/help [command]",
    async execute(args, ctx) {
      if (args) {
        const cmd = router.getCommand(args);
        if (!cmd) {
          console.log(pc.red(`Unknown command: ${args}`));
          return;
        }
        console.log(pc.bold(`/${cmd.name}`) + " — " + cmd.description);
        if (cmd.usage) console.log(pc.gray(`Usage: ${cmd.usage}`));
        return;
      }

      const table = new Table({
        head: [pc.bold("Command"), pc.bold("Description")],
        style: { head: [], border: [] },
      });

      for (const cmd of router.getAllCommands()) {
        table.push([pc.green(`/${cmd.name}`), cmd.description]);
      }
      console.log(table.toString());
    },
  };
}
