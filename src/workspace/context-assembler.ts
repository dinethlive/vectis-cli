import fs from "node:fs";
import path from "node:path";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { ResolvedReference } from "../references/resolver.js";
import type { SessionContext, ConversationTurn } from "../types/repl.js";
import { TOKEN_BUDGET_WARNING } from "../constants.js";
import { estimateTokens } from "../ai/token-counter.js";
import pc from "picocolors";

const SYSTEM_PROMPT = `You are Vectis, an AI design engineering assistant that works with Penpot (open-source design tool).

You help designers and developers:
- Understand design systems, components, and layout patterns
- Analyze design files and provide feedback
- Generate layout specifications
- Bridge the gap between design intent and implementation

When referencing design elements, be specific about names, layers, and properties.
When suggesting changes, use concrete values from the design system's tokens.
Be concise but thorough. Prefer actionable suggestions over general advice.`;

export function assembleContext(
  userInput: string,
  refs: ResolvedReference[],
  ctx: SessionContext,
): { messages: MessageParam[]; system: string } {
  const systemParts: string[] = [SYSTEM_PROMPT];

  // Add project context if available
  if (ctx.config.projectRoot) {
    const projectMd = path.join(ctx.config.projectRoot, "context", "project.md");
    if (fs.existsSync(projectMd)) {
      const content = fs.readFileSync(projectMd, "utf-8");
      systemParts.push(`\n--- Project Context ---\n${content}`);
    }

    // Active flow context
    if (ctx.state.currentFlow) {
      const flowMd = path.join(
        ctx.config.projectRoot,
        "context",
        "flows",
        `${ctx.state.currentFlow}.md`,
      );
      if (fs.existsSync(flowMd)) {
        const content = fs.readFileSync(flowMd, "utf-8");
        systemParts.push(`\n--- Active Flow: ${ctx.state.currentFlow} ---\n${content}`);
      }
    }
  }

  // Always-on skills
  const alwaysOnSkills = ctx.skills.getAlwaysOnSkills();
  for (const skill of alwaysOnSkills) {
    systemParts.push(`\n--- Skill: ${skill.name} ---\n${skill.content}`);
  }

  const system = systemParts.join("\n");

  // Build messages from conversation history + current input
  const messages: MessageParam[] = [];

  // Previous turns (conversation history)
  for (const turn of ctx.session.turns) {
    messages.push({
      role: turn.role,
      content: turn.content,
    });
  }

  // Current user message with resolved references
  const userContent: ContentBlockParam[] = [];

  // Add text references
  const textRefs = refs.filter((r) => r.type !== "image");
  if (textRefs.length > 0) {
    const refContent = textRefs.map((r) => r.content).join("\n\n");
    userContent.push({ type: "text", text: refContent });
  }

  // Add image references (for Claude vision)
  const imageRefs = refs.filter((r) => r.type === "image" && r.base64);
  for (const img of imageRefs) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: img.base64!,
      },
    });
  }

  // Add user's actual message
  userContent.push({ type: "text", text: userInput });

  messages.push({ role: "user", content: userContent });

  // Token budget warning
  const totalTokenEstimate =
    estimateTokens(system) +
    refs.reduce((sum, r) => sum + r.tokenEstimate, 0) +
    estimateTokens(userInput);

  if (totalTokenEstimate > TOKEN_BUDGET_WARNING) {
    console.log(
      pc.yellow(
        `Warning: Estimated ${totalTokenEstimate.toLocaleString()} tokens in context (budget: ${TOKEN_BUDGET_WARNING.toLocaleString()})`,
      ),
    );
  }

  return { messages, system };
}
