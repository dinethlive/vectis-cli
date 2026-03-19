import pc from "picocolors";
import open from "open";
import type { CommandHandler } from "../../types/repl.js";
import { VERSION } from "../../constants.js";
import { getPlatformInfo } from "../../utils/platform.js";

const REPO = "penpot/vectis-cli";

export function bugCommand(): CommandHandler {
  return {
    name: "bug",
    description: "Open a pre-filled GitHub issue for bug reporting",
    usage: "/bug [title]",
    async execute(args, _ctx) {
      const platform = getPlatformInfo();

      const title = args.trim() || "Bug: ";
      const body = buildBody(platform);

      const url = new URL(`https://github.com/${REPO}/issues/new`);
      url.searchParams.set("title", title);
      url.searchParams.set("body", body);
      url.searchParams.set("labels", "bug");

      const issueUrl = url.toString();

      console.log(pc.bold("\nOpening bug report...\n"));
      console.log(pc.gray("Environment collected:"));
      console.log(`  Vectis:   ${VERSION}`);
      console.log(`  Bun:      ${platform.bunVersion}`);
      console.log(`  Node:     ${platform.nodeVersion}`);
      console.log(`  OS:       ${platform.os}`);
      console.log(`  Terminal: ${platform.terminal}`);
      console.log("");

      try {
        await open(issueUrl);
        console.log(pc.green("Opened in browser."));
      } catch {
        console.log(pc.yellow("Could not open browser. Copy this URL:"));
        console.log(pc.cyan(issueUrl));
      }
    },
  };
}

function buildBody(platform: {
  os: string;
  bunVersion: string;
  nodeVersion: string;
  terminal: string;
  arch: string;
  shell: string;
}): string {
  return `## Description

<!-- Describe the bug clearly -->

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

<!-- What did you expect? -->

## Actual Behavior

<!-- What happened instead? -->

## Environment

| Field | Value |
|-------|-------|
| Vectis | ${VERSION} |
| Bun | ${platform.bunVersion} |
| Node | ${platform.nodeVersion} |
| OS | ${platform.os} |
| Arch | ${platform.arch} |
| Terminal | ${platform.terminal} |
| Shell | ${platform.shell} |

## Additional Context

<!-- Paste error logs, screenshots, etc. -->
`;
}
