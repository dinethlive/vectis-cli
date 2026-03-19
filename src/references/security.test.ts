import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateReferenceSecurity } from "./security.js";

describe("validateReferenceSecurity", () => {
  const tmpDir = path.join(os.tmpdir(), "vectis-test-security-" + Date.now());

  // Setup
  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "test.txt"), "hello");
    fs.mkdirSync(path.join(tmpDir, "sub"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "sub", "nested.txt"), "nested");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows files within project root", () => {
    const result = validateReferenceSecurity("test.txt", tmpDir);
    expect(result).toBe(path.join(tmpDir, "test.txt"));
  });

  it("allows nested files", () => {
    const result = validateReferenceSecurity("sub/nested.txt", tmpDir);
    expect(result).toContain("nested.txt");
  });

  it("rejects paths with ..", () => {
    expect(() => validateReferenceSecurity("../etc/passwd", tmpDir)).toThrow();
  });

  it("rejects absolute paths outside root", () => {
    expect(() => validateReferenceSecurity("/etc/passwd", tmpDir)).toThrow();
  });

  it("throws for nonexistent files", () => {
    expect(() => validateReferenceSecurity("nope.txt", tmpDir)).toThrow();
  });
});
