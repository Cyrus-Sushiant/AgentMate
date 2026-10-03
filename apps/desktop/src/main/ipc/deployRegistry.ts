import type { IpcMainInvokeEvent } from 'electron';
import { MAX_SECRET_LENGTH, normalizeRegistry } from '../../shared/deploy/registries';
import type {
  DeployRegistryCredentialInput,
  DeployRegistryPlan,
  DeployRegistryProof,
  DeployServerCredentialInput,
} from '../../shared/deployRegistryTypes';
import { isImageReference } from '../../shared/dockerNames';
import { IPC } from '../../shared/ipcChannels';
import type { DeployServerRegistries } from '../deploy/registry/serverCredentials';
import type { DeployRegistries } from '../deploy/registry/service';
import { type DeployIpcRegistry, object, serverId, text } from './deploy';

/**
 * The private registries' invoke channels (E08). Like the rest of Deploy they answer only the
 * main window. Secrets travel in one direction only, from the form to the main process, which
 * checks them here, seals them and never hands one back; the core checks them all again.
 */

export interface PlanRequest {
  serverId: string;
  stackId: string | null;
  revision: number | null;
  images: string[] | null;
}

export interface DeployRegistryHandlerDeps {
  ipc: DeployIpcRegistry;
  registries: DeployRegistries;
  servers: DeployServerRegistries;
  plan: (request: PlanRequest) => Promise<DeployRegistryPlan>;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN = 1024;
const MAX_USERNAME = 255;
const MAX_REGISTRY = 300;
const MAX_PROOF = 1024;
const MAX_IMAGES = 200;

function flag(value: unknown, question: string): boolean {
  if (typeof value !== 'boolean') throw new Error(question);
  return value;
}

function guid(value: unknown, what: string): string {
  if (typeof value !== 'string' || !GUID.test(value)) throw new Error(`That is not ${what}.`);
  return value;
}

function githubToken(value: unknown): string {
  return text(value, MAX_TOKEN, 'token').trim();
}

function secret(value: unknown): string {
  return text(value, MAX_SECRET_LENGTH, 'token or password');
}

function registry(value: unknown): string {
  const host = normalizeRegistry(text(value, MAX_REGISTRY, 'registry'));
  if (!host) throw new Error('Enter the registry host, such as registry.example.com:5000.');
  return host;
}

function proof(input: Record<string, unknown>): DeployRegistryProof {
  return {
    ...(typeof input.password === 'string' && input.password.length > 0
      ? { password: text(input.password, MAX_PROOF, 'password') }
      : {}),
    ...(typeof input.totpCode === 'string' && input.totpCode.length > 0
      ? { totpCode: text(input.totpCode, 16, 'code') }
      : {}),
  };
}

function credentialInput(value: unknown): DeployRegistryCredentialInput {
  const input = object(value, 'a registry sign-in');
  if (input.kind !== 'dockerhub' && input.kind !== 'custom') {
    throw new Error('A registry sign-in is for Docker Hub or a custom registry.');
  }
  return {
    kind: input.kind,
    ...(input.kind === 'custom' ? { registry: registry(input.registry) } : {}),
    username: text(input.username, MAX_USERNAME, 'user name'),
    secret: secret(input.secret),
  };
}

function serverCredentialInput(value: unknown): DeployServerCredentialInput {
  const input = object(value, 'a credential for the server');
  const base = { serverId: serverId(input.serverId), ...proof(input) };
  if (input.credentialId !== undefined) {
    return { ...base, credentialId: guid(input.credentialId, 'a saved sign-in') };
  }
  return {
    ...base,
    registry: registry(input.registry),
    username: text(input.username, MAX_USERNAME, 'user name'),
    secret: secret(input.secret),
  };
}

function planRequest(value: unknown): PlanRequest {
  const input = object(value, 'a plan request');
  const revision = input.revision;
  if (
    revision !== undefined &&
    revision !== null &&
    (!Number.isSafeInteger(revision) || (revision as number) < 1)
  ) {
    throw new Error('A revision is a whole number from 1.');
  }
  let images: string[] | null = null;
  if (input.images !== undefined && input.images !== null) {
    if (!Array.isArray(input.images) || input.images.length > MAX_IMAGES) {
      throw new Error(`Send the images as a list of at most ${MAX_IMAGES}.`);
    }
    images = input.images.filter(
      (image): image is string => typeof image === 'string' && isImageReference(image),
    );
  }
  const stackId =
    input.stackId === undefined || input.stackId === null ? null : guid(input.stackId, 'an app');
  if (images === null && (stackId === null || revision === undefined || revision === null)) {
    throw new Error('Name the app and its revision, or the images.');
  }
  return {
    serverId: serverId(input.serverId),
    stackId,
    revision: (revision as number | null | undefined) ?? null,
    images,
  };
}

export function registerDeployRegistryHandlers(deps: DeployRegistryHandlerDeps): void {
  const { ipc, registries, servers } = deps;
  const handle = (channel: string, run: (...args: unknown[]) => unknown) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!deps.guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(...args);
    });
  };

  handle(IPC.deployRegistry.list, () => registries.list());
  handle(IPC.deployRegistry.checkGithubToken, (token) =>
    registries.checkGithubToken(githubToken(token)),
  );
  handle(IPC.deployRegistry.saveGithubToken, (value) => {
    const input = object(value, 'a GitHub token');
    return registries.saveGithubToken({
      token: githubToken(input.token),
      acceptBroaderScopes: flag(
        input.acceptBroaderScopes,
        "Say whether the token's broader scopes are accepted.",
      ),
    });
  });
  handle(IPC.deployRegistry.githubCliStatus, () => registries.githubCliStatus());
  handle(IPC.deployRegistry.saveGithubCli, (value) => {
    const input = object(value, 'the GitHub CLI sign-in');
    return registries.saveGithubCli({
      acceptBroaderScopes: flag(
        input.acceptBroaderScopes,
        "Say whether the sign-in's broader scopes are accepted.",
      ),
    });
  });
  handle(IPC.deployRegistry.saveCredential, (value) =>
    registries.saveCredential(credentialInput(value)),
  );
  handle(IPC.deployRegistry.remove, (id) => registries.remove(guid(id, 'a saved sign-in')));
  handle(IPC.deployRegistry.setAppChoice, (value) => {
    const input = object(value, 'a choice for an app');
    return registries.setSendSignIns(
      serverId(input.serverId),
      guid(input.stackId, 'an app'),
      flag(input.sendSignIns, "Say whether the app's deploys send sign-ins."),
    );
  });
  handle(IPC.deployRegistry.plan, (value) => deps.plan(planRequest(value)));
  handle(IPC.deployRegistry.serverList, (id) => servers.list(serverId(id)));
  handle(IPC.deployRegistry.serverSave, (value) => servers.save(serverCredentialInput(value)));
  handle(IPC.deployRegistry.serverRemove, (value) => {
    const input = object(value, 'a stored credential');
    return servers.remove({
      serverId: serverId(input.serverId),
      credentialId: guid(input.credentialId, 'a stored credential'),
      ...proof(input),
    });
  });
}
