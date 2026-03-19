import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import type { Logger } from "../utils/logger.js";

const keybindingSchema = z.record(z.string());

export interface Keybinding {
  key: string;
  action: string;
}

const DEFAULT_KEYBINDINGS: Record<string, string> = {
  "ctrl+c": "interrupt",
  "ctrl+d": "exit",
  "ctrl+l": "clear",
  "ctrl+g": "external-editor",
  "ctrl+p": "history-prev",
  "ctrl+n": "history-next",
};

export class KeybindingsManager {
  private bindings = new Map<string, string>();
  private logger: Logger;
  private watchedPaths: string[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
    // Load defaults
    for (const [key, action] of Object.entries(DEFAULT_KEYBINDINGS)) {
      this.bindings.set(key, action);
    }
  }

  load(projectRoot?: string | null): void {
    // Global keybindings
    const globalPath = path.join(os.homedir(), ".vectis", "keybindings.json");
    this.loadFromFile(globalPath);

    // Project keybindings (override global)
    if (projectRoot) {
      const projectPath = path.join(projectRoot, ".vectis", "keybindings.json");
      this.loadFromFile(projectPath);
    }
  }

  private loadFromFile(filePath: string): void {
    if (!fs.existsSync(filePath)) return;

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const result = keybindingSchema.safeParse(raw);
      if (!result.success) {
        this.logger.warn(`Invalid keybindings in ${filePath}: ${result.error.message}`);
        return;
      }

      for (const [key, action] of Object.entries(result.data)) {
        // Cross-platform normalization: Option -> Alt on non-mac
        const normalizedKey = os.platform() !== "darwin"
          ? key.replace(/option/gi, "alt")
          : key;
        this.bindings.set(normalizedKey, action);
      }

      this.watchedPaths.push(filePath);
    } catch (err) {
      this.logger.debug(`Failed to load keybindings from ${filePath}: ${err}`);
    }
  }

  getAction(key: string): string | undefined {
    return this.bindings.get(key);
  }

  getAll(): Keybinding[] {
    return Array.from(this.bindings.entries()).map(([key, action]) => ({ key, action }));
  }

  startWatching(onChange: () => void): void {
    for (const filePath of this.watchedPaths) {
      try {
        fs.watch(filePath, () => {
          this.logger.debug(`Keybindings file changed: ${filePath}`);
          this.bindings.clear();
          for (const [key, action] of Object.entries(DEFAULT_KEYBINDINGS)) {
            this.bindings.set(key, action);
          }
          this.load();
          onChange();
        });
      } catch {
        // File might not exist yet
      }
    }
  }
}
