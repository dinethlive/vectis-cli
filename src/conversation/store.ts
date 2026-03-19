import fs from "node:fs";
import path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tokenEstimate?: number;
}

export interface ConversationSession {
  id: string;
  flow: string;
  startedAt: string;
  turns: ConversationTurn[];
  decisions?: string[];
  metadata?: Record<string, unknown>;
}

export interface ConversationMeta {
  id: string;
  date: string;
  flow: string;
  turnCount: number;
  filePath: string;
}

// ─── Store functions ─────────────────────────────────────────────────────────

/**
 * Saves a conversation session to disk as a JSON file.
 * File is written to `.vectis/conversations/<timestamp>_<flow>.json`.
 */
export function saveConversation(dir: string, session: ConversationSession): string {
  const conversationsDir = path.join(dir, ".vectis", "conversations");
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }

  const timestamp = session.startedAt.replace(/[:.]/g, "-").replace(/T/, "_").replace(/Z$/, "");
  const sanitizedFlow = session.flow.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${timestamp}_${sanitizedFlow}.json`;
  const filePath = path.join(conversationsDir, filename);

  const data = JSON.stringify(session, null, 2);
  fs.writeFileSync(filePath, data, "utf-8");

  return filePath;
}

/**
 * Reads and parses a conversation file from disk.
 */
export function loadConversation(filePath: string): ConversationSession {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ConversationSession;
}

/**
 * Lists all conversation files in the project's conversations directory.
 * Returns metadata for each file: id, date, flow, turn count.
 */
export function listConversations(dir: string): ConversationMeta[] {
  const conversationsDir = path.join(dir, ".vectis", "conversations");
  if (!fs.existsSync(conversationsDir)) {
    return [];
  }

  const files = fs.readdirSync(conversationsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const results: ConversationMeta[] = [];

  for (const file of files) {
    const filePath = path.join(conversationsDir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const session = JSON.parse(raw) as ConversationSession;
      results.push({
        id: session.id,
        date: session.startedAt,
        flow: session.flow,
        turnCount: session.turns.length,
        filePath,
      });
    } catch {
      // Skip malformed files
    }
  }

  return results;
}
