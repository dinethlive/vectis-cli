export const VERSION = "0.1.0";

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const MAX_RETRIES = 3;
export const RETRY_DELAYS = [1000, 2000, 4000];
export const TOKEN_BUDGET_WARNING = 100_000;
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const MCP_DEFAULT_URL = "http://localhost:4401/mcp";
export const WS_DEFAULT_URL = "ws://localhost:4402";
export const WS_RECONNECT_INITIAL = 1000;
export const WS_RECONNECT_MAX = 30000;
