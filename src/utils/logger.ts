import pc from "picocolors";

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function createLogger(verbose: boolean): Logger {
  return {
    debug(msg: string) {
      if (verbose) {
        process.stderr.write(pc.gray(`[debug] ${msg}\n`));
      }
    },
    info(msg: string) {
      process.stderr.write(`${msg}\n`);
    },
    warn(msg: string) {
      process.stderr.write(pc.yellow(`[warn] ${msg}\n`));
    },
    error(msg: string) {
      process.stderr.write(pc.red(`[error] ${msg}\n`));
    },
  };
}
