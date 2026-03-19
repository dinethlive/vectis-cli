import pc from "picocolors";

const PASTE_THRESHOLD_MS = 50;
const PREVIEW_LINES = 5;

export type PasteResult =
  | { type: "char"; char: string }
  | { type: "paste-detected"; content: string }
  | { type: "accumulating" };

export type PasteConfirmResult =
  | { type: "confirmed"; content: string }
  | { type: "edit"; content: string }
  | { type: "aborted" };

export class PasteDetector {
  private lastInputTime = 0;
  private accumulatedChars: string[] = [];
  private isPasting = false;
  private pasteTimeout: ReturnType<typeof setTimeout> | null = null;

  onInput(char: string, timestamp: number): PasteResult {
    const elapsed = timestamp - this.lastInputTime;
    this.lastInputTime = timestamp;

    if (this.isPasting) {
      // Still within paste threshold — accumulate
      this.accumulatedChars.push(char);
      this.resetPasteTimeout();
      return { type: "accumulating" };
    }

    if (elapsed < PASTE_THRESHOLD_MS && this.accumulatedChars.length > 0) {
      // Rapid successive input detected — enter paste mode
      this.isPasting = true;
      this.accumulatedChars.push(char);
      this.resetPasteTimeout();
      return { type: "accumulating" };
    }

    // Check if this is part of a multi-char burst
    if (this.accumulatedChars.length > 0 && elapsed < PASTE_THRESHOLD_MS) {
      this.accumulatedChars.push(char);
      this.isPasting = true;
      this.resetPasteTimeout();
      return { type: "accumulating" };
    }

    // Single char — store it but return as normal char
    // The previous accumulation (if any) is already handled
    this.accumulatedChars = [char];
    this.resetPasteTimeout();
    return { type: "char", char };
  }

  private resetPasteTimeout(): void {
    if (this.pasteTimeout) {
      clearTimeout(this.pasteTimeout);
    }
    // This will be checked externally
  }

  /**
   * Call this when the paste timeout fires (PASTE_THRESHOLD_MS after last input)
   * to finalize accumulated content.
   */
  finalize(): PasteResult {
    const content = this.accumulatedChars.join("");
    const wasPasting = this.isPasting;

    // Reset state
    this.accumulatedChars = [];
    this.isPasting = false;

    if (wasPasting && content.length > 1) {
      return { type: "paste-detected", content };
    }

    if (content.length === 1) {
      return { type: "char", char: content };
    }

    return { type: "char", char: content };
  }

  /**
   * Returns the paste detection threshold in ms.
   */
  static get threshold(): number {
    return PASTE_THRESHOLD_MS;
  }

  /**
   * Formats a paste preview for display.
   */
  static formatPreview(content: string): string {
    const lines = content.split("\n");
    const previewLines = lines.slice(0, PREVIEW_LINES);
    const output: string[] = [];

    output.push(pc.bold("Paste detected:"));
    output.push(pc.dim("─".repeat(40)));

    for (const line of previewLines) {
      const displayLine = line.length > 60 ? line.slice(0, 57) + "..." : line;
      output.push(`  ${displayLine}`);
    }

    if (lines.length > PREVIEW_LINES) {
      output.push(pc.dim(`  ... and ${lines.length - PREVIEW_LINES} more line(s)`));
    }

    output.push(pc.dim("─".repeat(40)));
    output.push(pc.dim("(c)onfirm / (e)dit / (a)bort"));

    return output.join("\n");
  }

  /**
   * Processes the user's response to a paste confirmation prompt.
   */
  static handleConfirmation(key: string, content: string): PasteConfirmResult | null {
    const lower = key.toLowerCase();

    switch (lower) {
      case "c":
        return { type: "confirmed", content };
      case "e":
        return { type: "edit", content };
      case "a":
        return { type: "aborted" };
      default:
        return null;
    }
  }

  reset(): void {
    this.accumulatedChars = [];
    this.isPasting = false;
    this.lastInputTime = 0;
    if (this.pasteTimeout) {
      clearTimeout(this.pasteTimeout);
      this.pasteTimeout = null;
    }
  }
}
