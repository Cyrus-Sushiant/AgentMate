import { allGroups, findGroup, isWorktreeScope, type Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workspace } from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { ProjectPromptBuildDialog } from '@/components/projects/ProjectPromptBuildDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceProject } from '@/hooks/useWorktrees';
import { queryKeys } from '@/lib/queryKeys';
import { useTerminalSessionStore } from '@/lib/terminal/terminalRuntime';
import { cn } from '@/lib/utils';
import { usePromptDialogStore } from '@/lib/workspace/commands';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { GitPanel } from './git/GitPanel';
import { PaneTree } from './PaneTree';
import { ProjectRail } from './ProjectRail';
import {
  WorkspaceLoading,
  WorktreeDialogsHost,
  WorktreeMissingNotice,
  WorktreeWorkspaceGuards,
} from './worktrees/WorktreeHostParts';

function WorkspaceWelcome({
  projects,
  loading,
}: {
  projects: Project[];
  loading: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();
  const visible = projects.filter((p) => !p.archived);
  return (
    <div className="flex h-full w-full items-start justify-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]">
            <Workspace className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Pick a project to work on</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            Run agents and shells side by side in its folder, and watch every change they make land
            in the panel on the right.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
              ))
            : visible.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/workspace/${project.id}`)}
                  className="glass group flex items-center gap-3 rounded-xl p-3.5 text-left transition-all duration-150 hover:-translate-y-px hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
                >
                  <ProjectIcon
                    iconDataUrl={project.iconDataUrl}
                    bgColor={project.iconBgColor}
                    iconColor={project.iconColor}
                    className="h-10 w-10 rounded-xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{project.name}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {project.folderPath}
                    </span>
                  </span>
                </button>
              ))}
        </div>
        {!loading && visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No projects yet. Add one on the Projects page first.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shells that exit cleanly close their tab, like closing a terminal window. Agents and
 * failed commands keep theirs, so the last output stays readable until the user moves on.
 */
function useAutoCloseFinishedShells(): void {
  useEffect(() => {
    return useTerminalSessionStore.subscribe((state, previous) => {
      for (const [id, code] of Object.entries(state.ended)) {
        if (id in previous.ended || code !== 0) continue;
        const { workspaces, closeTab } = useWorkspaceStore.getState();
        for (const [projectId, ws] of Object.entries(workspaces)) {
          const tab = ws.tabs[id];
          if (tab?.kind === 'terminal' && !tab.cliId) closeTab(projectId, id);
        }
      }
    });
  }, []);
}

/**
 * Tells main which tabs are on screen, so an agent finishing in front of the user does not
 * also raise a notification, and looking at a finished tab counts as having seen it.
 */
function useReportViewing(visible: boolean): void {
  const signature = useWorkspaceStore((s) => {
    const ws = s.activeProjectId ? s.workspaces[s.activeProjectId] : undefined;
    if (!visible || !ws) return '|';
    const groups = ws.zoomedGroupId
      ? allGroups(ws.root).filter((g) => g.id === ws.zoomedGroupId)
      : allGroups(ws.root);
    const shown = groups.flatMap((g) => (g.activeTabId ? [g.activeTabId] : []));
    const focused = findGroup(ws.root, ws.focusedGroupId)?.activeTabId ?? '';
    return `${shown.join(',')}|${focused}`;
  });

  useEffect(() => {
    const report = (): void => {
      const [shown, focused] = signature.split('|');
      const hidden = document.visibilityState !== 'visible';
      void window.agentmat.agents.setViewing(
        hidden || !shown ? [] : shown.split(','),
        hidden ? null : focused || null,
      );
    };
    report();
    // Coming back to the window re-reports, which is what acknowledges a finished tab.
    window.addEventListener('focus', report);
    document.addEventListener('visibilitychange', report);
    return () => {
      window.removeEventListener('focus', report);
      document.removeEventListener('visibilitychange', report);
    };
  }, [signature]);
}

/**
 * The Workspace page. It is mounted once, beside the routed pages rather than inside them,
 * so leaving the page or switching projects never tears its terminals down.
 */
export function WorkspaceHost({ visible }: { visible: boolean }): React.JSX.Element {
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const workspace = useWorkspaceStore((s) =>
    s.activeProjectId ? s.workspaces[s.activeProjectId] : undefined,
  );
  const closeProject = useWorkspaceStore((s) => s.closeProject);
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const projects = projectsQuery.data ?? [];
  // The active id is a project's, or a worktree's scope id; either way this is what its panes,
  // git panel and launchers work on.
  const { project } = useWorkspaceProject(activeProjectId);
  const worktreePending = Boolean(activeProjectId && isWorktreeScope(activeProjectId) && !project);
  const missing = project?.worktree?.missing === true;

  useAutoCloseFinishedShells();
  useReportViewing(visible);

  // A project deleted elsewhere takes its workspace with it. This runs only when a fresh
  // project list arrives, never because the rail changed: a project opened a moment ago can
  // be missing from a cached list, and closing it would end its shells.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the list's fetch time on purpose
  useEffect(() => {
    if (!projectsQuery.data || projectsQuery.isFetching) return;
    const known = new Set(projectsQuery.data.map((p) => p.id));
    for (const id of useWorkspaceStore.getState().railProjectIds) {
      if (!known.has(id)) closeProject(id);
    }
  }, [projectsQuery.dataUpdatedAt]);

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex bg-background',
        visible ? 'workspace-enter' : 'hidden',
      )}
    >
      <ProjectRail
        projects={projects}
        activeProjectId={project || worktreePending ? activeProjectId : null}
      />
      <main className="relative flex min-h-0 min-w-0 flex-1 p-1.5">
        {project && workspace && missing ? (
          <WorktreeMissingNotice project={project} />
        ) : project && workspace ? (
          <PaneTree key={project.id} project={project} workspace={workspace} />
        ) : worktreePending ? (
          <WorkspaceLoading />
        ) : (
          <WorkspaceWelcome projects={projects} loading={projectsQuery.isPending} />
        )}
      </main>
      {project && workspace && !missing ? (
        <GitPanel key={project.id} project={project} visible={visible} />
      ) : null}
      <WorkspacePromptDialog projects={projects} />
      <WorktreeDialogsHost projects={projects} />
      <WorktreeWorkspaceGuards />
    </div>
  );
}

/** The Build Prompt dialog, opened from a pane's "+" menu so its result can run right there. */
function WorkspacePromptDialog({ projects }: { projects: Project[] }): React.JSX.Element | null {
  const projectId = usePromptDialogStore((s) => s.projectId);
  const groupId = usePromptDialogStore((s) => s.groupId);
  const close = usePromptDialogStore((s) => s.close);
  // Opened from a worktree's pane, the prompt is still the project's, but the agent runs there.
  const { project: workspaceProject } = useWorkspaceProject(projectId);
  const project = projects.find((p) => p.id === workspaceProject?.parentId);
  if (!project || !workspaceProject) return null;
  return (
    <ProjectPromptBuildDialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
      projectId={project.id}
      projectName={project.name}
      iconDataUrl={project.iconDataUrl}
      iconBgColor={project.iconBgColor}
      iconColor={project.iconColor}
      launchGroupId={groupId}
      launchProject={workspaceProject.worktree ? workspaceProject : null}
    />
  );
}
