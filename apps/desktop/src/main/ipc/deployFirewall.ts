import type { IpcMainInvokeEvent } from 'electron';
import { parseChanges } from '../../shared/deploy/firewallValidation';
import type {
  DeployFirewallApplyInput,
  DeployFirewallChangesInput,
  DeployFirewallDecisionInput,
  DeployFirewallHistoryInput,
} from '../../shared/deployFirewallTypes';
import { IPC } from '../../shared/ipcChannels';
import type { DeployFirewall } from '../deploy/firewall';
import { type DeployIpcRegistry, object, optionalText, serverId, stepUpInput } from './deploy';

/**
 * The Firewall section's invoke channels (E13). Like every Deploy group they answer only the
 * main window's own frame and check each argument here, change by change, before the core
 * hears of it. The core checks again and decides who may do what.
 */

export interface DeployFirewallHandlerDeps {
  ipc: DeployIpcRegistry;
  firewall: DeployFirewall;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The core's guard takes up to 200 characters of typed phrase. */
const MAX_PHRASE = 200;
const HISTORY = { min: 1, max: 200 };

function changesInput(value: unknown): DeployFirewallChangesInput {
  const input = object(value, 'a firewall change set');
  return { serverId: serverId(input.serverId), changes: parseChanges(input.changes) };
}

function applyInput(value: unknown): DeployFirewallApplyInput {
  const input = object(value, 'a firewall change set');
  const proof = stepUpInput(value);
  const phrase = optionalText(input.overrideConfirmation, MAX_PHRASE, 'confirmation phrase');
  return {
    ...proof,
    changes: parseChanges(input.changes),
    ...(phrase ? { overrideConfirmation: phrase } : {}),
  };
}

function decisionInput(value: unknown): DeployFirewallDecisionInput {
  const input = object(value, 'a firewall change');
  if (typeof input.changeSetId !== 'string' || !GUID.test(input.changeSetId)) {
    throw new Error('That is not a firewall change.');
  }
  return { serverId: serverId(input.serverId), changeSetId: input.changeSetId };
}

function historyInput(value: unknown): DeployFirewallHistoryInput {
  const input = object(value, 'a history query');
  const limit = input.limit;
  if (limit === undefined || limit === null) return { serverId: serverId(input.serverId) };
  if (
    !Number.isSafeInteger(limit) ||
    (limit as number) < HISTORY.min ||
    (limit as number) > HISTORY.max
  ) {
    throw new Error(`The page size must be a whole number from ${HISTORY.min} to ${HISTORY.max}.`);
  }
  return { serverId: serverId(input.serverId), limit: limit as number };
}

export function registerDeployFirewallHandlers(deps: DeployFirewallHandlerDeps): void {
  const { ipc, firewall } = deps;
  const handle = (channel: string, run: (...args: unknown[]) => unknown) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!deps.guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(...args);
    });
  };

  handle(IPC.deployFirewall.status, (id) => firewall.status(serverId(id)));
  handle(IPC.deployFirewall.presets, (id) => firewall.presets(serverId(id)));
  handle(IPC.deployFirewall.history, (value) => firewall.history(historyInput(value)));
  handle(IPC.deployFirewall.exposure, (id) => firewall.exposure(serverId(id)));
  handle(IPC.deployFirewall.preview, (value) => firewall.preview(changesInput(value)));
  handle(IPC.deployFirewall.apply, (value) => firewall.apply(applyInput(value)));
  handle(IPC.deployFirewall.confirm, (value) => firewall.confirm(decisionInput(value)));
  handle(IPC.deployFirewall.revert, (value) => firewall.revert(decisionInput(value)));
}
