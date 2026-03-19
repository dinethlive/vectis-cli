import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { getGlobalConfigDir, getGlobalConfigPath, getGlobalSkillsDir } from "./paths.js";

describe("paths", () => {
  it("getGlobalConfigDir returns ~/.vectis", () => {
    const result = getGlobalConfigDir();
    expect(result).toBe(path.join(os.homedir(), ".vectis"));
  });

  it("getGlobalConfigPath returns config.json path", () => {
    const result = getGlobalConfigPath();
    expect(result).toContain("config.json");
    expect(result).toContain(".vectis");
  });

  it("getGlobalSkillsDir returns skills path", () => {
    const result = getGlobalSkillsDir();
    expect(result).toContain("skills");
    expect(result).toContain(".vectis");
  });
});
