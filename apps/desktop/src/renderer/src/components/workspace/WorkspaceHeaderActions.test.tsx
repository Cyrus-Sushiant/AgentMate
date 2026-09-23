import type { Project } from '@agentmat/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVersionDialogStore } from '@/stores/versionDialogStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { WorkspaceHeaderActions } from './WorkspaceHeaderActions';

vi.mock('@/lib/terminal/terminalRuntime', () => ({
  terminalRuntime: { dispose: vi.fn(), mount: vi.fn(), unmount: vi.fn(), focus: vi.fn() },
}));

const run = vi.hoisted(() => ({ requestRun: vi.fn(), runCommand: vi.fn() }));

vi.mock('@/components/projects/useProjectRun', () => ({
  useProjectRun: () => ({
    requestRun: run.requestRun,
    runCommand: run.runCommand,
    runPicker: null,
  }),
}));

/**
 * The real dialogs hold the tag form, the running suggestion and the tag being created. What
 * matters here is which project each instance was mounted for and what it is told, so the stand-in
 * records that and hands back its onOpenChange for the test to call later, the way a tag that
 * finishes in the background does.
 */
const dialogs = vi.hoisted(() => ({
  mounts: [] as string[],
  unmounts: [] as string[],
  onOpenChange: {} as Record<string, (open: boolean) => void>,
}));

vi.mock('@/pages/ProjectDetailPage', () => ({
  ProjectVersionDialogs: ({
    projectId,
    open,
    onOpenChange,
  }: {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    dialogs.onOpenChange[projectId] = onOpenChange;
    // biome-ignore lint/correctness/useExhaustiveDependencies: counts real mounts only; re-running on a projectId change would hide a reused instance
    useEffect(() => {
      dialogs.mounts.push(projectId);
      return () => {
        dialogs.unmounts.push(projectId);
      };
    }, []);
    return open ? <div role="dialog" aria-label={`Tag a version of ${projectId}`} /> : null;
  },
}));

function project(id: string): Project {
  return {
    id,
    name: id.toUpperCase(),
    folderPath: `/work/${id}`,
    description: '',
    tags: [],
    agentType: 'claude-code',
    notes: '',
    runCommands: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Project;
}

/** Shows where the header navigated to, since the test router has no other pages. */
function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output aria-label="Location">{location.pathname + location.search}</output>;
}

beforeEach(() => {
  run.requestRun.mockReset();
  run.runCommand.mockReset();
  dialogs.mounts.length = 0;
  dialogs.unmounts.length = 0;
  dialogs.onOpenChange = {};
});

async function renderHeader(projects: Project[] = [project('a'), project('b')]) {
  useWorkspaceStore.getState().openProject('a');
  const view = renderWithProviders(
    <>
      <WorkspaceHeaderActions />
      <LocationProbe />
    </>,
    {
      bridge: { 'projects.list': projects },
    },
  );
  await screen.findByRole('button', { name: 'Tag a version' });
  return view;
}

describe('WorkspaceHeaderActions tag a version', () => {
  it('gives each project its own dialogs instead of reusing one', async () => {
    await renderHeader();
    expect(dialogs.mounts).toEqual(['a']);

    act(() => useWorkspaceStore.getState().openProject('b'));

    // A fresh instance for B, so A's typed version, pending suggestion and tag can't show up there.
    await waitFor(() => expect(dialogs.mounts).toEqual(['a', 'b']));
    expect(dialogs.unmounts).toEqual(['a']);
  });

  it("does not close project B's dialog when project A's flow closes", async () => {
    const { user } = await renderHeader();
    await user.click(screen.getByRole('button', { name: 'Tag a version' }));
    expect(useVersionDialogStore.getState().openProjectId).toBe('a');
    const closeA = dialogs.onOpenChange.a;

    act(() => useWorkspaceStore.getState().openProject('b'));
    await waitFor(() => expect(dialogs.mounts).toContain('b'));
    await user.click(screen.getByRole('button', { name: 'Tag a version' }));
    expect(await screen.findByRole('dialog', { name: 'Tag a version of b' })).toBeInTheDocument();

    // A's tag finishes and its dialog asks to close, long after the user moved on to B.
    act(() => closeA?.(false));

    expect(useVersionDialogStore.getState().openProjectId).toBe('b');
    expect(screen.getByRole('dialog', { name: 'Tag a version of b' })).toBeInTheDocument();
  });
});

const dev = { id: 'dev', label: 'Dev', command: 'pnpm dev' };
const prod = { id: 'prod', label: '', command: 'pnpm start' };

async function openRunMenu(
  user: Awaited<ReturnType<typeof renderHeader>>['user'],
  name: string | RegExp,
): Promise<HTMLElement> {
  await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name }) });
  return screen.findByRole('menu');
}

describe('WorkspaceHeaderActions run menu', () => {
  it('shows each command under its environment, or as the bare command when unnamed', async () => {
    const { user } = await renderHeader([{ ...project('a'), runCommands: [dev, prod] }]);
    const menu = await openRunMenu(user, 'Run A: pick a command');

    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Devpnpm dev',
      'pnpm start',
      'Edit run commands',
    ]);
    expect(within(menu).getByText('Run in A')).toBeInTheDocument();
  });

  it('opens the menu without running anything', async () => {
    const { user } = await renderHeader([{ ...project('a'), runCommands: [dev] }]);
    await openRunMenu(user, 'Run A (pnpm dev)');

    expect(run.requestRun).not.toHaveBeenCalled();
    expect(run.runCommand).not.toHaveBeenCalled();
  });

  it('still runs through the normal path on a left click', async () => {
    const { user } = await renderHeader([{ ...project('a'), runCommands: [dev] }]);
    await user.click(screen.getByRole('button', { name: 'Run A (pnpm dev)' }));

    expect(run.requestRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), {
      onEmpty: expect.any(Function),
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the project on its run commands from Edit run commands', async () => {
    const { user } = await renderHeader([{ ...project('a'), runCommands: [dev] }]);
    const menu = await openRunMenu(user, 'Run A (pnpm dev)');

    await user.click(within(menu).getByRole('menuitem', { name: 'Edit run commands' }));

    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(
      '/projects/a?edit=run',
    );
  });

  it('opens the run commands of the project currently in the Workspace', async () => {
    const { user } = await renderHeader([
      { ...project('a'), runCommands: [dev] },
      { ...project('b'), runCommands: [prod] },
    ]);
    act(() => useWorkspaceStore.getState().openProject('b'));
    const menu = await openRunMenu(user, 'Run B (pnpm start)');

    await user.click(within(menu).getByRole('menuitem', { name: /pnpm start/ }));
    expect(run.runCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), prod);
  });

  it('lists the run commands on right-click and runs the one picked', async () => {
    const { user } = await renderHeader([{ ...project('a'), runCommands: [dev, prod] }]);

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Run A: pick a command' }),
    });
    expect(await screen.findByRole('menuitem', { name: /Edit run commands/ })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /pnpm start/ }));

    expect(run.runCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), prod);
  });

  it('offers to add a run command when the project has none', async () => {
    const { user } = await renderHeader();
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Set a run command for A' }),
    });
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('No run commands yet')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: /Add a run command/ }));

    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(
      '/projects/a?edit=run',
    );
  });
});
