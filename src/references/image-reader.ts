import fs from "node:fs";
import path from "node:path";
import { MAX_FILE_SIZE } from "../constants.js";
import { refTooLarge } from "../types/errors.js";
import type { ResolvedReference } from "./resolver.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export async function resolveImageReference(
  absPath: string,
  original: string,
): Promise<ResolvedReference | null> {
  const stat = fs.statSync(absPath);
  if (stat.size > MAX_FILE_SIZE) {
    throw refTooLarge(original);
  }

  const ext = path.extname(absPath).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) return null;

  const buffer = fs.readFileSync(absPath);
  const base64 = buffer.toString("base64");

  return {
    original: `@${original}`,
    type: "image",
    content: `[Image: ${original}]`,
    base64,
    mediaType,
    tokenEstimate: Math.ceil(stat.size / 750), // Rough vision token estimate
  };
}
