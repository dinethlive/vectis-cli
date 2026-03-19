export interface VectisGlobalConfig {
  anthropicApiKey?: string;
  defaultModel?: string;
  globalSkillsDir?: string;
}

export interface VectisProjectConfig {
  penpotFileId?: string;
  penpotFileUrl?: string;
  mcpServerUrl?: string;
  wsServerUrl?: string;
  model?: string;
  namingFilter?: {
    skipPrefixes?: string[];
  };
}

export interface VectisConfig {
  global: VectisGlobalConfig;
  project: VectisProjectConfig;
  apiKey: string | null;
  model: string;
  mcpServerUrl: string;
  wsServerUrl: string;
  projectRoot: string | null;
  globalConfigDir: string;
  verbose: boolean;
}
