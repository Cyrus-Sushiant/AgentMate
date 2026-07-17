export const queryKeys = {
  cliStatus: ['cli-status'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  activity: ['activity'] as const,
  repositories: ['skill-repositories'] as const,
  repositoryIndex: (id: string) => ['skill-repository-index', id] as const,
  installedSkills: (projectId: string) => ['installed-skills', projectId] as const,
  templates: ['prompt-templates'] as const,
  settings: ['settings'] as const,
  promptHistory: ['prompt-history'] as const,
  promptHistorySearch: (query: string) => ['prompt-history', query] as const,
};
