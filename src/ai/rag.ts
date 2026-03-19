import fs from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
  type: "spec" | "context" | "skill" | "flow" | "token";
  path: string;
  name: string;
}

export interface StoredDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface SearchResult {
  document: StoredDocument;
  score: number;
}

// ─── Stopwords ──────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "this", "that", "these", "those", "i", "you", "he", "she", "we",
  "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "its", "our", "their", "what", "which", "who", "when", "where",
  "how", "not", "no", "nor", "if", "then", "than", "too", "very",
  "just", "about", "up", "out", "so", "also",
]);

// ─── Tokenizer ──────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ─── VectorStore ────────────────────────────────────────────────────────────

/**
 * Simple in-memory vector store using TF-IDF scoring and cosine similarity.
 * Serves as the RAG foundation — can be upgraded to LanceDB later.
 */
export class VectorStore {
  private documents: StoredDocument[] = [];
  private tokenVectors = new Map<string, Map<string, number>>();
  private idfCache = new Map<string, number>();
  private dirty = true;

  /**
   * Tokenizes and stores a document for later retrieval.
   */
  addDocument(id: string, content: string, metadata: DocumentMetadata): void {
    // Replace existing document with the same id
    const existingIdx = this.documents.findIndex((d) => d.id === id);
    if (existingIdx !== -1) {
      this.documents.splice(existingIdx, 1);
      this.tokenVectors.delete(id);
    }

    const doc: StoredDocument = { id, content, metadata };
    this.documents.push(doc);

    // Compute term frequency (TF) vector
    const tokens = tokenize(content);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // Normalize TF by document length
    const length = tokens.length || 1;
    for (const [term, count] of tf) {
      tf.set(term, count / length);
    }

    this.tokenVectors.set(id, tf);
    this.dirty = true;
  }

  /**
   * Finds the top K most similar documents using TF-IDF cosine similarity.
   */
  search(query: string, topK = 5): SearchResult[] {
    if (this.documents.length === 0) return [];

    if (this.dirty) {
      this.computeIdf();
      this.dirty = false;
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Build query TF vector
    const queryTf = new Map<string, number>();
    for (const token of queryTokens) {
      queryTf.set(token, (queryTf.get(token) ?? 0) + 1);
    }
    const queryLen = queryTokens.length || 1;
    for (const [term, count] of queryTf) {
      queryTf.set(term, count / queryLen);
    }

    // Build query TF-IDF vector
    const queryTfidf = new Map<string, number>();
    for (const [term, tf] of queryTf) {
      const idf = this.idfCache.get(term) ?? 0;
      queryTfidf.set(term, tf * idf);
    }

    // Score each document
    const scored: SearchResult[] = [];
    for (const doc of this.documents) {
      const docTf = this.tokenVectors.get(doc.id);
      if (!docTf) continue;

      // Build doc TF-IDF for relevant terms
      const docTfidf = new Map<string, number>();
      for (const [term, tf] of docTf) {
        const idf = this.idfCache.get(term) ?? 0;
        docTfidf.set(term, tf * idf);
      }

      const score = cosineSimilarity(queryTfidf, docTfidf);
      if (score > 0) {
        scored.push({ document: doc, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Indexes specs, context files, and skill content from the project.
   */
  buildIndex(projectRoot: string): void {
    this.clear();

    // Index context files
    const contextDir = path.join(projectRoot, "context");
    if (fs.existsSync(contextDir)) {
      this.indexDirectory(contextDir, "context");
    }

    // Index flow contexts
    const flowsDir = path.join(projectRoot, "context", "flows");
    if (fs.existsSync(flowsDir)) {
      this.indexDirectory(flowsDir, "flow");
    }

    // Index specs
    const specsDir = path.join(projectRoot, "specs");
    if (fs.existsSync(specsDir)) {
      this.indexDirectory(specsDir, "spec");
    }

    // Index project skills
    const skillsDir = path.join(projectRoot, ".vectis", "skills");
    if (fs.existsSync(skillsDir)) {
      this.indexDirectory(skillsDir, "skill");
    }

    // Index design tokens
    const tokensPath = path.join(projectRoot, "context", "tokens.json");
    if (fs.existsSync(tokensPath)) {
      try {
        const content = fs.readFileSync(tokensPath, "utf-8");
        this.addDocument("tokens:design-tokens", content, {
          type: "token",
          path: tokensPath,
          name: "design-tokens",
        });
      } catch {
        // Skip unreadable token files
      }
    }
  }

  /**
   * Clears the entire index.
   */
  clear(): void {
    this.documents = [];
    this.tokenVectors.clear();
    this.idfCache.clear();
    this.dirty = true;
  }

  /**
   * Returns the number of indexed documents.
   */
  get size(): number {
    return this.documents.length;
  }

  // ── Internal ─────────────────────────────────────────────────

  private indexDirectory(dir: string, type: DocumentMetadata["type"]): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (!stat.isFile()) continue;

      // Only index text-based files
      const ext = path.extname(entry).toLowerCase();
      if (![".md", ".json", ".txt", ".yaml", ".yml"].includes(ext)) continue;

      // Skip very large files (> 256KB)
      if (stat.size > 256 * 1024) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const name = path.basename(entry, ext);
        this.addDocument(`${type}:${name}`, content, {
          type,
          path: fullPath,
          name,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  private computeIdf(): void {
    this.idfCache.clear();
    const n = this.documents.length;
    if (n === 0) return;

    // Count how many documents contain each term
    const docFreq = new Map<string, number>();
    for (const tf of this.tokenVectors.values()) {
      for (const term of tf.keys()) {
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    // Compute IDF: log(N / df)
    for (const [term, df] of docFreq) {
      this.idfCache.set(term, Math.log(n / df));
    }
  }
}

// ─── Math helpers ───────────────────────────────────────────────────────────

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of a) {
    normA += valA * valA;
    const valB = b.get(term);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  for (const valB of b.values()) {
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dotProduct / denom;
}
