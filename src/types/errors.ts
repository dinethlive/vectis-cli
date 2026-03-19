export type ErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_INVALID"
  | "API_RATE_LIMITED"
  | "API_CONNECTION_ERROR"
  | "API_STREAM_ERROR"
  | "PENPOT_NOT_CONNECTED"
  | "PENPOT_NO_SELECTION"
  | "PENPOT_MCP_ERROR"
  | "REF_FILE_NOT_FOUND"
  | "REF_OUTSIDE_PROJECT"
  | "REF_TOO_LARGE"
  | "REF_BINARY_FILE"
  | "REF_INVALID"
  | "SPEC_VALIDATION_FAILED"
  | "CONFIG_INVALID"
  | "CONFIG_NOT_FOUND"
  | "DB_ERROR"
  | "MIGRATION_ERROR"
  | "COMMAND_NOT_FOUND"
  | "COMMAND_ERROR"
  | "SKILL_NOT_FOUND"
  | "SKILL_PARSE_ERROR"
  | "INIT_ALREADY_EXISTS"
  | "UNKNOWN";

export class VectisError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public userMessage: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "VectisError";
  }
}

export function apiKeyMissing(): VectisError {
  return new VectisError(
    "No API key configured",
    "API_KEY_MISSING",
    "No Anthropic API key found.",
    "Set ANTHROPIC_API_KEY environment variable or run /init to configure.",
  );
}

export function apiKeyInvalid(): VectisError {
  return new VectisError(
    "Invalid API key",
    "API_KEY_INVALID",
    "Your Anthropic API key is invalid.",
    "Check your key at console.anthropic.com and update with /init.",
  );
}

export function apiRateLimited(): VectisError {
  return new VectisError(
    "Rate limited by Anthropic API",
    "API_RATE_LIMITED",
    "You've hit the Anthropic rate limit.",
    "Wait a moment and try again. Consider upgrading your API plan.",
  );
}

export function penpotNotConnected(): VectisError {
  return new VectisError(
    "Penpot MCP server not connected",
    "PENPOT_NOT_CONNECTED",
    "Cannot reach the Penpot MCP server.",
    "Make sure the Penpot MCP server is running and check /doctor.",
  );
}

export function refFileNotFound(path: string): VectisError {
  return new VectisError(
    `Reference file not found: ${path}`,
    "REF_FILE_NOT_FOUND",
    `File not found: ${path}`,
    "Check the file path and try again.",
  );
}

export function refOutsideProject(path: string): VectisError {
  return new VectisError(
    `Reference path escapes project root: ${path}`,
    "REF_OUTSIDE_PROJECT",
    `Path "${path}" is outside the project directory.`,
    "References must be within the project root.",
  );
}

export function refTooLarge(path: string): VectisError {
  return new VectisError(
    `Reference file too large: ${path}`,
    "REF_TOO_LARGE",
    `File "${path}" exceeds the 1MB size limit.`,
    "Use a smaller file or reference specific sections.",
  );
}
