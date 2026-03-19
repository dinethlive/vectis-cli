import pc from "picocolors";
import { vc } from "./theme.js";
import type { ReplState } from "../types/repl.js";

export function getPrompt(state: ReplState): string {
  const modeIndicator   = getModeIndicator(state.mode);
  const flowIndicator   = state.currentFlow ? vc.light(` [${state.currentFlow}]`) : "";
  const streamIndicator = state.isStreaming ? vc.bright(" ···") : "";

  return `${modeIndicator}${flowIndicator}${streamIndicator} ${vc.vivid(">")} `;
}

function getModeIndicator(mode: string): string {
  switch (mode) {
    case "NORMAL":
      return pc.bold(vc.bright("vectis"));
    case "GEN_PREVIEW":
      return pc.bold(vc.medium("preview"));
    case "STRUCTURE_CONV":
      return pc.bold(vc.light("structure"));
    case "VIM_NORMAL":
      return pc.bold(pc.yellow("VIM:N"));
    case "VIM_INSERT":
      return pc.bold(pc.yellow("VIM:I"));
    default:
      return pc.bold(vc.bright("vectis"));
  }
}
