import type { ClaudeClient, StreamResult } from "../ai/client.js";
import type { LayoutSpec } from "./types.js";
import {
  buildSpecSystemPrompt,
  buildSpecUserPrompt,
} from "../ai/prompts/spec-generator.js";
import type { SpecPromptContext } from "../ai/prompts/spec-generator.js";
import { VectisError } from "../types/errors.js";
import { LAYOUT_SPEC_TOOL } from "../ai/tools/layout-spec-tool.js";

export interface SpecGeneratorContext {
  /** Board / screen name to generate. */
  boardName: string;
  /** Optional human description of what the board should contain. */
  boardDescription?: string;
  /** Markdown or text describing the flow this board belongs to. */
  flowContext?: string;
  /** List of available component names (from the component index). */
  componentNames: string[];
  /** Token set listings (stringified — e.g. "color.primary: #1a73e8"). */
  tokenSets: string[];
  /** Full-text content of relevant skills (already loaded). */
  skills: string[];
  /** Whether to use tool_use for structured output. */
  useToolUse?: boolean;
}

export interface GenerateSpecResult {
  spec: LayoutSpec;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Generate a LayoutSpec by streaming a response from the AI client.
 *
 * 1. Assembles the prompt from context + skills + component index + tokens
 * 2. Streams Claude's response (optionally via tool_use for structured output)
 * 3. Parses the resulting JSON into a LayoutSpec
 *
 * Throws `VectisError` with code `SPEC_VALIDATION_FAILED` when the
 * response cannot be parsed as valid JSON.
 */
export async function generateSpec(
  client: ClaudeClient,
  context: SpecGeneratorContext,
  options?: {
    maxTokens?: number;
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
  },
): Promise<GenerateSpecResult> {
  const promptCtx: SpecPromptContext = {
    boardName: context.boardName,
    boardDescription: context.boardDescription,
    flowContext: context.flowContext,
    componentNames: context.componentNames,
    tokenSets: context.tokenSets,
    skills: context.skills,
    useToolUse: context.useToolUse,
  };

  const system = buildSpecSystemPrompt(promptCtx);
  const userPrompt = buildSpecUserPrompt(promptCtx);

  const messages = [{ role: "user" as const, content: userPrompt }];

  const toolOptions = context.useToolUse
    ? {
        tools: [LAYOUT_SPEC_TOOL],
        toolChoice: { type: "tool" as const, name: LAYOUT_SPEC_TOOL.name },
      }
    : {};

  const stream = client.streamMessage(messages, {
    system,
    maxTokens: options?.maxTokens ?? 8192,
    signal: options?.signal,
    ...toolOptions,
  });

  let fullContent = "";
  let result: IteratorResult<string, StreamResult>;

  do {
    result = await stream.next();
    if (!result.done) {
      fullContent += result.value;
      options?.onChunk?.(result.value);
    }
  } while (!result.done);

  const streamResult = result.value as StreamResult;

  // Try tool_use result first, fall back to text parsing
  const spec = streamResult.toolUseInput
    ? (streamResult.toolUseInput as LayoutSpec)
    : parseSpecJson(fullContent);

  return {
    spec,
    inputTokens: streamResult.inputTokens,
    outputTokens: streamResult.outputTokens,
  };
}

/**
 * Extract and parse LayoutSpec JSON from an AI response string.
 * Handles cases where the model wraps JSON in markdown fences.
 */
function parseSpecJson(raw: string): LayoutSpec {
  let jsonStr = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Try to find the outermost JSON object
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr) as LayoutSpec;
    return parsed;
  } catch (err) {
    throw new VectisError(
      `Failed to parse LayoutSpec JSON: ${err}`,
      "SPEC_VALIDATION_FAILED",
      "The AI response could not be parsed as valid LayoutSpec JSON.",
      "Try regenerating the spec or simplify your request.",
    );
  }
}
