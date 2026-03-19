import { describe, it, expect } from "vitest";
import { estimateTokens, calculateCost, TokenTracker } from "./token-counter.js";

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("hello")).toBe(2); // 5/4 = 1.25, ceil = 2
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

describe("calculateCost", () => {
  it("calculates cost based on token counts", () => {
    const cost = calculateCost(1_000_000, 0);
    expect(cost).toBeCloseTo(3.0); // $3/M input
  });

  it("includes output cost", () => {
    const cost = calculateCost(0, 1_000_000);
    expect(cost).toBeCloseTo(15.0); // $15/M output
  });
});

describe("TokenTracker", () => {
  it("starts at zero", () => {
    const tracker = new TokenTracker();
    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
    expect(usage.estimatedCost).toBe(0);
  });

  it("accumulates tokens", () => {
    const tracker = new TokenTracker();
    tracker.record(100, 50);
    tracker.record(200, 100);
    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBe(300);
    expect(usage.outputTokens).toBe(150);
  });

  it("resets to zero", () => {
    const tracker = new TokenTracker();
    tracker.record(100, 50);
    tracker.reset();
    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
  });
});
