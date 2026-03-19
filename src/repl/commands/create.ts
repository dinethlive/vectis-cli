import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler, SessionContext } from "../../types/repl.js";
import type { LayoutSpec } from "../../generation/types.js";
import { renderPreview } from "../../generation/preview-renderer.js";
import { renderToPenpot } from "../../generation/penpot-renderer.js";
import { TokenResolver } from "../../generation/token-resolver.js";
import { penpotNotConnected } from "../../types/errors.js";
import type { PenpotDesignTokens } from "../../bridge/types.js";
import { generateSpec } from "../../generation/spec-generator.js";
import { postProcessSpec } from "../../generation/spec-postprocess.js";
import { validateSpec as validateSpecFull, type ValidationContext } from "../../generation/spec-validator.js";

export function createCommand(): CommandHandler {
  return {
    name: "create",
    description: "Generate a design board via AI pipeline",
    usage: "/create <board-name> [description]",
    async execute(args, ctx) {
      if (!args.trim()) {
        console.log(pc.yellow("Usage: /create <board-name> [description]"));
        console.log(pc.gray("  Example: /create login-page A responsive login form with email and password fields"));
        return;
      }

      if (!ctx.client) {
        console.log(pc.yellow("No API key configured. Run /init to set up."));
        return;
      }

      // Parse board name and description
      const spaceIdx = args.indexOf(" ");
      const boardName = spaceIdx === -1 ? args : args.slice(0, spaceIdx);
      const description = spaceIdx === -1 ? "" : args.slice(spaceIdx + 1).trim();

      // Build prompt context
      const componentNames: string[] = [];
      if (ctx.bridge && typeof (ctx.bridge as Record<string, unknown>).listComponents === "function") {
        try {
          const components = await (ctx.bridge as unknown as { listComponents(): Promise<{ name: string }[]> }).listComponents();
          if (components) componentNames.push(...components.map((c) => c.name));
        } catch { /* no components available */ }
      }

      const tokenSets: string[] = [];
      const tokenNames = new Set<string>();
      if (ctx.config.projectRoot) {
        const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");
        if (fs.existsSync(tokensPath)) {
          try {
            const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as PenpotDesignTokens;
            for (const [setName, tokenSet] of Object.entries(tokens)) {
              tokenSets.push(`### ${setName}\n${JSON.stringify(tokenSet, null, 2)}`);
              collectTokenNames(tokenSet, setName, tokenNames);
            }
          } catch { /* ignore malformed tokens */ }
        }
      }

      // Load skills for spec generation
      const skillContents = ctx.skills.getAlwaysOnSkills().map(s => s.content);
      const layoutSkill = ctx.skills.load("penpot-layout");
      if (layoutSkill) skillContents.push(layoutSkill.content);

      // Step 1: Generate spec via AI
      const sp = spinner("Generating layout spec...").start();

      let spec: LayoutSpec;
      try {
        const result = await generateSpec(ctx.client, {
          boardName,
          boardDescription: description || undefined,
          componentNames,
          tokenSets,
          skills: skillContents,
          useToolUse: true,
        }, {
          maxTokens: 8192,
        });

        spec = result.spec;
        ctx.tokenTracker.record(result.inputTokens, result.outputTokens);
        sp.succeed("Layout spec generated");
      } catch (err) {
        sp.fail("Generation failed");
        const message = err instanceof Error ? err.message : String(err);
        console.log(pc.red(`Error: ${message}`));
        return;
      }

      // Step 1.5: Post-process auto-fixes
      const { spec: processedSpec, fixes } = postProcessSpec(spec);
      spec = processedSpec;
      if (fixes.length > 0) {
        console.log(pc.dim(`\nAuto-fixed ${fixes.length} issue${fixes.length > 1 ? "s" : ""}:`));
        for (const fix of fixes) {
          console.log(pc.dim(`  - ${fix}`));
        }
      }

      // Step 2: Validate
      const valCtx: ValidationContext = {
        tokenNames,
        componentNames: new Set(componentNames),
      };
      const validation = validateSpecFull(spec, valCtx);
      if (validation.errors.length > 0) {
        console.log(pc.yellow("\nValidation errors:"));
        for (const issue of validation.errors) {
          console.log(pc.yellow(`  - [${issue.path}] ${issue.message}`));
        }
      }
      if (validation.warnings.length > 0) {
        console.log(pc.yellow("\nValidation warnings:"));
        for (const issue of validation.warnings) {
          console.log(pc.yellow(`  - [${issue.path}] ${issue.message}`));
        }
      }

      // Step 3: Preview
      console.log("");
      console.log(pc.bold("Preview:"));
      console.log(renderPreview(spec));
      console.log("");

      // Step 4: Set GEN_PREVIEW mode — action handled by session.ts on next input
      ctx.state.mode = "GEN_PREVIEW";
      ctx.pendingAction = {
        type: "create-preview",
        data: { spec, boardName, args },
        handle: handlePreviewAction,
      };

      console.log(pc.dim("Actions: (p)ush to Penpot  (e)dit  (r)egenerate  (s)ave spec  (q)uit"));
    },
  };
}

/**
 * Handle a single-key action while in GEN_PREVIEW mode.
 * Returns true if the input was consumed (valid or invalid action key).
 */
async function handlePreviewAction(input: string, ctx: SessionContext): Promise<boolean> {
  const key = input.trim().toLowerCase();
  const validActions = ["p", "e", "r", "s", "q"];

  if (!validActions.includes(key)) {
    console.log(pc.dim("Actions: (p)ush to Penpot  (e)dit  (r)egenerate  (s)ave spec  (q)uit"));
    return true; // consumed but invalid — stay in GEN_PREVIEW
  }

  const { spec, boardName, args } = ctx.pendingAction!.data as {
    spec: LayoutSpec;
    boardName: string;
    args: string;
  };

  // Clear pending state
  ctx.state.mode = "NORMAL";
  ctx.pendingAction = null;

  switch (key) {
    case "p": {
      // Push to Penpot
      if (!ctx.bridge) {
        throw penpotNotConnected();
      }

      const renderSpinner = spinner("Rendering to Penpot...").start();
      try {
        // Load tokens for resolver
        let tokenResolver: TokenResolver | null = null;
        if (ctx.config.projectRoot) {
          const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");
          if (fs.existsSync(tokensPath)) {
            const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as PenpotDesignTokens;
            tokenResolver = new TokenResolver(tokens);
          }
        }

        const result = await renderToPenpot(spec, ctx.bridge, tokenResolver);
        renderSpinner.succeed(`Pushed to Penpot (${result.shapeIds.length} shapes created)`);

        if (result.warnings.length > 0) {
          console.log(pc.yellow("\nRender warnings:"));
          for (const warn of result.warnings) {
            console.log(pc.yellow(`  - ${warn}`));
          }
        }
      } catch (err) {
        renderSpinner.fail("Render failed");
        const message = err instanceof Error ? err.message : String(err);
        console.log(pc.red(`Error: ${message}`));
      }
      break;
    }

    case "e": {
      console.log(pc.dim("Re-enter your prompt to modify the spec, then run /create again."));
      break;
    }

    case "r": {
      console.log(pc.dim("Regenerating — run the same /create command again."));
      break;
    }

    case "s": {
      // Save spec
      if (!ctx.config.projectRoot) {
        console.log(pc.yellow("No project root. Run /init first."));
        break;
      }

      const specsDir = path.join(ctx.config.projectRoot, "specs");
      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      const specPath = path.join(specsDir, `${boardName}.json`);
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
      console.log(pc.green(`Spec saved to ${specPath}`));
      break;
    }

    case "q": {
      console.log(pc.dim("Cancelled."));
      break;
    }
  }

  return true;
}

function collectTokenNames(obj: Record<string, unknown>, prefix: string, names: Set<string>): void {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      if ("value" in (val as Record<string, unknown>)) {
        names.add(path);
      } else {
        collectTokenNames(val as Record<string, unknown>, path, names);
      }
    }
  }
}

