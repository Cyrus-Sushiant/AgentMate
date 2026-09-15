import type { SshAgentMode } from '@shared/apiTypes';
import { useState } from 'react';
import { toast } from 'sonner';
import { Robot } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { startSshAgentTask, useSshAgentStore } from '@/stores/sshAgentStore';

const MODES: { value: SshAgentMode; label: string; description: string }[] = [
  {
    value: 'approve-all',
    label: 'Approve each command',
    description: 'Nothing runs until you click Run on it.',
  },
  {
    value: 'approve-risky',
    label: 'Auto, guard risky ones',
    description: 'Ordinary commands run right away; destructive-looking ones pause for you.',
  },
  {
    value: 'autonomous',
    label: 'Fully autonomous',
    description: 'Runs the whole task unattended. Just watch the terminal.',
  },
];

export function SshAskAiDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const lastMode = useSshAgentStore((s) => s.lastMode);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<SshAgentMode>(lastMode);
  const [starting, setStarting] = useState(false);

  async function handleStart(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || starting) return;
    setStarting(true);
    try {
      await startSshAgentTask(sessionId, trimmed, mode);
      setPrompt('');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Could not start the AI task.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Robot className="h-4 w-4" />
            Ask AI to run a task here
          </DialogTitle>
          <DialogDescription>
            Describe what you want done on this server. The AI runs real commands in this session,
            so you&apos;ll see everything it does live in the terminal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Check disk usage, then list the 5 largest files in /var/log"
            className="min-h-24 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleStart();
              }
            }}
          />
          <div className="flex flex-col gap-1.5">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  mode === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-foreground/5',
                )}
              >
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleStart()} disabled={!prompt.trim() || starting}>
            {starting ? 'Starting…' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
