import type { ClaudeClient } from "../ai/client.js";
import type { Logger } from "../utils/logger.js";

export interface FlowScreen {
  name: string;
  description: string;
  components: string[];
}

export interface Flow {
  name: string;
  description: string;
  screens: FlowScreen[];
}

export interface StructureAnalysis {
  projectName: string;
  projectDescription: string;
  flows: Flow[];
  constraints: string[];
  ambiguities: string[];
}

const STRUCTURE_SYSTEM_PROMPT = `You are a design engineering analyst. You analyze project files and extract the UI structure.

Given project files, identify:
1. **Flows**: User journeys or feature areas (e.g., "Authentication", "Dashboard", "Settings")
2. **Screens/Boards per flow**: Individual screens within each flow, with a brief description and key components
3. **Constraints**: Design constraints mentioned (accessibility requirements, responsive breakpoints, design tokens, layout rules, etc.)
4. **Ambiguities**: Anything unclear or potentially conflicting that needs human clarification

Respond ONLY with valid JSON matching this exact schema:
{
  "projectName": "string",
  "projectDescription": "string — one-sentence overview",
  "flows": [
    {
      "name": "string — flow name in kebab-case",
      "description": "string — what this flow covers",
      "screens": [
        {
          "name": "string — screen name in kebab-case",
          "description": "string — what this screen shows",
          "components": ["string — key UI components on this screen"]
        }
      ]
    }
  ],
  "constraints": ["string — each design constraint found"],
  "ambiguities": ["string — each unclear item that needs clarification"]
}`;

export async function analyseStructure(
  client: ClaudeClient,
  files: { path: string; content: string }[],
  logger: Logger,
): Promise<StructureAnalysis> {
  const fileContents = files
    .map((f) => `--- File: ${f.path} ---\n${f.content}\n--- End: ${f.path} ---`)
    .join("\n\n");

  const userMessage = `Analyze the following project files and extract the UI structure:\n\n${fileContents}`;

  logger.debug(`Sending ${files.length} file(s) to Claude for structure analysis`);

  const result = await client.sendMessage(
    [{ role: "user", content: userMessage }],
    {
      system: STRUCTURE_SYSTEM_PROMPT,
      maxTokens: 8192,
    },
  );

  logger.debug(`Structure analysis received (${result.outputTokens} tokens)`);

  const parsed = parseAnalysisResponse(result.content);
  return parsed;
}

function parseAnalysisResponse(content: string): StructureAnalysis {
  // Try to extract JSON from the response — Claude may wrap it in markdown code fences
  let jsonStr = content.trim();

  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const data = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
      projectName: String(data.projectName ?? "Untitled Project"),
      projectDescription: String(data.projectDescription ?? ""),
      flows: Array.isArray(data.flows) ? data.flows.map(parseFlow) : [],
      constraints: Array.isArray(data.constraints) ? data.constraints.map(String) : [],
      ambiguities: Array.isArray(data.ambiguities) ? data.ambiguities.map(String) : [],
    };
  } catch {
    throw new Error(
      `Failed to parse structure analysis response as JSON. Raw content:\n${content.slice(0, 500)}`,
    );
  }
}

function parseFlow(raw: unknown): Flow {
  const obj = raw as Record<string, unknown>;
  return {
    name: String(obj.name ?? "unnamed-flow"),
    description: String(obj.description ?? ""),
    screens: Array.isArray(obj.screens) ? obj.screens.map(parseScreen) : [],
  };
}

function parseScreen(raw: unknown): FlowScreen {
  const obj = raw as Record<string, unknown>;
  return {
    name: String(obj.name ?? "unnamed-screen"),
    description: String(obj.description ?? ""),
    components: Array.isArray(obj.components) ? obj.components.map(String) : [],
  };
}
