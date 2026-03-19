import { z } from "zod";

export const globalConfigSchema = z.object({
  anthropicApiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  globalSkillsDir: z.string().optional(),
});

export const projectConfigSchema = z.object({
  penpotFileId: z.string().optional(),
  penpotFileUrl: z.string().url().optional(),
  mcpServerUrl: z.string().url().optional(),
  wsServerUrl: z.string().optional(),
  model: z.string().optional(),
  namingFilter: z
    .object({
      skipPrefixes: z.array(z.string()).optional(),
    })
    .optional(),
});

export type GlobalConfigInput = z.infer<typeof globalConfigSchema>;
export type ProjectConfigInput = z.infer<typeof projectConfigSchema>;
