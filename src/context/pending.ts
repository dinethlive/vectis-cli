import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../utils/logger.js";

export interface PendingItem {
  id: string;
  name: string;
  type: "board" | "component" | "page";
  data?: Record<string, unknown>;
  addedAt?: string;
}

function getPendingDir(projectRoot: string): string {
  return path.join(projectRoot, ".vectis", "pending");
}

function ensurePendingDir(projectRoot: string): string {
  const dir = getPendingDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Add a new item to the pending directory for review/approval.
 */
export function addPending(projectRoot: string, item: PendingItem): void {
  const dir = ensurePendingDir(projectRoot);
  const fileName = `${item.type}-${sanitizeId(item.id)}.json`;
  const filePath = path.join(dir, fileName);

  const pendingData: PendingItem = {
    ...item,
    addedAt: item.addedAt ?? new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(pendingData, null, 2), "utf-8");
}

/**
 * List all pending items awaiting approval.
 */
export function listPending(projectRoot: string): PendingItem[] {
  const dir = getPendingDir(projectRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items: PendingItem[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const item = JSON.parse(content) as PendingItem;
      items.push(item);
    } catch {
      // Skip malformed files
    }
  }

  return items;
}

/**
 * Approve a pending item — moves it from pending to tracked.
 * Updates the database to mark the board as tracked.
 */
export function approvePending(
  projectRoot: string,
  boardId: string,
  db: import("bun:sqlite").Database,
  logger: Logger,
): boolean {
  const dir = getPendingDir(projectRoot);
  const matchingFile = findPendingFile(dir, boardId);

  if (!matchingFile) {
    logger.warn(`No pending item found for board ID: ${boardId}`);
    return false;
  }

  // Read the pending item
  const content = fs.readFileSync(path.join(dir, matchingFile), "utf-8");
  const item = JSON.parse(content) as PendingItem;

  // Mark as tracked in the database
  db.run("UPDATE boards SET tracked = 1, updated_at = datetime('now') WHERE id = ?", [boardId]);

  // Remove from pending
  fs.unlinkSync(path.join(dir, matchingFile));

  logger.debug(`Approved pending item: ${item.name} [${boardId}]`);
  return true;
}

/**
 * Reject a pending item — removes it from pending without tracking.
 */
export function rejectPending(
  projectRoot: string,
  boardId: string,
  logger: Logger,
): boolean {
  const dir = getPendingDir(projectRoot);
  const matchingFile = findPendingFile(dir, boardId);

  if (!matchingFile) {
    logger.warn(`No pending item found for board ID: ${boardId}`);
    return false;
  }

  fs.unlinkSync(path.join(dir, matchingFile));

  logger.debug(`Rejected pending item: ${boardId}`);
  return true;
}

function findPendingFile(dir: string, entityId: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const sanitized = sanitizeId(entityId);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  // Look for exact match first
  for (const file of files) {
    if (file.includes(sanitized)) {
      return file;
    }
  }

  // Fallback: read each file and check the ID
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const item = JSON.parse(content) as PendingItem;
      if (item.id === entityId) {
        return file;
      }
    } catch {
      // Skip
    }
  }

  return null;
}

/**
 * Sanitize an ID for use as a filename — replace non-alphanumeric chars with dashes.
 */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, "-");
}
