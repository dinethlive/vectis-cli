import pc from "picocolors";
import type { VectisError } from "../types/errors.js";

export function formatError(err: VectisError): string {
  const lines: string[] = [];
  lines.push(pc.red(`Error [${err.code}]: ${err.userMessage}`));
  if (err.suggestion) {
    lines.push(pc.yellow(`  Hint: ${err.suggestion}`));
  }
  return lines.join("\n");
}

export function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return pc.red(`Error: ${err.message}`);
  }
  return pc.red(`Error: ${String(err)}`);
}
