import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { withRetry } from "./retry.js";
import { VectisError } from "../types/errors.js";
import type { Logger } from "../utils/logger.js";

export interface StreamResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  toolUseInput?: unknown;
}

export interface ClaudeClientOptions {
  apiKey: string;
  model: string;
  logger: Logger;
}

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private logger: Logger;

  constructor(options: ClaudeClientOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
    this.logger = options.logger;
  }

  async *streamMessage(
    messages: MessageParam[],
    options?: {
      system?: string;
      maxTokens?: number;
      signal?: AbortSignal;
      tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
      toolChoice?: { type: "auto" } | { type: "any" } | { type: "tool"; name: string };
    },
  ): AsyncGenerator<string, StreamResult> {
    const maxTokens = options?.maxTokens ?? 4096;

    const streamFn = async () => {
      return this.client.messages.stream({
        model: this.model,
        max_tokens: maxTokens,
        system: options?.system,
        messages,
        ...(options?.tools?.length ? { tools: options.tools } : {}),
        ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
      });
    };

    const stream = await withRetry(streamFn, this.logger);
    let content = "";
    let toolInputJson = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;

    try {
      for await (const event of stream) {
        if (options?.signal?.aborted) {
          stream.controller.abort();
          break;
        }

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            content += event.delta.text;
            yield event.delta.text;
          } else if (event.delta.type === "input_json_delta") {
            toolInputJson += event.delta.partial_json;
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;
      stopReason = finalMessage.stop_reason;
    } catch (err) {
      if (options?.signal?.aborted) {
        // Graceful abort — return what we have
      } else {
        throw err;
      }
    }

    let toolUseInput: unknown;
    if (toolInputJson) {
      try {
        toolUseInput = JSON.parse(toolInputJson);
      } catch { /* malformed tool input — fall back to text */ }
    }

    return { content, inputTokens, outputTokens, stopReason, toolUseInput };
  }

  async sendMessage(
    messages: MessageParam[],
    options?: {
      system?: string;
      maxTokens?: number;
    },
  ): Promise<StreamResult> {
    const gen = this.streamMessage(messages, options);
    let result: IteratorResult<string, StreamResult>;
    do {
      result = await gen.next();
    } while (!result.done);
    return result.value;
  }

  async countTokens(messages: MessageParam[], system?: string): Promise<number> {
    try {
      const result = await this.client.messages.countTokens({
        model: this.model,
        messages,
        system,
      });
      return result.input_tokens;
    } catch {
      // Fallback to heuristic
      return this.estimateTokens(messages);
    }
  }

  estimateTokens(messages: MessageParam[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg.content === "string") {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text") {
            totalChars += block.text.length;
          }
        }
      }
    }
    return Math.ceil(totalChars / 4);
  }
}
