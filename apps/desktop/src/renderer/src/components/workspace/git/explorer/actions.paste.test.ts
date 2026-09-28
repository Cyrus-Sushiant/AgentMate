// @vitest-environment jsdom
import type { Project } from '@agentmat/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { explorerProject, useExplorerStore } from '@/stores/explorerStore';
import {
  type FakeBridge,
  installAgentmatBridge,
} from '../../../../../../test/renderer/agentmatBridge';
import { pasteInto, transferExternalEntries } from './actions';

/**
 * Pasting into the explorer when what's on offer isn't from inside the app: files copied in
 * Explorer/Finder, read off the real OS clipboard. The in-app cut/copy clipboard always wins when
 * it applies to this project; the OS clipboard is only a fallback.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const project = { id: 'p1', name: 'App', folderPath: 'C:\\work\\app' } as Project;

let bridge: FakeBridge;

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
  bridge = installAgentmatBridge();
  useExplorerStore.setState({ clipboard: null, projects: {} });
});

describe('pasteInto', () => {
  it('copies from the OS clipboard when the in-app clipboard is empty', async () => {
    bridge.$set('explorer.osClipboardPaths', ['C:\\shots\\a.png']);
    bridge.$set('explorer.pasteExternal', {
      moves: [{ from: 'C:\\shots\\a.png', to: 'C:\\work\\app\\a.png' }],
      conflicts: [],
    });

    await pasteInto(project, project.folderPath);

    expect(bridge.$fn('explorer.pasteExternal')).toHaveBeenCalledWith(
      'p1',
      ['C:\\shots\\a.png'],
      project.folderPath,
    );
  });

  it('prefers the in-app clipboard over the OS clipboard when both have something', async () => {
    useExplorerStore.setState({
      clipboard: { mode: 'copy', projectId: 'p1', paths: ['C:\\work\\app\\a.txt'] },
    });
    bridge.$set('explorer.osClipboardPaths', ['C:\\shots\\a.png']);
    bridge.$set('explorer.copy', {
      moves: [{ from: 'C:\\work\\app\\a.txt', to: 'C:\\work\\app\\sub\\a.txt' }],
      conflicts: [],
    });

    await pasteInto(project, 'C:\\work\\app\\sub');

    expect(bridge.$fn('explorer.copy')).toHaveBeenCalled();
    expect(() => bridge.$fn('explorer.pasteExternal')).toThrow('has not been touched');
  });

  it('falls back to the OS clipboard when the in-app clipboard belongs to a different project', async () => {
    useExplorerStore.setState({
      clipboard: { mode: 'copy', projectId: 'p2', paths: ['C:\\work\\other\\a.txt'] },
    });
    bridge.$set('explorer.osClipboardPaths', ['C:\\shots\\a.png']);
    bridge.$set('explorer.pasteExternal', {
      moves: [{ from: 'C:\\shots\\a.png', to: 'C:\\work\\app\\a.png' }],
      conflicts: [],
    });

    await pasteInto(project, project.folderPath);

    expect(bridge.$fn('explorer.pasteExternal')).toHaveBeenCalledWith(
      'p1',
      ['C:\\shots\\a.png'],
      project.folderPath,
    );
  });

  it('does nothing when neither clipboard has anything to paste', async () => {
    bridge.$set('explorer.osClipboardPaths', []);

    await pasteInto(project, project.folderPath);

    expect(() => bridge.$fn('explorer.pasteExternal')).toThrow('has not been touched');
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('transferExternalEntries', () => {
  it('opens the target folder and selects what landed, the same as an ordinary copy', async () => {
    bridge.$set('explorer.pasteExternal', {
      moves: [{ from: 'C:\\shots\\a.png', to: 'C:\\work\\app\\sub\\a.png' }],
      conflicts: [],
    });

    const ok = await transferExternalEntries(project, ['C:\\shots\\a.png'], 'C:\\work\\app\\sub');

    expect(ok).toBe(true);
    const state = explorerProject('p1');
    expect(state.open['C:\\work\\app\\sub']).toBe(true);
    expect(state.selected).toEqual(['C:\\work\\app\\sub\\a.png']);
  });

  it('reports the failure with a toast when the external copy rejects', async () => {
    bridge.$set('explorer.pasteExternal', () => Promise.reject(new Error('disk full')));

    const ok = await transferExternalEntries(project, ['C:\\shots\\a.png'], project.folderPath);

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Could not copy', { description: 'disk full' });
  });
});
