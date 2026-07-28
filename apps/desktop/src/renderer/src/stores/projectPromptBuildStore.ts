import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PromptType, TargetAI } from '@agentmat/core';

interface ProjectPromptBuildEntry {
  rawInput: string;
  promptType: PromptType;
  targetAI: TargetAI;
  generated: string;
}

const EMPTY_ENTRY: ProjectPromptBuildEntry = {
  rawInput: '',
  promptType: 'Full Stack',
  targetAI: 'Claude',
  generated: '',
};

interface ProjectPromptBuildState {
  entries: Record<string, ProjectPromptBuildEntry>;
  update: (projectId: string, patch: Partial<ProjectPromptBuildEntry>) => void;
  clear: (projectId: string) => void;
}

export const useProjectPromptBuildStore = create<ProjectPromptBuildState>()(
  persist(
    (set) => ({
      entries: {},
      update: (projectId, patch) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [projectId]: { ...EMPTY_ENTRY, ...state.entries[projectId], ...patch },
          },
        })),
      clear: (projectId) =>
        set((state) => ({
          entries: { ...state.entries, [projectId]: { ...EMPTY_ENTRY } },
        })),
    }),
    { name: 'agentmate-project-prompt-build' },
  ),
);

export function getProjectPromptBuildEntry(
  projectId: string,
): ProjectPromptBuildEntry {
  return useProjectPromptBuildStore.getState().entries[projectId] ?? EMPTY_ENTRY;
}
