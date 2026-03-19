import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import Table from "cli-table3";
import type { CommandHandler, SessionContext } from "../../types/repl.js";
import { getBoardsByFlow, getBoardsWithPage } from "../../graph/queries.js";
import { getAllTokenSets } from "../../graph/nodes.js";
import { VectisError } from "../../types/errors.js";
import { formatError } from "../error-formatter.js";
import type { Database } from "bun:sqlite";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuditIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  element?: string;
  fix?: string;
}

// ─── Command ────────────────────────────────────────────────────────────────

export function auditCommand(): CommandHandler {
  return {
    name: "audit",
    description: "Audit a board against graph rules and skills",
    usage: "/audit [board-name] [--fix]",
    async execute(args, ctx) {
      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      const wantFix = args.includes("--fix");
      const boardName = args.replace("--fix", "").trim();

      if (!boardName) {
        console.log(pc.yellow("Usage: /audit <board-name> [--fix]"));
        console.log(pc.gray("  Example: /audit login-page --fix"));
        return;
      }

      const sp = spinner(`Auditing board "${boardName}"...`).start();

      try {
        // Gather board data from the graph
        const boardData = await gatherBoardData(boardName, ctx);

        // Gather relevant skills
        const skillContext = gatherSkillContext(ctx);

        // Gather design tokens
        const tokenContext = gatherTokenContext(ctx);

        const systemPrompt = buildAuditSystemPrompt();
        const userPrompt = buildAuditUserPrompt(
          boardName,
          boardData,
          skillContext,
          tokenContext,
          wantFix,
        );

        const result = await ctx.client.sendMessage(
          [{ role: "user", content: userPrompt }],
          { system: systemPrompt, maxTokens: 4096 },
        );

        ctx.tokenTracker.record(result.inputTokens, result.outputTokens);
        sp.succeed(`Audit complete for "${boardName}"`);

        // Parse and display issues
        const issues = parseAuditResponse(result.content);
        displayAuditResults(issues, boardName);
      } catch (err) {
        sp.fail("Audit failed");
        if (err instanceof VectisError) {
          console.log(formatError(err));
        } else if (err instanceof Error) {
          console.log(pc.red(`Error: ${err.message}`));
        }
      }
    },
  };
}

// ─── Data Gathering ─────────────────────────────────────────────────────────

async function gatherBoardData(
  boardName: string,
  ctx: SessionContext,
): Promise<string> {
  const parts: string[] = [];

  // Try getting board info from graph DB
  if (ctx.db) {
    const db = ctx.db as Database;
    try {
      const boards = getBoardsWithPage(db);
      const match = boards.find(
        (b) => b.board_name.toLowerCase() === boardName.toLowerCase(),
      );
      if (match) {
        parts.push(`Board: ${match.board_name}`);
        parts.push(`Page: ${match.page_name}`);
        parts.push(`Layout type: ${match.layout_type ?? "unknown"}`);
        parts.push(`Layer count: ${match.layer_count}`);
        parts.push(`Has context: ${match.has_context ? "yes" : "no"}`);
        parts.push(`Last pulled: ${match.pulled_at}`);
      }
    } catch {
      // DB query may fail if schema is not migrated
    }
  }

  // Try fetching live shape data from Penpot
  if (ctx.bridge?.mcpConnected) {
    try {
      const shape = await ctx.bridge.getShapeByName(boardName);
      if (shape) {
        parts.push(`\nPenpot shape data:\n${JSON.stringify(shape, null, 2)}`);
      }
    } catch {
      // Penpot may not be available
    }
  }

  if (parts.length === 0) {
    parts.push(`Board "${boardName}" — no detailed data available in graph or Penpot.`);
    parts.push("Performing general audit based on name and conventions.");
  }

  return parts.join("\n");
}

function gatherSkillContext(ctx: SessionContext): string {
  const skills = ctx.skills.getAllMetadata();
  if (skills.length === 0) return "No skills available.";

  const parts: string[] = [];
  for (const meta of skills) {
    const skill = ctx.skills.load(meta.name);
    if (skill) {
      parts.push(`--- Skill: ${skill.name} ---\n${skill.content}`);
    }
  }
  return parts.join("\n\n");
}

function gatherTokenContext(ctx: SessionContext): string {
  if (!ctx.db) return "No design tokens available.";

  try {
    const db = ctx.db as Database;
    const tokenSets = getAllTokenSets(db);
    if (tokenSets.length === 0) return "No design tokens available.";

    return tokenSets
      .map((ts) => `Token set "${ts.name}": ${ts.tokens}`)
      .join("\n");
  } catch {
    return "No design tokens available.";
  }
}

// ─── Prompt Building ────────────────────────────────────────────────────────

function buildAuditSystemPrompt(): string {
  return `You are Vectis, an AI design engineering auditor for Penpot.

You audit design boards for:
- Naming convention violations (layers, components, pages)
- Layout structure issues (missing auto-layout, inconsistent spacing)
- Design token compliance (hardcoded values vs token references)
- Component usage (missing annotations, variant coverage)
- Accessibility concerns (contrast, touch targets, text sizing)
- Consistency with design system skills/rules

Respond ONLY with a JSON array of issues. Each issue:
{
  "severity": "error" | "warning" | "info",
  "category": "naming" | "layout" | "tokens" | "components" | "accessibility" | "consistency",
  "message": "description of the issue",
  "element": "optional — the specific element affected",
  "fix": "optional — suggested fix (only if fix was requested)"
}

Return [] if no issues found. No explanation outside the JSON.`;
}

function buildAuditUserPrompt(
  boardName: string,
  boardData: string,
  skillContext: string,
  tokenContext: string,
  wantFix: boolean,
): string {
  const parts = [
    `Audit the board "${boardName}" for design quality issues.`,
    "",
    "--- Board Data ---",
    boardData,
    "",
    "--- Design Tokens ---",
    tokenContext,
    "",
    "--- Skills / Rules ---",
    skillContext,
    "",
  ];

  if (wantFix) {
    parts.push(
      'Include a "fix" field for each issue with a concrete suggestion.',
    );
  } else {
    parts.push('Do not include the "fix" field.');
  }

  parts.push("", "Respond with a JSON array of issues only.");
  return parts.join("\n");
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parseAuditResponse(content: string): AuditIssue[] {
  let jsonStr = content.trim();

  // Strip markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed as AuditIssue[];
    }
    return [];
  } catch {
    // If parsing fails, return a single info issue
    return [
      {
        severity: "info",
        category: "consistency",
        message: content.slice(0, 200),
      },
    ];
  }
}

// ─── Display ────────────────────────────────────────────────────────────────

function displayAuditResults(issues: AuditIssue[], boardName: string): void {
  if (issues.length === 0) {
    console.log(pc.green(`\nNo issues found for "${boardName}".`));
    return;
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  console.log("");
  console.log(
    pc.bold(`Audit Results for "${boardName}": `) +
      (errors > 0 ? pc.red(`${errors} error(s) `) : "") +
      (warnings > 0 ? pc.yellow(`${warnings} warning(s) `) : "") +
      (infos > 0 ? pc.gray(`${infos} info(s)`) : ""),
  );
  console.log("");

  const table = new Table({
    head: [
      pc.bold("Sev"),
      pc.bold("Category"),
      pc.bold("Message"),
      pc.bold("Element"),
    ],
    colWidths: [8, 14, 44, 18],
    wordWrap: true,
  });

  for (const issue of issues) {
    const sevLabel =
      issue.severity === "error"
        ? pc.red("ERR")
        : issue.severity === "warning"
          ? pc.yellow("WARN")
          : pc.gray("INFO");

    table.push([
      sevLabel,
      issue.category,
      issue.message,
      issue.element ?? "-",
    ]);
  }

  console.log(table.toString());

  // Show fixes if present
  const withFixes = issues.filter((i) => i.fix);
  if (withFixes.length > 0) {
    console.log("");
    console.log(pc.bold("Suggested Fixes:"));
    for (const issue of withFixes) {
      const sev =
        issue.severity === "error"
          ? pc.red("*")
          : issue.severity === "warning"
            ? pc.yellow("*")
            : pc.gray("*");
      console.log(`  ${sev} ${issue.element ?? issue.category}: ${issue.fix}`);
    }
  }

  console.log("");
}
