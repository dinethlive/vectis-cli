import type { Database } from "bun:sqlite";

// ─── Page ────────────────────────────────────────────────────────────────────

export interface PageRow {
  id: string;
  name: string;
  is_tracked: number;
  board_count: number;
  pulled_at: string;
}

export function upsertPage(db: Database, page: PageRow): void {
  db.run(
    `INSERT INTO pages (id, name, is_tracked, board_count, pulled_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       is_tracked=excluded.is_tracked,
       board_count=excluded.board_count,
       pulled_at=excluded.pulled_at`,
    [page.id, page.name, page.is_tracked, page.board_count, page.pulled_at],
  );
}

export function getPageById(db: Database, id: string): PageRow | null {
  return (db.query("SELECT * FROM pages WHERE id = ?").get(id) as PageRow | null);
}

export function getAllPages(db: Database): PageRow[] {
  return db.query("SELECT * FROM pages").all() as PageRow[];
}

export function deletePage(db: Database, id: string): void {
  db.run("DELETE FROM pages WHERE id = ?", [id]);
}

// ─── Board ───────────────────────────────────────────────────────────────────

export interface BoardRow {
  id: string;
  page_id: string;
  name: string;
  is_tracked: number;
  layout_type: string | null;
  layer_count: number;
  has_context: number;
  pulled_at: string;
}

export function upsertBoard(db: Database, board: BoardRow): void {
  db.run(
    `INSERT INTO boards (id, page_id, name, is_tracked, layout_type, layer_count, has_context, pulled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       page_id=excluded.page_id,
       name=excluded.name,
       is_tracked=excluded.is_tracked,
       layout_type=excluded.layout_type,
       layer_count=excluded.layer_count,
       has_context=excluded.has_context,
       pulled_at=excluded.pulled_at`,
    [
      board.id,
      board.page_id,
      board.name,
      board.is_tracked,
      board.layout_type,
      board.layer_count,
      board.has_context,
      board.pulled_at,
    ],
  );
}

export function getBoardById(db: Database, id: string): BoardRow | null {
  return (db.query("SELECT * FROM boards WHERE id = ?").get(id) as BoardRow | null);
}

export function getAllBoards(db: Database): BoardRow[] {
  return db.query("SELECT * FROM boards").all() as BoardRow[];
}

export function deleteBoard(db: Database, id: string): void {
  db.run("DELETE FROM boards WHERE id = ?", [id]);
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ComponentRow {
  id: string;
  name: string;
  variants: string | null;
  annotation: string | null;
  pulled_at: string;
}

export function upsertComponent(db: Database, component: ComponentRow): void {
  db.run(
    `INSERT INTO components (id, name, variants, annotation, pulled_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       variants=excluded.variants,
       annotation=excluded.annotation,
       pulled_at=excluded.pulled_at`,
    [
      component.id,
      component.name,
      component.variants,
      component.annotation,
      component.pulled_at,
    ],
  );
}

export function getComponentById(db: Database, id: string): ComponentRow | null {
  return (db.query("SELECT * FROM components WHERE id = ?").get(id) as ComponentRow | null);
}

export function getAllComponents(db: Database): ComponentRow[] {
  return db.query("SELECT * FROM components").all() as ComponentRow[];
}

export function deleteComponent(db: Database, id: string): void {
  db.run("DELETE FROM components WHERE id = ?", [id]);
}

// ─── TokenSet ────────────────────────────────────────────────────────────────

export interface TokenSetRow {
  id: number;
  name: string;
  tokens: string;
  pulled_at: string;
}

export function upsertTokenSet(db: Database, tokenSet: Omit<TokenSetRow, "id"> & { id?: number }): void {
  db.run(
    `INSERT INTO token_sets (name, tokens, pulled_at)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       tokens=excluded.tokens,
       pulled_at=excluded.pulled_at`,
    [tokenSet.name, tokenSet.tokens, tokenSet.pulled_at],
  );
}

export function getTokenSetById(db: Database, id: number): TokenSetRow | null {
  return (db.query("SELECT * FROM token_sets WHERE id = ?").get(id) as TokenSetRow | null);
}

export function getAllTokenSets(db: Database): TokenSetRow[] {
  return db.query("SELECT * FROM token_sets").all() as TokenSetRow[];
}

export function deleteTokenSet(db: Database, id: number): void {
  db.run("DELETE FROM token_sets WHERE id = ?", [id]);
}

// ─── Flow ────────────────────────────────────────────────────────────────────

export interface FlowRow {
  name: string;
  screen_count: number;
  context_path: string | null;
}

export function upsertFlow(db: Database, flow: FlowRow): void {
  db.run(
    `INSERT INTO flows (name, screen_count, context_path)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       screen_count=excluded.screen_count,
       context_path=excluded.context_path`,
    [flow.name, flow.screen_count, flow.context_path],
  );
}

export function getFlowById(db: Database, name: string): FlowRow | null {
  return (db.query("SELECT * FROM flows WHERE name = ?").get(name) as FlowRow | null);
}

export function getAllFlows(db: Database): FlowRow[] {
  return db.query("SELECT * FROM flows").all() as FlowRow[];
}

export function deleteFlow(db: Database, name: string): void {
  db.run("DELETE FROM flows WHERE name = ?", [name]);
}

// ─── Spec ────────────────────────────────────────────────────────────────────

export interface SpecRow {
  id: string;
  board_name: string;
  spec_json: string;
  status: string;
}

export function upsertSpec(db: Database, spec: SpecRow): void {
  db.run(
    `INSERT INTO specs (id, board_name, spec_json, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       board_name=excluded.board_name,
       spec_json=excluded.spec_json,
       status=excluded.status`,
    [spec.id, spec.board_name, spec.spec_json, spec.status],
  );
}

export function getSpecById(db: Database, id: string): SpecRow | null {
  return (db.query("SELECT * FROM specs WHERE id = ?").get(id) as SpecRow | null);
}

export function getAllSpecs(db: Database): SpecRow[] {
  return db.query("SELECT * FROM specs").all() as SpecRow[];
}

export function deleteSpec(db: Database, id: string): void {
  db.run("DELETE FROM specs WHERE id = ?", [id]);
}

// ─── Decision ────────────────────────────────────────────────────────────────

export interface DecisionRow {
  id: number;
  session_id: string;
  summary: string;
  flow: string | null;
  board: string | null;
  created_at: string;
}

export function upsertDecision(
  db: Database,
  decision: Omit<DecisionRow, "id" | "created_at"> & { id?: number; created_at?: string },
): void {
  if (decision.id != null) {
    db.run(
      `INSERT INTO decisions (id, session_id, summary, flow, board, created_at)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
       ON CONFLICT(id) DO UPDATE SET
         session_id=excluded.session_id,
         summary=excluded.summary,
         flow=excluded.flow,
         board=excluded.board`,
      [
        decision.id,
        decision.session_id,
        decision.summary,
        decision.flow,
        decision.board,
        decision.created_at ?? null,
      ],
    );
  } else {
    db.run(
      `INSERT INTO decisions (session_id, summary, flow, board)
       VALUES (?, ?, ?, ?)`,
      [decision.session_id, decision.summary, decision.flow, decision.board],
    );
  }
}

export function getDecisionById(db: Database, id: number): DecisionRow | null {
  return (db.query("SELECT * FROM decisions WHERE id = ?").get(id) as DecisionRow | null);
}

export function getAllDecisions(db: Database): DecisionRow[] {
  return db.query("SELECT * FROM decisions ORDER BY created_at DESC").all() as DecisionRow[];
}

export function deleteDecision(db: Database, id: number): void {
  db.run("DELETE FROM decisions WHERE id = ?", [id]);
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface EventRow {
  id: number;
  event_type: string;
  payload: string;
  processed: number;
  received_at: string;
}

export function upsertEvent(
  db: Database,
  event: Omit<EventRow, "id" | "received_at" | "processed"> & {
    id?: number;
    processed?: number;
    received_at?: string;
  },
): void {
  if (event.id != null) {
    db.run(
      `INSERT INTO events (id, event_type, payload, processed, received_at)
       VALUES (?, ?, ?, COALESCE(?, 0), COALESCE(?, datetime('now')))
       ON CONFLICT(id) DO UPDATE SET
         event_type=excluded.event_type,
         payload=excluded.payload,
         processed=excluded.processed`,
      [
        event.id,
        event.event_type,
        event.payload,
        event.processed ?? 0,
        event.received_at ?? null,
      ],
    );
  } else {
    db.run(
      `INSERT INTO events (event_type, payload, processed)
       VALUES (?, ?, ?)`,
      [event.event_type, event.payload, event.processed ?? 0],
    );
  }
}

export function getEventById(db: Database, id: number): EventRow | null {
  return (db.query("SELECT * FROM events WHERE id = ?").get(id) as EventRow | null);
}

export function getAllEvents(db: Database): EventRow[] {
  return db.query("SELECT * FROM events ORDER BY received_at DESC").all() as EventRow[];
}

export function deleteEvent(db: Database, id: number): void {
  db.run("DELETE FROM events WHERE id = ?", [id]);
}
