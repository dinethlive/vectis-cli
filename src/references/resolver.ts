import { resolveFileReference, resolveFolderReference } from "./file-reader.js";
import { resolvePenpotReference } from "./penpot-reader.js";
import { resolveImageReference, isImageFile } from "./image-reader.js";
import { validateReferenceSecurity } from "./security.js";
import { estimateTokens } from "../ai/token-counter.js";
import type { SessionContext } from "../types/repl.js";

export interface ResolvedReference {
  original: string;
  type: "file" | "folder" | "penpot" | "image";
  content: string;
  base64?: string;
  mediaType?: string;
  tokenEstimate: number;
}

const REF_PATTERN = /@([\w./:\\-]+(?:\S*)?)/g;

export function extractReferences(input: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_PATTERN.source, "g");
  while ((match = re.exec(input)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

export async function resolveReferences(
  input: string,
  ctx: SessionContext,
): Promise<ResolvedReference[]> {
  const refs = extractReferences(input);
  if (refs.length === 0) return [];

  const resolved: ResolvedReference[] = [];

  for (const ref of refs) {
    try {
      // Penpot references
      if (ref.startsWith("penpot:") || ref === "penpot") {
        const result = await resolvePenpotReference(ref, ctx);
        if (result) resolved.push(result);
        continue;
      }

      // File/folder references
      const projectRoot = ctx.config.projectRoot || process.cwd();
      const absPath = validateReferenceSecurity(ref, projectRoot);

      if (ref.endsWith("/")) {
        const items = await resolveFolderReference(absPath, ref);
        resolved.push(...items);
      } else if (isImageFile(absPath)) {
        const img = await resolveImageReference(absPath, ref);
        if (img) resolved.push(img);
      } else {
        const file = await resolveFileReference(absPath, ref);
        if (file) resolved.push(file);
      }
    } catch (err) {
      ctx.logger.debug(`Failed to resolve @${ref}: ${err}`);
    }
  }

  return resolved;
}
