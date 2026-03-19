import type { ClaudeClient } from "../ai/client.js";
import type { Logger } from "../utils/logger.js";
import type { StructureAnalysis, Flow } from "./analyser.js";

export interface ConversationState {
  resolvedAmbiguities: Map<string, string>;
  confirmedFlows: Set<string>;
  rejectedFlows: Set<string>;
  pendingQuestion: string | null;
  questionIndex: number;
  complete: boolean;
}

const CONVERSATION_SYSTEM_PROMPT = `You are a design engineering assistant helping to clarify a project's UI structure.
You have already analyzed the project and found some ambiguities. Ask ONE clarifying question at a time.
Keep questions focused and concise. When the user answers, acknowledge their answer briefly.

Respond with JSON:
{
  "message": "string — your question or acknowledgment to show the user",
  "resolved": "string | null — the ambiguity that was resolved by the last answer, or null",
  "flowConfirmation": "string | null — flow name to confirm/reject if asking about a flow, or null",
  "done": false
}

When all ambiguities are resolved and flows are confirmed, set "done": true and provide a final summary message.`;

export class StructureConversation {
  private client: ClaudeClient;
  private logger: Logger;
  private analysis: StructureAnalysis;
  private state: ConversationState;
  private history: Array<{ role: "user" | "assistant"; content: string }>;

  constructor(client: ClaudeClient, analysis: StructureAnalysis, logger: Logger) {
    this.client = client;
    this.analysis = analysis;
    this.logger = logger;
    this.state = {
      resolvedAmbiguities: new Map(),
      confirmedFlows: new Set(),
      rejectedFlows: new Set(),
      pendingQuestion: null,
      questionIndex: 0,
      complete: false,
    };
    this.history = [];
  }

  getState(): Readonly<ConversationState> {
    return this.state;
  }

  getAnalysis(): StructureAnalysis {
    return this.analysis;
  }

  isComplete(): boolean {
    return this.state.complete;
  }

  async askQuestion(): Promise<string> {
    if (this.state.complete) {
      return "Structure analysis is complete. No more questions.";
    }

    // If no ambiguities remain, mark complete
    const unresolvedAmbiguities = this.analysis.ambiguities.filter(
      (a) => !this.state.resolvedAmbiguities.has(a),
    );
    const unconfirmedFlows = this.analysis.flows.filter(
      (f) => !this.state.confirmedFlows.has(f.name) && !this.state.rejectedFlows.has(f.name),
    );

    if (unresolvedAmbiguities.length === 0 && unconfirmedFlows.length === 0) {
      this.state.complete = true;
      return "All ambiguities resolved and flows confirmed. Structure analysis is complete.";
    }

    const contextMessage = this.buildContextMessage(unresolvedAmbiguities, unconfirmedFlows);
    this.history.push({ role: "user", content: contextMessage });

    const result = await this.client.sendMessage(
      this.history.map((h) => ({ role: h.role, content: h.content })),
      {
        system: CONVERSATION_SYSTEM_PROMPT,
        maxTokens: 1024,
      },
    );

    const parsed = this.parseConversationResponse(result.content);
    this.history.push({ role: "assistant", content: result.content });

    this.state.pendingQuestion = parsed.message;
    this.state.questionIndex++;

    if (parsed.done) {
      this.state.complete = true;
    }

    return parsed.message;
  }

  async handleAnswer(answer: string): Promise<string> {
    if (this.state.complete) {
      return "Structure analysis is already complete.";
    }

    this.history.push({ role: "user", content: answer });

    const result = await this.client.sendMessage(
      this.history.map((h) => ({ role: h.role, content: h.content })),
      {
        system: CONVERSATION_SYSTEM_PROMPT,
        maxTokens: 1024,
      },
    );

    const parsed = this.parseConversationResponse(result.content);
    this.history.push({ role: "assistant", content: result.content });

    // Track resolved ambiguity
    if (parsed.resolved) {
      this.state.resolvedAmbiguities.set(parsed.resolved, answer);
      this.logger.debug(`Resolved ambiguity: ${parsed.resolved}`);
    }

    // Track flow confirmation
    if (parsed.flowConfirmation) {
      const isConfirmed = answer.toLowerCase().includes("yes") ||
        answer.toLowerCase().includes("correct") ||
        answer.toLowerCase().includes("confirm");
      if (isConfirmed) {
        this.state.confirmedFlows.add(parsed.flowConfirmation);
      } else {
        this.state.rejectedFlows.add(parsed.flowConfirmation);
      }
    }

    if (parsed.done) {
      this.state.complete = true;
    }

    this.state.pendingQuestion = parsed.message;
    return parsed.message;
  }

  /**
   * Get the final analysis with any modifications from the conversation.
   * Rejected flows are removed from the analysis.
   */
  getFinalAnalysis(): StructureAnalysis {
    const filteredFlows = this.analysis.flows.filter(
      (f) => !this.state.rejectedFlows.has(f.name),
    );

    const resolvedList = Array.from(this.state.resolvedAmbiguities.entries()).map(
      ([ambiguity, resolution]) => `${ambiguity} (Resolved: ${resolution})`,
    );

    return {
      ...this.analysis,
      flows: filteredFlows,
      ambiguities: resolvedList,
    };
  }

  private buildContextMessage(
    unresolvedAmbiguities: string[],
    unconfirmedFlows: Flow[],
  ): string {
    const parts: string[] = [];

    parts.push(`Project: ${this.analysis.projectName}`);
    parts.push(`Description: ${this.analysis.projectDescription}`);

    if (unresolvedAmbiguities.length > 0) {
      parts.push(`\nUnresolved ambiguities:\n${unresolvedAmbiguities.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`);
    }

    if (unconfirmedFlows.length > 0) {
      parts.push(`\nFlows awaiting confirmation:\n${unconfirmedFlows.map((f) => `  - ${f.name}: ${f.description}`).join("\n")}`);
    }

    parts.push("\nAsk the next clarifying question.");

    return parts.join("\n");
  }

  private parseConversationResponse(content: string): {
    message: string;
    resolved: string | null;
    flowConfirmation: string | null;
    done: boolean;
  } {
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      const data = JSON.parse(jsonStr) as Record<string, unknown>;
      return {
        message: String(data.message ?? "Could you clarify that?"),
        resolved: data.resolved ? String(data.resolved) : null,
        flowConfirmation: data.flowConfirmation ? String(data.flowConfirmation) : null,
        done: Boolean(data.done),
      };
    } catch {
      // If parsing fails, use the raw content as the message
      this.logger.debug("Failed to parse conversation response as JSON, using raw content");
      return {
        message: content,
        resolved: null,
        flowConfirmation: null,
        done: false,
      };
    }
  }
}
