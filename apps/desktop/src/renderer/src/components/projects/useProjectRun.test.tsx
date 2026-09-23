import type { Project, ProjectRunCommand } from '@agentmat/core';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTerminalStore } from '@/stores/terminalStore';
import { renderHookWithProviders } from '../../../../test/renderer/renderWithProviders';
import { useProjectRun } from './useProjectRun';

const toast = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const dev: ProjectRunCommand = { id: 'dev', label: 'Dev', command: 'pnpm dev' };
const prod: ProjectRunCommand = { id: 'prod', label: 'Prod', command: 'pnpm start' };

function project(runCommands: ProjectRunCommand[]): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    folderPath: '/work/apollo',
    runCommands,
  } as unknown as Project;
}

function sessions() {
  return useTerminalStore.getState().sessions;
}

describe('useProjectRun', () => {
  it('runCommand types the chosen command into a new terminal in the project folder', () => {
    const { result } = renderHookWithProviders(() => useProjectRun());

    act(() => result.current.runCommand(project([dev, prod]), prod));

    expect(sessions()).toHaveLength(1);
    expect(sessions()[0]).toMatchObject({
      title: 'Apollo',
      cwd: '/work/apollo',
      projectId: 'p1',
      initialInput: 'pnpm start',
    });
    expect(toast.info).toHaveBeenCalledWith('Press Enter in the terminal to run "pnpm start".');
  });

  it('requestRun runs the only command straight away', () => {
    const { result } = renderHookWithProviders(() => useProjectRun());

    act(() => result.current.requestRun(project([dev])));

    expect(sessions().map((s) => s.initialInput)).toEqual(['pnpm dev']);
  });

  it('requestRun calls onEmpty and opens nothing when there is no command', () => {
    const onEmpty = vi.fn();
    const { result } = renderHookWithProviders(() => useProjectRun());

    act(() => result.current.requestRun(project([]), { onEmpty }));

    expect(onEmpty).toHaveBeenCalledOnce();
    expect(sessions()).toHaveLength(0);
  });

  it('requestRun waits for a pick when there are several commands', () => {
    const { result } = renderHookWithProviders(() => useProjectRun());

    act(() => result.current.requestRun(project([dev, prod])));

    expect(sessions()).toHaveLength(0);
  });
});
