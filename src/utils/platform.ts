import os from "node:os";

export interface PlatformInfo {
  os: string;
  osVersion: string;
  arch: string;
  terminal: string;
  shell: string;
  bunVersion: string;
  nodeVersion: string;
}

export function getPlatformInfo(): PlatformInfo {
  return {
    os: `${os.platform()} ${os.release()}`,
    osVersion: os.version(),
    arch: os.arch(),
    terminal: getTerminalProgram(),
    shell: getShell(),
    bunVersion: getBunVersion(),
    nodeVersion: process.version,
  };
}

export function isWindows(): boolean {
  return os.platform() === "win32";
}

export function isMac(): boolean {
  return os.platform() === "darwin";
}

export function isLinux(): boolean {
  return os.platform() === "linux";
}

export function getTerminalProgram(): string {
  return (
    process.env.TERM_PROGRAM ||
    process.env.TERMINAL_EMULATOR ||
    (isWindows() ? process.env.WT_SESSION ? "Windows Terminal" : "cmd" : "unknown")
  );
}

function getShell(): string {
  return process.env.SHELL || process.env.COMSPEC || "unknown";
}

function getBunVersion(): string {
  // Bun sets its version in process.versions
  const versions = process.versions as Record<string, string>;
  if (versions.bun) return versions.bun;

  // Fallback: check Bun global
  try {
    return (globalThis as Record<string, unknown> as { Bun?: { version: string } }).Bun?.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
