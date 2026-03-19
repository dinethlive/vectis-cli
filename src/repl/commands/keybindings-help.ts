import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import type { Keybinding } from "../keybindings.js";

interface KeyGroup {
  name: string;
  bindings: Keybinding[];
}

const ACTION_GROUPS: Record<string, string> = {
  interrupt: "Navigation",
  exit: "Navigation",
  clear: "Navigation",
  "history-prev": "Navigation",
  "history-next": "Navigation",
  "external-editor": "Editing",
  paste: "Editing",
  copy: "Editing",
  undo: "Editing",
  redo: "Editing",
  "vim-normal": "Mode switching",
  "vim-insert": "Mode switching",
  "toggle-mode": "Mode switching",
};

function categorize(bindings: Keybinding[]): KeyGroup[] {
  const groups = new Map<string, Keybinding[]>();

  for (const binding of bindings) {
    const groupName = ACTION_GROUPS[binding.action] ?? "Custom";
    const list = groups.get(groupName) ?? [];
    list.push(binding);
    groups.set(groupName, list);
  }

  // Sort groups: Navigation, Editing, Mode switching, Custom
  const order = ["Navigation", "Editing", "Mode switching", "Custom"];
  const result: KeyGroup[] = [];

  for (const name of order) {
    const binds = groups.get(name);
    if (binds && binds.length > 0) {
      result.push({ name, bindings: binds });
    }
  }

  // Any remaining groups not in the predefined order
  for (const [name, binds] of groups) {
    if (!order.includes(name) && binds.length > 0) {
      result.push({ name, bindings: binds });
    }
  }

  return result;
}

function formatKey(key: string): string {
  return key
    .split("+")
    .map((part) => {
      switch (part.toLowerCase()) {
        case "ctrl":
          return "Ctrl";
        case "alt":
          return "Alt";
        case "shift":
          return "Shift";
        case "option":
          return "Opt";
        default:
          return part.toUpperCase();
      }
    })
    .join("+");
}

function formatAction(action: string): string {
  return action
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function keybindingsHelpCommand(): CommandHandler {
  return {
    name: "keybindings",
    description: "Show all keybindings",
    usage: "/keybindings",
    async execute(_args, ctx) {
      // Access keybindings from the session context config or fallback to defaults
      const defaultBindings: Keybinding[] = [
        { key: "ctrl+c", action: "interrupt" },
        { key: "ctrl+d", action: "exit" },
        { key: "ctrl+l", action: "clear" },
        { key: "ctrl+g", action: "external-editor" },
        { key: "ctrl+p", action: "history-prev" },
        { key: "ctrl+n", action: "history-next" },
      ];

      const bindings = defaultBindings;
      const groups = categorize(bindings);

      console.log(pc.bold("\nKeybindings\n"));

      for (const group of groups) {
        const table = new Table({
          head: [pc.bold("Key"), pc.bold("Action")],
          style: { head: [], border: [] },
          colWidths: [20, 30],
        });

        for (const binding of group.bindings) {
          table.push([
            pc.yellow(formatKey(binding.key)),
            formatAction(binding.action),
          ]);
        }

        console.log(pc.bold(pc.cyan(`  ${group.name}`)));
        console.log(table.toString());
        console.log("");
      }

      console.log(
        pc.gray(
          "  Custom keybindings: ~/.vectis/keybindings.json or .vectis/keybindings.json",
        ),
      );
    },
  };
}

/**
 * Alias — /keys also works
 */
export function keysCommand(): CommandHandler {
  const cmd = keybindingsHelpCommand();
  return {
    ...cmd,
    name: "keys",
    description: "Show all keybindings (alias for /keybindings)",
  };
}
