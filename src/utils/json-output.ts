/**
 * JSON output mode for CI/scripting integration.
 * When --json flag is passed, structured data goes to stdout as JSON.
 */

let jsonMode = false;

export function isJsonMode(): boolean {
  return jsonMode;
}

export function enableJsonMode(): void {
  jsonMode = true;
}

export function detectJsonFlag(): void {
  if (process.argv.includes("--json")) {
    jsonMode = true;
  }
}

export class JsonOutput {
  private enabled: boolean;

  constructor(enabled?: boolean) {
    this.enabled = enabled ?? jsonMode;
  }

  /**
   * Write structured data as JSON to stdout if json mode is active.
   * Returns true if JSON was written (so caller can skip formatted output).
   */
  output(data: unknown): boolean {
    if (!this.enabled) return false;
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return true;
  }

  /**
   * Write a JSON line (no pretty print, one object per line).
   * Useful for streaming NDJSON output.
   */
  outputLine(data: unknown): boolean {
    if (!this.enabled) return false;
    process.stdout.write(JSON.stringify(data) + "\n");
    return true;
  }

  /**
   * Wrap a command execution: if JSON mode, capture and emit result as JSON.
   * Otherwise, run normally with formatted terminal output.
   */
  async wrap<T>(
    fn: () => Promise<T>,
    formatResult?: (result: T) => unknown,
  ): Promise<T> {
    const result = await fn();
    if (this.enabled && result !== undefined) {
      const jsonData = formatResult ? formatResult(result) : result;
      this.output(jsonData);
    }
    return result;
  }

  get isActive(): boolean {
    return this.enabled;
  }
}

/** Singleton for convenience */
export const jsonOutput = new JsonOutput();
