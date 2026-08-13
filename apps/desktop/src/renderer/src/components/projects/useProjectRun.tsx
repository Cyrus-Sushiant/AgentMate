import type { Project, ProjectRunCommand } from '@agentmat/core';
import { configuredRunCommands } from '@agentmat/core';
import { useState } from 'react';
import { toast } from 'sonner';
import { RunCommandPickerDialog } from '@/components/projects/RunCommandPickerDialog';
import { useTerminalStore } from '@/stores/terminalStore';

export function useProjectRun(): {
  requestRun: (project: Project, options?: { onEmpty?: () => void }) => void;
  runPicker: React.JSX.Element;
} {
  const openSession = useTerminalStore((s) => s.openSession);
  const [project, setProject] = useState<Project | null>(null);

  function execute(target: Project, command: ProjectRunCommand): void {
    openSession({
      title: target.name,
      cwd: target.folderPath,
      projectId: target.id,
      initialInput: command.command,
    });
    toast.info(`Press Enter in the terminal to run "${command.command}".`);
    setProject(null);
  }

  function requestRun(target: Project, options?: { onEmpty?: () => void }): void {
    const commands = configuredRunCommands(target);
    if (commands.length === 0) {
      options?.onEmpty?.();
      return;
    }
    if (commands.length === 1) {
      execute(target, commands[0]);
      return;
    }
    setProject(target);
  }

  return {
    requestRun,
    runPicker: (
      <RunCommandPickerDialog
        project={project}
        onOpenChange={(open) => {
          if (!open) setProject(null);
        }}
        onSelect={(command) => {
          if (project) execute(project, command);
        }}
      />
    ),
  };
}
