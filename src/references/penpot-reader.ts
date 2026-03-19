import type { ResolvedReference } from "./resolver.js";
import type { SessionContext } from "../types/repl.js";
import { estimateTokens } from "../ai/token-counter.js";
import { penpotNotConnected } from "../types/errors.js";

export async function resolvePenpotReference(
  ref: string,
  ctx: SessionContext,
): Promise<ResolvedReference | null> {
  if (!ctx.bridge) {
    throw penpotNotConnected();
  }

  const bridge = ctx.bridge;

  // @penpot or @penpot:selection
  if (ref === "penpot" || ref === "penpot:selection") {
    const selection = await bridge.getSelection();
    if (!selection) return null;
    const content = JSON.stringify(selection, null, 2);
    return {
      original: `@${ref}`,
      type: "penpot",
      content: `--- Penpot Selection ---\n${content}\n--- End Selection ---`,
      tokenEstimate: estimateTokens(content),
    };
  }

  // @penpot:page/PageName
  if (ref.startsWith("penpot:page/")) {
    const pageName = ref.slice("penpot:page/".length);
    const page = await bridge.getPageByName(pageName);
    if (!page) return null;
    const content = JSON.stringify(page, null, 2);
    return {
      original: `@${ref}`,
      type: "penpot",
      content: `--- Penpot Page: ${pageName} ---\n${content}\n--- End Page ---`,
      tokenEstimate: estimateTokens(content),
    };
  }

  // @penpot:components
  if (ref === "penpot:components") {
    const components = await bridge.getComponents();
    const content = JSON.stringify(components, null, 2);
    return {
      original: `@${ref}`,
      type: "penpot",
      content: `--- Penpot Components ---\n${content}\n--- End Components ---`,
      tokenEstimate: estimateTokens(content),
    };
  }

  // @penpot:tokens
  if (ref === "penpot:tokens") {
    const tokens = await bridge.getDesignTokens();
    const content = JSON.stringify(tokens, null, 2);
    return {
      original: `@${ref}`,
      type: "penpot",
      content: `--- Penpot Design Tokens ---\n${content}\n--- End Tokens ---`,
      tokenEstimate: estimateTokens(content),
    };
  }

  // @penpot:Board/Name — fuzzy match
  if (ref.startsWith("penpot:")) {
    const name = ref.slice("penpot:".length);
    const shape = await bridge.getShapeByName(name);
    if (!shape) return null;
    const content = JSON.stringify(shape, null, 2);
    return {
      original: `@${ref}`,
      type: "penpot",
      content: `--- Penpot Shape: ${name} ---\n${content}\n--- End Shape ---`,
      tokenEstimate: estimateTokens(content),
    };
  }

  return null;
}
