import { describe, it, expect } from "vitest";
import { getPrompt } from "./prompt.js";
import type { ReplState } from "../types/repl.js";
import { createInitialState } from "../types/repl.js";

describe("getPrompt", () => {
  it("shows vectis prompt in normal mode", () => {
    const state = createInitialState();
    const prompt = getPrompt(state);
    expect(prompt).toContain("vectis");
    expect(prompt).toContain(">");
  });

  it("includes flow name when active", () => {
    const state = createInitialState();
    state.currentFlow = "onboarding";
    const prompt = getPrompt(state);
    expect(prompt).toContain("onboarding");
  });

  it("shows streaming indicator", () => {
    const state = createInitialState();
    state.isStreaming = true;
    const prompt = getPrompt(state);
    expect(prompt).toContain("...");
  });

  it("changes indicator for VIM_NORMAL mode", () => {
    const state = createInitialState();
    state.mode = "VIM_NORMAL";
    const prompt = getPrompt(state);
    expect(prompt).toContain("VIM");
  });

  it("changes indicator for GEN_PREVIEW mode", () => {
    const state = createInitialState();
    state.mode = "GEN_PREVIEW";
    const prompt = getPrompt(state);
    expect(prompt).toContain("preview");
  });
});
