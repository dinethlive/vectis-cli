import { Database } from "bun:sqlite";
import path from "node:path";
import type { Logger } from "../utils/logger.js";

let instance: Database | null = null;

export function getDatabase(dbPath: string, logger: Logger): Database {
  if (instance) return instance;

  logger.debug(`Opening database at ${dbPath}`);
  instance = new Database(dbPath);
  instance.run("PRAGMA journal_mode = WAL");
  instance.run("PRAGMA foreign_keys = ON");
  instance.run("PRAGMA busy_timeout = 5000");

  return instance;
}

export function getMemoryDatabase(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
