import pc from "picocolors";
import { vc } from "./theme.js";
import type { SlashRouter } from "./slash-router.js";

// Command examples shown when typing /
const COMMAND_EXAMPLES: Record<string, string> = {
  init: "Set up Vectis in this project",
  doctor: "Check API key, Penpot, MCP status",
  ask: '/ask "what tokens do we use?" @context/tokens.json',
  pull: "Scan Penpot file for pages, boards, tokens",
  create: '/create Login "A clean login screen with email, password, sign-in button"',
  structure: "/structure @briefs/  — analyze project files into flows & screens",
  flow: "/flow onboarding  — set active flow",
  flows: "List all flows",
  checkout: "/checkout dashboard  — switch to a flow and load context",
  audit: "/audit Dashboard/Home  — check board against design rules",
  analyze: "/analyze onboarding  — deep analysis of a flow",
  explain: "/explain @penpot:Dashboard/Home  — explain a board's role",
  skill: "/skill list | show | add | new | enable | disable",
  token: "/token pull | push | show | diff",
  status: "Show flow, boards, Penpot connection, tokens",
  context: "Show current mode, model, project root",
  memory: "Show loaded skills and token counts",
  usage: "Show token usage and estimated cost",
  history: "List or load past conversations",
  compact: "Compress conversation history to save tokens",
  log: "Show recent conversation turns",
  pending: "List/approve/reject pending boards",
  help: "/help [command]  — detailed help for a command",
  clear: "Clear the terminal",
  exit: "Save session and quit",
  bug: "Open a pre-filled GitHub issue",
  keybindings: "Show all keyboard shortcuts",
  "terminal-setup": "Platform-specific terminal tips",
};

let hintsVisible = false;

/**
 * Clear any hints below the prompt line.
 * Uses save/restore cursor + erase-below so we never scroll the terminal.
 */
export function clearHints(): void {
  if (!hintsVisible) return;
  // Save cursor, move to next line, erase everything below, restore cursor
  process.stdout.write("\x1b[s\x1b[1B\x1b[J\x1b[u");
  hintsVisible = false;
}

/**
 * Show matching command hints below the current prompt line.
 * Uses save/restore cursor so readline's cursor position stays correct.
 */
export function showCommandHints(input: string, router: SlashRouter): void {
  if (!input.startsWith("/")) return;

  const partial = input.slice(1).toLowerCase();
  const allCommands = router.getAllCommands();

  // Filter matching commands
  const matches = allCommands.filter((cmd) => cmd.name.startsWith(partial));

  if (matches.length === 0 || matches.length > 12) return;

  // Build hint lines
  const lines: string[] = [];
  const maxNameLen = Math.max(...matches.map((m) => m.name.length));

  for (const cmd of matches.slice(0, 8)) {
    const example = COMMAND_EXAMPLES[cmd.name] || cmd.description;
    const paddedName = cmd.name.padEnd(maxNameLen);
    lines.push(`  ${vc.bright(`/${paddedName}`)}  ${pc.gray(example)}`);
  }

  if (matches.length > 8) {
    lines.push(pc.gray(`  ... and ${matches.length - 8} more`));
  }

  // Save cursor → move down 1 → erase below → write hints → restore cursor
  process.stdout.write(
    "\x1b[s" +                    // save cursor position
    "\x1b[1B" +                   // move down one line
    "\x1b[J" +                    // erase from cursor to end of screen
    lines.join("\n") +            // write hint lines
    "\x1b[u"                      // restore cursor position
  );
  hintsVisible = true;
}
