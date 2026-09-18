import type { Project } from '@agentmat/core';
import { AGENT_TYPE_LABELS } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The Projects page from the outside: what the list shows, the create dialog and the folder
 * picker behind it, and the pin/archive controls on a card. Nothing here reaches into the
 * component, it all goes through the same bridge the real preload script provides.
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

const { default: ProjectsPage } = await import('./ProjectsPage');

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    folderPath: 'C:\\code\\apollo',
    description: 'The control room.',
    tags: ['web'],
    agentType: 'claude-code',
    notes: '',
    runCommands: [{ id: 'r1', label: 'dev', command: 'npm run dev' }],
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

/** The dialog's Create button, which doubles as the form's validity readout. */
function createButton(dialog: HTMLElement): HTMLButtonElement {
  return within(dialog).getByRole('button', { name: 'Create project' }) as HTMLButtonElement;
}

describe('ProjectsPage list', () => {
  it('shows the empty state when there are no projects at all', async () => {
    renderWithProviders(<ProjectsPage />);

    expect(await screen.findByText('No projects yet')).toBeTruthy();
    // Both the header and the empty state offer the same way forward.
    expect(screen.getAllByRole('button', { name: /New Project/ }).length).toBeGreaterThan(0);
  });

  it('lists what the bridge returns, with the folder, the agent and the tags', async () => {
    renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.list': [
          project(),
          project({ id: 'p2', name: 'Hermes', folderPath: '/srv/hermes', tags: ['api'] }),
        ],
      },
    });

    expect(await screen.findByRole('button', { name: 'Apollo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hermes' })).toBeTruthy();
    expect(screen.getByText('2 projects')).toBeTruthy();
    // Only the last path segment is shown, the full path lives in the tooltip.
    expect(screen.getByText('apollo')).toBeTruthy();
    expect(screen.getByText('hermes')).toBeTruthy();
    expect(screen.getAllByText(AGENT_TYPE_LABELS['claude-code']).length).toBe(2);
    expect(screen.getByText('web')).toBeTruthy();
  });

  it('filters as you search and offers a way back out of an empty result', async () => {
    const { user } = renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.list': [project(), project({ id: 'p2', name: 'Hermes' })],
      },
    });
    await screen.findByRole('button', { name: 'Apollo' });

    await user.type(screen.getByRole('textbox', { name: 'Search projects' }), 'herm');
    expect(screen.queryByRole('button', { name: 'Apollo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hermes' })).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();

    await user.clear(screen.getByRole('textbox', { name: 'Search projects' }));
    await user.type(screen.getByRole('textbox', { name: 'Search projects' }), 'zeus');
    expect(screen.getByText('No matching projects')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('button', { name: 'Apollo' })).toBeTruthy();
  });

  it('opens a project when its name is clicked', async () => {
    // Only `/projects` is routed here, so navigating to the detail route shows up as this page
    // leaving the screen, which is the observable half of the navigation.
    const { user } = renderWithProviders(<ProjectsPage />, {
      route: '/projects',
      path: 'projects',
      bridge: { 'projects.list': [project()] },
    });

    await user.click(await screen.findByRole('button', { name: 'Apollo' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apollo' })).toBeNull());
  });
});

describe('ProjectsPage pinning and archiving', () => {
  it('pins a project and moves it under the Pinned heading', async () => {
    const pinned = project({ pinned: true });
    const { user, bridge } = renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.list': [project(), project({ id: 'p2', name: 'Hermes' })],
        'projects.setPinned': async () => pinned,
      },
    });
    await screen.findByRole('button', { name: 'Apollo' });
    expect(screen.queryByText('Pinned')).toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Pin to top' })[0]);

    expect(bridge.$fn('projects.setPinned')).toHaveBeenCalledWith('p1', true);
    expect(await screen.findByText('Pinned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpin project' })).toBeTruthy();
  });

  it('archives a project, says so, and hides it behind the Archived toggle', async () => {
    const archived = project({ archived: true });
    const { user, bridge } = renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.list': [project(), project({ id: 'p2', name: 'Hermes' })],
        'projects.setArchived': async () => archived,
      },
    });
    await screen.findByRole('button', { name: 'Apollo' });

    await user.click(screen.getAllByRole('button', { name: 'Archive project' })[0]);

    expect(bridge.$fn('projects.setArchived')).toHaveBeenCalledWith('p1', true);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Archived “Apollo”.'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apollo' })).toBeNull());

    // The toggle is the only way back to it, and shows how many are hiding there.
    const toggle = screen.getByRole('button', { name: /Archived/ });
    await user.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apollo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore project' })).toBeTruthy();
  });
});

describe('ProjectsPage create dialog', () => {
  it('refuses to submit until both the name and the folder are filled in', async () => {
    const { user } = renderWithProviders(<ProjectsPage />);
    await screen.findByText('No projects yet');

    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('New project')).toBeTruthy();
    expect(createButton(dialog).disabled).toBe(true);
    expect(within(dialog).getByText('Name and folder are required')).toBeTruthy();

    // A name on its own is not enough: without a folder there is nothing to work in.
    await user.type(within(dialog).getByLabelText(/^Name/), 'Apollo');
    expect(createButton(dialog).disabled).toBe(true);

    await user.type(within(dialog).getByLabelText(/^Folder/), 'C:\\code\\apollo');
    expect(createButton(dialog).disabled).toBe(false);
    expect(within(dialog).getByText('Ctrl+Enter to save')).toBeTruthy();
  });

  it('opens itself when the page is reached with ?new=1', async () => {
    renderWithProviders(<ProjectsPage />, { route: '/projects?new=1', path: '*' });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('New project')).toBeTruthy();
  });

  it('fills the folder and the name from the folder picker, then creates the project', async () => {
    const { user, bridge } = renderWithProviders(<ProjectsPage />, {
      bridge: { 'projects.pickFolder': async () => 'C:\\code\\apollo' },
    });
    await screen.findByText('No projects yet');
    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: /Browse/ }));

    expect(bridge.$fn('projects.pickFolder')).toHaveBeenCalled();
    await waitFor(() =>
      expect((within(dialog).getByLabelText(/^Folder/) as HTMLInputElement).value).toBe(
        'C:\\code\\apollo',
      ),
    );
    // An empty name is worth guessing at; the folder's own name is the usual answer.
    expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe('apollo');

    await user.click(createButton(dialog));

    expect(bridge.$fn('projects.create')).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'apollo',
        folderPath: 'C:\\code\\apollo',
        agentType: 'claude-code',
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Project created.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('never overwrites a name that was already typed, and does nothing when the picker is cancelled', async () => {
    const { user } = renderWithProviders(<ProjectsPage />, {
      // An undefined answer is what the bridge gives back when the native dialog is dismissed.
      bridge: { 'projects.pickFolder': async () => undefined },
    });
    await screen.findByText('No projects yet');
    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText(/^Name/), 'Mission Control');
    await user.click(within(dialog).getByRole('button', { name: /Browse/ }));

    expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
      'Mission Control',
    );
    expect((within(dialog).getByLabelText(/^Folder/) as HTMLInputElement).value).toBe('');
    expect(createButton(dialog).disabled).toBe(true);
  });

  it('carries the tags typed in the chip field through to the created project', async () => {
    const { user, bridge } = renderWithProviders(<ProjectsPage />, {
      bridge: { 'projects.pickFolder': async () => '/srv/hermes' },
    });
    await screen.findByText('No projects yet');
    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Browse/ }));
    await waitFor(() =>
      expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe('hermes'),
    );

    const tags = within(dialog).getByLabelText(/^Tags/);
    await user.type(tags, 'api{Enter}');
    expect(within(dialog).getByRole('button', { name: 'Remove api' })).toBeTruthy();
    // A tag still sitting in the box when Create is pressed counts too.
    await user.type(tags, 'infra');
    await user.click(createButton(dialog));

    expect(bridge.$fn('projects.create')).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['api', 'infra'] }),
    );
  });
});

describe('ProjectsPage when the bridge refuses', () => {
  it('says why an icon could not be read instead of failing silently', async () => {
    const { user } = renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.pickIcon': async () => {
          // Electron wraps anything thrown in main; the toast should carry only the message.
          throw new Error(
            "Error invoking remote method 'projects:pickIcon': Error: That file is not an image.",
          );
        },
      },
    });
    await screen.findByText('No projects yet');
    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('tab', { name: /Appearance/ }));
    await user.click(within(dialog).getByRole('button', { name: /Choose image/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That file is not an image.'));
    // The dialog stays put so the work in it is not lost.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps the dialog open and usable when creating the project fails', async () => {
    const { user } = renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.pickFolder': async () => '/srv/hermes',
        'projects.create': async () => {
          throw new Error('disk is read only');
        },
      },
    });
    await screen.findByText('No projects yet');
    await user.click(screen.getAllByRole('button', { name: /New Project/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Browse/ }));
    await waitFor(() =>
      expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe('hermes'),
    );

    await user.click(createButton(dialog));

    // No success toast, the dialog is still there, and the button is pressable again.
    await waitFor(() => expect(createButton(dialog).disabled).toBe(false));
    expect(toast.success).not.toHaveBeenCalledWith('Project created.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('falls back to the empty state when the project list cannot be read', async () => {
    renderWithProviders(<ProjectsPage />, {
      bridge: {
        'projects.list': async () => {
          throw new Error('database locked');
        },
      },
    });

    expect(await screen.findByText('No projects yet')).toBeTruthy();
  });
});
