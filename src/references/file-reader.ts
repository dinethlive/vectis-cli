import fs from "node:fs";
import path from "node:path";
import { estimateTokens } from "../ai/token-counter.js";
import { refTooLarge } from "../types/errors.js";
import { MAX_FILE_SIZE } from "../constants.js";
import type { ResolvedReference } from "./resolver.js";

const BINARY_EXTENSIONS = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".db", ".sqlite", ".db-journal", ".db-wal",
  ".wasm", ".o", ".a",
]);

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export async function resolveFileReference(
  absPath: string,
  original: string,
): Promise<ResolvedReference | null> {
  const stat = fs.statSync(absPath);
  if (stat.size > MAX_FILE_SIZE) {
    throw refTooLarge(original);
  }

  if (isBinaryFile(absPath)) {
    return null; // Skip binary (images handled separately)
  }

  const content = fs.readFileSync(absPath, "utf-8");
  return {
    original: `@${original}`,
    type: "file",
    content: `--- File: ${original} ---\n${content}\n--- End: ${original} ---`,
    tokenEstimate: estimateTokens(content),
  };
}

export async function resolveFolderReference(
  absPath: string,
  original: string,
): Promise<ResolvedReference[]> {
  const entries = fs.readdirSync(absPath).sort();
  const results: ResolvedReference[] = [];

  for (const entry of entries) {
    const filePath = path.join(absPath, entry);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;
    if (isBinaryFile(filePath)) continue;
    if (stat.size > MAX_FILE_SIZE) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    results.push({
      original: `@${original}${entry}`,
      type: "folder",
      content: `--- File: ${original}${entry} ---\n${content}\n--- End: ${original}${entry} ---`,
      tokenEstimate: estimateTokens(content),
    });
  }

  return results;
}
