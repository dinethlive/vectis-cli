import { describe, it, expect } from "vitest";
import { extractReferences } from "./resolver.js";

describe("extractReferences", () => {
  it("extracts file references", () => {
    const refs = extractReferences("check @src/index.ts please");
    expect(refs).toEqual(["src/index.ts"]);
  });

  it("extracts multiple references", () => {
    const refs = extractReferences("compare @file1.ts and @file2.ts");
    expect(refs).toEqual(["file1.ts", "file2.ts"]);
  });

  it("extracts folder references", () => {
    const refs = extractReferences("read @context/");
    expect(refs).toEqual(["context/"]);
  });

  it("extracts penpot references", () => {
    const refs = extractReferences("show me @penpot:Dashboard/Home");
    expect(refs).toEqual(["penpot:Dashboard/Home"]);
  });

  it("extracts bare penpot reference", () => {
    const refs = extractReferences("what is @penpot selected?");
    expect(refs).toEqual(["penpot"]);
  });

  it("returns empty for no references", () => {
    const refs = extractReferences("no references here");
    expect(refs).toEqual([]);
  });

  it("handles email-like patterns", () => {
    // @ in email context - regex picks up after @, this is expected behavior
    const refs = extractReferences("email user@example.com");
    expect(refs.length).toBeGreaterThan(0); // picks up example.com
  });
});
