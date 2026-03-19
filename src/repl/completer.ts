import type { SessionContext } from "../types/repl.js";
import type { SlashRouter } from "./slash-router.js";
import type { CompleterResult } from "node:readline";
import fs from "node:fs";
import path from "node:path";

const PENPOT_SHORTCUTS = [
  "@penpot:selection",
  "@penpot:components",
  "@penpot:tokens",
  "@penpot:page/",
];

export function createCompleter(
  router: SlashRouter,
  ctx: SessionContext,
): (line: string, callback: (err: Error | null, result: CompleterResult) => void) => void {
  // Cache for file completions
  let fileCache: string[] | null = null;
  let fileCacheTime = 0;
  const CACHE_TTL = 5000; // 5 seconds

  // Cache for board names
  let boardCache: string[] | null = null;
  let boardCacheTime = 0;

  function getFilePaths(): string[] {
    const now = Date.now();
    if (fileCache && now - fileCacheTime < CACHE_TTL) {
      return fileCache;
    }

    const projectRoot = ctx.config.projectRoot;
    if (!projectRoot) {
      fileCache = [];
      fileCacheTime = now;
      return fileCache;
    }

    try {
      const entries: string[] = [];
      collectFiles(projectRoot, "", entries, 3); // max depth 3
      fileCache = entries;
      fileCacheTime = now;
      return fileCache;
    } catch {
      fileCache = [];
      fileCacheTime = now;
      return fileCache;
    }
  }

  function collectFiles(base: string, prefix: string, results: string[], maxDepth: number): void {
    if (maxDepth <= 0) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(base, prefix), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      // Skip hidden dirs and common large directories
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        results.push(relativePath + "/");
        collectFiles(base, relativePath, results, maxDepth - 1);
      } else {
        results.push(relativePath);
      }
    }
  }

  function getBoardNames(): string[] {
    const now = Date.now();
    if (boardCache && now - boardCacheTime < CACHE_TTL) {
      return boardCache;
    }

    // Use activeBoards from state as cached board data
    boardCache = ctx.state.activeBoards.slice();
    boardCacheTime = now;
    return boardCache;
  }

  function getFlowNames(): string[] {
    const projectRoot = ctx.config.projectRoot;
    if (!projectRoot) return [];

    const flowsDir = path.join(projectRoot, "context", "flows");
    try {
      return fs
        .readdirSync(flowsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }

  function getSkillNames(): string[] {
    return ctx.skills.getAllMetadata().map((s) => s.name);
  }

  return (line: string, callback: (err: Error | null, result: CompleterResult) => void) => {
    try {
      // Command completion: /prefix
      if (line.startsWith("/")) {
        const names = router.getCommandNames().map((c) => `/${c}`);
        const matches = names.filter((c) => c.startsWith(line));
        callback(null, [matches.length > 0 ? matches : names, line]);
        return;
      }

      // @ reference completion
      const atMatch = line.match(/@(\S*)$/);
      if (atMatch) {
        const partial = atMatch[1];
        const prefix = line.slice(0, line.length - atMatch[0].length);
        const candidates: string[] = [];

        // Penpot shortcuts
        for (const shortcut of PENPOT_SHORTCUTS) {
          candidates.push(shortcut);
        }

        // Board names
        const boards = getBoardNames();
        for (const board of boards) {
          candidates.push(`@penpot:${board}`);
        }

        // File paths
        const files = getFilePaths();
        for (const file of files) {
          candidates.push(`@${file}`);
        }

        const query = `@${partial}`;
        const matches = candidates.filter((c) => c.startsWith(query));
        const completions = matches.map((m) => prefix + m);
        callback(null, [completions.length > 0 ? completions : [], line]);
        return;
      }

      // Flow name completion in flow-related contexts
      // Detects lines starting with /flow or /checkout
      const flowMatch = line.match(/^\/(flow|checkout)\s+(\S*)$/);
      if (flowMatch) {
        const cmd = flowMatch[1];
        const partial = flowMatch[2];
        const flows = getFlowNames();
        const matches = flows
          .filter((f) => f.startsWith(partial))
          .map((f) => `/${cmd} ${f}`);
        callback(null, [matches.length > 0 ? matches : [], line]);
        return;
      }

      // Skill name completion (when user types a skill-like context)
      // No specific trigger for now — default to empty
      callback(null, [[], line]);
    } catch {
      // Never let completion errors break the REPL
      callback(null, [[], line]);
    }
  };
}
