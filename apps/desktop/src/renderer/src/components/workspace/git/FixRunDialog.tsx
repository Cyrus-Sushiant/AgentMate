import {
  DEFAULT_TARGET_AI,
  EFFORT_LABELS,
  findGroup,
  getCliDefinition,
  type Project,
  runChoiceArgs,
  targetAIForCliId,
} from '@agentmat/core';
import type { GithubActionsRunErrorInput } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Spinner, TerminalSquare, Wand2 } from '@/components/icons';
import {
  RunRecommendationPanel,
  useRunRecommendation,
} from '@/components/promptBuilder/RunRecommendation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { launchPromptTab, projectCliId } from '@/lib/workspace/launch';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** What an agent is asked to do about a failed run, with the failure pasted underneath. */
export function buildFixRunPrompt(run: GithubActionsRunErrorInput, failure: string): string {
  const where = [
    run.headBranch ? `on ${run.headBranch}` : null,
    run.runNumber ? `(run #${run.runNumber})` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return [
    `The GitHub Actions workflow "${run.workflowName ?? 'CI'}" failed${where ? ` ${where}` : ''}.`,
    run.displayTitle ? `It ran for the commit "${run.displayTitle}".` : null,
    '',
    'Find the root cause and fix it in this repository. Run the same checks the workflow runs to reproduce the failure where you can, keep the change focused on this failure, and confirm the checks pass afterwards. When you are done, explain the cause and what you changed.',
    '',
    'Failure output from the run:',
    '```',
    failure.trim(),
    '```',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/**
 * Turns a failed run into a ready-to-run agent prompt. The failure is fetched, the prompt is
 * shown for a last look (and can be edited), and a quick sizing picks the model and effort.
 * Running it opens a tab with the command typed and waiting for Enter.
 */
export function FixRunDialog({
  project,
  run,
  open,
  onOpenChange,
}: {
  project: Project;
  run: GithubActionsRunErrorInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const analyzedFor = useRef<string | null>(null);
  const cliId = projectCliId(project);
  const cli = cliId ? getCliDefinition(cliId) : undefined;
  const targetAI = (cliId && targetAIForCliId(cliId)) || DEFAULT_TARGET_AI;

  const failure = useQuery({
    queryKey: ['pipeline-run-error', run.repo, run.runId],
    queryFn: async () => {
      const result = await window.agentmat.pipelines.runError(run);
      if (!result.ok) throw new Error(result.error);
      return result.text;
    },
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    meta: { silentLoading: true },
  });

  // The prompt is filled once per failure; after that it belongs to the user.
  useEffect(() => {
    if (failure.data && !prompt) setPrompt(buildFixRunPrompt(run, failure.data));
  }, [failure.data, prompt, run]);

  const recommendation = useRunRecommendation({
    jobKey: `pipeline-fix:${run.repo}:${run.runId}`,
    generated: prompt,
    promptType: 'Bug Fix',
    targetAI,
  });

  // Size the prompt as soon as it exists, so the model and effort are ready by the time the
  // user has read it. Edits after that mark the sizing stale; the panel offers a re-run.
  const { analyze } = recommendation;
  useEffect(() => {
    if (!open || !prompt || analyzedFor.current === `${run.repo}:${run.runId}`) return;
    analyzedFor.current = `${run.repo}:${run.runId}`;
    analyze({ prompt });
  }, [open, prompt, analyze, run.repo, run.runId]);

  // The model and effort are the user's to change in the panel below, and editing the prompt
  // afterwards must not quietly drop what they picked, so the flags come from the current choice
  // rather than from the (by then stale) sizing.
  const profile = recommendation.recommendation?.profile ?? null;
  const choice = recommendation.choice;
  const runArgs = profile && choice ? runChoiceArgs(profile, choice) : [];
  const suggestion =
    profile?.cliId && choice && runArgs.length > 0
      ? {
          cliId: profile.cliId,
          args: runArgs,
          label: [choice.model.label, choice.effort ? EFFORT_LABELS[choice.effort] : null]
            .filter(Boolean)
            .join(' · '),
        }
      : null;

  function openFix(launch: { cliId: string; runArgs?: string[]; runLabel?: string }): void {
    if (!prompt.trim()) return;
    const ws = useWorkspaceStore.getState().workspaces[project.id];
    const group = ws ? findGroup(ws.root, ws.focusedGroupId) : null;
    const tabId = launchPromptTab(project, { ...launch, prompt }, group?.id);
    if (!tabId) return;
    onOpenChange(false);
    navigate(`/workspace/${project.id}`);
    const name = getCliDefinition(launch.cliId)?.name ?? 'the agent';
    toast.success(`Starting ${name}`, {
      description: 'The prompt goes in as soon as it is ready. Press Enter in the tab to run it.',
    });
  }

  const sizing = recommendation.status === 'analyzing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[min(58rem,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            Fix {run.workflowName ?? 'this run'} with AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            {[run.headBranch, run.runNumber ? `run #${run.runNumber}` : null, run.displayTitle]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4 lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Prompt</p>
            {failure.isPending ? (
              <div className="space-y-2 rounded-lg border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Reading the failure from GitHub…</p>
                {Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={i}
                    className="shimmer block h-3 rounded"
                    style={{ width: `${92 - i * 9}%` }}
                  />
                ))}
              </div>
            ) : failure.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                Could not read this run's failure: {failure.error.message}
                <button
                  type="button"
                  onClick={() => void failure.refetch()}
                  className="ml-2 font-semibold underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                spellCheck={false}
                aria-label="Fix prompt"
                className="min-h-[18rem] flex-1 resize-none rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            )}
          </div>
          {/* The sizing is a suggestion: the model and effort stay editable right up to Run. */}
          <div className="min-h-0 shrink-0 overflow-y-auto rounded-lg border border-border/70 bg-background/40 p-3 lg:w-[21rem]">
            <RunRecommendationPanel state={recommendation} />
          </div>
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t border-border/70 px-5 py-3 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={!prompt}
            onClick={() => {
              void navigator.clipboard.writeText(prompt);
              toast.success('Prompt copied');
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy prompt
          </Button>
          <div className="flex items-center gap-2">
            {suggestion && cliId && suggestion.cliId !== cliId ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!prompt}
                onClick={() => openFix({ cliId })}
              >
                Open in {cli?.name ?? 'default CLI'}
              </Button>
            ) : null}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!prompt || (!suggestion && !cliId)}
              onClick={() =>
                openFix(
                  suggestion
                    ? {
                        cliId: suggestion.cliId,
                        runArgs: suggestion.args,
                        runLabel: suggestion.label,
                      }
                    : { cliId: cliId ?? '' },
                )
              }
            >
              {sizing ? (
                <Spinner className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TerminalSquare className="h-3.5 w-3.5" />
              )}
              {suggestion
                ? `Run on ${suggestion.label}`
                : sizing
                  ? `Open in ${cli?.name ?? 'agent'} (sizing…)`
                  : `Open in ${cli?.name ?? 'agent'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
