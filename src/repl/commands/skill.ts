import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import { VectisError } from "../../types/errors.js";
import { SkillLoader } from "../../skills/loader.js";

const SKILL_TEMPLATE = (name: string): string => `---
name: ${name}
description: TODO — describe what this skill teaches the AI
always: false
tags: []
---

# ${name}

Add your skill content here.
`;

export function skillCommand(): CommandHandler {
  return {
    name: "skill",
    description: "Manage skills (list, show, add, remove, enable, disable, new)",
    usage: "/skill [list|show|add|remove|enable|disable|new] [args]",
    async execute(args, ctx) {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || "list";
      const rest = parts.slice(1).join(" ").trim();

      switch (subcommand) {
        case "list":
          return listSkills(ctx);
        case "show":
          return showSkill(rest, ctx);
        case "add":
          return addSkill(rest, ctx);
        case "remove":
          return removeSkill(rest, ctx);
        case "enable":
          return enableSkill(rest, ctx);
        case "disable":
          return disableSkill(rest, ctx);
        case "new":
          return newSkill(rest, ctx);
        default:
          console.log(
            pc.red(`Unknown subcommand: ${subcommand}`) +
              "\n" +
              pc.gray("Usage: /skill [list|show|add|remove|enable|disable|new] [args]"),
          );
      }
    },
  };
}

// ── Subcommands ──────────────────────────────────────────────

async function listSkills(ctx: import("../../types/repl.js").SessionContext): Promise<void> {
  const allMeta = ctx.skills.getAllMetadata();

  if (allMeta.length === 0) {
    console.log(pc.yellow("No skills discovered. Run /init to set up built-in skills."));
    return;
  }

  const table = new Table({
    head: [
      pc.bold("Name"),
      pc.bold("Description"),
      pc.bold("Always"),
      pc.bold("Tags"),
    ],
    style: { head: [], border: [] },
    colWidths: [22, 44, 10, 20],
    wordWrap: true,
  });

  for (const meta of allMeta) {
    table.push([
      pc.green(meta.name),
      meta.description,
      meta.always ? pc.cyan("yes") : pc.gray("no"),
      (meta.tags ?? []).join(", ") || pc.gray("-"),
    ]);
  }

  console.log(pc.bold(`Skills (${allMeta.length}):\n`));
  console.log(table.toString());
}

async function showSkill(
  name: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!name) {
    console.log(pc.red("Usage: /skill show <name>"));
    return;
  }

  const skill = ctx.skills.load(name);
  if (!skill) {
    throw new VectisError(
      `Skill not found: ${name}`,
      "SKILL_NOT_FOUND",
      `Skill "${name}" was not found.`,
      "Run /skill list to see available skills.",
    );
  }

  console.log(pc.bold(`Skill: ${skill.name}`));
  console.log(pc.gray(`Description: ${skill.description}`));
  console.log(pc.gray(`Always-on:   ${skill.always ? "yes" : "no"}`));
  console.log(pc.gray(`Tags:        ${(skill.tags ?? []).join(", ") || "-"}`));
  console.log(pc.gray(`File:        ${skill.filePath}`));
  console.log(pc.gray("─".repeat(60)));
  console.log(skill.content);
}

async function addSkill(
  filePath: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!filePath) {
    console.log(pc.red("Usage: /skill add <path-to-skill.md>"));
    return;
  }

  const projectRoot = ctx.config.projectRoot;
  if (!projectRoot) {
    console.log(pc.red("No project root found. Run /init first."));
    return;
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log(pc.red(`File not found: ${resolved}`));
    return;
  }

  const skillsDir = path.join(projectRoot, ".vectis", "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  const destPath = path.join(skillsDir, path.basename(resolved));
  fs.copyFileSync(resolved, destPath);

  console.log(pc.green(`Copied skill to ${destPath}`));
  console.log(pc.gray("Re-discover with /skill list to see it."));
}

async function removeSkill(
  name: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!name) {
    console.log(pc.red("Usage: /skill remove <name>"));
    return;
  }

  const projectRoot = ctx.config.projectRoot;
  if (!projectRoot) {
    console.log(pc.red("No project root found. Run /init first."));
    return;
  }

  const skillsDir = path.join(projectRoot, ".vectis", "skills");
  const candidates = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"))
    : [];

  // Find the file matching this skill name
  let removed = false;
  for (const file of candidates) {
    const fullPath = path.join(skillsDir, file);
    try {
      const matter = await import("gray-matter");
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter.default(raw);
      if (data.name === name) {
        fs.unlinkSync(fullPath);
        console.log(pc.green(`Removed skill "${name}" (${file})`));
        removed = true;
        break;
      }
    } catch {
      // skip
    }
  }

  if (!removed) {
    console.log(pc.yellow(`Skill "${name}" not found in project skills directory.`));
    console.log(pc.gray("Only project-level skills can be removed."));
  }
}

async function enableSkill(
  name: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!name) {
    console.log(pc.red("Usage: /skill enable <name>"));
    return;
  }

  const updated = await setSkillAlways(name, true, ctx);
  if (updated) {
    console.log(pc.green(`Skill "${name}" is now always-on.`));
  }
}

async function disableSkill(
  name: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!name) {
    console.log(pc.red("Usage: /skill disable <name>"));
    return;
  }

  const updated = await setSkillAlways(name, false, ctx);
  if (updated) {
    console.log(pc.green(`Skill "${name}" is now on-demand.`));
  }
}

async function setSkillAlways(
  name: string,
  always: boolean,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<boolean> {
  const meta = ctx.skills.getMetadata(name);
  if (!meta) {
    console.log(pc.red(`Skill "${name}" not found.`));
    return false;
  }

  try {
    const matter = await import("gray-matter");
    const raw = fs.readFileSync(meta.filePath, "utf-8");
    const parsed = matter.default(raw);
    parsed.data.always = always;
    const updated = matter.default.stringify(parsed.content, parsed.data);
    fs.writeFileSync(meta.filePath, updated);
    return true;
  } catch (err) {
    console.log(pc.red(`Failed to update skill: ${err}`));
    return false;
  }
}

async function newSkill(
  name: string,
  ctx: import("../../types/repl.js").SessionContext,
): Promise<void> {
  if (!name) {
    console.log(pc.red("Usage: /skill new <name>"));
    return;
  }

  const projectRoot = ctx.config.projectRoot;
  if (!projectRoot) {
    console.log(pc.red("No project root found. Run /init first."));
    return;
  }

  const skillsDir = path.join(projectRoot, ".vectis", "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  const filename = name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() + ".md";
  const destPath = path.join(skillsDir, filename);

  if (fs.existsSync(destPath)) {
    console.log(pc.yellow(`Skill file already exists: ${destPath}`));
    return;
  }

  fs.writeFileSync(destPath, SKILL_TEMPLATE(name));
  console.log(pc.green(`Created skill template: ${destPath}`));
  console.log(pc.gray("Edit the file to add your skill content."));
}
