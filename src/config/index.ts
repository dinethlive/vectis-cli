import fs from "node:fs";
import { globalConfigSchema, projectConfigSchema } from "./schema.js";
import {
  getGlobalConfigPath,
  getGlobalConfigDir,
  getGlobalSkillsDir,
  findProjectRoot,
  getProjectConfigPath,
} from "./paths.js";
import { DEFAULT_MODEL, MCP_DEFAULT_URL, WS_DEFAULT_URL } from "../constants.js";
import type { VectisConfig, VectisGlobalConfig, VectisProjectConfig } from "../types/config.js";
import type { Logger } from "../utils/logger.js";

function readJsonFile(filePath: string): unknown {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadGlobalConfig(logger: Logger): VectisGlobalConfig {
  const configPath = getGlobalConfigPath();
  const raw = readJsonFile(configPath);
  if (!raw) {
    logger.debug(`No global config at ${configPath}`);
    return {};
  }

  const result = globalConfigSchema.safeParse(raw);
  if (!result.success) {
    logger.warn(`Invalid global config: ${result.error.message}`);
    return {};
  }
  return result.data;
}

function loadProjectConfig(projectRoot: string, logger: Logger): VectisProjectConfig {
  const configPath = getProjectConfigPath(projectRoot);
  const raw = readJsonFile(configPath);
  if (!raw) {
    logger.debug(`No project config at ${configPath}`);
    return {};
  }

  const result = projectConfigSchema.safeParse(raw);
  if (!result.success) {
    logger.warn(`Invalid project config: ${result.error.message}`);
    return {};
  }
  return result.data;
}

export async function loadConfig(logger: Logger): Promise<VectisConfig> {
  const global = loadGlobalConfig(logger);
  const projectRoot = findProjectRoot();
  const project = projectRoot ? loadProjectConfig(projectRoot, logger) : {};

  // Precedence: env var > project config > global config
  const apiKey =
    process.env.ANTHROPIC_API_KEY || project.penpotFileId
      ? process.env.ANTHROPIC_API_KEY || global.anthropicApiKey || null
      : global.anthropicApiKey || null;

  const model = project.model || global.defaultModel || DEFAULT_MODEL;
  const mcpServerUrl = project.mcpServerUrl || MCP_DEFAULT_URL;
  const wsServerUrl = project.wsServerUrl || WS_DEFAULT_URL;

  return {
    global,
    project,
    apiKey: process.env.ANTHROPIC_API_KEY || global.anthropicApiKey || null,
    model,
    mcpServerUrl,
    wsServerUrl,
    projectRoot,
    globalConfigDir: getGlobalConfigDir(),
    verbose: false,
  };
}

export function saveGlobalConfig(config: VectisGlobalConfig): void {
  const dir = getGlobalConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getGlobalConfigPath(), JSON.stringify(config, null, 2));
}

export function saveProjectConfig(projectRoot: string, config: VectisProjectConfig): void {
  const configDir = `${projectRoot}/.vectis`;
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(getProjectConfigPath(projectRoot), JSON.stringify(config, null, 2));
}

export { getGlobalConfigDir, getGlobalSkillsDir, findProjectRoot } from "./paths.js";
