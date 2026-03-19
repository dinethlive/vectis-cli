import {
  listConversations,
  loadConversation,
  type ConversationMeta,
  type ConversationSession,
} from "./store.js";

/**
 * Manages listing and loading past conversations from the project directory.
 */
export class ConversationHistory {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Lists all conversations, sorted by most recent first.
   */
  list(): ConversationMeta[] {
    return listConversations(this.projectDir);
  }

  /**
   * Lists conversations filtered by flow name.
   */
  listByFlow(flow: string): ConversationMeta[] {
    return listConversations(this.projectDir).filter(
      (c) => c.flow === flow,
    );
  }

  /**
   * Loads a conversation by its file path.
   */
  load(filePath: string): ConversationSession {
    return loadConversation(filePath);
  }

  /**
   * Loads the most recent conversation, optionally filtered by flow.
   */
  loadLatest(flow?: string): ConversationSession | null {
    const conversations = flow ? this.listByFlow(flow) : this.list();
    if (conversations.length === 0) return null;
    return loadConversation(conversations[0].filePath);
  }

  /**
   * Returns the total number of stored conversations.
   */
  count(): number {
    return this.list().length;
  }

  /**
   * Returns distinct flow names across all stored conversations.
   */
  flows(): string[] {
    const flowSet = new Set<string>();
    for (const c of this.list()) {
      flowSet.add(c.flow);
    }
    return [...flowSet].sort();
  }
}
