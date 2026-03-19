import { describe, it, expect, vi } from "vitest";
import { assembleContext } from "./context-assembler.js";
import type { SessionContext } from "../types/repl.js";
import type { ResolvedReference } from "../references/resolver.js";
import { createInitialState } from "../types/repl.js";
import { SkillRegistry } from "../skills/registry.js";
import { createLogger } from "../utils/logger.js";
import { TokenTracker } from "../ai/token-counter.js";

function makeCtx(overrides?: Partial<SessionContext>): SessionContext {
  const logger = createLogger(false);
  return {
    config: {
      global: {},
      project: {},
      apiKey: "test-key",
      model: "claude-sonnet-4-20250514",
      mcpServerUrl: "http://localhost:4401/mcp",
      wsServerUrl: "ws://localhost:4402",
      projectRoot: null,
      globalConfigDir: "/tmp/.vectis",
      verbose: false,
    },
    client: null,
    bridge: null,
    db: null,
    state: createInitialState(),
    session: { id: "test", startedAt: new Date(), turns: [] },
    skills: new SkillRegistry(logger),
    logger,
    tokenTracker: new TokenTracker(),
    rl: null,
    ...overrides,
  };
}

describe("assembleContext", () => {
  it("creates messages with user input", () => {
    const ctx = makeCtx();
    const { messages, system } = assembleContext("hello", [], ctx);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(system).toContain("Vectis");
  });

  it("includes resolved text references", () => {
    const ctx = makeCtx();
    const refs: ResolvedReference[] = [
      {
        original: "@test.txt",
        type: "file",
        content: "--- File: test.txt ---\nfile content\n--- End ---",
        tokenEstimate: 10,
      },
    ];
    const { messages } = assembleContext("check this", refs, ctx);
    expect(messages).toHaveLength(1);
    // Content should be array with ref + user message
    expect(Array.isArray(messages[0].content)).toBe(true);
  });

  it("includes conversation history", () => {
    const ctx = makeCtx();
    ctx.session.turns = [
      { role: "user", content: "first message", timestamp: new Date() },
      { role: "assistant", content: "first reply", timestamp: new Date() },
    ];
    const { messages } = assembleContext("second message", [], ctx);
    expect(messages).toHaveLength(3); // 2 history + 1 current
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("user");
  });

  it("includes image references for vision", () => {
    const ctx = makeCtx();
    const refs: ResolvedReference[] = [
      {
        original: "@screenshot.png",
        type: "image",
        content: "[Image: screenshot.png]",
        base64: "iVBORw0KGgo=",
        mediaType: "image/png",
        tokenEstimate: 100,
      },
    ];
    const { messages } = assembleContext("describe this", refs, ctx);
    const content = messages[messages.length - 1].content as Array<{ type: string }>;
    const imageBlock = content.find((b) => b.type === "image");
    expect(imageBlock).toBeDefined();
  });
});
