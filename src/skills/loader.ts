import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import type { Logger } from "../utils/logger.js";
import type { SkillMetadata, Skill } from "./registry.js";

/**
 * 3-tier skill discovery and on-demand loading.
 *
 * Discovery order (later tiers do NOT override earlier):
 *   1. Project  — `.vectis/skills/`
 *   2. Global   — `~/.vectis/skills/`
 *   3. Built-in — `src/skills/built-in/`  (bundled with the CLI)
 *
 * At startup only YAML frontmatter is parsed (~5 tokens each).
 * Full content is loaded on demand when a task matches a skill's description.
 */
export class SkillLoader {
  private metadata = new Map<string, SkillMetadata>();
  private loaded = new Map<string, Skill>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // ── Discovery ────────────────────────────────────────────────

  /**
   * Run 3-tier discovery.  Call once at startup.
   * Skills found in higher-priority tiers shadow lower ones (by name).
   */
  discover(projectRoot: string | null): void {
    this.metadata.clear();
    this.loaded.clear();

    // Tier 1 — project skills
    if (projectRoot) {
      const projectSkillsDir = path.join(projectRoot, ".vectis", "skills");
      this.discoverFromDir(projectSkillsDir, "project");
    }

    // Tier 2 — global skills
    const globalSkillsDir = path.join(os.homedir(), ".vectis", "skills");
    this.discoverFromDir(globalSkillsDir, "global");

    // Tier 3 — built-in skills
    const builtInDir = path.join(import.meta.dirname ?? __dirname, "built-in");
    this.discoverFromDir(builtInDir, "built-in");

    this.logger.debug(`Discovered ${this.metadata.size} skills`);
  }

  /**
   * Scan a single directory for `.md` skill files.
   * Only parses YAML frontmatter (metadata-first).
   */
  private discoverFromDir(dir: string, tier: string): void {
    if (!fs.existsSync(dir)) return;

    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch {
      this.logger.debug(`Cannot read skills dir: ${dir}`);
      return;
    }

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const { data } = matter(raw);

        if (!data.name) {
          this.logger.debug(`Skipping ${file} — missing name in frontmatter`);
          continue;
        }

        // Higher-priority tiers shadow lower ones
        if (this.metadata.has(data.name)) {
          this.logger.debug(
            `Skill "${data.name}" from ${tier} shadowed by higher-priority tier`,
          );
          continue;
        }

        this.metadata.set(data.name, {
          name: data.name,
          description: data.description || "",
          always: data.always === true,
          tags: Array.isArray(data.tags) ? data.tags : [],
          filePath,
        });
      } catch (err) {
        this.logger.debug(`Failed to parse skill ${file}: ${err}`);
      }
    }
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Load a skill by exact name (on-demand — reads full content). */
  loadByName(name: string): Skill | null {
    if (this.loaded.has(name)) return this.loaded.get(name)!;

    const meta = this.metadata.get(name);
    if (!meta) return null;

    return this.loadFull(meta);
  }

  /** Load all skills with `always: true`. */
  loadAlways(): Skill[] {
    const result: Skill[] = [];
    for (const meta of this.metadata.values()) {
      if (meta.always) {
        const skill = this.loadFull(meta);
        if (skill) result.push(skill);
      }
    }
    return result;
  }

  /**
   * Search skills whose name, description, or tags match the query.
   * Returns matching metadata (does NOT load full content).
   */
  search(query: string): SkillMetadata[] {
    const q = query.toLowerCase();
    const results: SkillMetadata[] = [];

    for (const meta of this.metadata.values()) {
      const haystack = [
        meta.name,
        meta.description,
        ...(meta.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      if (haystack.includes(q)) {
        results.push(meta);
      }
    }

    return results;
  }

  /** Return all discovered metadata. */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadata.values());
  }

  /** Return metadata for a single skill. */
  getMetadata(name: string): SkillMetadata | undefined {
    return this.metadata.get(name);
  }

  /** Number of discovered skills. */
  count(): number {
    return this.metadata.size;
  }

  // ── Internal ─────────────────────────────────────────────────

  private loadFull(meta: SkillMetadata): Skill | null {
    if (this.loaded.has(meta.name)) return this.loaded.get(meta.name)!;

    try {
      const raw = fs.readFileSync(meta.filePath, "utf-8");
      const { content } = matter(raw);
      const skill: Skill = { ...meta, content };
      this.loaded.set(meta.name, skill);
      return skill;
    } catch (err) {
      this.logger.debug(`Failed to load skill "${meta.name}": ${err}`);
      return null;
    }
  }
}
