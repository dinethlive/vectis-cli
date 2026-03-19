import fs from "node:fs";
import path from "node:path";
import type { Database } from "bun:sqlite";
import type { Logger } from "../utils/logger.js";

export function runMigrations(db: Database, migrationsDir: string, logger: Logger): void {
  // Ensure migrations table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Get applied migrations
  const applied = new Set<number>();
  const rows = db.query("SELECT version FROM _migrations").all() as { version: number }[];
  for (const row of rows) {
    applied.add(row.version);
  }

  // Read migration files
  if (!fs.existsSync(migrationsDir)) {
    logger.debug(`No migrations directory at ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];

    if (applied.has(version)) continue;

    logger.debug(`Running migration ${version}: ${name}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

    // Run in transaction
    db.run("BEGIN");
    try {
      // Split by semicolons and run each statement
      const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        db.run(stmt);
      }
      db.run("INSERT INTO _migrations (version, name) VALUES (?, ?)", [version, name]);
      db.run("COMMIT");
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }
  }
}
