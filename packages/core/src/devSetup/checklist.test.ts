import { describe, expect, it } from 'vitest';
import { buildChecklist } from './checklist.js';
import type { DevSetupEnvironment } from './recipes.js';
import type { DevDetection } from './types.js';

const win: DevSetupEnvironment = { os: 'win32', arch: 'x64', packageManagers: ['winget'] };
const linux: DevSetupEnvironment = { os: 'linux', arch: 'x64', packageManagers: ['apt-get'] };

const found = (version: string | null): DevDetection => ({
  state: 'found',
  version,
  path: null,
  onPath: true,
});
const absent: DevDetection = { state: 'absent' };

function stateOf(checklist: ReturnType<typeof buildChecklist>, id: string): string | undefined {
  return checklist.rows.find((row) => row.item.id === id)?.state.kind;
}

describe('buildChecklist', () => {
  it('lists the items of the chosen stacks, all still checking before any probe answers', () => {
    const checklist = buildChecklist({ stacks: ['essentials'], environment: win, detections: {} });

    expect(checklist.rows.map((row) => row.item.id)).toEqual([
      'git',
      'node',
      'npm',
      'gh',
      'pnpm',
      'gh-auth',
    ]);
    expect(new Set(checklist.rows.map((row) => row.state.kind))).toEqual(new Set(['checking']));
    expect(checklist.summary).toMatchObject({ total: 4, ready: 0, checking: 4, missing: 0 });
  });

  it('turns each detection into the state the row shows', () => {
    const checklist = buildChecklist({
      stacks: ['essentials'],
      environment: win,
      detections: {
        git: found('2.55.0'),
        node: found('20.1.0'),
        npm: found('10.9.0'),
        gh: absent,
        pnpm: absent,
        'gh-auth': absent,
      },
    });

    expect(stateOf(checklist, 'git')).toBe('installed');
    expect(stateOf(checklist, 'node')).toBe('outdated');
    expect(stateOf(checklist, 'npm')).toBe('installed');
    expect(stateOf(checklist, 'gh')).toBe('missing');
  });

  it('blocks an item whose dependency is not installed, and names it', () => {
    const checklist = buildChecklist({
      stacks: ['essentials'],
      environment: win,
      detections: { git: found('2.55.0'), node: absent, npm: absent, gh: absent },
    });

    const npm = checklist.rows.find((row) => row.item.id === 'npm');
    expect(npm?.state).toEqual({ kind: 'blocked', waitingFor: ['node'], via: 'bundled' });
  });

  it('keeps an item checking while the thing it depends on is still being checked', () => {
    const checklist = buildChecklist({
      stacks: ['essentials', 'flutter'],
      environment: win,
      detections: { flutter: absent },
    });

    expect(stateOf(checklist, 'flutter')).toBe('checking');
  });

  it('lets an install job override what the last probe said', () => {
    const checklist = buildChecklist({
      stacks: ['essentials'],
      environment: win,
      detections: { git: absent },
      jobs: { git: { status: 'installing', phase: 'downloading', fraction: 0.5 } },
    });

    expect(checklist.rows.find((row) => row.item.id === 'git')?.state).toMatchObject({
      kind: 'installing',
      phase: 'downloading',
      fraction: 0.5,
    });
  });

  it('counts a dependency that is being installed as not ready yet', () => {
    const checklist = buildChecklist({
      stacks: ['essentials', 'flutter'],
      environment: win,
      detections: { git: absent, flutter: absent },
      jobs: { git: { status: 'installing' } },
    });

    expect(checklist.rows.find((row) => row.item.id === 'flutter')?.state).toMatchObject({
      kind: 'blocked',
      waitingFor: ['git'],
    });
  });

  it('groups rows by stack, in catalog order, with each stack counting only required items', () => {
    const checklist = buildChecklist({
      stacks: ['docker', 'essentials'],
      environment: win,
      detections: { git: found('2.55.0'), wsl2: found('2.5.9') },
    });

    expect(checklist.groups.map((group) => group.stack.id)).toEqual(['essentials', 'docker']);
    expect(checklist.groups[0]).toMatchObject({ ready: 1, total: 4 });
    expect(checklist.groups[1]).toMatchObject({ ready: 1, total: 3 });
    expect(checklist.groups[0]?.rows.map((row) => row.item.id)).toContain('pnpm');
  });

  it('always includes Essentials, even when it was not asked for', () => {
    const checklist = buildChecklist({ stacks: ['dotnet'], environment: linux, detections: {} });

    expect(checklist.groups.map((group) => group.stack.id)).toEqual(['essentials', 'dotnet']);
  });

  it('shows only what exists on this OS', () => {
    const onWindows = buildChecklist({
      stacks: ['essentials', 'docker'],
      environment: win,
      detections: {},
    });
    const onLinux = buildChecklist({
      stacks: ['essentials', 'docker'],
      environment: linux,
      detections: {},
    });

    expect(onWindows.rows.map((row) => row.item.id)).toContain('wsl2');
    expect(onLinux.rows.map((row) => row.item.id)).not.toContain('wsl2');
  });

  it('names an item the way this OS knows it', () => {
    const onWindows = buildChecklist({ stacks: ['docker'], environment: win, detections: {} });
    const onLinux = buildChecklist({ stacks: ['docker'], environment: linux, detections: {} });

    const name = (checklist: ReturnType<typeof buildChecklist>) =>
      checklist.rows.find((row) => row.item.id === 'docker-desktop')?.name;
    expect(name(onWindows)).toBe('Docker Desktop');
    expect(name(onLinux)).toBe('Docker Engine');
  });

  it('picks the install route each row will use', () => {
    const checklist = buildChecklist({ stacks: ['essentials'], environment: win, detections: {} });

    expect(checklist.rows.find((row) => row.item.id === 'git')?.mode).toMatchObject({
      mode: 'in-app',
      recipe: { kind: 'winget' },
    });
    expect(checklist.rows.find((row) => row.item.id === 'npm')?.mode).toEqual({
      mode: 'bundled',
      with: 'node',
    });
  });

  it('falls back to a download page for every winget item when winget is missing', () => {
    const noWinget = { ...win, packageManagers: [] };
    const checklist = buildChecklist({
      stacks: ['essentials'],
      environment: noWinget,
      detections: {},
    });

    expect(checklist.rows.find((row) => row.item.id === 'git')?.mode).toMatchObject({
      mode: 'link',
      reason: 'no-package-manager',
    });
  });

  it('hands the plan builder the same rows, keyed by id and in order', () => {
    const checklist = buildChecklist({ stacks: ['essentials'], environment: win, detections: {} });

    expect([...checklist.entries.keys()]).toEqual(checklist.rows.map((row) => row.item.id));
    expect(checklist.entries.get('git')?.state).toEqual({ kind: 'checking' });
  });

  it('ignores a stack id it does not know', () => {
    const checklist = buildChecklist({
      stacks: ['bogus', 'docker'],
      environment: linux,
      detections: {},
    });

    expect(checklist.groups.map((group) => group.stack.id)).toEqual(['essentials', 'docker']);
  });
});
