import {
  type ChecklistRow,
  type DevInstallPhase,
  type DevJobState,
  type DevOs,
  type InstallPlan,
  recipeCommandLine,
  type SetupSummary,
} from '@agentmat/core';

/**
 * Every word and every button on a Dev Setup row, worked out from the row's state. It is plain
 * functions with no React in it, so each state can be checked on its own and the copy lives in one
 * place. Copy follows the project rule: write like a person, and no em dashes.
 */

export type RowTone = 'success' | 'warning' | 'destructive' | 'neutral' | 'primary';
export type RowIcon =
  | 'installed'
  | 'outdated'
  | 'missing'
  | 'blocked'
  | 'queued'
  | 'installing'
  | 'failed'
  | 'info'
  | 'unavailable';

export type RowActionKind =
  | 'install'
  | 'update'
  /** Opens a terminal with the command typed in, for the person to run. */
  | 'terminal-install'
  | 'open-link'
  | 'retry'
  | 'recheck'
  | 'cancel'
  | 'unqueue';

export interface RowAction {
  kind: RowActionKind;
  label: string;
  url?: string;
  disabled?: boolean;
  /** Why the button is disabled, shown as a tooltip. */
  hint?: string;
}

export interface RowChip {
  text: string;
  tone: RowTone;
}

export interface RowView {
  tone: RowTone;
  icon: RowIcon;
  /** The line under the item's name. Empty while the check is still running. */
  text: string;
  chips: RowChip[];
  /** The one button a row leads with, or null when there is nothing to do. */
  action: RowAction | null;
  /** The command for "Open in terminal" and "Copy command", when there is a single one. */
  terminalCommand: string | null;
  progress: { fraction: number | null; label: string } | null;
  /** Whether "Show log" is worth offering. */
  showLog: boolean;
  busy: boolean;
  /** The check has not answered yet, so the row shows a shimmer instead of text. */
  checking: boolean;
}

export interface DescribeRowOptions {
  os: DevOs;
  /** Whether the app installs things itself, or only hands the command to a terminal. */
  inAppInstall: boolean;
  /** An item's display name, for "Waiting for Git". */
  nameOf: (id: string) => string;
}

const PHASE_TEXT: Record<DevInstallPhase, string> = {
  preparing: 'Getting ready',
  downloading: 'Downloading',
  verifying: 'Checking the download',
  extracting: 'Unpacking',
  installing: 'Installing',
  checking: 'Checking the result',
};

/** "22.12.0" reads as "22.12", and "24.0.0" as "24". A trailing zero is not worth saying. */
export function formatMinimum(version: string): string {
  const parts = version.split('.');
  while (parts.length > 1 && parts.at(-1) === '0') parts.pop();
  return parts.join('.');
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function neededText(row: ChecklistRow): string {
  return row.item.minVersion ? `Needs ${formatMinimum(row.item.minVersion)} or newer.` : '';
}

/** The button for getting an item in place, shaped by how the app can do it on this machine. */
function installAction(
  row: ChecklistRow,
  verb: 'install' | 'update',
  options: DescribeRowOptions,
): RowAction | null {
  const label = `${verb === 'install' ? 'Install' : 'Update'} ${row.name}`;
  const downloadPage = (url: string | undefined): RowAction | null =>
    url ? { kind: 'open-link', label: 'Open download page', url } : null;

  switch (row.mode.mode) {
    case 'in-app':
      if (options.inAppInstall) return { kind: verb, label };
      // The app does not install yet: type the command into a terminal if there is one, or send
      // the person to the vendor's page for an item the app installs with its own code.
      return recipeCommandLine(row.mode, options.os)
        ? { kind: 'terminal-install', label }
        : downloadPage(row.item.manualUrl);
    case 'terminal':
      return { kind: 'terminal-install', label };
    case 'link':
      return downloadPage(row.mode.url);
    default:
      // Bundled items come with another one, and an unavailable one has nothing to offer.
      return null;
  }
}

const BASE: RowView = {
  tone: 'neutral',
  icon: 'missing',
  text: '',
  chips: [],
  action: null,
  terminalCommand: null,
  progress: null,
  showLog: false,
  busy: false,
  checking: false,
};

export function describeRow(row: ChecklistRow, options: DescribeRowOptions): RowView {
  const { state } = row;
  const command = recipeCommandLine(row.mode, options.os);

  switch (state.kind) {
    case 'checking':
      return { ...BASE, checking: true };

    case 'installed':
      return {
        ...BASE,
        tone: 'success',
        icon: 'installed',
        text: state.version ? `Version ${state.version}` : 'Installed',
        chips: state.onPath ? [] : [{ text: 'Not on your PATH', tone: 'warning' }],
      };

    case 'outdated': {
      const found = state.version ? `Version ${state.version}.` : 'Version could not be read.';
      return {
        ...BASE,
        tone: 'warning',
        icon: 'outdated',
        text: [found, `Needs ${formatMinimum(state.minVersion)} or newer.`].join(' '),
        action: installAction(row, 'update', options),
        terminalCommand: command,
      };
    }

    case 'missing':
      return {
        ...BASE,
        text: ['Not installed.', neededText(row)].filter(Boolean).join(' '),
        action: installAction(row, 'install', options),
        terminalCommand: command,
      };

    case 'blocked': {
      const names = joinNames(state.waitingFor.map(options.nameOf));
      if (state.via === 'bundled') {
        return { ...BASE, icon: 'blocked', text: `Comes with ${names}` };
      }
      const action = installAction(row, 'install', options);
      return {
        ...BASE,
        icon: 'blocked',
        text: `Waiting for ${names}`,
        action: action && {
          ...action,
          disabled: true,
          hint: `Install ${names} first. Install all missing handles the order.`,
        },
      };
    }

    case 'queued':
      return {
        ...BASE,
        tone: 'primary',
        icon: 'queued',
        text: 'Waiting in line',
        action: { kind: 'unqueue', label: `Remove ${row.name} from the queue` },
      };

    case 'installing': {
      const phase = PHASE_TEXT[state.phase];
      const text = state.detail ? `${phase} ${state.detail}` : phase;
      return {
        ...BASE,
        tone: 'primary',
        icon: 'installing',
        text,
        busy: true,
        progress: { fraction: state.fraction, label: `${row.name}: ${text}` },
        action: { kind: 'cancel', label: `Cancel installing ${row.name}` },
        showLog: true,
      };
    }

    case 'failed':
      return {
        ...BASE,
        tone: 'destructive',
        icon: 'failed',
        text: state.message,
        action: { kind: 'retry', label: 'Try again' },
        terminalCommand: command,
        showLog: true,
      };

    case 'waiting-terminal':
      return {
        ...BASE,
        tone: 'primary',
        icon: 'info',
        text: 'Waiting for the terminal. Press Enter there, then check again.',
        action: { kind: 'recheck', label: 'Check again' },
        terminalCommand: command,
      };

    case 'unavailable':
      return { ...BASE, icon: 'unavailable', text: 'There is no installer for this system yet.' };

    case 'unknown':
      return {
        ...BASE,
        icon: 'info',
        text: state.message || 'Could not check this.',
        action: { kind: 'retry', label: 'Try again' },
        terminalCommand: command,
      };
  }
}

export function summaryHeadline(summary: SetupSummary): string {
  if (summary.total === 0) return 'Nothing to set up';
  if (summary.checking === summary.total) return 'Checking your tools';
  if (summary.complete) return 'Everything is ready';
  return `${summary.ready} of ${summary.total} ready`;
}

/** The line under the headline: what is still being looked at, or what is left to do. */
export function summarySubline(summary: SetupSummary): string {
  if (summary.checking > 0) {
    return `Still checking ${summary.checking} ${summary.checking === 1 ? 'tool' : 'tools'}.`;
  }
  if (summary.complete) return 'Your machine has everything on this list.';
  return `${summary.missing} still to install.`;
}

export function installAllLabel(stepCount: number): string {
  return stepCount > 0 ? `Install all missing (${stepCount})` : 'Install all missing';
}

export interface InstallAllView {
  label: string;
  disabled: boolean;
  /** Why it is disabled, shown on hover. */
  hint?: string;
  /** A line under the button about what it will leave for the person. */
  note: string | null;
}

/** The "Install all missing" button: what it says, whether it can run, and what it leaves out. */
export function describeInstallAll(plan: InstallPlan): InstallAllView {
  const left = plan.manual.length;
  const note =
    plan.steps.length > 0 && left > 0
      ? `${left} more ${left === 1 ? 'step needs' : 'steps need'} a terminal or a download. Use the buttons on ${left === 1 ? 'that row' : 'those rows'}, then press Install all again.`
      : null;
  if (plan.steps.length > 0) {
    return { label: installAllLabel(plan.steps.length), disabled: false, note };
  }
  const waiting = plan.manual.length > 0 || plan.deferred.length > 0;
  return {
    label: installAllLabel(0),
    disabled: true,
    hint: waiting
      ? 'What is left needs a terminal or a download first. Use the buttons on each row.'
      : 'Nothing is missing.',
    note: null,
  };
}

/** The headline and progress line while an install run is going. */
export function describeRun(
  job: DevJobState,
  nameOf: (id: string) => string,
): { headline: string; subline: string } {
  const total = job.order.length;
  const toGo = job.order.filter(
    (id) => !job.completed.includes(id) && job.items[id]?.status !== 'failed',
  ).length;
  const headline = job.current
    ? `Installing ${job.completed.length + 1} of ${total}: ${nameOf(job.current)}`
    : `Installing ${total} ${total === 1 ? 'tool' : 'tools'}`;
  return { headline, subline: `${job.completed.length} done, ${toGo} to go.` };
}
