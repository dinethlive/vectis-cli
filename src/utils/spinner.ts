import ora from "ora";
import type { Ora } from "ora";

/**
 * Create an ora spinner with discardStdin disabled.
 *
 * ora's StdinDiscarder has a bug on Windows: start() is a no-op on win32,
 * but stop() still calls process.stdin.pause(). Combined with Bun's broken
 * stdin.pause()/resume() (oven-sh/bun#8693), this permanently kills readline.
 */
export function spinner(text: string): Ora {
  return ora({ text, discardStdin: false });
}
