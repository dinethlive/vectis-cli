import type { Database } from "bun:sqlite";
import type { Logger } from "../utils/logger.js";
import { addPending } from "./pending.js";

export interface BoardEvent {
  type: "board_added" | "board_renamed" | "board_deleted";
  boardId: string;
  name: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface ComponentEvent {
  type: "component_changed";
  componentId: string;
  name: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface PageEvent {
  type: "page_added";
  pageId: string;
  name: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export type PenpotEvent = BoardEvent | ComponentEvent | PageEvent;

export class EventProcessor {
  private db: Database;
  private logger: Logger;
  private projectRoot: string;

  constructor(db: Database, projectRoot: string, logger: Logger) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.logger = logger;
  }

  /**
   * Ensure the required tables exist for event processing.
   */
  ensureTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT,
        processed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tracked INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Process a single event and update the database accordingly.
   */
  processEvent(event: PenpotEvent): void {
    const timestamp = event.timestamp ?? new Date().toISOString();
    const dataJson = event.data ? JSON.stringify(event.data) : null;

    // Store the raw event
    const entityId = this.getEntityId(event);
    this.db.run(
      "INSERT INTO events (type, entity_id, name, data, processed) VALUES (?, ?, ?, ?, 1)",
      [event.type, entityId, event.name, dataJson],
    );

    // Process by type
    switch (event.type) {
      case "board_added":
        this.handleBoardAdded(event as BoardEvent);
        break;
      case "board_renamed":
        this.handleBoardRenamed(event as BoardEvent);
        break;
      case "board_deleted":
        this.handleBoardDeleted(event as BoardEvent);
        break;
      case "component_changed":
        this.handleComponentChanged(event as ComponentEvent);
        break;
      case "page_added":
        this.handlePageAdded(event as PageEvent);
        break;
      default:
        this.logger.warn(`Unknown event type: ${(event as PenpotEvent).type}`);
    }
  }

  /**
   * Process all unprocessed events in the database.
   */
  processPending(): number {
    const rows = this.db.query(
      "SELECT id, type, entity_id, name, data FROM events WHERE processed = 0 ORDER BY id ASC",
    ).all() as Array<{
      id: number;
      type: string;
      entity_id: string;
      name: string;
      data: string | null;
    }>;

    let processedCount = 0;

    for (const row of rows) {
      try {
        const parsedData = row.data ? JSON.parse(row.data) as Record<string, unknown> : undefined;

        const event = this.reconstructEvent(
          row.type,
          row.entity_id,
          row.name,
          parsedData,
        );

        if (event) {
          // Process the event logic (not re-inserting the raw event)
          this.processEventLogic(event);

          // Mark as processed
          this.db.run("UPDATE events SET processed = 1 WHERE id = ?", [row.id]);
          processedCount++;
        }
      } catch (err) {
        this.logger.error(
          `Failed to process event ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (processedCount > 0) {
      this.logger.debug(`Processed ${processedCount} pending event(s)`);
    }

    return processedCount;
  }

  private handleBoardAdded(event: BoardEvent): void {
    this.db.run(
      "INSERT OR IGNORE INTO boards (id, name, tracked) VALUES (?, ?, 0)",
      [event.boardId, event.name],
    );

    // Add to pending for approval
    addPending(this.projectRoot, {
      id: event.boardId,
      name: event.name,
      type: "board",
      data: event.data,
    });

    this.logger.debug(`Board added (pending approval): ${event.name} [${event.boardId}]`);
  }

  private handleBoardRenamed(event: BoardEvent): void {
    this.db.run(
      "UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?",
      [event.name, event.boardId],
    );
    this.logger.debug(`Board renamed: ${event.name} [${event.boardId}]`);
  }

  private handleBoardDeleted(event: BoardEvent): void {
    this.db.run("DELETE FROM boards WHERE id = ?", [event.boardId]);
    this.logger.debug(`Board deleted: ${event.boardId}`);
  }

  private handleComponentChanged(event: ComponentEvent): void {
    const dataJson = event.data ? JSON.stringify(event.data) : null;
    this.db.run(
      `INSERT INTO components (id, name, data, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET name = ?, data = ?, updated_at = datetime('now')`,
      [event.componentId, event.name, dataJson, event.name, dataJson],
    );
    this.logger.debug(`Component changed: ${event.name} [${event.componentId}]`);
  }

  private handlePageAdded(event: PageEvent): void {
    this.db.run(
      "INSERT OR IGNORE INTO pages (id, name) VALUES (?, ?)",
      [event.pageId, event.name],
    );
    this.logger.debug(`Page added: ${event.name} [${event.pageId}]`);
  }

  private getEntityId(event: PenpotEvent): string {
    switch (event.type) {
      case "board_added":
      case "board_renamed":
      case "board_deleted":
        return (event as BoardEvent).boardId;
      case "component_changed":
        return (event as ComponentEvent).componentId;
      case "page_added":
        return (event as PageEvent).pageId;
      default:
        return "unknown";
    }
  }

  private reconstructEvent(
    type: string,
    entityId: string,
    name: string,
    data?: Record<string, unknown>,
  ): PenpotEvent | null {
    switch (type) {
      case "board_added":
      case "board_renamed":
      case "board_deleted":
        return { type, boardId: entityId, name, data } as BoardEvent;
      case "component_changed":
        return { type, componentId: entityId, name, data } as ComponentEvent;
      case "page_added":
        return { type, pageId: entityId, name, data } as PageEvent;
      default:
        this.logger.warn(`Cannot reconstruct unknown event type: ${type}`);
        return null;
    }
  }

  /**
   * Process just the logic for an event (without inserting the raw event row).
   * Used by processPending to avoid duplicate raw event insertion.
   */
  private processEventLogic(event: PenpotEvent): void {
    switch (event.type) {
      case "board_added":
        this.handleBoardAdded(event as BoardEvent);
        break;
      case "board_renamed":
        this.handleBoardRenamed(event as BoardEvent);
        break;
      case "board_deleted":
        this.handleBoardDeleted(event as BoardEvent);
        break;
      case "component_changed":
        this.handleComponentChanged(event as ComponentEvent);
        break;
      case "page_added":
        this.handlePageAdded(event as PageEvent);
        break;
    }
  }
}
