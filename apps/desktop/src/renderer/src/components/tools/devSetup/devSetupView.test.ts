import {
  buildChecklist,
  type ChecklistRow,
  type DevDetection,
  type DevItemJob,
  type DevSetupEnvironment,
} from '@agentmat/core';
import { describe, expect, it } from 'vitest';
import {
  describeInstallAll,
  describeRow,
  describeRun,
  formatMinimum,
  installAllLabel,
  summaryHeadline,
  summarySubline,
} from './devSetupView';

/**
 * Every word and every button on a checklist row is decided here, away from React, so each state
 * can be checked on its own. The copy is the product, so it is pinned in full.
 */

const EM_DASH = String.fromCodePoint(0x2014);

const win: DevSetupEnvironment = { os: 'win32', arch: 'x64', packageManagers: ['winget'] };
const found = (version: string | null, onPath = true): DevDetection => ({
  state: 'found',
  version,
  path: null,
  onPath,
});
const absent: DevDetection = { state: 'absent' };

function rowFor(
  id: string,
  detections: Record<string, DevDetection | undefined>,
  options: { environment?: DevSetupEnvironment; job?: DevItemJob; stacks?: string[] } = {},
): ChecklistRow {
  const checklist = buildChecklist({
    stacks: options.stacks ?? ['essentials', 'flutter', 'docker'],
    environment: options.environment ?? win,
    detections,
    jobs: options.job ? { [id]: options.job } : {},
  });
  const row = checklist.rows.find((one) => one.item.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
}

const NAMES = new Map<string, string>([
  ['git', 'Git'],
  ['node', 'Node.js'],
  ['jdk17', 'Java 17 (JDK)'],
  ['android-emulator', 'Android emulator'],
  ['android-licenses', 'Android SDK licenses'],
  ['android-platform', 'Android 16 platform (API 36)'],
]);
const nameOf = (id: string): string => NAMES.get(id) ?? id;

const inApp = { os: 'win32' as const, inAppInstall: true, nameOf };
const terminalOnly = { os: 'win32' as const, inAppInstall: false, nameOf };

describe('describeRow: installed', () => {
  it('shows the version in green', () => {
    const view = describeRow(rowFor('node', { node: found('22.12.0') }), inApp);

    expect(view).toMatchObject({
      tone: 'success',
      icon: 'installed',
      text: 'Version 22.12.0',
      action: null,
      progress: null,
    });
  });

  it('says "Installed" when the version could not be read but none is required', () => {
    const view = describeRow(
      rowFor('gh-auth', { gh: found('2.62.0'), 'gh-auth': found(null) }),
      inApp,
    );

    expect(view.text).toBe('Installed');
  });

  it('flags a tool that is there but not on PATH', () => {
    const view = describeRow(rowFor('git', { git: found('2.55.0', false) }), inApp);

    expect(view.chips).toEqual([{ text: 'Not on your PATH', tone: 'warning' }]);
  });
});

describe('describeRow: checking', () => {
  it('has no text and no button, so the row can shimmer in their place', () => {
    const view = describeRow(rowFor('git', {}), inApp);

    expect(view).toMatchObject({ icon: 'missing', text: '', action: null, terminalCommand: null });
    expect(view.checking).toBe(true);
  });
});

describe('describeRow: missing and outdated', () => {
  it('offers a one-click install when the app can do it', () => {
    const view = describeRow(rowFor('git', { git: absent }), inApp);

    expect(view).toMatchObject({
      tone: 'neutral',
      icon: 'missing',
      text: 'Not installed. Needs 2.30 or newer.',
      action: { kind: 'install', label: 'Install Git' },
    });
  });

  it('hands the install to the terminal when the app cannot do it itself yet', () => {
    const view = describeRow(rowFor('git', { git: absent }), terminalOnly);

    expect(view.action).toEqual({ kind: 'terminal-install', label: 'Install Git' });
  });

  it('says how old a tool is and what it needs to be, and offers to update it', () => {
    const view = describeRow(rowFor('node', { node: found('20.11.0') }), inApp);

    expect(view).toMatchObject({
      tone: 'warning',
      icon: 'outdated',
      text: 'Version 20.11.0. Needs 22.12 or newer.',
      action: { kind: 'update', label: 'Update Node.js' },
    });
  });

  it('copes with a tool whose version cannot be read', () => {
    const view = describeRow(rowFor('node', { node: found(null) }), inApp);

    expect(view.text).toBe('Version could not be read. Needs 22.12 or newer.');
  });

  it('leaves out the minimum when an item has none', () => {
    const view = describeRow(rowFor('pnpm', { npm: found('10.9.0'), pnpm: absent }), inApp);

    expect(view.text).toBe('Not installed.');
  });

  it('points at the download page when the package manager is missing', () => {
    const noWinget = { ...win, packageManagers: [] };
    const view = describeRow(rowFor('git', { git: absent }, { environment: noWinget }), inApp);

    expect(view.action).toEqual({
      kind: 'open-link',
      label: 'Open download page',
      url: 'https://git-scm.com/downloads',
    });
  });

  it('has no button for an item that comes bundled with another', () => {
    const view = describeRow(rowFor('npm', { node: found('22.12.0'), npm: absent }), inApp);

    expect(view.action).toBeNull();
  });

  it('gives the equivalent command for the terminal and the clipboard', () => {
    const view = describeRow(rowFor('git', { git: absent }), inApp);

    expect(view.terminalCommand).toBe(
      'winget install --id Git.Git --exact --source winget --silent --accept-package-agreements --accept-source-agreements',
    );
  });

  it('has no command for something the app installs by itself', () => {
    const view = describeRow(rowFor('flutter', { git: found('2.55.0'), flutter: absent }), inApp);

    expect(view.action).toEqual({ kind: 'install', label: 'Install Flutter SDK' });
    expect(view.terminalCommand).toBeNull();
  });

  it('falls back to the download page for a self-installed item the app cannot install yet', () => {
    const view = describeRow(
      rowFor('flutter', { git: found('2.55.0'), flutter: absent }),
      terminalOnly,
    );

    expect(view.action).toEqual({
      kind: 'open-link',
      label: 'Open download page',
      url: 'https://docs.flutter.dev/get-started/install',
    });
  });

  it('sends sign-in and WSL to the terminal whatever the app can do', () => {
    const wsl = describeRow(rowFor('wsl2', { wsl2: absent }), inApp);
    expect(wsl.action).toEqual({
      kind: 'terminal-install',
      label: 'Install Windows Subsystem for Linux',
    });
    expect(wsl.terminalCommand).toBe('wsl --install --no-distribution');
  });
});

describe('describeRow: blocked', () => {
  it('leaves the button enabled for an item with nothing to wait for', () => {
    const view = describeRow(rowFor('jdk17', { jdk17: absent }), inApp);

    expect(view.action?.disabled).toBeUndefined();
  });

  it('says what it waits for, and disables the button with the reason', () => {
    const view = describeRow(
      rowFor('android-emulator', {
        jdk17: absent,
        'android-cmdline-tools': absent,
        'android-licenses': absent,
        'android-emulator': absent,
      }),
      inApp,
    );

    expect(view).toMatchObject({
      icon: 'blocked',
      tone: 'neutral',
      text: 'Waiting for Android SDK licenses',
      action: {
        kind: 'install',
        label: 'Install Android emulator',
        disabled: true,
        hint: 'Install Android SDK licenses first. Install all missing handles the order.',
      },
    });
  });

  it('lists several things it waits for in a sentence', () => {
    const view = describeRow(
      rowFor('android-system-image', {
        'android-emulator': absent,
        'android-platform': absent,
        'android-system-image': absent,
      }),
      { ...inApp, nameOf },
    );

    expect(view.text).toBe('Waiting for Android emulator and Android 16 platform (API 36)');
  });

  it('says a bundled item comes with its parent, and has no button', () => {
    const view = describeRow(rowFor('npm', { node: absent, npm: absent }), inApp);

    expect(view).toMatchObject({ icon: 'blocked', text: 'Comes with Node.js', action: null });
  });
});

describe('describeRow: working', () => {
  it('shows a queued item as waiting its turn, with a way to take it out', () => {
    const view = describeRow(rowFor('git', { git: absent }, { job: { status: 'queued' } }), inApp);

    expect(view).toMatchObject({
      icon: 'queued',
      text: 'Waiting in line',
      action: { kind: 'unqueue', label: 'Remove Git from the queue' },
    });
  });

  it('shows progress while installing, with Cancel and the log', () => {
    const view = describeRow(
      rowFor(
        'git',
        { git: absent },
        {
          job: {
            status: 'installing',
            phase: 'downloading',
            fraction: 0.4,
            detail: '312 of 780 MB',
          },
        },
      ),
      inApp,
    );

    expect(view).toMatchObject({
      tone: 'primary',
      icon: 'installing',
      busy: true,
      text: 'Downloading 312 of 780 MB',
      progress: { fraction: 0.4, label: 'Git: Downloading 312 of 780 MB' },
      action: { kind: 'cancel', label: 'Cancel installing Git' },
      showLog: true,
    });
  });

  it.each([
    ['preparing', 'Getting ready'],
    ['downloading', 'Downloading'],
    ['verifying', 'Checking the download'],
    ['extracting', 'Unpacking'],
    ['installing', 'Installing'],
    ['checking', 'Checking the result'],
  ] as const)('words the %s phase as "%s"', (phase, text) => {
    const view = describeRow(
      rowFor('git', { git: absent }, { job: { status: 'installing', phase } }),
      inApp,
    );

    expect(view.text).toBe(text);
    expect(view.progress?.fraction).toBeNull();
  });
});

describe('describeRow: trouble', () => {
  it('says why it failed and offers another go, the terminal, the clipboard and the log', () => {
    const view = describeRow(
      rowFor(
        'git',
        { git: absent },
        {
          job: {
            status: 'failed',
            message: 'winget could not finish (code 1603).',
            exitCode: 1603,
          },
        },
      ),
      inApp,
    );

    expect(view).toMatchObject({
      tone: 'destructive',
      icon: 'failed',
      text: 'winget could not finish (code 1603).',
      action: { kind: 'retry', label: 'Try again' },
      showLog: true,
    });
    expect(view.terminalCommand).toContain('winget install --id Git.Git');
  });

  it('waits for the terminal and offers to check again', () => {
    const view = describeRow(
      rowFor('gh', { git: found('2.55.0'), gh: absent }, { job: { status: 'waiting-terminal' } }),
      inApp,
    );

    expect(view).toMatchObject({
      tone: 'primary',
      icon: 'info',
      text: 'Waiting for the terminal. Press Enter there, then check again.',
      action: { kind: 'recheck', label: 'Check again' },
    });
  });

  it('says plainly when there is no way to install something here', () => {
    const bare = rowFor('git', { git: absent });
    const view = describeRow(
      { ...bare, mode: { mode: 'unavailable' }, state: { kind: 'unavailable' } },
      inApp,
    );

    expect(view).toMatchObject({
      icon: 'unavailable',
      text: 'There is no installer for this system yet.',
      action: null,
    });
  });

  it('reports a check that failed, and offers to try it again', () => {
    const view = describeRow(
      rowFor('git', { git: { state: 'error', message: 'It did not answer in time.' } }),
      inApp,
    );

    expect(view).toMatchObject({
      icon: 'info',
      text: 'It did not answer in time.',
      action: { kind: 'retry', label: 'Try again' },
    });
  });
});

describe('copy', () => {
  it('never uses an em dash', () => {
    const states: Array<[string, Record<string, DevDetection | undefined>, DevItemJob?]> = [
      ['node', { node: found('22.12.0') }],
      ['node', { node: found('20.0.0') }],
      ['node', { node: absent }],
      ['npm', { node: absent, npm: absent }],
      ['git', { git: absent }, { status: 'queued' }],
      ['git', { git: absent }, { status: 'installing', phase: 'verifying', detail: '4 of 9 MB' }],
      ['git', { git: absent }, { status: 'failed', message: 'It stopped.' }],
      ['gh', { git: found('2.55.0'), gh: absent }, { status: 'waiting-terminal' }],
    ];
    for (const [id, detections, job] of states) {
      const view = describeRow(rowFor(id, detections, { job }), inApp);
      const words = [
        view.text,
        view.action?.label,
        view.action?.hint,
        ...view.chips.map((c) => c.text),
      ];
      for (const word of words) expect(word ?? '', id).not.toContain(EM_DASH);
    }
  });
});

describe('formatMinimum', () => {
  it.each([
    ['22.12.0', '22.12'],
    ['2.30.0', '2.30'],
    ['24.0.0', '24'],
    ['10.0.100', '10.0.100'],
    ['17', '17'],
    ['3.35.0', '3.35'],
  ])('shows %s as %s', (version, shown) => {
    expect(formatMinimum(version)).toBe(shown);
  });
});

describe('the summary', () => {
  const summary = (overrides: Partial<Parameters<typeof summaryHeadline>[0]>) => ({
    total: 11,
    ready: 6,
    checking: 0,
    missing: 5,
    stacks: [],
    complete: false,
    ...overrides,
  });

  it('counts what is ready', () => {
    expect(summaryHeadline(summary({}))).toBe('6 of 11 ready');
  });

  it('says so when everything is ready', () => {
    expect(summaryHeadline(summary({ ready: 11, missing: 0, complete: true }))).toBe(
      'Everything is ready',
    );
  });

  it('says it is still looking before any probe has answered', () => {
    expect(summaryHeadline(summary({ ready: 0, checking: 11, missing: 0 }))).toBe(
      'Checking your tools',
    );
  });

  it('has a line for how many are still being checked, and for what is missing', () => {
    expect(summarySubline(summary({ checking: 2, missing: 3 }))).toBe('Still checking 2 tools.');
    expect(summarySubline(summary({ checking: 1, missing: 3 }))).toBe('Still checking 1 tool.');
    expect(summarySubline(summary({}))).toBe('5 still to install.');
    expect(summarySubline(summary({ missing: 1, ready: 10 }))).toBe('1 still to install.');
    expect(summarySubline(summary({ ready: 11, missing: 0, complete: true }))).toBe(
      'Your machine has everything on this list.',
    );
  });

  it('labels the Install all button with how many steps it will run', () => {
    expect(installAllLabel(5)).toBe('Install all missing (5)');
    expect(installAllLabel(0)).toBe('Install all missing');
  });
});

describe('describeInstallAll', () => {
  const plan = (steps: string[], manual: string[] = [], deferred: string[] = []) => ({
    steps,
    manual,
    deferred,
  });

  it('counts the steps it will run, and is ready to go', () => {
    expect(describeInstallAll(plan(['git', 'node', 'gh']))).toEqual({
      label: 'Install all missing (3)',
      disabled: false,
      note: null,
    });
  });

  it('says what it leaves for the person, so the button is not a surprise', () => {
    expect(describeInstallAll(plan(['git'], ['wsl2'], ['docker-desktop'])).note).toBe(
      '1 more step needs a terminal or a download. Use the buttons on that row, then press Install all again.',
    );
    expect(describeInstallAll(plan(['git'], ['wsl2', 'homebrew'])).note).toBe(
      '2 more steps need a terminal or a download. Use the buttons on those rows, then press Install all again.',
    );
  });

  it('mentions nothing when everything left can run', () => {
    expect(describeInstallAll(plan(['git'], [], [])).note).toBeNull();
  });

  it('is off, and says why, when only the person can do what is left', () => {
    expect(describeInstallAll(plan([], ['wsl2'], ['docker-desktop']))).toEqual({
      label: 'Install all missing',
      disabled: true,
      hint: 'What is left needs a terminal or a download first. Use the buttons on each row.',
      note: null,
    });
  });

  it('is off when nothing is missing', () => {
    expect(describeInstallAll(plan([]))).toEqual({
      label: 'Install all missing',
      disabled: true,
      hint: 'Nothing is missing.',
      note: null,
    });
  });
});

describe('describeRun', () => {
  const nameOf = (id: string) => ({ git: 'Git', node: 'Node.js', gh: 'GitHub CLI' })[id] ?? id;
  const job = (overrides: Partial<Parameters<typeof describeRun>[0]>) => ({
    jobId: 'a',
    running: true,
    items: {},
    order: ['git', 'node', 'gh'],
    completed: [] as string[],
    logs: {},
    current: 'git' as string | null,
    restartAdvised: false,
    ...overrides,
  });

  it('names the step and where it is in the run', () => {
    expect(describeRun(job({}), nameOf)).toEqual({
      headline: 'Installing 1 of 3: Git',
      subline: '0 done, 3 to go.',
    });
    expect(describeRun(job({ completed: ['git'], current: 'node' }), nameOf)).toEqual({
      headline: 'Installing 2 of 3: Node.js',
      subline: '1 done, 2 to go.',
    });
  });

  it('counts the current step as still to go', () => {
    expect(describeRun(job({ completed: ['git', 'node'], current: 'gh' }), nameOf).subline).toBe(
      '2 done, 1 to go.',
    );
  });

  it('speaks of the whole run between steps, when none is current', () => {
    expect(describeRun(job({ current: null }), nameOf)).toEqual({
      headline: 'Installing 3 tools',
      subline: '0 done, 3 to go.',
    });
    expect(describeRun(job({ order: ['git'], current: null }), nameOf).headline).toBe(
      'Installing 1 tool',
    );
  });

  it('never uses an em dash', () => {
    const view = describeRun(job({}), nameOf);
    expect(`${view.headline} ${view.subline}`).not.toContain(EM_DASH);
  });
});
