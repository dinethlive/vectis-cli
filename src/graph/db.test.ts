import { describe, it, expect } from "vitest";
import { getMemoryDatabase } from "./db.js";

describe("getMemoryDatabase", () => {
  it("creates an in-memory database", () => {
    const db = getMemoryDatabase();
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY)");
    db.run("INSERT INTO test (id) VALUES (1)");
    const rows = db.query("SELECT id FROM test").all() as { id: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    db.close();
  });

  it("has foreign keys enabled", () => {
    const db = getMemoryDatabase();
    const result = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
    db.close();
  });
});
