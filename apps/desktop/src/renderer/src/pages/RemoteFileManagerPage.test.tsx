// @vitest-environment jsdom
import type { RemoteFileManagerEntry, RemoteState } from '@shared/apiTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteStore } from '@/stores/remoteStore';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * Browsing the machine on the other end of a remote session. Nothing here is local: every listing,
 * upload and download is an IPC round trip, so the tests drive the page and assert on the bridge.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const confirm = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('@/stores/confirmStore', () => confirm);

const { default: RemoteFileManagerPage } = await import('./RemoteFileManagerPage');

function entry(overrides: Partial<RemoteFileManagerEntry> & { name: string }) {
  return {
    path: `/home/${overrides.name}`,
    isDirectory: false,
    size: 1024,
    mtimeMs: 1_700_000_000_000,
    ...overrides,
  } satisfies RemoteFileManagerEntry;
}

const drive = entry({ name: 'C:', path: 'C:/', isDirectory: true, size: 0 });
const projects = entry({ name: 'projects', path: 'C:/projects', isDirectory: true, size: 0 });
const notes = entry({ name: 'notes.md', path: 'C:/notes.md', size: 2048 });

const ROOT_LISTING = { path: 'C:/', entries: [projects, notes] };

function connected(overrides: Partial<RemoteState['connection']> = {}): void {
  useRemoteStore.setState({
    state: {
      deviceName: 'Workbench',
      hosting: false,
      hostIp: null,
      hostPort: 7900,
      inputSupported: true,
      pairing: null,
      peers: [],
      interfaces: [],
      connection: {
        status: 'connected',
        remoteDeviceName: 'Studio',
        remoteScreen: null,
        intent: null,
        ...overrides,
      },
    },
    logs: [],
    transfers: [],
  });
}

/** The row a name sits in, so a click lands on that entry's own buttons. */
function row(name: string): HTMLElement {
  const found = screen.getByText(name).closest('li');
  if (!found) throw new Error(`"${name}" is not in a row`);
  return found;
}

/** The icon-only buttons carry their meaning in a tooltip Radix only mounts on a real hover. */
function iconButtons(scope: HTMLElement): HTMLElement[] {
  return within(scope)
    .getAllByRole('button')
    .filter((button) => !button.textContent?.trim());
}

function iconButton(scope: HTMLElement, index: number): HTMLElement {
  const icons = iconButtons(scope);
  const found = icons[index];
  if (!found) throw new Error(`No icon button at ${index}, found ${icons.length}`);
  return found;
}

/** Back and Refresh live in the card header, which is everything outside the entry rows. */
function headerIconButton(index: number): HTMLElement {
  const icons = screen
    .getAllByRole('button')
    .filter((button) => !button.textContent?.trim() && !button.closest('li'));
  const found = icons[index];
  if (!found) throw new Error(`No header icon button at ${index}, found ${icons.length}`);
  return found;
}

beforeEach(() => {
  useRemoteStore.setState({ state: null, logs: [], transfers: [] });
});

describe('RemoteFileManagerPage without a session', () => {
  it('explains where to connect instead of showing an empty browser', async () => {
    const { bridge } = renderWithProviders(<RemoteFileManagerPage />, { route: '/remote-files' });

    expect(await screen.findByText(/Not connected\./)).toBeInTheDocument();
    expect(bridge.remote.fmRoots).not.toHaveBeenCalled();
  });

  it('says the same while a connection is still being negotiated', async () => {
    connected({ status: 'connecting' });
    const { bridge } = renderWithProviders(<RemoteFileManagerPage />, { route: '/remote-files' });

    expect(await screen.findByText(/Not connected\./)).toBeInTheDocument();
    expect(bridge.remote.fmRoots).not.toHaveBeenCalled();
  });
});

describe('RemoteFileManagerPage listing', () => {
  it('opens on the peer roots as soon as the session is up', async () => {
    connected();
    const { bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive] },
    });

    expect(await screen.findByText('C:')).toBeInTheDocument();
    expect(bridge.$fn('remote.fmRoots')).toHaveBeenCalled();
    // Roots are not a folder, so there is nothing to upload into and no way further up.
    expect(screen.getByText('This computer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /New folder/ })).toBeNull();
  });

  it('says a folder is empty rather than leaving a blank card', async () => {
    connected();
    renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [] },
    });

    expect(await screen.findByText('This folder is empty.')).toBeInTheDocument();
  });

  it('shows what a failed listing said and keeps the page usable', async () => {
    connected();
    renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': () => Promise.reject(new Error('Peer went away')) },
    });

    expect(await screen.findByText('Peer went away')).toBeInTheDocument();
    expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
  });
});

describe('RemoteFileManagerPage navigation', () => {
  it('opens a folder and lists what is in it, with each file sized', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });

    await user.click(await screen.findByRole('button', { name: 'C:' }));

    expect(await screen.findByText('notes.md')).toBeInTheDocument();
    expect(bridge.$fn('remote.fmList')).toHaveBeenCalledWith('C:/');
    expect(within(row('notes.md')).getByText('2.0 KB')).toBeInTheDocument();
    // A folder is a button because it can be opened; a file is only ever text.
    expect(screen.getByRole('button', { name: 'projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.md' })).toBeNull();
  });

  it('walks up to the parent folder', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: {
        'remote.fmRoots': [drive],
        'remote.fmList': async (path: unknown) =>
          path === 'C:/projects'
            ? {
                path: 'C:/projects',
                entries: [entry({ name: 'app.ts', path: 'C:/projects/app.ts' })],
              }
            : ROOT_LISTING,
      },
    });

    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await user.click(await screen.findByRole('button', { name: 'projects' }));
    await screen.findByText('app.ts');
    expect(screen.getByText('C:/projects')).toBeInTheDocument();

    await user.click(headerIconButton(0));

    await waitFor(() => expect(bridge.$fn('remote.fmList')).toHaveBeenLastCalledWith('C:'));
  });

  it('goes back to the roots from a folder that has no parent path', async () => {
    connected();
    const posixRoot = entry({ name: '/', path: '/', isDirectory: true, size: 0 });
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: {
        'remote.fmRoots': [posixRoot],
        'remote.fmList': { path: '/', entries: [entry({ name: 'etc', path: '/etc' })] },
      },
    });

    await user.click(await screen.findByRole('button', { name: '/' }));
    await screen.findByText('etc');

    await user.click(headerIconButton(0));

    expect(await screen.findByText('This computer')).toBeInTheDocument();
    await waitFor(() => expect(bridge.$fn('remote.fmRoots')).toHaveBeenCalledTimes(2));
  });

  it('reports a folder it could not open without losing the listing it had', async () => {
    connected();
    const { user } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: {
        'remote.fmRoots': [drive],
        'remote.fmList': () => Promise.reject(new Error('EACCES')),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'C:' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not open that folder: EACCES'),
    );
    expect(screen.getByText('C:')).toBeInTheDocument();
  });
});

describe('RemoteFileManagerPage transfers', () => {
  it('uploads into the folder currently open', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    await user.click(screen.getByRole('button', { name: /Upload/ }));

    await waitFor(() => expect(bridge.$fn('remote.fmUploadTo')).toHaveBeenCalledWith('C:/'));
  });

  it('downloads the file whose row the button sits in', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    // Download comes first in a file row; a folder row has no download button at all.
    await user.click(iconButton(row('notes.md'), 0));

    await waitFor(() =>
      expect(bridge.$fn('remote.fmDownload')).toHaveBeenCalledWith('C:/notes.md'),
    );
    // A folder has nothing to download, so it only gets rename and delete.
    expect(iconButtons(row('projects'))).toHaveLength(2);
    expect(iconButtons(row('notes.md'))).toHaveLength(3);
  });

  it('says why a download did not happen', async () => {
    connected();
    const { user } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: {
        'remote.fmRoots': [drive],
        'remote.fmList': ROOT_LISTING,
        'remote.fmDownload': () => Promise.reject(new Error('Disk full')),
      },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    await user.click(iconButton(row('notes.md'), 0));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not download "notes.md": Disk full'),
    );
  });

  it('shows a transfer in flight with how far it has got', async () => {
    connected();
    useRemoteStore.setState({
      transfers: [
        {
          transferId: 't1',
          name: 'notes.md',
          direction: 'incoming',
          transferred: 512_000,
          total: 1_024_000,
          done: false,
        },
      ],
    });
    renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive] },
    });

    expect(await screen.findByText('Transfers')).toBeInTheDocument();
    expect(screen.getByText('500.0 KB / 1000.0 KB')).toBeInTheDocument();
  });
});

describe('RemoteFileManagerPage entry actions', () => {
  it('deletes an entry only after the warning is accepted', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    // Download, rename, delete: delete is last in a file row.
    await user.click(iconButton(row('notes.md'), 2));

    expect(confirm.confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete "notes.md"?', variant: 'destructive' }),
    );
    await waitFor(() => expect(bridge.$fn('remote.fmDelete')).toHaveBeenCalledWith('C:/notes.md'));
  });

  it('keeps the file when the warning is dismissed', async () => {
    confirm.confirmDialog.mockResolvedValueOnce(false);
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    await user.click(iconButton(row('notes.md'), 2));

    await waitFor(() => expect(confirm.confirmDialog).toHaveBeenCalled());
    expect(bridge.remote.fmDelete).not.toHaveBeenCalled();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
  });

  it('renames an entry once the new name is committed', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    await user.click(iconButton(row('notes.md'), 1));
    const field = await screen.findByDisplayValue('notes.md');
    await user.clear(field);
    await user.type(field, 'readme.md{Enter}');

    await waitFor(() =>
      expect(bridge.$fn('remote.fmRename')).toHaveBeenCalledWith('C:/notes.md', 'readme.md'),
    );
  });

  it('creates a folder in the folder that is open', async () => {
    connected();
    const { user, bridge } = renderWithProviders(<RemoteFileManagerPage />, {
      route: '/remote-files',
      bridge: { 'remote.fmRoots': [drive], 'remote.fmList': ROOT_LISTING },
    });
    await user.click(await screen.findByRole('button', { name: 'C:' }));
    await screen.findByText('notes.md');

    await user.click(screen.getByRole('button', { name: /New folder/ }));
    await user.type(await screen.findByPlaceholderText('Folder name'), 'drafts{Enter}');

    await waitFor(() => expect(bridge.$fn('remote.fmMkdir')).toHaveBeenCalledWith('C:/', 'drafts'));
  });
});
