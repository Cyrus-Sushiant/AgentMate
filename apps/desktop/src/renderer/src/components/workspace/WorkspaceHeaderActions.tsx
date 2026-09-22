import { configuredRunCommands, type Project, projectRunCommandTitle } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Cpu, FolderOpen, Pencil, Play, Run, Tag } from '@/components/icons';
import { useProjectRun } from '@/components/projects/useProjectRun';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { ProjectVersionDialogs } from '@/pages/ProjectDetailPage';
import { useRunningClisStore } from '@/stores/runningClisStore';
import { useVersionDialogStore } from '@/stores/versionDialogStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Run and Tag a version for the project open in the Workspace, beside the header's other
 * buttons. Run uses the general terminal, the same as the project page's Run button.
 * Right-clicking Run lists the project's commands and links to where they're edited.
 */
export function WorkspaceHeaderActions(): React.JSX.Element | null {
  const navigate = useNavigate();
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const { requestRun, runCommand, runPicker } = useProjectRun();
  const tagDialogProjectId = useVersionDialogStore((s) => s.openProjectId);
  const openVersionDialog = useVersionDialogStore((s) => s.open);
  const closeVersionDialog = useVersionDialogStore((s) => s.close);
  const runningClisOpen = useRunningClisStore((s) => s.open);
  const setRunningClisOpen = useRunningClisStore((s) => s.setOpen);
  const projectsQuery = useQuery<Project[]>({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const project = projectsQuery.data?.find((p) => p.id === activeProjectId);
  const tagOpen = tagDialogProjectId === activeProjectId;
  if (!project) return null;

  const commands = configuredRunCommands(project);
  const runLabel =
    commands.length === 1
      ? `Run ${project.name} (${commands[0]?.command})`
      : commands.length > 1
        ? `Run ${project.name}: pick a command`
        : `Set a run command for ${project.name}`;

  function editRunCommands(): void {
    if (project) navigate(`/projects/${project.id}?edit=run`);
  }

  return (
    <>
      <ContextMenu>
        <SimpleTooltip label={runLabel}>
          <ContextMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={runLabel}
              onClick={() =>
                requestRun(project, {
                  onEmpty: () => {
                    toast.info(`${project.name} has no run command yet`, {
                      description: 'Add one with Edit project on the project page.',
                      action: {
                        label: 'Edit run commands',
                        onClick: editRunCommands,
                      },
                    });
                  },
                })
              }
            >
              <Run className="h-4 w-4" />
            </Button>
          </ContextMenuTrigger>
        </SimpleTooltip>
        <ContextMenuContent className="max-w-[20rem]">
          {commands.length > 0 ? (
            <>
              <ContextMenuLabel>Run in {project.name}</ContextMenuLabel>
              {commands.map((entry) => {
                const title = projectRunCommandTitle(entry);
                const showCommand = entry.label.trim().length > 0;
                return (
                  <ContextMenuItem key={entry.id} onSelect={() => runCommand(project, entry)}>
                    <Play className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    {showCommand ? (
                      <span className="ml-auto max-w-[9rem] truncate pl-4 font-mono text-[11px] text-muted-foreground">
                        {entry.command}
                      </span>
                    ) : null}
                  </ContextMenuItem>
                );
              })}
              <ContextMenuSeparator />
            </>
          ) : (
            <ContextMenuLabel>No run commands yet</ContextMenuLabel>
          )}
          <ContextMenuItem onSelect={editRunCommands}>
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            {commands.length > 0 ? 'Edit run commands' : 'Add a run command'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <SimpleTooltip label={`Tag a version of ${project.name}`}>
        <Button
          variant={tagOpen ? 'secondary' : 'ghost'}
          size="icon"
          aria-label="Tag a version"
          onClick={() => openVersionDialog(project.id)}
        >
          <Tag className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label={`Open ${project.name}'s project details`}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Project details"
          onClick={() => navigate(`/projects/${project.id}`)}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label="Running CLIs: CPU and memory for every terminal">
        <Button
          variant={runningClisOpen ? 'secondary' : 'ghost'}
          size="icon"
          aria-label="Running CLIs"
          onClick={() => setRunningClisOpen(true)}
        >
          <Cpu className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
      {runPicker}
      {/* Keyed by project so each one gets its own form, suggestion and tag run. One shared
          instance let a project's pending answer or finished tag land in the next project. */}
      <ProjectVersionDialogs
        key={project.id}
        projectId={project.id}
        open={tagOpen}
        onOpenChange={(next) =>
          next ? openVersionDialog(project.id) : closeVersionDialog(project.id)
        }
      />
    </>
  );
}
