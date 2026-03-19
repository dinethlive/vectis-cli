import pc from "picocolors";
import { spinner } from "../../utils/spinner.js";
import type { CommandHandler } from "../../types/repl.js";
import { penpotNotConnected } from "../../types/errors.js";

export function pullCommand(): CommandHandler {
  return {
    name: "pull",
    description: "Pull design data from Penpot",
    usage: "/pull",
    async execute(args, ctx) {
      if (!ctx.bridge) {
        throw penpotNotConnected();
      }

      const sp = spinner("Scanning Penpot file...").start();

      try {
        // Get pages
        const pages = await ctx.bridge.getPages();
        sp.text = `Found ${pages.length} pages, scanning...`;

        let boardCount = 0;
        let layerCount = 0;

        // Naming filter: skip pages prefixed with ~ or _
        const filteredPages = pages.filter(
          (p) => !p.name.startsWith("~") && !p.name.startsWith("_"),
        );

        for (let i = 0; i < filteredPages.length; i++) {
          const page = filteredPages[i];
          sp.text = `Scanning page ${i + 1}/${filteredPages.length}: ${page.name}...`;

          const shapes = await ctx.bridge.getShapeTree(page.id);
          // Filter boards
          const boards = shapes.filter(
            (s) => s.type === "frame" && !s.name.startsWith("~") && !s.name.startsWith("_"),
          );
          boardCount += boards.length;
          layerCount += shapes.length;
        }

        // Get components
        sp.text = "Fetching components...";
        let componentCount = 0;
        try {
          const components = await ctx.bridge.getComponents();
          componentCount = components.length;
        } catch {
          ctx.logger.debug("Could not fetch components");
        }

        // Get tokens
        sp.text = "Fetching design tokens...";
        let tokenSetCount = 0;
        try {
          const tokens = await ctx.bridge.getDesignTokens();
          tokenSetCount = Object.keys(tokens).length;

          // Write tokens to context
          if (ctx.config.projectRoot && tokenSetCount > 0) {
            const fs = await import("node:fs");
            const path = await import("node:path");
            const tokensPath = path.join(ctx.config.projectRoot, "context", "tokens.json");
            fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
          }
        } catch {
          ctx.logger.debug("Could not fetch tokens");
        }

        sp.succeed("Pull complete");

        console.log(pc.bold("\nSummary:"));
        console.log(`  Pages:      ${filteredPages.length} (${pages.length - filteredPages.length} filtered)`);
        console.log(`  Boards:     ${boardCount}`);
        console.log(`  Components: ${componentCount}`);
        console.log(`  Token sets: ${tokenSetCount}`);
      } catch (err) {
        sp.fail("Pull failed");
        throw err;
      }
    },
  };
}
