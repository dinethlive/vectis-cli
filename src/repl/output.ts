import pc from "picocolors";
import { vc } from "./theme.js";

export function writeStreamDelta(text: string): void {
  process.stdout.write(text);
}

export function endStream(): void {
  process.stdout.write("\n\n");
}

export function printInfo(msg: string): void {
  console.log(vc.bright(msg));
}

export function printSuccess(msg: string): void {
  console.log(pc.green(msg));
}

export function printWarning(msg: string): void {
  console.log(pc.yellow(msg));
}

export function printError(msg: string): void {
  console.log(pc.red(msg));
}

export function printDim(msg: string): void {
  console.log(pc.gray(msg));
}

/**
 * Humanize a model ID into a readable name.
 * e.g. "claude-sonnet-4-20250514" -> "Claude Sonnet 4"
 *      "claude-opus-4-20250514"   -> "Claude Opus 4"
 *      "claude-3-5-haiku-20241022" -> "Claude 3.5 Haiku"
 */
export function formatModelName(model: string): string {
  // Strip date suffix (e.g., -20250514)
  const withoutDate = model.replace(/-\d{8}$/, "");

  // Known model family patterns
  const patterns: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
    {
      regex: /^claude-(\w+)-(\d+)$/,
      format: (m) => `Claude ${capitalize(m[1])} ${m[2]}`,
    },
    {
      regex: /^claude-(\d+)-(\d+)-(\w+)$/,
      format: (m) => `Claude ${m[1]}.${m[2]} ${capitalize(m[3])}`,
    },
    {
      regex: /^claude-(\d+)-(\w+)$/,
      format: (m) => `Claude ${m[1]} ${capitalize(m[2])}`,
    },
  ];

  for (const { regex, format } of patterns) {
    const match = withoutDate.match(regex);
    if (match) return format(match);
  }

  // Fallback: capitalize each segment
  return withoutDate
    .split("-")
    .map(capitalize)
    .join(" ");
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Print a model badge in the prompt area.
 */
export function printModelBadge(model: string): void {
  const name = formatModelName(model);
  process.stdout.write(pc.gray("[") + vc.bright(name) + pc.gray("] "));
}
