import { z } from 'zod';

export const SkillFileSchema = z.object({
  path: z.string(),
  url: z.string(),
});
export type SkillFile = z.infer<typeof SkillFileSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  author: z.string(),
  version: z.string(),
  popularity: z.number().default(0),
  dependencies: z.array(z.string()).default([]),
  compatibility: z.array(z.string()).default([]),
  documentationUrl: z.string().optional(),
  files: z.array(SkillFileSchema).min(1),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillRepositoryIndexSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  skills: z.array(SkillSchema),
});
export type SkillRepositoryIndex = z.infer<typeof SkillRepositoryIndexSchema>;

export type SkillRepositorySourceType = 'url' | 'git' | 'local-folder';

export interface SkillRepository {
  id: string;
  name: string;
  sourceType: SkillRepositorySourceType;
  source: string;
  addedAt: string;
  lastRefreshedAt: string | null;
}

export function parseRepositoryIndex(raw: unknown): SkillRepositoryIndex {
  return SkillRepositoryIndexSchema.parse(raw);
}
