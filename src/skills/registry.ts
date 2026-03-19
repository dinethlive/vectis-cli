import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Logger } from "../utils/logger.js";

export interface SkillMetadata {
  name: string;
  description: string;
  always?: boolean;
  tags?: string[];
  filePath: string;
}

export interface Skill extends SkillMetadata {
  content: string;
}

export class SkillRegistry {
  private skills = new Map<string, SkillMetadata>();
  private loaded = new Map<string, Skill>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  discoverFromDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const { data } = matter(raw);
        if (data.name) {
          this.skills.set(data.name, {
            name: data.name,
            description: data.description || "",
            always: data.always || false,
            tags: data.tags || [],
            filePath,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to parse skill ${file}: ${err}`);
      }
    }
  }

  getMetadata(name: string): SkillMetadata | undefined {
    return this.skills.get(name);
  }

  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values());
  }

  getAlwaysOnSkills(): Skill[] {
    const result: Skill[] = [];
    for (const meta of this.skills.values()) {
      if (meta.always) {
        result.push(this.load(meta.name)!);
      }
    }
    return result;
  }

  load(name: string): Skill | null {
    if (this.loaded.has(name)) return this.loaded.get(name)!;

    const meta = this.skills.get(name);
    if (!meta) return null;

    try {
      const raw = fs.readFileSync(meta.filePath, "utf-8");
      const { content } = matter(raw);
      const skill: Skill = { ...meta, content };
      this.loaded.set(name, skill);
      return skill;
    } catch {
      return null;
    }
  }

  count(): number {
    return this.skills.size;
  }
}
