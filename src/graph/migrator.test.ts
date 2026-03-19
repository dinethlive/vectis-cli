import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runMigrations } from "./migrator.js";
import { createLogger } from "../utils/logger.js";

describe("runMigrations", () => {
  const logger = createLogger(false);
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    tmpDir = path.join(os.tmpdir(), "vectis-test-migrations-" + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates _migrations table", () => {
    runMigrations(db, tmpDir, logger);
    const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'").all();
    expect(rows).toHaveLength(1);
  });

  it("runs SQL migration files", () => {
    fs.writeFileSync(
      path.join(tmpDir, "001_test.sql"),
      "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    );

    runMigrations(db, tmpDir, logger);

    const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'").all();
    expect(rows).toHaveLength(1);
  });

  it("records applied migrations", () => {
    fs.writeFileSync(path.join(tmpDir, "001_first.sql"), "CREATE TABLE t1 (id INTEGER PRIMARY KEY)");
    fs.writeFileSync(path.join(tmpDir, "002_second.sql"), "CREATE TABLE t2 (id INTEGER PRIMARY KEY)");

    runMigrations(db, tmpDir, logger);

    const applied = db.query("SELECT version, name FROM _migrations ORDER BY version").all() as { version: number; name: string }[];
    expect(applied).toHaveLength(2);
    expect(applied[0].version).toBe(1);
    expect(applied[0].name).toBe("first");
    expect(applied[1].version).toBe(2);
  });

  it("skips already applied migrations", () => {
    fs.writeFileSync(path.join(tmpDir, "001_first.sql"), "CREATE TABLE t1 (id INTEGER PRIMARY KEY)");

    runMigrations(db, tmpDir, logger);
    // Running again should not error
    runMigrations(db, tmpDir, logger);

    const applied = db.query("SELECT version FROM _migrations").all();
    expect(applied).toHaveLength(1);
  });

  it("handles empty migration directory", () => {
    runMigrations(db, tmpDir, logger);
    const applied = db.query("SELECT version FROM _migrations").all();
    expect(applied).toHaveLength(0);
  });

  it("handles nonexistent migration directory", () => {
    // Should not throw
    runMigrations(db, "/nonexistent/path", logger);
  });
});
