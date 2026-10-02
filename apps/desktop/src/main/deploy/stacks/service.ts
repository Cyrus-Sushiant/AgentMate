import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateStackName } from '@agentmat/core';
import { encodeCoreError } from '../../../shared/coreErrors';
import type {
  JobInfo,
  StackAction,
  StackDetails,
  StackInfo,
  StackRevisionFiles,
  StackRevisionInfo,
  StackRevisionUpload,
  StackSource,
} from '../../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../../../shared/deploy/protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import type {
  DeployComposeDiscovery,
  DeployStackCreateInput,
  DeployStackPreview,
  DeployStackPreviewInput,
  DeployStackRevisionInput,
  DeployStackUploadProgress,
  DeployStackUploadResult,
} from '../../../shared/deployStacksTypes';
import { type CoreHttpClient, CoreHttpError } from '../connection/coreHttp';
import type { CoreLinks } from '../live/coreLinks';
import { explainCoreRefusal } from '../system';
import type { BuildContextOptions, BuildContextResult } from './buildContext';
import {
  discoverComposeFiles,
  dockerfilesOf,
  previewFromSource,
  previewStack,
  readStackSource,
  type StackSourceDeps,
} from './compose';

/**
 * A server's Apps (E07), on its lasting hub connection, with the files going up over REST since
 * a compose file and its .env can be larger than a hub message. An upload reads the project and
 * its environment again here rather than trusting what the wizard showed: the preview is what
 * the renderer saw, this is what goes to the server. The .env text (with the values) is built
 * here and only ever sent to the core.
 */

/** A build context over SSH can take a while; the core caps it at 256 MB unpacked. */
const CONTEXT_TIMEOUT_MS = 30 * 60_000;
const FILES_TIMEOUT_MS = 2 * 60_000;

export interface DeployStacksDeps {
  links: Pick<CoreLinks, 'call'>;
  roles: (serverId: string) => string[] | null;
  /** A REST call signed in with this computer's session (DeployService.withCoreHttp). */
  http: <T>(
    serverId: string,
    work: (client: CoreHttpClient, token: string) => Promise<T>,
  ) => Promise<T>;
  source: StackSourceDeps;
  /** Packs the build context (buildContext.ts). */
  pack: (options: BuildContextOptions) => Promise<BuildContextResult>;
  progress?: (event: DeployStackUploadProgress) => void;
  /** Where packed contexts wait for their upload. */
  tempRoot?: () => string;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export class DeployStacks {
  constructor(private readonly deps: DeployStacksDeps) {}

  discover(projectId: string): Promise<DeployComposeDiscovery> {
    return discoverComposeFiles(this.deps.source, projectId);
  }

  preview(input: DeployStackPreviewInput): Promise<DeployStackPreview> {
    return previewStack(this.deps.source, input);
  }

  list(serverId: string): Promise<StackInfo[]> {
    return this.run(serverId, (hub) => hub.listStacks());
  }

  get(serverId: string, stackId: string): Promise<StackDetails> {
    return this.run(serverId, (hub) => hub.getStack(stackId));
  }

  files(serverId: string, stackId: string, revision: number): Promise<StackRevisionFiles> {
    return this.run(serverId, (hub) => hub.getStackRevisionFiles({ stackId, revision }));
  }

  /** A new app and its first revision. A name already taken by an app that never got files is reused. */
  async create(input: DeployStackCreateInput): Promise<DeployStackUploadResult> {
    const name = validateStackName(input.name);
    if (!name.ok) throw new Error(name.reason);
    const prepared = await this.prepare(input);
    const existing = (await this.list(input.serverId)).find((stack) => stack.name === name.value);
    if (existing && existing.revisionCount > 0) {
      throw new Error(`There is already an app called ${name.value} on this server.`);
    }
    const stack =
      existing ??
      (await this.run(input.serverId, (hub) =>
        hub.createStack({ name: name.value, source: prepared.source }),
      ));
    return this.send(input.serverId, stack.id, prepared);
  }

  /** A new revision of an existing app. */
  async upload(input: DeployStackRevisionInput): Promise<DeployStackUploadResult> {
    const prepared = await this.prepare(input);
    return this.send(input.serverId, input.stackId, prepared);
  }

  acknowledge(
    serverId: string,
    stackId: string,
    revision: number,
    riskIds: string[],
  ): Promise<StackRevisionInfo> {
    return this.run(serverId, (hub) =>
      hub.acknowledgeStackRisks({ stackId, revision, riskIds: unique(riskIds) }),
    );
  }

  deploy(serverId: string, stackId: string, revision: number): Promise<JobInfo> {
    return this.run(serverId, (hub) => hub.deployStack({ stackId, revision }));
  }

  rollback(serverId: string, stackId: string, revision: number): Promise<JobInfo> {
    return this.run(serverId, (hub) => hub.rollbackStack({ stackId, revision }));
  }

  action(serverId: string, stackId: string, action: StackAction): Promise<JobInfo> {
    return this.run(serverId, (hub) => hub.runStackAction({ stackId, action }));
  }

  delete(serverId: string, stackId: string, removeVolumes: boolean): Promise<JobInfo> {
    return this.run(serverId, (hub) =>
      removeVolumes ? hub.deleteStackWithVolumes(stackId) : hub.deleteStack(stackId),
    );
  }

  /** Reads and checks everything an upload sends, before anything reaches the server. */
  private async prepare(input: DeployStackRevisionInput | DeployStackCreateInput) {
    this.progress(input.serverId, 'reading');
    const source = await readStackSource(this.deps.source, input);
    const preview = previewFromSource(source, input.proxiedServices, false);
    if (preview.blocking || preview.envText === null || !preview.project) {
      throw new Error(preview.blocking ?? 'The compose file could not be read.');
    }
    const acknowledged = new Set(input.acknowledgedRisks);
    const waiting = preview.requiresAcknowledgment.filter((id) => !acknowledged.has(id));
    if (waiting.length > 0) {
      throw new Error(
        `Acknowledge every risk before deploying. Still waiting: ${waiting.join(', ')}.`,
      );
    }
    const stackSource: StackSource = {
      projectId: source.project.id,
      projectName: source.project.name,
      composePath: source.composePath,
      ...(source.environment
        ? { environmentId: source.environment.id, environmentName: source.environment.name }
        : {}),
    };
    return {
      source: stackSource,
      composeDir: source.composeDir,
      upload: {
        compose: source.composeText,
        env: preview.envText,
        proxiedServices: preview.proxiedServices,
        acknowledgedRisks: unique(input.acknowledgedRisks),
        buildContext: preview.buildContext !== null,
        source: stackSource,
      } satisfies StackRevisionUpload,
      dockerfiles: dockerfilesOf(preview.project),
    };
  }

  private async send(
    serverId: string,
    stackId: string,
    prepared: Awaited<ReturnType<DeployStacks['prepare']>>,
  ): Promise<DeployStackUploadResult> {
    const base = `/api/v1/stacks/${encodeURIComponent(stackId)}/revisions`;
    const folder = prepared.upload.buildContext
      ? await mkdtemp(join(this.deps.tempRoot?.() ?? tmpdir(), 'agentmate-context-'))
      : null;
    try {
      // Packed first: a context that is too large is refused before the server gets anything.
      let packed: BuildContextResult | null = null;
      if (folder) {
        this.progress(serverId, 'packing');
        packed = await this.deps.pack({
          root: prepared.composeDir,
          output: join(folder, 'context.tar.gz'),
          alwaysInclude: prepared.dockerfiles,
        });
      }
      this.progress(serverId, 'uploading-files');
      let revision = await this.rest(serverId, (client, token) =>
        client.post<StackRevisionInfo>(base, prepared.upload, {
          token,
          timeoutMs: FILES_TIMEOUT_MS,
        }),
      );
      if (packed) {
        const archive = packed;
        this.progress(serverId, 'uploading-context', 0, archive.archiveBytes);
        revision = await this.rest(serverId, (client, token) =>
          client.putStream<StackRevisionInfo>(
            `${base}/${revision.number}/context`,
            createReadStream(archive.path),
            {
              token,
              contentType: 'application/gzip',
              contentLength: archive.archiveBytes,
              headers: { 'x-content-sha256': archive.sha256 },
              timeoutMs: CONTEXT_TIMEOUT_MS,
              onProgress: (sent) =>
                this.progress(serverId, 'uploading-context', sent, archive.archiveBytes),
            },
          ),
        );
      }
      this.progress(serverId, 'done');
      const details = await this.get(serverId, stackId);
      return { stack: details.stack, revision };
    } finally {
      if (folder) await rm(folder, { recursive: true, force: true });
    }
  }

  private progress(
    serverId: string,
    phase: DeployStackUploadProgress['phase'],
    sentBytes?: number,
    totalBytes?: number,
  ): void {
    this.deps.progress?.({
      serverId,
      phase,
      ...(sentBytes === undefined ? {} : { sentBytes }),
      ...(totalBytes === undefined ? {} : { totalBytes }),
    });
  }

  /** A REST call whose refusal reads like the core's own words. */
  private async rest<T>(
    serverId: string,
    work: (client: CoreHttpClient, token: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.deps.http(serverId, work);
    } catch (error) {
      if (!(error instanceof CoreHttpError)) throw error;
      const said =
        error.body && typeof error.body === 'object' && 'message' in error.body
          ? String((error.body as { message: unknown }).message)
          : null;
      if (error.status === 403) {
        const roles = this.deps.roles(serverId);
        const which = roles && roles.length > 0 ? ` (${roles.join(', ')})` : '';
        throw new Error(
          encodeCoreError('forbidden', `Your role on this server${which} cannot upload apps.`),
        );
      }
      throw new Error(said ?? error.message);
    }
  }

  private async run<T>(serverId: string, work: (hub: ICoreHub) => Promise<T>): Promise<T> {
    try {
      return await this.deps.links.call(serverId, work);
    } catch (error) {
      throw explainCoreRefusal(error, this.deps.roles(serverId), false);
    }
  }
}
