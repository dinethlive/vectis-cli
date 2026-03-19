import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), ".vectis");
}

export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), "config.json");
}

export function getGlobalSkillsDir(): string {
  return path.join(getGlobalConfigDir(), "skills");
}

export function findProjectRoot(startDir?: string): string | null {
  let dir = startDir ?? process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, ".vectis"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, ".vectis", "config.json");
}

export function getConversationsDir(projectRoot: string): string {
  return path.join(projectRoot, ".vectis", "conversations");
}

export function getContextDir(projectRoot: string): string {
  return path.join(projectRoot, "context");
}

export function getSpecsDir(projectRoot: string): string {
  return path.join(projectRoot, "specs");
}

export function getDbPath(projectRoot: string): string {
  return path.join(projectRoot, ".vectis", "graph.db");
}
