#!/usr/bin/env node
import { startRepl } from "./repl/session.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./utils/logger.js";
import { setupSignalHandlers } from "./repl/signals.js";
import { VERSION } from "./constants.js";
import { printBanner } from "./repl/banner.js";

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || process.env.VECTIS_DEBUG === "1";

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`vectis ${VERSION}`);
    process.exit(0);
  }

  const logger = createLogger(verbose);
  logger.debug("Starting Vectis CLI...");

  try {
    const config = await loadConfig(logger);
    printBanner();
    await startRepl({ config, logger, verbose });
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err.message);
    }
    process.exit(1);
  }
}

setupSignalHandlers();
main();
