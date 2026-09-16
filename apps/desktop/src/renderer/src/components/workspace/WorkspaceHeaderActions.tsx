import { configuredRunCommands, type Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Cpu, Run, Tag } from '@/components/icons';
import { useProjectRun } from '@/components/projects/useProjectRun';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { ProjectVersionDialogs } from '@/pages/ProjectDetailPage';
import { useRunningClisStore } from '@/stores/runningClisStore';
import { useVersionDialogStore } from '@/stores/versionDialogStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Run and Tag a version for the project open in the Workspace, beside the header's other
 * buttons. Run uses the general terminal, the same as the project page's Run button.
 */
export function WorkspaceHeaderActions(): React.JSX.Element | null {
  const navigate = useNavigate();
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const { requestRun, runPicker } = useProjectRun();
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

  return (
    <>
      <SimpleTooltip label={runLabel}>
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
                    label: 'Open project',
                    onClick: () => navigate(`/projects/${project.id}`),
                  },
                });
              },
            })
          }
        >
          <Run className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
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
      <ProjectVersionDialogs
        projectId={project.id}
        open={tagOpen}
        onOpenChange={(next) => (next ? openVersionDialog(project.id) : closeVersionDialog())}
      />
    </>
  );
}
