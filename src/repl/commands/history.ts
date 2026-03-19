import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";

interface ConversationRecord {
  id: string;
  startedAt: string;
  turnCount: number;
  preview: string;
}

export function historyCommand(): CommandHandler {
  return {
    name: "history",
    description: "List past conversations or load one",
    usage: "/history [id]",
    async execute(args, ctx) {
      if (!ctx.config.projectRoot) {
        console.log(pc.yellow("No project initialized. Run /init first."));
        return;
      }

      const conversationsDir = path.join(ctx.config.projectRoot, ".vectis", "conversations");

      if (!fs.existsSync(conversationsDir)) {
        console.log(pc.dim("No conversation history found."));
        return;
      }

      const id = args.trim();

      if (id) {
        // Load a specific conversation
        await loadConversation(conversationsDir, id);
        return;
      }

      // List all conversations
      await listConversations(conversationsDir);
    },
  };
}

async function listConversations(dir: string): Promise<void> {
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log(pc.dim("No conversation history found."));
    return;
  }

  if (files.length === 0) {
    console.log(pc.dim("No conversation history found."));
    return;
  }

  // Sort by modification time, newest first
  const fileStats = files.map((f) => {
    const filePath = path.join(dir, f);
    try {
      const stat = fs.statSync(filePath);
      return { file: f, mtime: stat.mtimeMs };
    } catch {
      return { file: f, mtime: 0 };
    }
  });
  fileStats.sort((a, b) => b.mtime - a.mtime);

  const records: ConversationRecord[] = [];

  // Load up to 20 most recent
  const toShow = fileStats.slice(0, 20);
  for (const { file } of toShow) {
    try {
      const filePath = path.join(dir, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      const firstUserTurn = data.turns?.find((t: { role: string; content: string }) => t.role === "user");
      records.push({
        id: file.replace(/\.json$/, ""),
        startedAt: data.startedAt || "unknown",
        turnCount: data.turns?.length || 0,
        preview: firstUserTurn?.content?.slice(0, 50) || "(empty)",
      });
    } catch {
      // Skip invalid files
    }
  }

  if (records.length === 0) {
    console.log(pc.dim("No valid conversation records found."));
    return;
  }

  const table = new Table({
    head: [pc.bold("ID"), pc.bold("Date"), pc.bold("Turns"), pc.bold("Preview")],
    style: { head: [], border: [] },
  });

  for (const rec of records) {
    const dateStr = rec.startedAt !== "unknown"
      ? new Date(rec.startedAt).toLocaleDateString()
      : "unknown";
    table.push([
      pc.dim(rec.id.slice(0, 8)),
      dateStr,
      String(rec.turnCount),
      rec.preview,
    ]);
  }

  console.log(table.toString());
  console.log(pc.dim(`\nShowing ${records.length} of ${fileStats.length} conversations.`));
  console.log(pc.dim("Use /history <id> to view a conversation."));
}

async function loadConversation(dir: string, id: string): Promise<void> {
  // Try exact match first, then prefix match
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log(pc.red("Could not read conversation history."));
    return;
  }

  const match = files.find((f) => f.replace(/\.json$/, "") === id)
    || files.find((f) => f.startsWith(id));

  if (!match) {
    console.log(pc.red(`Conversation "${id}" not found.`));
    console.log(pc.dim("Use /history to list available conversations."));
    return;
  }

  try {
    const filePath = path.join(dir, match);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const conversationId = match.replace(/\.json$/, "");

    console.log(pc.bold(`Conversation: ${conversationId}`));
    if (data.startedAt) {
      console.log(pc.dim(`Started: ${new Date(data.startedAt).toLocaleString()}`));
    }
    console.log("");

    const turns = data.turns || [];
    for (const turn of turns) {
      const roleLabel = turn.role === "user"
        ? pc.blue("You")
        : pc.green("Assistant");
      const timestamp = turn.timestamp
        ? pc.dim(`[${new Date(turn.timestamp).toLocaleTimeString()}]`)
        : "";
      const tokenInfo = turn.tokenCount
        ? pc.dim(` (${turn.tokenCount.toLocaleString()} tokens)`)
        : "";

      console.log(`${timestamp} ${roleLabel}${tokenInfo}`);

      // Show truncated content for readability
      const maxLen = 300;
      const content = turn.content.length > maxLen
        ? turn.content.slice(0, maxLen) + pc.dim("...")
        : turn.content;
      console.log(`  ${content}\n`);
    }
  } catch (err) {
    console.log(pc.red("Failed to load conversation."));
    if (err instanceof Error) {
      console.log(pc.dim(err.message));
    }
  }
}
