import fs from "node:fs";
import path from "node:path";
import { refOutsideProject, refFileNotFound } from "../types/errors.js";

export function validateReferenceSecurity(ref: string, projectRoot: string): string {
  const absPath = path.resolve(projectRoot, ref);
  const normalizedPath = path.normalize(absPath);
  const normalizedRoot = path.normalize(projectRoot);

  // Reject paths that escape project root
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw refOutsideProject(ref);
  }

  // Reject symlinks that escape project root
  try {
    const realPath = fs.realpathSync(normalizedPath);
    if (!realPath.startsWith(normalizedRoot)) {
      throw refOutsideProject(ref);
    }
  } catch (err) {
    // If file doesn't exist, realpathSync throws — check later
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  // Check file exists
  if (!fs.existsSync(normalizedPath)) {
    throw refFileNotFound(ref);
  }

  return normalizedPath;
}
