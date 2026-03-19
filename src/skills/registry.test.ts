import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SkillRegistry } from "./registry.js";
import { createLogger } from "../utils/logger.js";

describe("SkillRegistry", () => {
  const tmpDir = path.join(os.tmpdir(), "vectis-test-skills-" + Date.now());
  const logger = createLogger(false);

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Write test skill files
    fs.writeFileSync(
      path.join(tmpDir, "test-skill.md"),
      `---
name: test-skill
description: A test skill
always: false
tags: [test]
---

# Test Skill Content

This is the test skill body.
`,
    );

    fs.writeFileSync(
      path.join(tmpDir, "always-skill.md"),
      `---
name: always-skill
description: An always-on skill
always: true
---

Always-on content here.
`,
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers skills from directory", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir(tmpDir);
    expect(registry.count()).toBe(2);
  });

  it("returns metadata without loading content", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir(tmpDir);
    const meta = registry.getMetadata("test-skill");
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("test-skill");
    expect(meta!.description).toBe("A test skill");
  });

  it("loads full skill content on demand", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir(tmpDir);
    const skill = registry.load("test-skill");
    expect(skill).toBeDefined();
    expect(skill!.content).toContain("Test Skill Content");
  });

  it("returns null for unknown skill", () => {
    const registry = new SkillRegistry(logger);
    expect(registry.load("nonexistent")).toBeNull();
  });

  it("gets always-on skills", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir(tmpDir);
    const alwaysOn = registry.getAlwaysOnSkills();
    expect(alwaysOn).toHaveLength(1);
    expect(alwaysOn[0].name).toBe("always-skill");
  });

  it("handles nonexistent directory", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir("/nonexistent/path");
    expect(registry.count()).toBe(0);
  });

  it("lists all metadata", () => {
    const registry = new SkillRegistry(logger);
    registry.discoverFromDir(tmpDir);
    const all = registry.getAllMetadata();
    expect(all).toHaveLength(2);
  });
});
