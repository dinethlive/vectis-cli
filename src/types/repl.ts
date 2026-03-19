export type ReplMode =
  | "NORMAL"
  | "GEN_PREVIEW"
  | "STRUCTURE_CONV"
  | "VIM_NORMAL"
  | "VIM_INSERT";

export interface ReplState {
  mode: ReplMode;
  currentFlow: string | null;
  activeBoards: string[];
  isStreaming: boolean;
  abortController: AbortController | null;
}

export function createInitialState(): ReplState {
  return {
    mode: "NORMAL",
    currentFlow: null,
    activeBoards: [],
    isStreaming: false,
    abortController: null,
  };
}

export interface CommandHandler {
  name: string;
  description: string;
  usage?: string;
  execute: (args: string, ctx: SessionContext) => Promise<void>;
}

export interface SessionContext {
  config: import("./config.js").VectisConfig;
  client: import("../ai/client.js").ClaudeClient | null;
  bridge: import("../bridge/penpot.js").PenpotBridge | null;
  db: unknown | null;
  state: ReplState;
  session: SessionInfo;
  skills: import("../skills/registry.js").SkillRegistry;
  logger: import("../utils/logger.js").Logger;
  tokenTracker: import("../ai/token-counter.js").TokenTracker;
  rl: import("node:readline").Interface | null;
  /** Set by commands that need to capture the next line of input */
  pendingInput: ((answer: string) => void) | null;
  /** State-based action handler for multi-step commands (e.g. /create preview) */
  pendingAction: {
    type: string;
    data: unknown;
    handle: (input: string, ctx: SessionContext) => Promise<boolean>;
  } | null;
}

export interface SessionInfo {
  id: string;
  startedAt: Date;
  turns: ConversationTurn[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokenCount?: number;
}
