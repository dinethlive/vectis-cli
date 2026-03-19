import { describe, it, expect } from "vitest";
import { globalConfigSchema, projectConfigSchema } from "./schema.js";

describe("globalConfigSchema", () => {
  it("accepts valid config", () => {
    const result = globalConfigSchema.safeParse({
      anthropicApiKey: "sk-ant-test",
      defaultModel: "claude-sonnet-4-20250514",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty config", () => {
    const result = globalConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("strips unknown fields", () => {
    const result = globalConfigSchema.safeParse({ unknown: "field" });
    expect(result.success).toBe(true);
  });
});

describe("projectConfigSchema", () => {
  it("accepts valid config", () => {
    const result = projectConfigSchema.safeParse({
      penpotFileId: "abc-123",
      mcpServerUrl: "http://localhost:4401/mcp",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = projectConfigSchema.safeParse({
      penpotFileUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts naming filter", () => {
    const result = projectConfigSchema.safeParse({
      namingFilter: { skipPrefixes: ["~", "_"] },
    });
    expect(result.success).toBe(true);
  });
});
