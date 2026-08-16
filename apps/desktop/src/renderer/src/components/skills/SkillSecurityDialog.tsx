import { CLI_REGISTRY, SKILL_RISK_CATEGORIES } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, Sparkles, Spinner, X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { queryKeys } from '@/lib/queryKeys';
import type { SkillAuditRecord, SkillAuditTarget } from '../../../../shared/apiTypes';
import { SkillAuditReport, SkillAuditVerdictBadge } from './SkillAuditReport';

/** What the dialog is checking, plus the name to show while it does. */
export interface SkillSecurityTarget {
  target: SkillAuditTarget;
  skillName: string;
  /** Stable id used to look up this skill's earlier scans; mirrors what the audit stores. */
  skillId: string;
}

/** Falls back to whatever Settings picked as the default CLI. */
const DEFAULT_CLI_VALUE = '__default__';

export function SkillSecurityDialog({
  subject,
  onOpenChange,
}: {
  subject: SkillSecurityTarget | null;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [deepReview, setDeepReview] = useState(false);
  const [cliId, setCliId] = useState(DEFAULT_CLI_VALUE);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<SkillAuditRecord | null>(null);

  // A fresh target starts a fresh dialog: no leftover report from the last skill checked.
  useEffect(() => {
    setResult(null);
    setRequestId(null);
  }, [subject?.skillId]);

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
    enabled: !!subject,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.skillAuditsFor(subject?.skillId ?? ''),
    queryFn: () => window.agentmat.skills.listAudits({ skillId: subject!.skillId, limit: 20 }),
    enabled: !!subject,
  });

  // CLIs that can answer a one-shot prompt and are actually installed here.
  const installedPromptClis = CLI_REGISTRY.filter(
    (cli) => cli.promptCommand && cliQuery.data?.find((c) => c.id === cli.id)?.installed,
  );

  const auditMutation = useMutation({
    mutationFn: async () => {
      if (!subject) throw new Error('Nothing to scan.');
      const id = crypto.randomUUID();
      setRequestId(id);
      return window.agentmat.skills.runAudit({
        target: subject.target,
        deepReview,
        cliId: cliId === DEFAULT_CLI_VALUE ? null : cliId,
        requestId: id,
      });
    },
    onSettled: () => setRequestId(null),
    onSuccess: (response) => {
      if (response.cancelled) {
        toast.info('Security check cancelled.');
        return;
      }
      if (!response.ok || !response.record) {
        toast.error(response.error ?? 'The security check could not run.');
        return;
      }
      setResult(response.record);
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillAudits });
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillAuditsLatest });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const running = auditMutation.isPending;
  const shown = result ?? historyQuery.data?.[0] ?? null;
  const showingEarlierScan = !result && !!shown;
  const earlierChecks = (historyQuery.data ?? []).filter((entry) => entry.id !== shown?.id);

  return (
    <Dialog open={!!subject} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Shield className="h-4 w-4" />
            Security check: {subject?.skillName}
          </DialogTitle>
          <DialogDescription>
            Reads the skill's own files and looks for the {SKILL_RISK_CATEGORIES.length} risk
            patterns below. Nothing is installed or run to do this.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 -my-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1">
          <div className="space-y-3 rounded-lg border border-border bg-card/60 px-3 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Deep review with an agent CLI
                </span>
                <span className="text-xs text-muted-foreground">
                  Sends the skill's text to an installed CLI for a second opinion. Slower, and it
                  can only make the verdict stricter.
                </span>
              </span>
              <Switch checked={deepReview} onCheckedChange={setDeepReview} disabled={running} />
            </label>

            {deepReview && (
              <div className="space-y-1.5">
                <Label>CLI</Label>
                <Combobox
                  className="w-full"
                  value={cliId}
                  onChange={setCliId}
                  disabled={running}
                  placeholder="Choose a CLI"
                  options={[
                    { value: DEFAULT_CLI_VALUE, label: 'Default CLI (from Settings)' },
                    ...installedPromptClis.map((cli) => ({ value: cli.id, label: cli.label })),
                  ]}
                />
                {cliQuery.isFetched && installedPromptClis.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No CLI with a non-interactive mode was detected. Install one from CLI Manager,
                    or leave the deep review off and rely on the static scan.
                  </p>
                )}
              </div>
            )}
          </div>

          {running && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4 animate-spin" />
              {deepReview
                ? 'Scanning the files, then waiting on the CLI review. This can take a minute.'
                : 'Scanning the skill files…'}
            </p>
          )}

          {!running && shown && (
            <div className="space-y-3">
              {showingEarlierScan && (
                <p className="text-xs text-muted-foreground">
                  Showing the last check, from {new Date(shown.createdAt).toLocaleString()}.
                </p>
              )}
              <SkillAuditReport record={shown} />
            </div>
          )}

          {!running && !shown && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">This skill has not been checked yet.</p>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_RISK_CATEGORIES.map((category) => (
                  <Badge key={category.id} variant="outline">
                    {category.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {earlierChecks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Earlier checks</p>
              {earlierChecks.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left text-xs hover:bg-card"
                  onClick={() => setResult(entry)}
                >
                  <span className="text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.deepReview ? ` · ${entry.cliName ?? 'CLI'} review` : ''}
                  </span>
                  <SkillAuditVerdictBadge verdict={entry.verdict} score={entry.score} />
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          {running ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (requestId) void window.agentmat.skills.cancelAudit(requestId);
              }}
            >
              <X /> Cancel
            </Button>
          ) : (
            <Button type="button" disabled={!subject} onClick={() => auditMutation.mutate()}>
              <Shield /> {shown ? 'Check again' : 'Run security check'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
