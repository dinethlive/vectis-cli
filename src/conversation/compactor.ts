import type { ClaudeClient } from "../ai/client.js";
import type { ConversationTurn } from "./store.js";
import { estimateTokens } from "../ai/token-counter.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 60_000;
const RECENT_TURNS_TO_KEEP = 6;

const COMPACTION_SYSTEM_PROMPT = `You are a conversation compactor. Summarize the following conversation turns into a concise summary that preserves:
- All design decisions made and their reasoning
- Boards, screens, or components that were created or modified
- Open questions or unresolved issues
- Constraints or requirements that were established
- Current flow context and progress

Output a structured summary in this format:

## Decisions
- [list each decision with brief reasoning]

## Created/Modified
- [list boards, screens, components that changed]

## Open Questions
- [list unresolved items]

## Constraints
- [list established constraints]

## Context
[brief paragraph of where the conversation left off]`;

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Determines whether the conversation should be compacted based on
 * estimated total token count across all turns.
 */
export function shouldCompact(turns: ConversationTurn[], maxTokens?: number): boolean {
  const limit = maxTokens ?? DEFAULT_MAX_TOKENS;
  let total = 0;
  for (const turn of turns) {
    total += turn.tokenEstimate ?? estimateTokens(turn.content);
    if (total > limit) return true;
  }
  return false;
}

/**
 * Compacts a conversation by summarizing older turns via Claude,
 * then returning the summary turn plus the most recent turns.
 *
 * Preserves: decisions, reasoning, boards created, open questions, constraints.
 */
export async function compactConversation(
  client: ClaudeClient,
  turns: ConversationTurn[],
): Promise<ConversationTurn[]> {
  if (turns.length <= RECENT_TURNS_TO_KEEP) {
    return turns;
  }

  const oldTurns = turns.slice(0, turns.length - RECENT_TURNS_TO_KEEP);
  const recentTurns = turns.slice(turns.length - RECENT_TURNS_TO_KEEP);

  // Build the conversation text to summarize
  const conversationText = oldTurns
    .map((t) => `[${t.role}]: ${t.content}`)
    .join("\n\n");

  const result = await client.sendMessage(
    [
      {
        role: "user",
        content: `Please summarize this conversation:\n\n${conversationText}`,
      },
    ],
    {
      system: COMPACTION_SYSTEM_PROMPT,
      maxTokens: 2048,
    },
  );

  const summaryTurn: ConversationTurn = {
    role: "assistant",
    content: `[Compacted Summary]\n\n${result.content}`,
    timestamp: new Date().toISOString(),
    tokenEstimate: estimateTokens(result.content),
  };

  return [summaryTurn, ...recentTurns];
}
