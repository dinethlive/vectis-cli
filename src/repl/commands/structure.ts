import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import readline from "node:readline";
import type { CommandHandler } from "../../types/repl.js";
import { analyseStructure } from "../../structure/analyser.js";
import { StructureConversation } from "../../structure/conversation.js";
import { writeStructureFiles } from "../../structure/writer.js";
import { suggestSkills } from "../../structure/skill-suggester.js";
import { diffStructure, readExistingAnalysis } from "../../structure/differ.js";

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

export function structureCommand(): CommandHandler {
  return {
    name: "structure",
    description: "Analyze project structure and generate context files",
    usage: "/structure [@folder/] [--update]",
    async execute(args, ctx) {
      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      if (!ctx.config.projectRoot) {
        console.log(pc.yellow("No project root set. Run /init first."));
        return;
      }

      const projectRoot = ctx.config.projectRoot;
      const isUpdate = args.includes("--update");
      const folderArg = args.replace("--update", "").trim();

      // Determine folder to analyze
      let targetDir: string;
      if (folderArg.startsWith("@") && folderArg.endsWith("/")) {
        // @folder/ reference
        const folderName = folderArg.slice(1, -1);
        targetDir = path.join(projectRoot, folderName);
      } else if (folderArg) {
        targetDir = path.join(projectRoot, folderArg);
      } else {
        targetDir = path.join(projectRoot, "context");
      }

      if (!fs.existsSync(targetDir)) {
        console.log(pc.yellow(`Directory not found: ${targetDir}`));
        console.log(pc.dim("Run /init to create the project structure, or provide a valid folder."));
        return;
      }

      // Read files from the target directory
      const sp = spinner("Reading project files...").start();
      const files = readProjectFiles(targetDir);

      if (files.length === 0) {
        sp.fail("No readable files found in the target directory.");
        return;
      }

      sp.text = `Analyzing ${files.length} file(s) with Claude...`;

      try {
        const analysis = await analyseStructure(ctx.client, files, ctx.logger);
        sp.succeed(
          `Found ${analysis.flows.length} flow(s), ${analysis.constraints.length} constraint(s), ${analysis.ambiguities.length} ambiguity/ambiguities`,
        );

        // Handle --update mode
        if (isUpdate) {
          const existing = readExistingAnalysis(projectRoot, ctx.logger);
          if (existing) {
            const diff = diffStructure(existing, analysis, ctx.logger);
            if (!diff.hasChanges) {
              console.log(pc.green("No structural changes detected."));
              return;
            }

            console.log(pc.bold("\nStructure changes detected:"));
            for (const change of diff.changes) {
              const prefix =
                change.type === "added" ? pc.green("+") :
                change.type === "removed" ? pc.red("-") :
                pc.yellow("~");
              const entity = change.flowName
                ? `${change.entity} "${change.name}" in flow "${change.flowName}"`
                : `${change.entity} "${change.name}"`;
              console.log(`  ${prefix} ${entity}${change.details ? ` — ${change.details}` : ""}`);
            }
            console.log("");
          }
        }

        // Start conversational clarification if there are ambiguities
        if (analysis.ambiguities.length > 0) {
          console.log(pc.bold("\nSome items need clarification:"));

          const convRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          try {
            ctx.state.mode = "STRUCTURE_CONV";
            const conversation = new StructureConversation(ctx.client, analysis, ctx.logger);

            const firstQuestion = await conversation.askQuestion();
            console.log(pc.cyan(`\n${firstQuestion}`));

            while (!conversation.isComplete()) {
              const answer = await question(convRl, pc.dim("Your answer (or 'skip' to finish): "));

              if (answer.toLowerCase() === "skip") {
                break;
              }

              const response = await conversation.handleAnswer(answer);
              console.log(pc.cyan(`\n${response}`));
            }

            // Use the refined analysis
            const finalAnalysis = conversation.getFinalAnalysis();
            const writeSp = spinner("Writing context files...").start();
            const result = writeStructureFiles(projectRoot, finalAnalysis, ctx.logger);
            writeSp.succeed(`Wrote ${result.filesWritten.length} file(s)`);
          } finally {
            ctx.state.mode = "NORMAL";
            convRl.close();
          }
        } else {
          // No ambiguities — write directly
          const writeSp = spinner("Writing context files...").start();
          const result = writeStructureFiles(projectRoot, analysis, ctx.logger);
          writeSp.succeed(`Wrote ${result.filesWritten.length} file(s)`);
        }

        // Suggest skills
        const availableSkills = ctx.skills.getAllMetadata().map((s) => s.name);
        const suggestions = suggestSkills(analysis, availableSkills, ctx.logger);
        if (suggestions.length > 0) {
          console.log(pc.bold("\nSuggested skills based on your project:"));
          for (const s of suggestions) {
            console.log(`  ${pc.cyan(s.skillName)} — ${s.reason}`);
          }
        }

        console.log(pc.dim("\nContext files written to context/. Review and edit as needed."));
      } catch (err) {
        sp.fail("Structure analysis failed");
        if (err instanceof Error) {
          console.log(pc.red(`Error: ${err.message}`));
        }
      }
    },
  };
}

/**
 * Recursively read text files from a directory (non-binary, < 100KB).
 */
function readProjectFiles(
  dir: string,
  basePath?: string,
): { path: string; content: string }[] {
  const base = basePath ?? dir;
  const results: { path: string; content: string }[] = [];

  const SKIP_DIRS = new Set(["node_modules", ".git", ".vectis", "dist", "build"]);
  const MAX_FILE_SIZE = 100 * 1024; // 100KB
  const TEXT_EXTENSIONS = new Set([
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml",
    ".ts", ".tsx", ".js", ".jsx", ".css", ".scss",
    ".html", ".svg", ".xml",
  ]);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...readProjectFiles(fullPath, base));
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const relativePath = path.relative(base, fullPath);
      results.push({ path: relativePath, content });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}
