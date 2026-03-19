import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import Table from "cli-table3";
import type { CommandHandler } from "../../types/repl.js";
import type { PenpotDesignTokens } from "../../bridge/types.js";
import { penpotNotConnected } from "../../types/errors.js";

export function tokenCommand(): CommandHandler {
  return {
    name: "token",
    description: "Manage design tokens (pull/push/show/diff)",
    usage: "/token <pull|push|show|diff> [set-name]",
    async execute(args, ctx) {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();
      const setName = parts[1];

      if (!subcommand || !["pull", "push", "show", "diff"].includes(subcommand)) {
        console.log(pc.yellow("Usage: /token <pull|push|show|diff> [set-name]"));
        console.log(pc.gray("  /token pull        — Fetch tokens from Penpot"));
        console.log(pc.gray("  /token push        — Push local tokens to Penpot"));
        console.log(pc.gray("  /token show [set]  — Display token sets"));
        console.log(pc.gray("  /token diff        — Compare local vs Penpot tokens"));
        return;
      }

      switch (subcommand) {
        case "pull":
          await tokenPull(ctx);
          break;
        case "push":
          await tokenPush(ctx);
          break;
        case "show":
          await tokenShow(ctx, setName);
          break;
        case "diff":
          await tokenDiff(ctx);
          break;
      }
    },
  };
}

async function tokenPull(ctx: import("../../types/repl.js").SessionContext): Promise<void> {
  if (!ctx.bridge) {
    throw penpotNotConnected();
  }

  if (!ctx.config.projectRoot) {
    console.log(pc.yellow("No project root. Run /init first."));
    return;
  }

  const sp = spinner("Fetching design tokens from Penpot...").start();

  try {
    const tokens = await ctx.bridge.getDesignTokens();
    const setCount = Object.keys(tokens).length;

    if (setCount === 0) {
      sp.warn("No design tokens found in Penpot file");
      return;
    }

    // Ensure context directory exists
    const contextDir = path.join(ctx.config.projectRoot, "context");
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    const tokensPath = path.join(contextDir, "tokens.json");
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));

    sp.succeed(`Pulled ${setCount} token set(s) to context/tokens.json`);

    // Show summary
    for (const [name, set] of Object.entries(tokens)) {
      const tokenCount = countTokensInSet(set);
      console.log(pc.gray(`  ${name}: ${tokenCount} token(s)`));
    }
  } catch (err) {
    sp.fail("Failed to pull tokens");
    const message = err instanceof Error ? err.message : String(err);
    console.log(pc.red(`Error: ${message}`));
  }
}

async function tokenPush(ctx: import("../../types/repl.js").SessionContext): Promise<void> {
  if (!ctx.bridge) {
    throw penpotNotConnected();
  }

  if (!ctx.config.projectRoot) {
    console.log(pc.yellow("No project root. Run /init first."));
    return;
  }

  const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");

  if (!fs.existsSync(tokensPath)) {
    console.log(pc.yellow("No local tokens found. Run /token pull first."));
    return;
  }

  const sp = spinner("Pushing tokens to Penpot...").start();

  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as PenpotDesignTokens;
    const setCount = Object.keys(tokens).length;

    // Push tokens via MCP bridge
    const bridgeInternal = ctx.bridge as unknown as {
      mcp: { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> };
      fileId: string;
    };

    await bridgeInternal.mcp.callTool("set_design_tokens", {
      fileId: bridgeInternal.fileId,
      tokens,
    });

    sp.succeed(`Pushed ${setCount} token set(s) to Penpot`);
  } catch (err) {
    sp.fail("Failed to push tokens");
    const message = err instanceof Error ? err.message : String(err);
    console.log(pc.red(`Error: ${message}`));
  }
}

async function tokenShow(
  ctx: import("../../types/repl.js").SessionContext,
  setName?: string,
): Promise<void> {
  if (!ctx.config.projectRoot) {
    console.log(pc.yellow("No project root. Run /init first."));
    return;
  }

  const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");

  if (!fs.existsSync(tokensPath)) {
    console.log(pc.yellow("No local tokens found. Run /token pull first."));
    return;
  }

  const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as PenpotDesignTokens;

  if (setName) {
    // Show a specific token set
    const tokenSet = tokens[setName];
    if (!tokenSet) {
      console.log(pc.yellow(`Token set "${setName}" not found.`));
      console.log(pc.gray(`Available sets: ${Object.keys(tokens).join(", ")}`));
      return;
    }

    console.log(pc.bold(`Token set: ${setName}`));
    const table = new Table({
      head: [pc.bold("Token"), pc.bold("Value"), pc.bold("Type")],
      style: { head: [], border: [] },
    });

    flattenTokens(tokenSet, "").forEach(({ path: tokenPath, value, type }) => {
      table.push([pc.green(tokenPath), String(value), pc.dim(type)]);
    });

    console.log(table.toString());
  } else {
    // Show all token sets overview
    console.log(pc.bold("Design Token Sets"));

    const table = new Table({
      head: [pc.bold("Set Name"), pc.bold("Tokens"), pc.bold("Categories")],
      style: { head: [], border: [] },
    });

    for (const [name, set] of Object.entries(tokens)) {
      const tokenCount = countTokensInSet(set);
      const categories = Object.keys(set).slice(0, 5).join(", ");
      const suffix = Object.keys(set).length > 5 ? "..." : "";
      table.push([pc.green(name), String(tokenCount), pc.dim(categories + suffix)]);
    }

    console.log(table.toString());
  }
}

async function tokenDiff(ctx: import("../../types/repl.js").SessionContext): Promise<void> {
  if (!ctx.bridge) {
    throw penpotNotConnected();
  }

  if (!ctx.config.projectRoot) {
    console.log(pc.yellow("No project root. Run /init first."));
    return;
  }

  const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");

  if (!fs.existsSync(tokensPath)) {
    console.log(pc.yellow("No local tokens found. Run /token pull first."));
    return;
  }

  const sp = spinner("Comparing local and Penpot tokens...").start();

  try {
    const localTokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as PenpotDesignTokens;
    const remoteTokens = await ctx.bridge.getDesignTokens();

    sp.stop();

    const localSets = new Set(Object.keys(localTokens));
    const remoteSets = new Set(Object.keys(remoteTokens));

    // Sets only in local
    const localOnly = [...localSets].filter((s) => !remoteSets.has(s));
    // Sets only in remote
    const remoteOnly = [...remoteSets].filter((s) => !localSets.has(s));
    // Sets in both
    const shared = [...localSets].filter((s) => remoteSets.has(s));

    let hasChanges = false;

    if (localOnly.length > 0) {
      hasChanges = true;
      console.log(pc.green("\nLocal only (will be added on push):"));
      for (const name of localOnly) {
        console.log(pc.green(`  + ${name}`));
      }
    }

    if (remoteOnly.length > 0) {
      hasChanges = true;
      console.log(pc.red("\nPenpot only (will be added on pull):"));
      for (const name of remoteOnly) {
        console.log(pc.red(`  - ${name}`));
      }
    }

    // Compare shared sets
    for (const setName of shared) {
      const localFlat = flattenTokens(localTokens[setName], "");
      const remoteFlat = flattenTokens(remoteTokens[setName], "");

      const localMap = new Map(localFlat.map((t) => [t.path, t.value]));
      const remoteMap = new Map(remoteFlat.map((t) => [t.path, t.value]));

      const allPaths = new Set([...localMap.keys(), ...remoteMap.keys()]);
      const diffs: string[] = [];

      for (const tokenPath of allPaths) {
        const localVal = localMap.get(tokenPath);
        const remoteVal = remoteMap.get(tokenPath);

        if (localVal === undefined) {
          diffs.push(pc.red(`  - ${tokenPath}: ${remoteVal}`));
        } else if (remoteVal === undefined) {
          diffs.push(pc.green(`  + ${tokenPath}: ${localVal}`));
        } else if (String(localVal) !== String(remoteVal)) {
          diffs.push(pc.yellow(`  ~ ${tokenPath}: ${remoteVal} -> ${localVal}`));
        }
      }

      if (diffs.length > 0) {
        hasChanges = true;
        console.log(pc.bold(`\n${setName}:`));
        for (const diff of diffs) {
          console.log(diff);
        }
      }
    }

    if (!hasChanges) {
      console.log(pc.green("\nTokens are in sync."));
    }
  } catch (err) {
    sp.fail("Diff failed");
    const message = err instanceof Error ? err.message : String(err);
    console.log(pc.red(`Error: ${message}`));
  }
}

interface FlatToken {
  path: string;
  value: unknown;
  type: string;
}

function flattenTokens(obj: Record<string, unknown>, prefix: string): FlatToken[] {
  const result: FlatToken[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const tokenPath = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;

      // Check if this is a leaf token (has a "value" property)
      if ("value" in record) {
        result.push({
          path: tokenPath,
          value: record.value,
          type: typeof record.type === "string" ? record.type : typeof record.value,
        });
      } else {
        // Recurse into nested object
        result.push(...flattenTokens(record, tokenPath));
      }
    } else {
      result.push({
        path: tokenPath,
        value,
        type: typeof value,
      });
    }
  }

  return result;
}

function countTokensInSet(set: Record<string, unknown>): number {
  return flattenTokens(set, "").length;
}
