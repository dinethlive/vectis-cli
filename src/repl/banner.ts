import pc from "picocolors";
import { VERSION } from "../constants.js";
import { vc } from "./theme.js";

export function printBanner(): void {
  const W      = 52; // box inner width
  const border = (s: string) => vc.vivid(s);
  const dim    = (s: string) => pc.dim(s);

  const top    = "  " + border("╭" + "─".repeat(W) + "╮");
  const sep    = "  " + border("│") + " ".repeat(W) + border("│");
  const bottom = "  " + border("╰" + "─".repeat(W) + "╯");

  // Row helper: 1 leading space + styled content + right-pad to fill W
  const r = (styled: string, visLen: number): string => {
    const pad = " ".repeat(Math.max(0, W - 1 - visLen));
    return "  " + border("│") + " " + styled + pad + border("│");
  };

  // Gradient accent bar — exactly W (52) visual chars, pale→vivid left→right
  const accentBar =
    vc.pale("░".repeat(9)) +
    vc.light("░".repeat(9)) +
    vc.bright("▒".repeat(10)) +
    vc.medium("▓".repeat(12)) +
    vc.vivid("█".repeat(12));

  // ANSI-shadow "VECTIS" — each row is 45 visual chars + 3 leading spaces = 48
  // Gradient: pale (top) → deep (bottom)
  const logo: Array<[string, (t: string) => string]> = [
    ["   ██╗   ██╗███████╗ ██████╗████████╗██╗███████╗", vc.light],
    ["   ██║   ██║██╔════╝██╔════╝╚══██╔══╝██║██╔════╝", vc.bright],
    ["   ██║   ██║█████╗  ██║        ██║   ██║███████╗", vc.medium],
    ["   ╚██╗ ██╔╝██╔══╝  ██║        ██║   ██║╚════██║", vc.medium],
    ["    ╚████╔╝ ███████╗╚██████╗   ██║   ██║███████║", vc.vivid],
    ["     ╚═══╝  ╚══════╝ ╚═════╝   ╚═╝   ╚═╝╚══════╝", vc.deep],
  ];

  const vStr    = `v${VERSION}`;
  const hint    = "Type /help for commands";
  const sub2vis = 2 + vStr.length + 5 + hint.length;

  console.log();
  console.log(top);
  // Accent bar fills exactly W inner chars — no r() needed
  console.log("  " + border("│") + accentBar + border("│"));
  console.log(sep);
  for (const [text, color] of logo) {
    console.log(r(pc.bold(color(text)), 48));
  }
  console.log(sep);
  console.log(r(vc.light("  AI-driven design engineering for Penpot"), 42));
  console.log(
    r(
      "  " + dim(vStr) + "  " + vc.vivid("·") + "  " + dim(hint),
      sub2vis,
    ),
  );
  console.log(sep);
  console.log(bottom);
  console.log();
}
