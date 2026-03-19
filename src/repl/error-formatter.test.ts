import { describe, it, expect } from "vitest";
import { formatError, formatUnknownError } from "./error-formatter.js";
import { VectisError } from "../types/errors.js";

describe("formatError", () => {
  it("formats VectisError with suggestion", () => {
    const err = new VectisError("msg", "API_KEY_MISSING", "No key", "Run /init");
    const output = formatError(err);
    expect(output).toContain("API_KEY_MISSING");
    expect(output).toContain("No key");
    expect(output).toContain("Run /init");
  });

  it("formats VectisError without suggestion", () => {
    const err = new VectisError("msg", "UNKNOWN", "Something broke");
    const output = formatError(err);
    expect(output).toContain("UNKNOWN");
    expect(output).toContain("Something broke");
  });
});

describe("formatUnknownError", () => {
  it("formats Error objects", () => {
    const output = formatUnknownError(new Error("oops"));
    expect(output).toContain("oops");
  });

  it("formats non-Error values", () => {
    const output = formatUnknownError("string error");
    expect(output).toContain("string error");
  });
});
