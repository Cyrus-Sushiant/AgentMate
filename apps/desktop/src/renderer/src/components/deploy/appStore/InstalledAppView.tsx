import { coreErrorMessage } from '@shared/coreErrors';
import type { DeployRevisionResult } from '@shared/deployAppStoreTypes';
import type { DeployServer } from '@shared/deployTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, CircleCheck, CircleX, Globe, Minus, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { UpdateOffer } from '@/lib/deploy/appStore/format';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { DeployTimeline } from '../apps/DeployTimeline';
import { type AppsAccess, stackIsBusy } from '../apps/hooks';
import { useProofStepUp } from '../overview/useProofStepUp';
import { useInstalledApp } from './hooks';
import { PostInstallCard } from './PostInstallCard';

/**
 * One app from the App Store: its deploy as it happens (the install, an update, a rollback), the
 * steps that put it on a domain, and the post-install card. Passwords held from the install are
 * passed in and live only as long as this screen.
 */

export type ExposeStepState = 'running' | 'done' | 'failed' | 'skipped';

export interface ExposeStep {
  id: 'site' | 'apply' | 'certificate';
  label: string;
  state: ExposeStepState;
  detail?: string;
}

const STEP_ICON: Record<ExposeStepState, typeof CircleCheck> = {
  running: Spinner,
  done: CircleCheck,
  failed: CircleX,
  skipped: Minus,
};

const STEP_WORD: Record<ExposeStepState, string> = {
  running: 'working',
  done: 'done',
  failed: 'failed',
  skipped: 'skipped',
};

function ExposeSteps({ domain, steps }: { domain: string; steps: ExposeStep[] }) {
  return (
    <section
      aria-label="Domain steps"
      className="glass space-y-2 rounded-xl border border-border p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" /> {domain}
      </h4>
      <ol className="space-y-1 text-sm">
        {steps.map((step) => {
          const Icon = STEP_ICON[step.state];
          return (
            <li key={step.id} aria-label={step.label} className="flex items-start gap-2">
              <Icon
                className={
                  step.state === 'running'
                    ? 'mt-0.5 h-3.5 w-3.5 shrink-0 motion-safe:animate-spin'
                    : step.state === 'failed'
                      ? 'mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive'
                      : 'mt-0.5 h-3.5 w-3.5 shrink-0 text-success'
                }
              />
              <span>
                {step.label}{' '}
                <span className="text-muted-foreground">({STEP_WORD[step.state]})</span>
                {step.detail && (
                  <span className="block text-xs text-muted-foreground">{step.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function InstalledAppView({
  server,
  access,
  stackId,
  secrets,
  expose,
  notice,
  onBack,
  onOpenInApps,
}: {
  server: DeployServer;
  access: AppsAccess;
  stackId: string;
  /** The passwords made for this install, while the screen that made them is open. */
  secrets: Record<string, string> | null;
  expose: { domain: string; steps: ExposeStep[] } | null;
  /** Something to say from the install, such as why nothing was deployed. */
  notice?: string | null;
  onBack: () => void;
  onOpenInApps: () => void;
}): React.JSX.Element {
  const serverId = server.id;
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(secrets !== null);
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [problem, setProblem] = useState<string | null>(notice ?? null);
  const stepUp = useProofStepUp(server);
  const app = useInstalledApp(serverId, stackId, access.signedIn, following);
  const details = app.details;
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.deployApps(serverId) });

  if (app.loading && !details) {
    return <Skeleton className="h-64 w-full rounded-xl" aria-busy="true" />;
  }
  if (!details) {
    return (
      <p role="alert" className="text-sm text-destructive">
        The app did not load{app.detailsError ? `: ${coreErrorMessage(app.detailsError)}` : '.'}
      </p>
    );
  }

  const newest = details.revisions[0];
  const busy = stackIsBusy(details);
  const live = details.stack.liveRevision;
  const earlier = details.revisions.find(
    (revision) => revision.number !== live && revision.deployedAtUnixMs !== undefined,
  );

  async function reveal(): Promise<void> {
    if (app.revision === null) return;
    const revision = app.revision;
    setRevealing(true);
    setProblem(null);
    try {
      const values = await stepUp.run(
        (proof) =>
          window.agentmat.deployAppStore.revealSecrets({ serverId, stackId, revision, ...proof }),
        'reveal the passwords',
      );
      if (values) setRevealed(values);
    } catch (error) {
      setProblem(coreErrorMessage(error));
    } finally {
      setRevealing(false);
    }
  }

  async function started(work: () => Promise<DeployRevisionResult | unknown>): Promise<void> {
    setProblem(null);
    try {
      const result = (await work()) as Partial<DeployRevisionResult>;
      if (result && 'revision' in result && result.revision && result.job === null) {
        setProblem(
          result.revision.error ??
            `Revision ${result.revision.number} waits for findings to be acknowledged in Apps.`,
        );
      }
      setFollowing(true);
      await refresh();
    } catch (error) {
      setProblem(coreErrorMessage(error));
    }
  }

  async function update(offer: Exclude<UpdateOffer, { kind: 'none' }>): Promise<void> {
    const version = offer.kind === 'digest' ? offer.version : offer.version.id;
    const ok = await confirmDialog({
      title:
        offer.kind === 'digest'
          ? `Update ${details?.stack.name}?`
          : `Move to ${offer.version.label}?`,
      description: `The app is deployed again as a new revision with the newer images and the same settings and passwords. If it does not come up healthy, roll back to revision ${live ?? newest?.number}.`,
      ...(offer.kind === 'line'
        ? { warning: 'A new release line can change how data is stored on disk. Back up first.' }
        : {}),
      confirmLabel: offer.kind === 'digest' ? 'Update' : 'Move',
    });
    if (!ok) return;
    await started(() => window.agentmat.deployAppStore.update({ serverId, stackId, version }));
  }

  async function rollback(): Promise<void> {
    if (!earlier) return;
    const ok = await confirmDialog({
      title: `Roll back to revision ${earlier.number}?`,
      description: `Revision ${earlier.number}'s files are copied into a new revision and deployed. Data in the app's volumes stays as it is.`,
      confirmLabel: 'Roll back',
    });
    if (!ok) return;
    await started(() =>
      window.agentmat.deployStacks.rollback({ serverId, stackId, revision: earlier.number }),
    );
  }

  const timeline =
    newest?.jobId && (following || busy || newest.state !== 'live') ? newest : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> App Store
        </Button>
        <h3 className="text-base font-semibold">{details.stack.name}</h3>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onOpenInApps}>
          Open in Apps
        </Button>
      </div>
      {timeline && (
        <DeployTimeline
          serverId={serverId}
          revision={timeline}
          canOperate={access.canOperate}
          onSettled={() => void refresh()}
        />
      )}
      {expose && <ExposeSteps domain={expose.domain} steps={expose.steps} />}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {app.install ? (
        <PostInstallCard
          name={details.stack.name}
          install={app.install}
          secrets={secrets ?? revealed}
          canOperate={access.canOperate}
          canAdmin={access.canAdmin}
          revealing={revealing}
          busy={busy}
          rollbackTo={earlier && live !== undefined ? earlier.number : null}
          onReveal={() => void reveal()}
          onUpdate={(offer) => void update(offer)}
          onRollback={() => void rollback()}
        />
      ) : app.problem ? (
        <p className="text-sm text-muted-foreground">{app.problem}</p>
      ) : (
        <Skeleton className="h-40 w-full rounded-xl" aria-busy="true" />
      )}
      {stepUp.dialog}
    </div>
  );
}
