import type { Project, ProjectRunCommand } from '@agentmat/core';
import { configuredRunCommands, projectRunCommandTitle } from '@agentmat/core';
import { Play } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface RunCommandPickerDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (command: ProjectRunCommand) => void;
}

export function RunCommandPickerDialog({
  project,
  onOpenChange,
  onSelect,
}: RunCommandPickerDialogProps): React.JSX.Element {
  const commands = project ? configuredRunCommands(project) : [];

  return (
    <Dialog open={project != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Run command</DialogTitle>
          <DialogDescription>
            {project
              ? `Which command should ${project.name} start with?`
              : 'Choose a command to run.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {commands.map((entry) => {
            const title = projectRunCommandTitle(entry);
            const showCommand = entry.label.trim().length > 0;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry)}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  {showCommand ? (
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                      {entry.command}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
