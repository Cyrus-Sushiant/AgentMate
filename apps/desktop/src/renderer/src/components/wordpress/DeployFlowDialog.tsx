import type { WpItemRef, WpPlannedChange } from '@agentmat/core';
import type { DeployWordPressPlan } from '@shared/deployWordPressTypes';
import { wordPressErrorCode, wordPressErrorMessage } from '@shared/wordpressErrors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CloudUpload, RefreshCw, Spinner } from '@/components/icons';
import {
  HealthChecks,
  OutcomeBanner,
  ReviewHeading,
  RunError,
  WarningList,
} from '@/components/projects/wordpress/FlowParts';
import { OperationTimeline } from '@/components/projects/wordpress/OperationTimeline';
import {
  deployOutcome,
  FORCEABLE_WARNINGS,
  needsNewPlan,
  planExpired,
} from '@/components/projects/wordpress/wordpressCopy';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OverflowScroll } from '@/components/ui/overflow-scroll';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { findWordPressRun, useWordPressOperationStore } from '@/stores/wordpressOperationStore';
import { ChangeDiff, ChangeList, changeKey } from './ChangeList';
import { ConflictResolver } from './ConflictResolver';
import { LeftOutList } from './LeftOutList';

/**
 * Reviews and deploys a WordPress project's changes to its site (E21): plan, review (changes,
 * conflicts, what is left out and why, warnings), confirm, progress, result.
 *
 * The Deploy UI opens it from a site's Items panel with these props, so they stay as they are.
 * The run itself lives in the operation store, so closing the dialog or leaving the page does not
 * lose it: opening the dialog again for the same project shows where it got to.
 */
export interface DeployFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  siteId: string;
  /** Only these of the project's items; all of them when left out. */
  items?: WpItemRef[];
}

type Step = 'plan' | 'review' | 'confirm' | 'run';

const SILENT = { silentLoading: true } as const;

export function DeployFlowDialog({
  open,
  onOpenChange,
  projectId,
  siteId,
  items,
}: DeployFlowDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const startDeploy = useWordPressOperationStore((state) => state.deploy);
  const cancelRun = useWordPressOperationStore((state) => state.cancel);
  const clearRun = useWordPressOperationStore((state) => state.clear);

  const [step, setStep] = useState<Step>('plan');
  const [plan, setPlan] = useState<DeployWordPressPlan | null>(null);
  const [planError, setPlanError] = useState<unknown>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [selected, setSelected] = useState<WpPlannedChange | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const planRequest = useRef(0);
  const run = useWordPressOperationStore((state) =>
    operationId ? (state.runs[operationId] ?? null) : null,
  );

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
    enabled: open,
  });
  const project = projectsQuery.data?.find((candidate) => candidate.id === projectId);
  const sitesQuery = useQuery({
    queryKey: queryKeys.deployWordPressSites,
    queryFn: () => window.agentmat.deployWordPress.listSites(),
    enabled: open,
    meta: SILENT,
  });
  const site = sitesQuery.data?.find((candidate) => candidate.id === siteId);
  const siteName = site?.label || site?.siteName || 'the site';

  async function makePlan(): Promise<void> {
    planRequest.current += 1;
    const request = planRequest.current;
    setStep('plan');
    setPlan(null);
    setPlanError(null);
    setSelected(null);
    setOverwrite(false);
    setAcknowledged(false);
    setOperationId(null);
    try {
      const next = await window.agentmat.deployWordPress.planDeploy({
        projectId,
        ...(items ? { items } : {}),
      });
      if (request !== planRequest.current) return;
      setPlan(next);
      setStep('review');
    } catch (error) {
      if (request !== planRequest.current) return;
      setPlanError(error);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: start over each time it opens, not on every render
  useEffect(() => {
    if (!open) {
      planRequest.current += 1;
      return;
    }
    const existing = findWordPressRun(useWordPressOperationStore.getState().runs, {
      kind: 'deploy',
      projectId,
    });
    if (existing) {
      setOperationId(existing.operationId);
      setStep('run');
      return;
    }
    void makePlan();
  }, [open, projectId]);

  const runStatus = run?.status;
  useEffect(() => {
    if (runStatus !== 'done' && runStatus !== 'failed') return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectWordPressChanges(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.deployWordPressHistory(siteId) });
  }, [runStatus, projectId, siteId, queryClient]);

  function handleOpenChange(next: boolean): void {
    // A finished run has been seen once the dialog closes on it; a running one carries on.
    if (!next && run && run.status !== 'running') clearRun(run.operationId);
    onOpenChange(next);
  }

  const conflicts = plan?.conflicts ?? [];
  const pending = plan?.changes.filter((change) => change.action !== 'none') ?? [];
  const uploads = pending.filter((change) => change.action === 'upload');
  const deletes = pending.filter((change) => change.action === 'deleteRemote');
  const forceable = plan?.warnings.some((warning) => FORCEABLE_WARNINGS.has(warning)) ?? false;
  const readOnly = plan?.warnings.includes('readOnlyScope') === true || site?.scope === 'read';
  const needsForce = conflicts.length > 0 || forceable;
  const blockedReason = !plan
    ? null
    : readOnly
      ? "This site's key is read-only, so it can't take a deploy."
      : pending.length === 0
        ? 'Nothing to deploy.'
        : conflicts.length > 0 && !overwrite
          ? "Choose to overwrite the site's version first."
          : forceable && !acknowledged
            ? 'Confirm the warnings above first.'
            : null;

  function deploy(): void {
    if (!plan) return;
    if (planExpired(plan.expiresAt)) {
      void makePlan();
      return;
    }
    const id = crypto.randomUUID();
    setOperationId(id);
    setStep('run');
    void startDeploy(
      { planId: plan.planId, operationId: id, force: needsForce },
      { siteId, projectId },
    );
  }

  const result = run?.result?.kind === 'deploy' ? run.result.value : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === 'confirm' ? `Deploy to ${siteName}?` : `Deploy to ${siteName}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'run'
              ? 'Changes go to the site one step at a time. You can close this window; the deploy keeps going.'
              : step === 'confirm'
                ? 'Before anything changes, the site keeps a copy of every file this touches. If the site shows an error afterwards, the old files go back on their own.'
                : "What would change on the site, what stays here, and anything worth knowing first. Click a file to compare it with the site's copy."}
          </DialogDescription>
        </DialogHeader>

        <OverflowScroll fill>
          {step === 'plan' ? (
            planError ? (
              <RunError
                message={wordPressErrorMessage(planError)}
                code={wordPressErrorCode(planError)}
              />
            ) : (
              <div role="status" aria-label="Working out the changes" className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            )
          ) : null}

          {step === 'review' && plan ? (
            <div className="space-y-5">
              <p className="px-1 text-sm">
                {uploads.length === 1 ? '1 file to upload' : `${uploads.length} files to upload`}
                {plan.uploadBytes > 0 ? ` (${formatBytes(plan.uploadBytes)})` : ''},{' '}
                {deletes.length === 1 ? '1 to delete' : `${deletes.length} to delete`}
                {conflicts.length > 0 ? `, ${conflicts.length} in conflict` : ''}.
              </p>

              <WarningList
                warnings={plan.warnings}
                acknowledged={acknowledged}
                onAcknowledgedChange={setAcknowledged}
              />

              <ConflictResolver
                mode="deploy"
                conflicts={conflicts}
                overwrite={overwrite}
                onOverwriteChange={setOverwrite}
                disabled={readOnly}
              />

              <div className="space-y-2">
                <ReviewHeading>Changes</ReviewHeading>
                <ChangeList
                  changes={plan.changes}
                  direction="deploy"
                  selectedKey={selected ? changeKey(selected) : null}
                  onSelect={(change) =>
                    setSelected((current) =>
                      current && changeKey(current) === changeKey(change) ? null : change,
                    )
                  }
                />
                {selected && project ? (
                  <ChangeDiff
                    projectId={projectId}
                    folderPath={project.folderPath}
                    change={selected}
                    direction="deploy"
                    onClose={() => setSelected(null)}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <ReviewHeading>Left out</ReviewHeading>
                <LeftOutList entries={plan.leftOut} direction="deploy" />
              </div>
            </div>
          ) : null}

          {step === 'confirm' && plan ? (
            <ul className="space-y-1.5 px-1 text-sm">
              <li>
                {uploads.length === 1 ? '1 file uploaded' : `${uploads.length} files uploaded`}
                {plan.uploadBytes > 0 ? ` (${formatBytes(plan.uploadBytes)})` : ''}
              </li>
              <li>{deletes.length === 1 ? '1 file deleted' : `${deletes.length} files deleted`}</li>
              {conflicts.length > 0 ? (
                <li className="text-warning">
                  {conflicts.length === 1
                    ? "1 file overwrites the site's own edits"
                    : `${conflicts.length} files overwrite the site's own edits`}
                </li>
              ) : null}
              <li className="text-muted-foreground">
                Agent settings and AgentMate's own files stay on this computer.
              </li>
            </ul>
          ) : null}

          {step === 'run' ? (
            run ? (
              <div className="space-y-4">
                {run.status === 'done' && result ? (
                  <OutcomeBanner outcome={deployOutcome(result)} />
                ) : null}
                {run.status === 'failed' ? (
                  <RunError message={run.error ?? 'The deploy failed.'} code={run.errorCode} />
                ) : null}
                <OperationTimeline run={run} />
                {result && result.health.length > 0 ? (
                  <div className="space-y-1.5">
                    <ReviewHeading>Health checks</ReviewHeading>
                    <HealthChecks checks={result.health} />
                  </div>
                ) : null}
              </div>
            ) : (
              <Skeleton className="h-40 w-full rounded-lg" />
            )
          ) : null}
        </OverflowScroll>

        <DialogFooter>
          {step === 'plan' ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              {planError ? (
                <Button onClick={() => void makePlan()}>
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              ) : null}
            </>
          ) : null}

          {step === 'review' ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => void makePlan()}>
                <RefreshCw className="h-4 w-4" /> Check again
              </Button>
              <SimpleTooltip label={blockedReason} wrapTrigger>
                <Button disabled={blockedReason !== null} onClick={() => setStep('confirm')}>
                  <CloudUpload className="h-4 w-4" /> Continue
                </Button>
              </SimpleTooltip>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <Button variant="ghost" onClick={() => setStep('review')}>
                Back
              </Button>
              <Button onClick={deploy}>
                <CloudUpload className="h-4 w-4" /> Deploy now
              </Button>
            </>
          ) : null}

          {step === 'run' && run ? (
            run.status === 'running' ? (
              <>
                <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                  Hide
                </Button>
                <Button
                  variant="outline"
                  disabled={run.cancelling}
                  onClick={() => void cancelRun(run.operationId)}
                >
                  {run.cancelling ? <Spinner className="h-4 w-4 animate-spin" /> : null}
                  {run.cancelling ? 'Cancelling' : 'Cancel deploy'}
                </Button>
              </>
            ) : (
              <>
                {run.status === 'failed' &&
                (needsNewPlan(run.errorCode) || run.errorCode === 'syntaxError') ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearRun(run.operationId);
                      void makePlan();
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> Check again
                  </Button>
                ) : null}
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
