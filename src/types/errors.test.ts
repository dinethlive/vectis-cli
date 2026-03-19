import { describe, it, expect } from "vitest";
import {
  VectisError,
  apiKeyMissing,
  apiKeyInvalid,
  apiRateLimited,
  penpotNotConnected,
  refFileNotFound,
  refOutsideProject,
  refTooLarge,
} from "./errors.js";

describe("VectisError", () => {
  it("creates error with all fields", () => {
    const err = new VectisError("msg", "API_KEY_MISSING", "user msg", "do this");
    expect(err.message).toBe("msg");
    expect(err.code).toBe("API_KEY_MISSING");
    expect(err.userMessage).toBe("user msg");
    expect(err.suggestion).toBe("do this");
    expect(err.name).toBe("VectisError");
    expect(err instanceof Error).toBe(true);
  });

  it("creates error without suggestion", () => {
    const err = new VectisError("msg", "UNKNOWN", "user msg");
    expect(err.suggestion).toBeUndefined();
  });
});

describe("error factory functions", () => {
  it("apiKeyMissing", () => {
    const err = apiKeyMissing();
    expect(err.code).toBe("API_KEY_MISSING");
    expect(err.suggestion).toBeDefined();
  });

  it("apiKeyInvalid", () => {
    const err = apiKeyInvalid();
    expect(err.code).toBe("API_KEY_INVALID");
  });

  it("apiRateLimited", () => {
    const err = apiRateLimited();
    expect(err.code).toBe("API_RATE_LIMITED");
  });

  it("penpotNotConnected", () => {
    const err = penpotNotConnected();
    expect(err.code).toBe("PENPOT_NOT_CONNECTED");
  });

  it("refFileNotFound", () => {
    const err = refFileNotFound("test.txt");
    expect(err.code).toBe("REF_FILE_NOT_FOUND");
    expect(err.userMessage).toContain("test.txt");
  });

  it("refOutsideProject", () => {
    const err = refOutsideProject("../secret");
    expect(err.code).toBe("REF_OUTSIDE_PROJECT");
    expect(err.userMessage).toContain("../secret");
  });

  it("refTooLarge", () => {
    const err = refTooLarge("huge.bin");
    expect(err.code).toBe("REF_TOO_LARGE");
    expect(err.userMessage).toContain("huge.bin");
  });
});
