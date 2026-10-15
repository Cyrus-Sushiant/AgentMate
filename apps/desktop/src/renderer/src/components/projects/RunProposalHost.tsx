import type { RunProposal } from '@shared/apiTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Asks the user about each run command an AI agent suggested. One suggestion shows at a time, in
 * the order they arrived. Nothing is saved until the user chooses Add command, and nothing runs
 * until they press Run on the project. Escape counts as Discard.
 */
export function RunProposalHost(): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<RunProposal[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void window.agentmat.runProposals.list().then((list) => {
      if (active) setPending(list);
    });
    const unsubscribe = window.agentmat.runProposals.onChanged((changed) => {
      if (active) setPending(changed.pending);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const current = pending[0];
  if (!current) return null;

  async function decide(decision: 'add' | 'discard'): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.agentmat.runProposals.decide(current.id, decision);
      // AgentMate drops the suggestion either way, so it leaves the dialog either way.
      setPending((prev) => prev.filter((item) => item.id !== current.id));
      if (!result.ok) {
        toast.error(result.error);
      } else if (decision === 'add') {
        toast.success(`Added a run command to ${current.projectName}.`);
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      }
    } finally {
      setBusy(false);
    }
  }

  const title = current.label
    ? `Add "${current.label}" to ${current.projectName}?`
    : `Add a run command to ${current.projectName}?`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void decide('discard');
      }}
    >
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            An AI agent in this project suggested it. Nothing is saved or run until you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-6 py-5">
          <pre
            dir="ltr"
            className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed"
          >
            {current.command}
          </pre>
          {pending.length > 1 ? (
            <p className="text-xs text-muted-foreground">1 of {pending.length} suggestions</p>
          ) : null}
        </div>

        <DialogFooter className="items-center border-t border-border/70 bg-muted/20 px-6 py-3.5 sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Run it later from the project&apos;s Run button.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="soft"
              size="sm"
              disabled={busy}
              onClick={() => void decide('discard')}
            >
              Discard
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void decide('add')}>
              Add command
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
