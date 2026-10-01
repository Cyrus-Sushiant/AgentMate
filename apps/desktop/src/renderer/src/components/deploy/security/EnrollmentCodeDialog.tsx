import { coreErrorMessage } from '@shared/coreErrors';
import type { EnrollmentCodeInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { DeployServer } from '@shared/deployTypes';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Key, Spinner, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { clockTime, fromNow } from './format';
import type { StepUp } from './useStepUp';

const VALIDITY = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 8 * 60, label: '8 hours' },
  { minutes: 24 * 60, label: '24 hours' },
] as const;

/**
 * An Owner's single-use code that lets one more computer join the core as a user, together with
 * that user's password. The core keeps only the code's hash, so it is shown here once and is gone
 * when the dialog closes.
 */
export function EnrollmentCodeDialog({
  server,
  userName,
  self,
  open,
  onOpenChange,
  run,
}: {
  server: DeployServer;
  userName: string;
  /** The code is for the signed-in user, for another computer of theirs. */
  self: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: StepUp['run'];
}): React.JSX.Element {
  const validityId = useId();
  const [minutes, setMinutes] = useState<number>(VALIDITY[0].minutes);
  const [made, setMade] = useState<EnrollmentCodeInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinutes(VALIDITY[0].minutes);
    setMade(null);
    setProblem(null);
  }, [open]);

  async function make(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      const code = await run(() =>
        window.agentmat.deploySecurity.createEnrollmentCode({
          serverId: server.id,
          userName,
          validMinutes: minutes,
        }),
      );
      if (code) setMade(code);
    } catch (error) {
      setProblem(coreErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Enrollment code copied.');
    } catch {
      toast.error('Could not copy the enrollment code.');
    }
  }

  const whose = self ? 'your' : `${userName}'s`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            {self
              ? 'Enrollment code for another computer of yours'
              : `Enrollment code for ${userName}`}
          </DialogTitle>
          <DialogDescription>
            A code lets one more computer join {server.nickname} as {self ? 'you' : userName},
            together with {whose} password. It works once.
          </DialogDescription>
        </DialogHeader>

        {made ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/30 p-4 text-center">
              <p
                aria-label="Enrollment code"
                className="select-all break-all font-mono text-xl font-semibold tracking-wider text-foreground"
              >
                {made.code}
              </p>
              <p className="text-xs text-muted-foreground">
                Works once, until {clockTime(made.expiresAtUnixMs)} ({fromNow(made.expiresAtUnixMs)}
                ).
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Copy it now: this is the only time it is shown. Anyone with the code and {whose}{' '}
                password can enroll a computer until it is used or runs out.
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              On the other computer, save this server in Remote with an SSH login that is in the
              server's agentmate group, open Deploy, pick the server and choose Join with a code.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void copy(made.code)}>
                <Copy className="h-3.5 w-3.5" /> Copy the code
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={validityId}>Valid for</Label>
              <select
                id={validityId}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                className="h-9 w-full max-w-48 rounded-md border border-input bg-background px-2 text-sm"
              >
                {VALIDITY.map((option) => (
                  <option key={option.minutes} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {problem && (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void make()}>
                {busy && <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />} Make the code
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
