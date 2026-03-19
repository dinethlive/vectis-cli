import { describe, it, expect, vi } from "vitest";
import { SlashRouter } from "./slash-router.js";
import type { SessionContext } from "../types/repl.js";

function makeRouter() {
  const router = new SlashRouter();
  router.register({
    name: "test",
    description: "A test command",
    execute: vi.fn(),
  });
  router.register({
    name: "help",
    description: "Show help",
    execute: vi.fn(),
  });
  return router;
}

describe("SlashRouter", () => {
  it("isCommand returns true for /commands", () => {
    const router = makeRouter();
    expect(router.isCommand("/test")).toBe(true);
    expect(router.isCommand("/help")).toBe(true);
    expect(router.isCommand("not a command")).toBe(false);
    expect(router.isCommand("")).toBe(false);
  });

  it("parse extracts command and args", () => {
    const router = makeRouter();
    expect(router.parse("/test")).toEqual({ command: "test", args: "" });
    expect(router.parse("/test arg1 arg2")).toEqual({ command: "test", args: "arg1 arg2" });
    expect(router.parse("/help")).toEqual({ command: "help", args: "" });
    expect(router.parse("not a command")).toBeNull();
  });

  it("getCommand returns registered command", () => {
    const router = makeRouter();
    expect(router.getCommand("test")).toBeDefined();
    expect(router.getCommand("test")?.name).toBe("test");
    expect(router.getCommand("nonexistent")).toBeUndefined();
  });

  it("getAllCommands returns all registered commands", () => {
    const router = makeRouter();
    const cmds = router.getAllCommands();
    expect(cmds).toHaveLength(2);
  });

  it("getCommandNames returns command names", () => {
    const router = makeRouter();
    expect(router.getCommandNames()).toContain("test");
    expect(router.getCommandNames()).toContain("help");
  });

  it("dispatch calls the right handler", async () => {
    const router = makeRouter();
    const ctx = {} as SessionContext;
    await router.dispatch("/test some args", ctx);
    const handler = router.getCommand("test")!;
    expect(handler.execute).toHaveBeenCalledWith("some args", ctx);
  });

  it("dispatch handles unknown commands gracefully", async () => {
    const router = makeRouter();
    const ctx = {} as SessionContext;
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handled = await router.dispatch("/unknown", ctx);
    expect(handled).toBe(true);
    consoleSpy.mockRestore();
  });

  it("dispatch returns false for non-commands", async () => {
    const router = makeRouter();
    const ctx = {} as SessionContext;
    const handled = await router.dispatch("not a command", ctx);
    expect(handled).toBe(false);
  });
});
