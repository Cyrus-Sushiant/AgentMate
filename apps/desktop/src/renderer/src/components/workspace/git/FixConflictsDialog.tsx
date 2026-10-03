import type { Project } from '@agentmat/core';
import type { WorkspaceGitState } from '@shared/apiTypes';
import { buildFixConflictsPrompt } from '@shared/conflictPrompts';
import { useState } from 'react';
import { Wand2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FixWithAiDialog } from '../FixWithAiDialog';

type ConflictState = Pick<
  WorkspaceGitState,
  'operation' | 'branch' | 'conflicts' | 'projectPrefix'
>;

/** Fix with AI for a stopped merge, rebase or other operation: every conflict in one prompt. */
export function FixConflictsDialog({
  project,
  state,
  open,
  onOpenChange,
}: {
  project: Project;
  state: ConflictState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const count = state.conflicts.length;
  const operation = state.operation
    ? state.operation.charAt(0).toUpperCase() + state.operation.slice(1)
    : null;
  const paths = state.conflicts
    .map((entry) => entry.path)
    .sort()
    .join(',');

  return (
    <FixWithAiDialog
      project={project}
      open={open}
      onOpenChange={onOpenChange}
      title="Fix conflicts with AI"
      description={[
        operation && state.branch ? `${operation} on ${state.branch}` : (operation ?? state.branch),
        `${count} conflicted file${count === 1 ? '' : 's'}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      jobKey={`conflict-fix:${project.id}:${state.operation ?? 'none'}:${paths}`}
      source={{ prompt: buildFixConflictsPrompt(state) }}
    />
  );
}

/** The "Fix with AI" button shown wherever conflicts block the user, with its dialog. */
export function FixConflictsButton({
  project,
  state,
  className,
}: {
  project: Project;
  state: ConflictState;
  className?: string;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (state.conflicts.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20',
          className,
        )}
      >
        <Wand2 className="h-2.5 w-2.5" />
        Fix with AI
      </button>
      {open ? (
        <FixConflictsDialog project={project} state={state} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
