import type { Project } from '@agentmat/core';
import { AGENT_TYPE_LABELS } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The project detail page reads its project out of the route, so everything here renders it
 * under `projects/:projectId`. The page is a shell around sixteen sections, so the tests cover
 * the shell (the header, the section nav, the not-found path) plus the sections that are the
 * page's own code rather than a separate component with its own tests.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

// The confirmation modal itself lives in the app shell, outside anything this page renders, so
// there is no button for a test to press. Standing in for it is the only way to reach both
// answers.
const confirm = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('@/stores/confirmStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/confirmStore')>();
  return { ...actual, confirmDialog: confirm.confirmDialog };
});

// Monaco's real module registers web workers through Vite's `?worker` imports, which do not
// exist outside a Vite build, and it measures layout jsdom has none of. The Config section only
// needs something that shows the text and reports edits.
vi.mock('@/components/editor/MonacoEditor', () => ({
  MonacoEditor: ({ value, onChange }: { value: string; onChange?: (next: string) => void }) => (
    <textarea
      aria-label="Editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));
vi.mock('@/components/editor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: () => <div />,
  languageFor: () => 'plaintext',
}));

const { default: ProjectDetailPage } = await import('./ProjectDetailPage');

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    folderPath: 'C:\\code\\apollo',
    description: 'The control room.',
    tags: ['web'],
    agentType: 'claude-code',
    notes: '',
    runCommands: [],
    prompt: '',
    notifications: {
      completion: { enabled: false, cliId: null, message: '' },
      confirmation: { enabled: false, cliId: null, message: '' },
      pet: { enabled: false, cliId: null, message: '' },
    },
    cliId: null,
    iconDataUrl: null,
    iconFile: null,
    iconBgColor: null,
    iconColor: null,
    websiteUrl: '',
    repoUrl: '',
    githubActionsMuted: [],
    pinned: false,
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    ...overrides,
  };
}

type Overrides = Record<string, unknown>;

/** Renders the page at `/projects/p1` with one project behind the bridge. */
function renderPage(bridge: Overrides = {}, projects: Project[] = [project()]) {
  return renderWithProviders(<ProjectDetailPage />, {
    route: '/projects/p1',
    path: 'projects/:projectId',
    bridge: { 'projects.list': projects, ...bridge },
  });
}

function sectionNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Project sections' });
}

/** Clicks a section in the left-hand nav and waits for it to report itself as the current one. */
async function openSection(
  user: ReturnType<typeof renderWithProviders>['user'],
  label: RegExp,
): Promise<void> {
  await user.click(within(sectionNav()).getByRole('button', { name: label }));
  await waitFor(() =>
    expect(within(sectionNav()).getByRole('button', { name: label, current: 'page' })).toBeTruthy(),
  );
}

async function openHeaderMenu(
  user: ReturnType<typeof renderWithProviders>['user'],
): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'More project actions' }));
  return screen.findByRole('menu');
}

describe('ProjectDetailPage shell', () => {
  it('shows the project named in the route, with its folder and agent', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Apollo' })).toBeTruthy();
    expect(screen.getByText('The control room.')).toBeTruthy();
    expect(screen.getByText(AGENT_TYPE_LABELS['claude-code'])).toBeTruthy();
    expect(screen.getByText('C:\\code\\apollo')).toBeTruthy();
    expect(screen.getByText('web')).toBeTruthy();
  });

  it('says so instead of crashing when the id in the route matches nothing', async () => {
    renderWithProviders(<ProjectDetailPage />, {
      route: '/projects/ghost',
      path: 'projects/:projectId',
      bridge: { 'projects.list': [project()] },
    });

    expect(await screen.findByText('Project not found')).toBeTruthy();
    expect(screen.getByText('It may have been removed, or this link is out of date.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Back to Projects/ }).length).toBeGreaterThan(0);
    // The header, and everything that reads off a project, must stay off the screen.
    expect(screen.queryByRole('button', { name: 'More project actions' })).toBeNull();
  });

  it('survives the project list failing to load, with the same not-found state', async () => {
    renderWithProviders(<ProjectDetailPage />, {
      route: '/projects/p1',
      path: 'projects/:projectId',
      bridge: {
        'projects.list': async () => {
          throw new Error('database locked');
        },
      },
    });

    expect(await screen.findByText('Project not found')).toBeTruthy();
  });

  it('offers Run only once the project has a command to run', async () => {
    const { unmount } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Apollo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Run/ })).toBeNull();
    unmount();

    renderPage({}, [
      project({ runCommands: [{ id: 'r1', label: 'dev', command: 'npm run dev' }] }),
    ]);
    expect(await screen.findByRole('button', { name: /^Run/ })).toBeTruthy();
  });

  it('copies the folder path to the clipboard', async () => {
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    await user.click(screen.getByRole('button', { name: /C:\\code\\apollo/ }));

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe('C:\\code\\apollo'),
    );
    expect(toast.success).toHaveBeenCalledWith('Path copied to clipboard.');
  });

  it('asks the shell to open the project folder, and reports a refusal', async () => {
    const { user, bridge } = renderPage({
      'shell.openPath': async () => {
        throw new Error('no such directory');
      },
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await user.click(screen.getByRole('button', { name: 'Open in File Explorer' }));

    expect(bridge.$fn('shell.openPath')).toHaveBeenCalledWith('C:\\code\\apollo');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('no such directory'));
  });
});

describe('ProjectDetailPage sections', () => {
  it('starts on Overview and shows its empty prompt and notes', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    expect(
      within(sectionNav()).getByRole('button', { name: /^Overview/, current: 'page' }),
    ).toBeTruthy();
    expect(screen.getByText('Standing prompt')).toBeTruthy();
    expect(screen.getByText('No standing prompt')).toBeTruthy();
    expect(screen.getByText('No notes yet')).toBeTruthy();
  });

  it('shows each section it is switched to', async () => {
    const { user } = renderPage({
      'skills.listInstalled': [],
      'mcp.listInstalled': [],
      // A scalar answer is read back as a value, so a string one has to arrive as a function.
      'fs.readFile': async () => '{ "runCommand": "npm run dev" }',
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await openSection(user, /^Skills/);
    expect(await screen.findByText('No skills installed')).toBeTruthy();

    await openSection(user, /^MCP/);
    expect(await screen.findByText('No MCP servers installed')).toBeTruthy();

    await openSection(user, /^Terminal/);
    expect(await screen.findByText('Project terminal')).toBeTruthy();
    expect(screen.getByText(/Opens in this folder/)).toBeTruthy();
    // Nothing is configured to run, so the section offers to set one up instead.
    expect(screen.getByRole('button', { name: 'Set a run command' })).toBeTruthy();

    await openSection(user, /^Config/);
    expect(await screen.findByText('.agentmate/config.json')).toBeTruthy();

    await openSection(user, /^Prompts/);
    // Leaving a section really unmounts it, rather than stacking the sections up.
    expect(screen.queryByText('Project terminal')).toBeNull();
    expect(screen.queryByText('No skills installed')).toBeNull();
  });

  it('sends an old Schedule link to the Scheduled tab of Prompts', async () => {
    renderWithProviders(<ProjectDetailPage />, {
      route: '/projects/p1?tab=schedule',
      path: 'projects/:projectId',
      bridge: { 'projects.list': [project()], 'scheduledTasks.listByProject': [] },
    });

    expect(await screen.findByText('Nothing scheduled')).toBeTruthy();
    expect(
      within(sectionNav()).getByRole('button', { name: /^Prompts/, current: 'page' }),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Scheduled/, selected: true })).toBeTruthy();
  });

  it('mounts every section in the nav without falling over', async () => {
    // The page is mostly a router between fifteen sections, so the thing worth proving is that
    // each one can be reached and rendered with nothing but a project behind the bridge.
    const { user } = renderPage({ 'tools.detectAll': [{ id: 'diffray', installed: true }] });
    await screen.findByRole('heading', { name: 'Apollo' });

    const labels = within(sectionNav())
      .getAllByRole('button')
      .map((button) => button.textContent?.trim() ?? '');
    expect(labels.length).toBe(15);

    for (const label of labels) {
      const button = within(sectionNav()).getByRole('button', { name: label });
      await user.click(button);
      await waitFor(() =>
        expect(
          within(sectionNav()).getByRole('button', { name: label, current: 'page' }),
        ).toBeTruthy(),
      );
      // The header belongs to the page, not to a section, so it proves the page is still up.
      expect(screen.getByRole('heading', { name: 'Apollo' })).toBeTruthy();
    }
  });

  it('opens the section named in the query string, and ignores one it does not know', async () => {
    const { unmount } = renderWithProviders(<ProjectDetailPage />, {
      route: '/projects/p1?tab=git',
      path: 'projects/:projectId',
      bridge: { 'projects.list': [project()] },
    });

    expect(await screen.findByText("This folder isn't a git repository yet")).toBeTruthy();
    expect(
      within(sectionNav()).getByRole('button', { name: /^Git/, current: 'page' }),
    ).toBeTruthy();
    unmount();

    renderWithProviders(<ProjectDetailPage />, {
      route: '/projects/p1?tab=nonsense',
      path: 'projects/:projectId',
      bridge: { 'projects.list': [project()] },
    });
    await screen.findByRole('heading', { name: 'Apollo' });
    expect(
      within(sectionNav()).getByRole('button', { name: /^Overview/, current: 'page' }),
    ).toBeTruthy();
  });

  it('hides the Review section until diffray is installed', async () => {
    const { unmount } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });
    expect(within(sectionNav()).queryByRole('button', { name: /^Review/ })).toBeNull();
    unmount();

    renderPage({ 'tools.detectAll': [{ id: 'diffray', installed: true }] });
    await screen.findByRole('heading', { name: 'Apollo' });
    await waitFor(() =>
      expect(within(sectionNav()).getByRole('button', { name: /^Review/ })).toBeTruthy(),
    );
  });

  it('previews the files bootstrapping would write', async () => {
    const { user } = renderPage({
      'projects.bootstrapPlan': {
        agentLabel: 'Claude Code',
        docsUrl: 'https://example.test/docs',
        files: [{ relativePath: 'CLAUDE.md' }, { relativePath: '.claude/settings.json' }],
        folders: ['.claude'],
      },
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await openSection(user, /^Bootstrap/);

    expect(await screen.findByText('CLAUDE.md')).toBeTruthy();
    expect(screen.getByText('.claude/settings.json')).toBeTruthy();
    expect(screen.getByText('.claude/')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bootstrap Project/ })).toBeTruthy();
  });

  it('explains a plan that could not be loaded rather than showing an empty box', async () => {
    const { user } = renderPage({
      'projects.bootstrapPlan': async () => {
        throw new Error('agent template missing');
      },
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await openSection(user, /^Bootstrap/);

    expect(await screen.findByText(/Could not load the plan: agent template missing/)).toBeTruthy();
  });

  it('lists the installed skills and removes one after the confirmation', async () => {
    const { user, bridge } = renderPage({
      'skills.listInstalled': [{ skillId: 'acme/linter', version: '1.2.0' }],
      'skills.checkForUpdates': [],
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await openSection(user, /^Skills/);
    expect(await screen.findByText('acme/linter')).toBeTruthy();
    expect(screen.getByText('v1.2.0')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove acme/linter' }));

    await waitFor(() =>
      expect(confirm.confirmDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove "acme/linter"?', variant: 'destructive' }),
      ),
    );
    await waitFor(() =>
      expect(bridge.$fn('skills.remove')).toHaveBeenCalledWith({
        projectId: 'p1',
        skillId: 'acme/linter',
      }),
    );
  });
});

describe('ProjectDetailPage notes', () => {
  it('saves what was typed in the notes box', async () => {
    const { user, bridge } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    await user.click(screen.getByRole('button', { name: /Add notes/ }));
    await user.type(screen.getByRole('textbox'), 'Deploy on Fridays, never.');
    await user.click(screen.getByRole('button', { name: 'Save notes' }));

    expect(bridge.$fn('projects.update')).toHaveBeenCalledWith('p1', {
      notes: 'Deploy on Fridays, never.',
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Notes saved.'));
  });

  it('keeps the draft on screen and says why when saving the notes fails', async () => {
    const { user } = renderPage({
      'projects.update': async () => {
        throw new Error('disk is read only');
      },
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    await user.click(screen.getByRole('button', { name: /Add notes/ }));
    await user.type(screen.getByRole('textbox'), 'Something worth keeping.');
    await user.click(screen.getByRole('button', { name: 'Save notes' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('disk is read only'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Something worth keeping.',
    );
  });
});

describe('ProjectDetailPage header menu', () => {
  it('removes the project once the confirmation is accepted', async () => {
    confirm.confirmDialog.mockResolvedValueOnce(true);
    const { user, bridge } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    const menu = await openHeaderMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Remove project/ }));

    await waitFor(() =>
      expect(confirm.confirmDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove "Apollo"?', variant: 'destructive' }),
      ),
    );
    await waitFor(() => expect(bridge.$fn('projects.delete')).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Project removed.');
  });

  it('keeps the project when the confirmation is declined', async () => {
    confirm.confirmDialog.mockResolvedValueOnce(false);
    const { user, bridge } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    const menu = await openHeaderMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Remove project/ }));

    await waitFor(() => expect(confirm.confirmDialog).toHaveBeenCalled());
    expect(() => bridge.$fn('projects.delete')).toThrow();
    expect(await screen.findByRole('heading', { name: 'Apollo' })).toBeTruthy();
  });

  it('archives the project and marks it as archived in the header', async () => {
    const { user, bridge } = renderPage({
      'projects.setArchived': async () => project({ archived: true }),
    });
    await screen.findByRole('heading', { name: 'Apollo' });

    const menu = await openHeaderMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Archive project/ }));

    expect(bridge.$fn('projects.setArchived')).toHaveBeenCalledWith('p1', true);
    expect(await screen.findByText('Archived')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith(
      'Archived. It now lives behind the Archived toggle on the Projects page.',
    );
  });

  it('opens the standing prompt dialog from the header', async () => {
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    await user.click(screen.getByRole('button', { name: 'Prompt' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Project prompt')).toBeTruthy();
  });

  it('opens the edit dialog filled in with the project', async () => {
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Apollo' });

    const menu = await openHeaderMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Edit project/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit project')).toBeTruthy();
    expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Apollo');
    expect((within(dialog).getByLabelText(/^Folder/) as HTMLInputElement).value).toBe(
      'C:\\code\\apollo',
    );
  });
});

describe('ProjectDetailPage edit run commands link', () => {
  const withRun = project({ runCommands: [{ id: 'dev', label: 'Dev', command: 'pnpm dev' }] });

  function renderAt(route: string) {
    return renderWithProviders(<ProjectDetailPage />, {
      route,
      path: 'projects/:projectId',
      bridge: { 'projects.list': [withRun] },
    });
  }

  it('opens Edit project on the Agent tab when the route asks for ?edit=run', async () => {
    renderAt('/projects/p1?edit=run');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit project')).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: /Agent/, selected: true })).toBeTruthy();
    expect((within(dialog).getByLabelText('Command 1') as HTMLInputElement).value).toBe('pnpm dev');
  });

  it('keeps the section from the route alongside the edit link', async () => {
    renderAt('/projects/p1?tab=terminal&edit=run');

    await screen.findByRole('dialog');
    // The open dialog hides the page behind it from the accessibility tree.
    const nav = screen.getByRole('navigation', { name: 'Project sections', hidden: true });
    expect(
      within(nav).getByRole('button', { name: /Terminal/, current: 'page', hidden: true }),
    ).toBeTruthy();
  });

  it('goes back to opening on Basics after the run commands dialog is closed', async () => {
    const { user } = renderAt('/projects/p1?edit=run');
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const menu = await openHeaderMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: /Edit project/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: /Basics/, selected: true })).toBeTruthy();
  });

  it('does not open the edit dialog without the link', async () => {
    renderAt('/projects/p1');

    await screen.findByRole('heading', { name: 'Apollo' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
