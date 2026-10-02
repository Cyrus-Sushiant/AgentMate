import type { IpcMainInvokeEvent } from 'electron';
import type {
  DeployCertificateIssueInput,
  DeployCertificateRemoveInput,
  DeployCertificateUploadInput,
  DeploySiteLogWatchInput,
} from '../../shared/deploySitesTypes';
import { IPC } from '../../shared/ipcChannels';
import type { SubscriptionOwner } from '../deploy/live/subscriptions';
import type { DeploySites } from '../deploy/sites/deploySites';
import type { SiteLogSubscriptions } from '../deploy/sites/siteLogs';
import { type DeployIpcRegistry, object, serverId, stepUpInput } from './deploy';
import {
  bounded,
  flag,
  oneOf,
  siteId,
  siteSettings,
  snippets,
  streamSettings,
  tailLines,
} from './deploySitesInput';

/**
 * The Websites section's invoke channels (E10, E11): `deploySites` for nginx, its sites, stream
 * proxies and logs, `deployCerts` for certificates. Like the other Deploy groups they answer only
 * the main window and check every argument here. A site log belongs to the window that opened it
 * and ends when that window reloads, crashes or closes.
 */

export interface DeploySitesHandlerDeps {
  ipc: DeployIpcRegistry;
  sites: DeploySites;
  logs: Pick<SiteLogSubscriptions, 'watch' | 'unwatch'>;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
  /** The window behind a call, as the owner of what it subscribes to. */
  owner: (event: IpcMainInvokeEvent) => SubscriptionOwner;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PEM = 64 * 1024;

function logWatch(value: unknown): DeploySiteLogWatchInput {
  const input = object(value, 'a site log subscription');
  const tail = tailLines(input.tailLines);
  return {
    serverId: serverId(input.serverId),
    siteId: siteId(input.siteId),
    kind: oneOf(input.kind, ['access', 'error'] as const, 'log'),
    ...(tail === undefined ? {} : { tailLines: tail }),
  };
}

function issueInput(value: unknown): DeployCertificateIssueInput {
  const input = object(value, 'a certificate order');
  const email =
    input.contactEmail === undefined || input.contactEmail === null || input.contactEmail === ''
      ? undefined
      : bounded(input.contactEmail, 254, 'contact email');
  if (email !== undefined && !EMAIL.test(email)) throw new Error('That is not an email address.');
  return {
    serverId: serverId(input.serverId),
    siteId: siteId(input.siteId),
    acceptTermsOfService: flag(input.acceptTermsOfService, 'the terms of service'),
    staging: flag(input.staging, 'the staging CA'),
    ...(email ? { contactEmail: email } : {}),
  };
}

function uploadInput(value: unknown): DeployCertificateUploadInput {
  const input = object(value, 'a certificate upload');
  return {
    serverId: serverId(input.serverId),
    siteId: siteId(input.siteId),
    certificatePem: bounded(input.certificatePem, MAX_PEM, 'certificate'),
    privateKeyPem: bounded(input.privateKeyPem, MAX_PEM, 'private key'),
  };
}

function removeInput(value: unknown): DeployCertificateRemoveInput {
  const input = object(value, 'a certificate removal');
  return {
    ...stepUpInput(input),
    siteId: siteId(input.siteId),
    revoke: flag(input.revoke, 'revoking'),
    reason: oneOf(
      input.reason,
      ['unspecified', 'keyCompromise', 'superseded', 'cessationOfOperation'] as const,
      'revocation reason',
    ),
  };
}

function subscription(value: unknown): string {
  if (typeof value !== 'string' || !GUID.test(value))
    throw new Error('That is not a subscription.');
  return value;
}

export function registerDeploySitesHandlers(deps: DeploySitesHandlerDeps): void {
  const { ipc, sites, logs } = deps;
  const handle = (
    channel: string,
    run: (owner: () => SubscriptionOwner, ...args: unknown[]) => unknown,
  ) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!deps.guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(() => deps.owner(event), ...args);
    });
  };

  handle(IPC.deploySites.status, (_owner, id) => sites.status(serverId(id)));
  handle(IPC.deploySites.list, (_owner, id) => sites.sites(serverId(id)));
  handle(IPC.deploySites.listStreams, (_owner, id) => sites.streams(serverId(id)));
  handle(IPC.deploySites.install, (_owner, id) => sites.install(serverId(id)));
  handle(IPC.deploySites.save, (_owner, id, settings) =>
    sites.saveSite(serverId(id), siteSettings(settings)),
  );
  handle(IPC.deploySites.remove, (_owner, id, site) =>
    sites.deleteSite(serverId(id), siteId(site)),
  );
  handle(IPC.deploySites.saveStream, (_owner, id, settings) =>
    sites.saveStream(serverId(id), streamSettings(settings)),
  );
  handle(IPC.deploySites.removeStream, (_owner, id, proxy) =>
    sites.deleteStream(serverId(id), siteId(proxy, 'stream proxy')),
  );
  handle(IPC.deploySites.apply, (_owner, id) => sites.apply(serverId(id)));
  handle(IPC.deploySites.setSnippets, (_owner, id, value) =>
    sites.setSnippets(serverId(id), snippets(value)),
  );
  handle(IPC.deploySites.watchLog, (owner, value) => logs.watch(owner(), logWatch(value)));
  handle(IPC.deploySites.unwatchLog, (owner, id) => logs.unwatch(owner(), subscription(id)));

  handle(IPC.deployCerts.list, (_owner, id) => sites.certificates(serverId(id)));
  handle(IPC.deployCerts.issue, (_owner, value) => sites.issue(issueInput(value)));
  handle(IPC.deployCerts.renew, (_owner, id, site) => sites.renew(serverId(id), siteId(site)));
  handle(IPC.deployCerts.upload, (_owner, value) => sites.upload(uploadInput(value)));
  handle(IPC.deployCerts.remove, (_owner, value) => sites.removeCertificate(removeInput(value)));
}
