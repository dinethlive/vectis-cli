import type { Database } from "bun:sqlite";

// ─── Cross-table query types ─────────────────────────────────────────────────

export interface BoardWithPage {
  id: string;
  page_id: string;
  board_name: string;
  page_name: string;
  is_tracked: number;
  layout_type: string | null;
  layer_count: number;
  has_context: number;
  pulled_at: string;
}

export interface ComponentUsageSummary {
  total_components: number;
  with_variants: number;
  with_annotations: number;
}

export interface FlowWithScreenCount {
  name: string;
  screen_count: number;
  context_path: string | null;
  actual_board_count: number;
}

export interface GraphSummary {
  pages: number;
  boards: number;
  components: number;
  token_sets: number;
  flows: number;
}

// ─── Query functions ─────────────────────────────────────────────────────────

/**
 * Returns all boards joined with their parent page name.
 */
export function getBoardsWithPage(db: Database): BoardWithPage[] {
  return db.query(
    `SELECT
       b.id,
       b.page_id,
       b.name AS board_name,
       p.name AS page_name,
       b.is_tracked,
       b.layout_type,
       b.layer_count,
       b.has_context,
       b.pulled_at
     FROM boards b
     INNER JOIN pages p ON b.page_id = p.id
     ORDER BY p.name, b.name`,
  ).all() as BoardWithPage[];
}

/**
 * Returns boards that belong to a named flow.
 * Uses context_path from the flow to match boards by page relationship.
 */
export function getBoardsByFlow(db: Database, flowName: string): BoardWithPage[] {
  return db.query(
    `SELECT
       b.id,
       b.page_id,
       b.name AS board_name,
       p.name AS page_name,
       b.is_tracked,
       b.layout_type,
       b.layer_count,
       b.has_context,
       b.pulled_at
     FROM boards b
     INNER JOIN pages p ON b.page_id = p.id
     INNER JOIN flows f ON f.name = ?
     WHERE p.name = f.name OR f.context_path IS NOT NULL
     ORDER BY b.name`,
    [flowName],
  ).all() as BoardWithPage[];
}

/**
 * Returns a summary of component usage: total count, how many have variants,
 * and how many have annotations.
 */
export function getComponentUsageSummary(db: Database): ComponentUsageSummary {
  const row = db.query(
    `SELECT
       COUNT(*) AS total_components,
       SUM(CASE WHEN variants IS NOT NULL AND variants != '' THEN 1 ELSE 0 END) AS with_variants,
       SUM(CASE WHEN annotation IS NOT NULL AND annotation != '' THEN 1 ELSE 0 END) AS with_annotations
     FROM components`,
  ).get() as ComponentUsageSummary;
  return row;
}

/**
 * Returns all events that have not yet been processed.
 */
export function getUnprocessedEvents(db: Database): Array<{
  id: number;
  event_type: string;
  payload: string;
  processed: number;
  received_at: string;
}> {
  return db.query(
    "SELECT * FROM events WHERE processed = 0 ORDER BY received_at ASC",
  ).all() as Array<{
    id: number;
    event_type: string;
    payload: string;
    processed: number;
    received_at: string;
  }>;
}

/**
 * Marks a single event as processed.
 */
export function markEventProcessed(db: Database, eventId: number): void {
  db.run("UPDATE events SET processed = 1 WHERE id = ?", [eventId]);
}

/**
 * Returns a flow along with an actual board count computed by counting
 * boards whose page name matches the flow name.
 */
export function getFlowWithScreenCount(db: Database, flowName: string): FlowWithScreenCount | null {
  return db.query(
    `SELECT
       f.name,
       f.screen_count,
       f.context_path,
       (SELECT COUNT(*) FROM boards b
        INNER JOIN pages p ON b.page_id = p.id
        WHERE p.name = f.name) AS actual_board_count
     FROM flows f
     WHERE f.name = ?`,
    [flowName],
  ).get() as FlowWithScreenCount | null;
}

/**
 * Returns aggregate counts for the main graph tables.
 */
export function getGraphSummary(db: Database): GraphSummary {
  const row = db.query(
    `SELECT
       (SELECT COUNT(*) FROM pages) AS pages,
       (SELECT COUNT(*) FROM boards) AS boards,
       (SELECT COUNT(*) FROM components) AS components,
       (SELECT COUNT(*) FROM token_sets) AS token_sets,
       (SELECT COUNT(*) FROM flows) AS flows`,
  ).get() as GraphSummary;
  return row;
}
