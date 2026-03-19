import type { ReplMode } from "../types/repl.js";

export type VimAction =
  | { type: "noop" }
  | { type: "insert"; char: string }
  | { type: "delete-char" }
  | { type: "delete-line" }
  | { type: "yank-line" }
  | { type: "paste" }
  | { type: "mode-change"; mode: ReplMode }
  | { type: "submit" }
  | { type: "cursor-move"; position: number };

export class VimMode {
  private buffer: string[] = [];
  private cursorLine = 0;
  private cursorCol = 0;
  private mode: "VIM_NORMAL" | "VIM_INSERT" = "VIM_NORMAL";
  private yankBuffer = "";
  private pendingKey: string | null = null;

  constructor(initialContent = "") {
    this.buffer = initialContent ? initialContent.split("\n") : [""];
    this.cursorLine = 0;
    this.cursorCol = 0;
  }

  getMode(): "VIM_NORMAL" | "VIM_INSERT" {
    return this.mode;
  }

  getBuffer(): string {
    return this.buffer.join("\n");
  }

  getCurrentLine(): string {
    return this.buffer[this.cursorLine] ?? "";
  }

  getCursorPosition(): { line: number; col: number } {
    return { line: this.cursorLine, col: this.cursorCol };
  }

  handleKey(key: string): VimAction {
    if (this.mode === "VIM_INSERT") {
      return this.handleInsertKey(key);
    }
    return this.handleNormalKey(key);
  }

  private handleInsertKey(key: string): VimAction {
    // Escape -> normal mode
    if (key === "\x1B" || key === "escape") {
      this.mode = "VIM_NORMAL";
      // Move cursor back one if possible (vim behavior)
      if (this.cursorCol > 0) {
        this.cursorCol--;
      }
      return { type: "mode-change", mode: "VIM_NORMAL" };
    }

    // Backspace
    if (key === "\x7F" || key === "backspace") {
      if (this.cursorCol > 0) {
        const line = this.buffer[this.cursorLine];
        this.buffer[this.cursorLine] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
        this.cursorCol--;
        return { type: "delete-char" };
      } else if (this.cursorLine > 0) {
        // Join with previous line
        const prevLine = this.buffer[this.cursorLine - 1];
        const currentLine = this.buffer[this.cursorLine];
        this.cursorCol = prevLine.length;
        this.buffer[this.cursorLine - 1] = prevLine + currentLine;
        this.buffer.splice(this.cursorLine, 1);
        this.cursorLine--;
        return { type: "delete-char" };
      }
      return { type: "noop" };
    }

    // Enter
    if (key === "\r" || key === "\n" || key === "return") {
      const line = this.buffer[this.cursorLine];
      const before = line.slice(0, this.cursorCol);
      const after = line.slice(this.cursorCol);
      this.buffer[this.cursorLine] = before;
      this.buffer.splice(this.cursorLine + 1, 0, after);
      this.cursorLine++;
      this.cursorCol = 0;
      return { type: "insert", char: "\n" };
    }

    // Regular character
    if (key.length === 1 && key >= " ") {
      const line = this.buffer[this.cursorLine];
      this.buffer[this.cursorLine] = line.slice(0, this.cursorCol) + key + line.slice(this.cursorCol);
      this.cursorCol++;
      return { type: "insert", char: key };
    }

    return { type: "noop" };
  }

  private handleNormalKey(key: string): VimAction {
    // Handle two-key combos (dd, yy)
    if (this.pendingKey !== null) {
      const combo = this.pendingKey + key;
      this.pendingKey = null;

      if (combo === "dd") {
        return this.deleteLine();
      }
      if (combo === "yy") {
        return this.yankLine();
      }
      return { type: "noop" };
    }

    switch (key) {
      // Movement
      case "h":
        return this.moveCursorLeft();
      case "l":
        return this.moveCursorRight();
      case "j":
        return this.moveCursorDown();
      case "k":
        return this.moveCursorUp();

      // Word movement
      case "w":
        return this.moveWordForward();
      case "b":
        return this.moveWordBackward();

      // Line start/end
      case "0":
        this.cursorCol = 0;
        return { type: "cursor-move", position: this.cursorCol };
      case "$": {
        const lineLen = this.getCurrentLine().length;
        this.cursorCol = lineLen > 0 ? lineLen - 1 : 0;
        return { type: "cursor-move", position: this.cursorCol };
      }

      // Enter insert mode
      case "i":
        this.mode = "VIM_INSERT";
        return { type: "mode-change", mode: "VIM_INSERT" };
      case "a":
        this.mode = "VIM_INSERT";
        if (this.getCurrentLine().length > 0) {
          this.cursorCol = Math.min(this.cursorCol + 1, this.getCurrentLine().length);
        }
        return { type: "mode-change", mode: "VIM_INSERT" };
      case "o":
        this.mode = "VIM_INSERT";
        this.buffer.splice(this.cursorLine + 1, 0, "");
        this.cursorLine++;
        this.cursorCol = 0;
        return { type: "mode-change", mode: "VIM_INSERT" };

      // Two-key combos
      case "d":
      case "y":
        this.pendingKey = key;
        return { type: "noop" };

      // Paste
      case "p":
        return this.pasteLine();

      default:
        return { type: "noop" };
    }
  }

  private moveCursorLeft(): VimAction {
    if (this.cursorCol > 0) {
      this.cursorCol--;
    }
    return { type: "cursor-move", position: this.cursorCol };
  }

  private moveCursorRight(): VimAction {
    const lineLen = this.getCurrentLine().length;
    if (this.cursorCol < lineLen - 1) {
      this.cursorCol++;
    }
    return { type: "cursor-move", position: this.cursorCol };
  }

  private moveCursorDown(): VimAction {
    if (this.cursorLine < this.buffer.length - 1) {
      this.cursorLine++;
      this.cursorCol = Math.min(this.cursorCol, Math.max(0, this.getCurrentLine().length - 1));
    }
    return { type: "cursor-move", position: this.cursorCol };
  }

  private moveCursorUp(): VimAction {
    if (this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorCol = Math.min(this.cursorCol, Math.max(0, this.getCurrentLine().length - 1));
    }
    return { type: "cursor-move", position: this.cursorCol };
  }

  private moveWordForward(): VimAction {
    const line = this.getCurrentLine();
    let col = this.cursorCol;

    // Skip current word
    while (col < line.length && /\w/.test(line[col])) {
      col++;
    }
    // Skip whitespace
    while (col < line.length && /\s/.test(line[col])) {
      col++;
    }

    if (col >= line.length && this.cursorLine < this.buffer.length - 1) {
      // Move to next line
      this.cursorLine++;
      this.cursorCol = 0;
    } else {
      this.cursorCol = Math.min(col, Math.max(0, line.length - 1));
    }

    return { type: "cursor-move", position: this.cursorCol };
  }

  private moveWordBackward(): VimAction {
    const line = this.getCurrentLine();
    let col = this.cursorCol;

    // Skip whitespace backwards
    while (col > 0 && /\s/.test(line[col - 1])) {
      col--;
    }
    // Skip word backwards
    while (col > 0 && /\w/.test(line[col - 1])) {
      col--;
    }

    if (col <= 0 && this.cursorLine > 0) {
      // Move to end of previous line
      this.cursorLine--;
      this.cursorCol = Math.max(0, this.getCurrentLine().length - 1);
    } else {
      this.cursorCol = col;
    }

    return { type: "cursor-move", position: this.cursorCol };
  }

  private deleteLine(): VimAction {
    this.yankBuffer = this.buffer[this.cursorLine];

    if (this.buffer.length > 1) {
      this.buffer.splice(this.cursorLine, 1);
      if (this.cursorLine >= this.buffer.length) {
        this.cursorLine = this.buffer.length - 1;
      }
    } else {
      this.buffer[0] = "";
    }

    this.cursorCol = 0;
    return { type: "delete-line" };
  }

  private yankLine(): VimAction {
    this.yankBuffer = this.buffer[this.cursorLine];
    return { type: "yank-line" };
  }

  private pasteLine(): VimAction {
    if (!this.yankBuffer) {
      return { type: "noop" };
    }

    this.buffer.splice(this.cursorLine + 1, 0, this.yankBuffer);
    this.cursorLine++;
    this.cursorCol = 0;
    return { type: "paste" };
  }

  getDisplayLine(): string {
    const line = this.getCurrentLine();
    if (line.length === 0) {
      const modeIndicator = this.mode === "VIM_INSERT" ? "-- INSERT --" : "-- NORMAL --";
      return `${modeIndicator} |`;
    }

    // Insert cursor indicator
    const before = line.slice(0, this.cursorCol);
    const cursor = line[this.cursorCol] ?? " ";
    const after = line.slice(this.cursorCol + 1);
    const modeIndicator = this.mode === "VIM_INSERT" ? "-- INSERT --" : "-- NORMAL --";

    return `${modeIndicator} ${before}[${cursor}]${after}`;
  }
}
