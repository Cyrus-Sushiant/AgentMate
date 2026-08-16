import type {
  CliDefinition,
  DetectedClaudeHook,
  NotificationHookKind,
  Project,
  ProjectDraftStatus,
  ProjectGithubAction,
  ProjectNotificationHook,
  ProjectNotificationSettings,
  ScheduledTask,
} from '@agentmat/core';
import { CLI_REGISTRY, cliIdForTargetAI, configuredRunCommands, DIFFRAY_TOOL_ID } from '@agentmat/core';
import type { BootstrapResult, GitBranchInfo, GitStatus, GitTagInfo, SkillUpdateInfo } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CliLogo, cliOptionIcon } from '@/components/cliLogos';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Blocks,
  CalendarDays,
  Check,
  CircleCheck,
  CircleQuestion,
  CloudDownload,
  CloudUpload,
  Download,
  EllipsisVertical,
  FileCog,
  FileText,
  Folder,
  FolderTree,
  GitBranch,
  GitCommit,
  GitPullRequest,
  History,
  LinkOff,
  MessageSquare,
  Pencil,
  Play,
  Plug,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Spinner,
  Tag,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Wand2,
  X,
} from '@/components/icons';
import {
  type BootstrapDescription,
  BootstrapDescriptionDialog,
} from '@/components/projects/BootstrapDescriptionDialog';
import { DiffrayReviewLaunchCard, DiffrayReviewWizard } from '@/components/projects/DiffrayReviewWizard';
import { GitActionsCard } from '@/components/projects/GitActionsCard';
import { GitBranchHistoryDialog } from '@/components/projects/GitBranchHistoryDialog';
import { GitSetupWizard } from '@/components/projects/GitSetupWizard';
import { PackagesTab } from '@/components/projects/PackagesTab';
import {
  AGENT_TYPE_LABELS,
  isProjectSectionId,
  ProjectDetailHeader,
  ProjectDetailSkeleton,
  ProjectEmptyState,
  ProjectNotesCard,
  type ProjectSectionId,
  ProjectSectionNav,
  type SectionBadge,
} from '@/components/projects/ProjectDetailChrome';
import { ProjectFileBrowser } from '@/components/projects/ProjectFileBrowser';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
import { ProjectPromptDialog } from '@/components/projects/ProjectPromptDialog';
import { ProjectPromptHistory } from '@/components/projects/ProjectPromptHistory';
import { useProjectRun } from '@/components/projects/useProjectRun';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OverflowScroll } from '@/components/ui/overflow-scroll';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { persianTextProps } from '@/lib/rtl';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useCliStore } from '@/stores/cliStore';
import { confirmDialog } from '@/stores/confirmStore';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useShortcutLabel } from '@/stores/shortcutStore';
import { useTerminalStore } from '@/stores/terminalStore';

export default function ProjectDetailPage(): React.JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);
  const { requestRun, runPicker } = useProjectRun();
  const [editOpen, setEditOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const tabParam = searchParams.get('tab');
  const section: ProjectSectionId = isProjectSectionId(tabParam) ? tabParam : 'overview';

  function setSection(next: ProjectSectionId): void {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'overview') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    workspaceRef.current?.scrollIntoView({ block: 'nearest' });
  }, [section]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const project = projectsQuery.data?.find((p) => p.id === projectId);

  usePageHeader(project?.name ?? '', project ? AGENT_TYPE_LABELS[project.agentType] : undefined);

  const installedSkillsQuery = useQuery({
    queryKey: queryKeys.installedSkills(projectId ?? ''),
    queryFn: () => window.agentmat.skills.listInstalled(projectId!),
    enabled: !!projectId,
  });

  const skillUpdatesQuery = useQuery({
    queryKey: queryKeys.skillUpdates(projectId ?? ''),
    queryFn: () => window.agentmat.skills.checkForUpdates(projectId!),
    enabled: !!projectId && (installedSkillsQuery.data?.length ?? 0) > 0,
  });
  const skillUpdateBySkillId = new Map((skillUpdatesQuery.data ?? []).map((u) => [u.skillId, u]));

  // Shares its key with the Overview tab's drafts list, so both read one fetch.
  const draftsQuery = useQuery({
    queryKey: queryKeys.projectDrafts(projectId ?? ''),
    queryFn: () => window.agentmat.projectDrafts.listByProject(projectId!),
    enabled: !!projectId,
  });
  const openDraftCount = (draftsQuery.data ?? []).filter(
    (draft) => draft.status === 'draft',
  ).length;

  const installedMcpServersQuery = useQuery({
    queryKey: queryKeys.installedMcpServers(projectId ?? ''),
    queryFn: () => window.agentmat.mcp.listInstalled(projectId!),
    enabled: !!projectId,
  });

  const toolsStatusQuery = useQuery({
    queryKey: queryKeys.toolsStatus,
    queryFn: () => window.agentmat.tools.detectAll(),
  });
  const diffrayInstalled =
    toolsStatusQuery.data?.find((tool) => tool.id === DIFFRAY_TOOL_ID)?.installed === true;

  // The preload bridge is only attached when the window is created, so a
  // hot-reloaded renderer can outrun it. Feature-detect instead of calling
  // blind, which would throw a bare TypeError.
  const planBridgeReady = typeof window.agentmat?.projects?.bootstrapPlan === 'function';

  // Fetched from the main process rather than computed here, so the preview is
  // literally the plan that gets written. Keyed on the fields the plan derives
  // from, so editing the project's agent refreshes it.
  const bootstrapPlanQuery = useQuery({
    queryKey: [
      'bootstrap-plan',
      projectId,
      project?.agentType,
      project?.name,
      project?.description,
    ],
    queryFn: () => window.agentmat.projects.bootstrapPlan(projectId!),
    enabled: !!projectId && !!project && planBridgeReady,
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => window.agentmat.projects.update(projectId!, values),
    onSuccess: () => {
      toast.success('Project updated.');
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) => window.agentmat.projects.update(projectId!, { notes }),
    onSuccess: () => {
      toast.success('Notes saved.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null);
  const [describeOpen, setDescribeOpen] = useState(false);
  // Bumped on success so the file browser jumps back to the root and refetches.
  const [fileBrowserRevision, setFileBrowserRevision] = useState(0);

  const bootstrapMutation = useMutation({
    // The description is persisted on the project before scaffolding, because
    // the main process builds the file plan from the stored project, so
    // the preview, the written files, and the saved description can't disagree.
    mutationFn: async ({ description, translatedFrom }: BootstrapDescription) => {
      if (description !== project?.description) {
        await window.agentmat.projects.update(projectId!, { description });
      }
      if (translatedFrom) {
        try {
          await window.agentmat.promptHistory.add({
            rawInput: translatedFrom,
            promptType: 'Project description',
            targetAI: '',
            content: description,
            source: 'translate',
            projectId,
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.promptHistory });
        } catch {
          // Best-effort: losing the history entry shouldn't abort the bootstrap.
        }
      }
      return window.agentmat.projects.bootstrap(projectId!);
    },
    onSuccess: (raw) => {
      setDescribeOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      // The main process is bundled separately from this renderer, so a stale
      // Electron build can answer with an older shape. Normalize rather than
      // crash, and say so plainly; the fix is restarting `pnpm dev`.
      const stale = !raw?.agentLabel || !raw?.skippedFiles;
      const result: BootstrapResult = {
        agentLabel: raw?.agentLabel ?? 'the selected agent',
        createdFiles: raw?.createdFiles ?? [],
        skippedFiles: raw?.skippedFiles ?? [],
      };
      setBootstrapResult(result);

      if (stale) {
        toast.warning(
          'Bootstrapped with an outdated main process. Files may have gone to the old locations. Restart the app (pnpm dev) and run it again.',
        );
      } else {
        const skipped = result.skippedFiles.length
          ? ` ${result.skippedFiles.length} already existed.`
          : '';
        toast.success(
          `Created ${result.createdFiles.length} file(s) for ${result.agentLabel}.${skipped}`,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['project-dir'] });
      setFileBrowserRevision((n) => n + 1);
    },
    onError: (error: Error) => {
      setBootstrapResult(null);
      toast.error(`Bootstrap failed: ${error.message}`);
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) =>
      window.agentmat.skills.remove({ projectId: projectId!, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(projectId ?? '') });
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: (update: SkillUpdateInfo) =>
      window.agentmat.skills.install({
        projectId: projectId!,
        repositoryId: update.repositoryId,
        skillId: update.skillId,
      }),
    onSuccess: (_data, update) => {
      toast.success(`Updated ${update.skillId} to v${update.latestVersion}.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(projectId ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillUpdates(projectId ?? '') });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMcpServerMutation = useMutation({
    mutationFn: (serverId: string) =>
      window.agentmat.mcp.remove({ projectId: projectId!, serverId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.installedMcpServers(projectId ?? ''),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => window.agentmat.projects.delete(projectId!),
    onSuccess: () => {
      toast.success('Project removed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      navigate('/projects');
    },
  });

  async function handleCopyPath(): Promise<void> {
    if (!project) return;
    await navigator.clipboard.writeText(project.folderPath);
    toast.success('Path copied to clipboard.');
  }

  async function handleOpenInFileExplorer(): Promise<void> {
    if (!project) return;
    try {
      await window.agentmat.shell.openPath(project.folderPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open folder.');
    }
  }

  function handleOpenTerminalHere(): void {
    if (!project) return;
    openSession({ title: project.name, cwd: project.folderPath, projectId: project.id });
  }

  function handleRun(): void {
    if (!project) return;
    requestRun(project);
  }

  function handleDelete(): void {
    if (!project) return;
    void confirmDialog({
      title: `Remove "${project.name}"?`,
      description: 'This removes it from AgentMate. Files on disk are kept.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    }).then((confirmed) => {
      if (confirmed) deleteMutation.mutate();
    });
  }

  const skillUpdateCount = (skillUpdatesQuery.data ?? []).filter((u) => u.hasUpdate).length;
  const sectionBadges = useMemo((): Partial<Record<ProjectSectionId, SectionBadge>> => {
    const badges: Partial<Record<ProjectSectionId, SectionBadge>> = {};
    const skillCount = installedSkillsQuery.data?.length ?? 0;
    const mcpCount = installedMcpServersQuery.data?.length ?? 0;
    if (openDraftCount > 0) badges.overview = { count: openDraftCount };
    if (skillCount > 0) badges.skills = { count: skillCount, attention: skillUpdateCount > 0 };
    if (mcpCount > 0) badges.mcp = { count: mcpCount };
    return badges;
  }, [installedMcpServersQuery.data, installedSkillsQuery.data, openDraftCount, skillUpdateCount]);

  if (projectsQuery.isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="-ml-2">
          <ArrowLeft /> Back to Projects
        </Button>
        <ProjectEmptyState
          icon={FileText}
          title="Project not found"
          description="It may have been removed, or this link is out of date."
          action={
            <Button variant="outline" onClick={() => navigate('/projects')}>
              <ArrowLeft /> Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col gap-5 p-6">
      <ProjectDetailHeader
        project={project}
        onBack={() => navigate('/projects')}
        onRun={handleRun}
        onPrompt={() => setPromptOpen(true)}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
        onCopyPath={() => void handleCopyPath()}
        onOpenFolder={() => void handleOpenInFileExplorer()}
        onOpenTerminal={handleOpenTerminalHere}
      />

      <div
        ref={workspaceRef}
        className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start"
      >
        <ProjectSectionNav
          section={section}
          onSectionChange={setSection}
          badges={sectionBadges}
          createdAt={project.createdAt}
          updatedAt={project.updatedAt}
          hiddenIds={diffrayInstalled ? [] : ['review']}
        />

        <div className="min-w-0 flex-1">
          {section === 'overview' && (
            <div className="space-y-5">
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-medium text-muted-foreground">Standing prompt</h2>
                  <Button variant="ghost" size="sm" onClick={() => setPromptOpen(true)}>
                    <MessageSquare /> {project.prompt ? 'Edit prompt' : 'Define prompt'}
                  </Button>
                </div>
                {project.prompt ? (
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm leading-relaxed">
                    {project.prompt}
                  </p>
                ) : (
                  <ProjectEmptyState
                    icon={MessageSquare}
                    title="No standing prompt"
                    description="Set the context agents should start from every time they work on this project."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setPromptOpen(true)}>
                        <MessageSquare /> Define prompt
                      </Button>
                    }
                  />
                )}
              </section>

              <ProjectNotesCard
                notes={project.notes}
                onSave={(notes) => notesMutation.mutate(notes)}
                saving={notesMutation.isPending}
              />

              <DiffrayReviewLaunchCard
                installed={diffrayInstalled}
                onOpen={() => setSection('review')}
              />

              <DraftsSection projectId={project.id} />
            </div>
          )}

          {section === 'bootstrap' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {bootstrapPlanQuery.data ? (
                    <>
                      Scaffolds this project the way{' '}
                      <span className="font-medium">{bootstrapPlanQuery.data.agentLabel}</span>{' '}
                      expects it, following{' '}
                      <a
                        href={bootstrapPlanQuery.data.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        its own documented layout
                      </a>
                      . Existing files are never overwritten.
                    </>
                  ) : (
                    'Scaffolds this project the way its agent expects it. Existing files are never overwritten.'
                  )}
                </p>
                <Button
                  className="shrink-0"
                  onClick={() => setDescribeOpen(true)}
                  disabled={
                    bootstrapMutation.isPending || (planBridgeReady && !bootstrapPlanQuery.data)
                  }
                >
                  <Wand2 />
                  {bootstrapMutation.isPending ? 'Bootstrapping…' : 'Bootstrap Project'}
                </Button>
              </div>

              {bootstrapMutation.isError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  Bootstrap failed: {(bootstrapMutation.error as Error).message}
                </p>
              )}

              <div className="rounded-md border bg-muted/30 p-3">
                {bootstrapResult ? (
                  <>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Result</p>
                    <ul className="space-y-0.5 font-mono text-xs">
                      {[
                        ...bootstrapResult.createdFiles.map((f) => ({ path: f, created: true })),
                        ...bootstrapResult.skippedFiles.map((f) => ({ path: f, created: false })),
                      ].map((file) => (
                        <li
                          key={file.path}
                          className={file.created ? 'text-foreground' : 'text-muted-foreground'}
                        >
                          {file.created ? '+ ' : '· '}
                          {file.path}
                          {file.created ? '' : ' (already existed)'}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : !planBridgeReady ? (
                  <p className="text-xs text-muted-foreground">
                    Preview unavailable. This window is running an older preload script. Fully quit
                    the app and start it again (<code className="font-mono">pnpm dev</code>) to see
                    it. Bootstrapping still works.
                  </p>
                ) : bootstrapPlanQuery.isError ? (
                  <p className="text-xs text-destructive">
                    Could not load the plan: {(bootstrapPlanQuery.error as Error).message}
                  </p>
                ) : bootstrapPlanQuery.isPending ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Files it will create
                    </p>
                    <ul className="space-y-0.5 font-mono text-xs text-muted-foreground">
                      {bootstrapPlanQuery.data?.files.map((file) => (
                        <li key={file.relativePath}>{file.relativePath}</li>
                      ))}
                    </ul>
                    <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">
                      Folders it will create
                    </p>
                    <ul className="space-y-0.5 font-mono text-xs text-muted-foreground">
                      {bootstrapPlanQuery.data?.folders.map((folder) => (
                        <li key={folder}>{folder}/</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderTree className="h-3.5 w-3.5" /> Browse and edit project files
              </div>
              <ProjectFileBrowser rootPath={project.folderPath} revision={fileBrowserRevision} />
            </div>
          )}

          {section === 'prompts' && <ProjectPromptHistory projectId={project.id} />}

          {section === 'skills' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Skills installed into this project.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/skills?projectId=${project.id}`)}
                >
                  <Blocks /> Browse marketplace
                </Button>
              </div>
              {installedSkillsQuery.data?.length === 0 ? (
                <ProjectEmptyState
                  icon={Blocks}
                  title="No skills installed"
                  description="Pull skills from the marketplace so agents on this project can use them."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/skills?projectId=${project.id}`)}
                    >
                      <Blocks /> Browse marketplace
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {installedSkillsQuery.data?.map((skill) => {
                    const update = skillUpdateBySkillId.get(skill.skillId);
                    return (
                      <div
                        key={skill.skillId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{skill.skillId}</p>
                          <p className="text-xs text-muted-foreground">v{skill.version}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {update?.hasUpdate && (
                            <>
                              <Badge variant="warning">v{update.latestVersion} available</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  updateSkillMutation.isPending &&
                                  updateSkillMutation.variables?.skillId === skill.skillId
                                }
                                onClick={() => updateSkillMutation.mutate(update)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Update
                              </Button>
                            </>
                          )}
                          <SimpleTooltip label={`Remove ${skill.skillId}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${skill.skillId}`}
                              onClick={() => {
                                void confirmDialog({
                                  title: `Remove "${skill.skillId}"?`,
                                  description: 'This removes it from this project.',
                                  confirmLabel: 'Remove',
                                  variant: 'destructive',
                                }).then((confirmed) => {
                                  if (confirmed) removeSkillMutation.mutate(skill.skillId);
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </SimpleTooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'mcp' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  MCP servers installed into this project.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/mcp?projectId=${project.id}`)}
                >
                  <Plug /> Browse marketplace
                </Button>
              </div>
              {installedMcpServersQuery.data?.length === 0 ? (
                <ProjectEmptyState
                  icon={Plug}
                  title="No MCP servers installed"
                  description="Install servers from the marketplace to give this project's agents extra tools."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/mcp?projectId=${project.id}`)}
                    >
                      <Plug /> Browse marketplace
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {installedMcpServersQuery.data?.map((server) => (
                    <div
                      key={server.serverId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{server.serverId}</p>
                        <p className="text-xs text-muted-foreground">v{server.version}</p>
                      </div>
                      <SimpleTooltip label={`Remove ${server.serverId}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${server.serverId}`}
                          onClick={() => {
                            void confirmDialog({
                              title: `Remove "${server.serverId}"?`,
                              description: 'This removes it from this project.',
                              confirmLabel: 'Remove',
                              variant: 'destructive',
                            }).then((confirmed) => {
                              if (confirmed) removeMcpServerMutation.mutate(server.serverId);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </SimpleTooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'packages' && <PackagesTab projectId={project.id} />}

          {section === 'git' && (
            <GitTab
              projectId={project.id}
              folderPath={project.folderPath}
              watchedActions={project.githubActions ?? []}
              diffrayInstalled={diffrayInstalled}
              onReviewWithDiffray={() => setSection('review')}
            />
          )}

          {section === 'review' && (
            <DiffrayReviewWizard
              key={project.id}
              projectId={project.id}
              projectName={project.name}
              folderPath={project.folderPath}
              agentType={project.agentType}
              installed={diffrayInstalled}
            />
          )}

          {section === 'schedule' && <ScheduleTab projectId={project.id} />}

          {section === 'hooks' && <HooksTab project={project} />}

          {section === 'terminal' && (
            <ProjectTerminalSection
              project={project}
              onOpenHere={() =>
                openSession({
                  title: project.name,
                  cwd: project.folderPath,
                  projectId: project.id,
                })
              }
              onRun={handleRun}
              onSetRun={() => setEditOpen(true)}
            />
          )}

          {section === 'config' && <ProjectConfigEditor projectFolderPath={project.folderPath} />}
        </div>
      </div>

      <ProjectPromptDialog project={project} open={promptOpen} onOpenChange={setPromptOpen} />

      <BootstrapDescriptionDialog
        project={project}
        open={describeOpen}
        onOpenChange={setDescribeOpen}
        onConfirm={(result) => bootstrapMutation.mutate(result)}
        pending={bootstrapMutation.isPending}
      />

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={project}
        onSubmit={(values) => updateMutation.mutate(values)}
        isSubmitting={updateMutation.isPending}
      />
      {runPicker}
    </div>
  );
}

function ProjectTerminalSection({
  project,
  onOpenHere,
  onRun,
  onSetRun,
}: {
  project: Project;
  onOpenHere: () => void;
  onRun: () => void;
  onSetRun: () => void;
}): React.JSX.Element {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const openDrawer = useTerminalStore((s) => s.openDrawer);
  const terminalShortcut = useShortcutLabel('terminal.toggle');
  const runCommands = configuredRunCommands(project);
  const projectSessions = sessions.filter((session) => session.projectId === project.id);

  function showSession(id: string): void {
    setActiveSession(id);
    openDrawer();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-start gap-3 border-b border-border bg-card/80 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TerminalSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Project terminal</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Opens in this folder. Hide the panel from the top bar and the shell keeps running.
          </p>
          <p className="mt-2 flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground">
            <Folder className="h-3 w-3 shrink-0" />
            {project.folderPath}
          </p>
        </div>
      </div>

      {projectSessions.length > 0 && (
        <div className="space-y-1.5 border-b border-border px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Open here
          </p>
          {projectSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => showSession(session.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
                session.id === activeSessionId && 'bg-primary/10',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  session.id === activeSessionId
                    ? 'terminal-live-dot bg-primary shadow-[0_0_6px_hsl(var(--primary))]'
                    : 'bg-foreground/25',
                )}
              />
              <span className="min-w-0 flex-1 truncate">{session.title}</span>
              <span className="text-xs text-muted-foreground">Show</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <Button onClick={onOpenHere}>
          <TerminalSquare /> Open terminal here
        </Button>
        {runCommands.length > 0 ? (
          <Button variant="outline" onClick={onRun}>
            <Play /> {runCommands.length === 1 ? `Run ${runCommands[0].command}` : 'Run'}
          </Button>
        ) : (
          <Button variant="outline" onClick={onSetRun}>
            Set a run command
          </Button>
        )}
        {terminalShortcut ? (
          <span className="text-xs text-muted-foreground">
            {terminalShortcut} toggles the panel
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ProjectConfigEditor({
  projectFolderPath,
}: {
  projectFolderPath: string;
}): React.JSX.Element {
  const configPath = `${projectFolderPath}/.agentmate/config.json`;
  const [content, setContent] = useState('{}');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.agentmat.fs
      .readFile(configPath)
      .catch(() => '{}')
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configPath]);

  async function handleSave(): Promise<void> {
    try {
      JSON.parse(content);
    } catch {
      toast.error('Config must be valid JSON.');
      return;
    }
    await window.agentmat.fs.writeFile(configPath, content);
    toast.success('Config saved.');
  }

  if (!loaded) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileCog className="h-3.5 w-3.5" /> .agentmate/config.json
        </div>
        <Button size="sm" onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
      <MonacoEditor
        value={content}
        onChange={setContent}
        language="json"
        className="min-h-[320px]"
      />
    </div>
  );
}

/** `${sourceFile}:${event}:${groupIndex}:${hookIndex}` → the settings file this hook lives in. */
function sourceFileLabel(hookId: string): string {
  return hookId.split(':')[0] ?? 'settings.json';
}

/**
 * The hook's agent logo. These hooks all live in Claude Code's settings files, so anything
 * unrecognized is attributed to Claude Code rather than shown as a generic bell.
 */
function HookAgentIcon({
  cliId,
  className,
}: {
  cliId?: string;
  className?: string;
}): React.JSX.Element {
  const known = cliId != null && CLI_REGISTRY.some((c) => c.id === cliId);
  return <CliLogo cliId={known ? cliId : 'claude-code'} className={className} />;
}

/** Best-effort one-line summary of a raw hook body for the list view (command + args, if present). */
function summarizeHook(hook: Record<string, unknown>): string {
  const command = typeof hook.command === 'string' ? hook.command : '';
  const args = Array.isArray(hook.args)
    ? hook.args.filter((a): a is string => typeof a === 'string')
    : [];
  return [command, ...args].filter(Boolean).join(' ') || '(empty command)';
}

function EditClaudeHookDialog({
  projectId,
  hook,
  onOpenChange,
}: {
  projectId: string;
  hook: DetectedClaudeHook | null;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [hookJson, setHookJson] = useState('');
  const [matcher, setMatcher] = useState('');

  useEffect(() => {
    if (hook) {
      setHookJson(JSON.stringify(hook.hook, null, 2));
      setMatcher(hook.matcher ?? '');
    }
  }, [hook]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!hook) return Promise.resolve();
      let parsed: unknown;
      try {
        parsed = JSON.parse(hookJson);
      } catch {
        throw new Error('Hook body must be valid JSON.');
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Hook body must be a JSON object.');
      }
      return window.agentmat.projects.updateClaudeHook(projectId, hook.id, {
        hook: parsed as Record<string, unknown>,
        matcher: matcher || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Hook updated.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.claudeHooks(projectId) });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update hook.');
    },
  });

  return (
    <Dialog open={!!hook} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit hook</DialogTitle>
          <DialogDescription>
            {hook?.event} hook in .claude/{hook ? sourceFileLabel(hook.id) : 'settings.json'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Matcher</Label>
            <Input
              value={matcher}
              onChange={(e) => setMatcher(e.target.value)}
              placeholder="Optional tool/event matcher"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hook body (JSON)</Label>
            <Textarea
              value={hookJson}
              onChange={(e) => setHookJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={updateMutation.isPending || !hookJson.trim()}
            onClick={() => updateMutation.mutate()}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Prompt Builder drafts parked on this project, shown with the parameters each was built with
 * so the project's Overview says what was planned, and lets you flip one to implemented.
 */
function DraftsSection({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const draftsQuery = useQuery({
    queryKey: queryKeys.projectDrafts(projectId),
    queryFn: () => window.agentmat.projectDrafts.listByProject(projectId),
  });

  // Newest first, since the draft just saved from Prompt Builder is the one you came here for.
  const drafts = [...(draftsQuery.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectDrafts(projectId) });
  }

  const updateStatusMutation = useMutation({
    mutationFn: (params: { draftId: string; status: ProjectDraftStatus }) =>
      window.agentmat.projectDrafts.updateStatus(params.draftId, params.status),
    onSuccess: (_result, params) => {
      toast.success(params.status === 'implemented' ? 'Marked as implemented.' : 'Draft reopened.');
      invalidate();
    },
    onError: () => toast.error('Could not update the draft.'),
  });

  const removeMutation = useMutation({
    mutationFn: (draftId: string) => window.agentmat.projectDrafts.remove(draftId),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Drafts
        </p>
        <p className="text-xs text-muted-foreground">
          Requests parked on this project from Prompt Builder, with the parameters they were built
          with. Mark one implemented once it has shipped.
        </p>
      </div>

      {draftsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : drafts.length === 0 ? (
        <ProjectEmptyState
          icon={FileText}
          title="No drafts yet"
          description='In Prompt Builder, set Status to "Draft", pick this project, and save.'
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/prompt-builder')}>
              Open Prompt Builder
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const implemented = draft.status === 'implemented';
            const expanded = expandedId === draft.id;
            return (
              <div
                key={draft.id}
                className="space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={implemented ? 'success' : 'warning'} className="capitalize">
                      {draft.status}
                    </Badge>
                    {draft.promptType && <Badge variant="secondary">{draft.promptType}</Badge>}
                    {draft.targetAI && <Badge variant="outline">{draft.targetAI}</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {implemented && draft.implementedAt
                        ? `Implemented ${timeAgo(draft.implementedAt)}`
                        : `Added ${timeAgo(draft.createdAt)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <SimpleTooltip
                      label={implemented ? 'Reopen draft' : 'Mark implemented'}
                      wrapTrigger={updateStatusMutation.isPending}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            draftId: draft.id,
                            status: implemented ? 'draft' : 'implemented',
                          })
                        }
                      >
                        {implemented ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </SimpleTooltip>
                    <SimpleTooltip label="Delete draft">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          void confirmDialog({
                            title: 'Delete this draft?',
                            description: 'It will be removed from this project.',
                            confirmLabel: 'Delete',
                            variant: 'destructive',
                          }).then((confirmed) => {
                            if (confirmed) removeMutation.mutate(draft.id);
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  </div>
                </div>

                <p
                  dir={persianTextProps(draft.rawInput).dir}
                  className={cn(
                    'whitespace-pre-wrap text-xs',
                    implemented ? 'text-muted-foreground' : '',
                    persianTextProps(draft.rawInput).className,
                  )}
                >
                  {draft.rawInput || '(no description)'}
                </p>

                {draft.content && (
                  <>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      onClick={() => setExpandedId(expanded ? null : draft.id)}
                    >
                      {expanded ? 'Hide generated prompt' : 'Show generated prompt'}
                    </button>
                    {expanded && (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
                        {draft.content}
                      </pre>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusBadgeVariant(
  status: ScheduledTask['status'],
): 'warning' | 'success' | 'destructive' {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'warning';
}

function ScheduleTab({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openSession = useTerminalStore((s) => s.openSession);
  const defaultCliId = useCliStore((s) => s.defaultCliId);

  const tasksQuery = useQuery({
    queryKey: queryKeys.scheduledTasks(projectId),
    queryFn: () => window.agentmat.scheduledTasks.listByProject(projectId),
  });

  const tasks = [...(tasksQuery.data ?? [])].sort((a, b) => a.runAt.localeCompare(b.runAt));

  const updateStatusMutation = useMutation({
    mutationFn: (params: { taskId: string; status: ScheduledTask['status'] }) =>
      window.agentmat.scheduledTasks.updateStatus(params.taskId, params.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks(projectId) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (taskId: string) => window.agentmat.scheduledTasks.remove(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks(projectId) });
    },
  });

  async function handleRun(task: ScheduledTask): Promise<void> {
    const cliId = defaultCliId ?? cliIdForTargetAI(task.targetAI);
    const cliDef = CLI_REGISTRY.find((c) => c.id === cliId);
    if (!cliDef) {
      toast.error('No CLI available for this task. Set a default CLI in Settings.');
      return;
    }
    const filePath = await window.agentmat.fs.writeScratchFile(
      `scheduled-task-${task.id}.md`,
      task.content,
    );
    const executable = cliDef.executableNames[0];
    const command =
      window.agentmat.platform === 'win32'
        ? `& ${executable} (Get-Content -Raw -LiteralPath "${filePath}")`
        : `${executable} "$(cat '${filePath}')"`;
    openSession({ title: cliDef.name, initialInput: command });
    updateStatusMutation.mutate({ taskId: task.id, status: 'completed' });
  }

  if (tasksQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <ProjectEmptyState
        icon={CalendarDays}
        title="No scheduled tasks"
        description='Build a series from Prompt Builder by setting Status to "Scheduled" and choosing this project.'
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/prompt-builder')}>
            Open Prompt Builder
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(task.runAt).toLocaleString()}
              <Badge variant={statusBadgeVariant(task.status)} className="ml-1 capitalize">
                {task.status}
              </Badge>
              <Badge variant="outline">{task.targetAI}</Badge>
            </div>
            <div className="flex items-center gap-1">
              {task.status === 'pending' && (
                <>
                  <SimpleTooltip label="Run now">
                    <Button variant="ghost" size="icon" onClick={() => void handleRun(task)}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip label="Mark completed">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateStatusMutation.mutate({ taskId: task.id, status: 'completed' })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip label="Cancel">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateStatusMutation.mutate({ taskId: task.id, status: 'cancelled' })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </>
              )}
              <SimpleTooltip label="Delete">
                <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(task.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.rawInput}</p>
        </div>
      ))}
    </div>
  );
}

/** Strips markdown fences/quotes and collapses to a single line, for AI-suggested branch names. */
function sanitizeBranchName(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`/g, '')
    .split('\n')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function gitBranchOptions(
  branches: GitBranchInfo[],
  current: string | null,
  defaultBranch: string | null,
): ComboboxOption[] {
  return [...branches]
    .sort((a, b) => {
      if (a.name === current) return -1;
      if (b.name === current) return 1;
      if (a.name === defaultBranch) return -1;
      if (b.name === defaultBranch) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((branch) => {
      const tags: string[] = [];
      if (branch.name === defaultBranch) tags.push('default');
      if (!branch.local && branch.remote) tags.push('remote');
      return {
        value: branch.name,
        label: tags.length > 0 ? `${branch.name} · ${tags.join(' · ')}` : branch.name,
        keywords: [
          branch.name,
          ...tags,
          branch.local ? 'local' : '',
          branch.remote ? 'remote' : '',
          !branch.local && branch.remote ? 'pull' : '',
        ].filter(Boolean),
        icon:
          !branch.local && branch.remote ? (
            <CloudDownload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ),
      };
    });
}

/** Strips markdown fences/quotes but keeps line breaks, for AI-suggested commit messages. */
function sanitizeCommitMessage(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

type GitFileKind = 'untracked' | 'deleted' | 'added' | 'renamed' | 'modified';

function gitFileKind(x: string, y: string): GitFileKind {
  const code = `${x}${y}`.trim();
  if (code === '??') return 'untracked';
  if (code.includes('D')) return 'deleted';
  if (code.includes('A')) return 'added';
  if (code.includes('R')) return 'renamed';
  return 'modified';
}

function GitStatusBadge({ kind }: { kind: GitFileKind }): React.JSX.Element {
  const variant =
    kind === 'deleted'
      ? 'destructive'
      : kind === 'added'
        ? 'success'
        : kind === 'modified'
          ? 'warning'
          : 'outline';
  return (
    <Badge variant={variant} className="shrink-0 font-mono text-[10px] uppercase tracking-wide">
      {kind}
    </Badge>
  );
}

function splitGitPath(path: string): { dir: string; name: string } {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (i < 0) return { dir: '', name: path };
  return { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}

/** CLI transcripts often arrive with color codes that a dialog cannot render. */
function displayCliOutput(raw: string): string {
  return raw
    .replace(/\u001B\[[?]?\d*(?:;\d+)*[a-zA-Z]/g, '')
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSemverTag(
  tag: string,
): { prefix: string; major: number; minor: number; patch: number } | null {
  const match = tag.trim().match(/^(v?)(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  return {
    prefix: match[1] ?? '',
    major: Number(match[2]),
    minor: Number(match[3]),
    patch: Number(match[4]),
  };
}

function bumpSemverTag(latestTag: string | null, kind: 'major' | 'minor' | 'patch'): string {
  const parsed = latestTag
    ? parseSemverTag(latestTag)
    : { prefix: 'v', major: 0, minor: 0, patch: 0 };
  const prefix = parsed?.prefix ?? 'v';
  if (!parsed) {
    if (kind === 'major') return `${prefix}1.0.0`;
    if (kind === 'minor') return `${prefix}0.1.0`;
    return `${prefix}0.0.1`;
  }
  if (kind === 'major') return `${prefix}${parsed.major + 1}.0.0`;
  if (kind === 'minor') return `${prefix}${parsed.major}.${parsed.minor + 1}.0`;
  return `${prefix}${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function GitIconWell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {children}
    </div>
  );
}

/**
 * One button for both halves of an AI call. Idle, it asks. While the request runs it
 * keeps reporting progress (spinner plus what it is doing) and carries a red ✕ that
 * cancels, so the work stays visible and stoppable from the spot it was started.
 */
function AiSuggestButton({
  pending,
  onStart,
  onCancel,
  disabled,
  size,
  label,
  pendingLabel,
  pendingTooltip,
}: {
  pending: boolean;
  onStart: () => void;
  onCancel: () => void;
  disabled?: boolean;
  size?: 'sm';
  label: string;
  /** What the AI is doing right now, e.g. "Thinking…". */
  pendingLabel: string;
  pendingTooltip: string;
}): React.JSX.Element {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (pending) {
    return (
      <SimpleTooltip label={pendingTooltip}>
        <Button
          variant="outline"
          size={size}
          onClick={onCancel}
          aria-label={`${pendingLabel} Click to cancel.`}
          className="border-destructive/40 hover:bg-destructive/10"
        >
          <Spinner className={`${iconSize} animate-spin`} />
          {pendingLabel}
          <X className={`${iconSize} text-destructive`} />
        </Button>
      </SimpleTooltip>
    );
  }

  return (
    <Button variant="outline" size={size} disabled={disabled} onClick={onStart}>
      <Sparkles className={iconSize} /> {label}
    </Button>
  );
}

/**
 * Git writes report progress in the button the user clicked, so they opt out of the
 * app-wide loading overlay (see `useAppLoadingOverlay`). Blanking the whole page for a
 * push hides the branch, the file list and the status badges the user is reading.
 */
const GIT_OP_META = { silentLoading: true } as const;

/**
 * A git action button that carries its own progress: the icon swaps for a spinner and
 * the label says what is happening, so the page around it stays readable.
 */
function GitOpButton({
  icon: Icon,
  label,
  pendingLabel,
  pending,
  disabled,
  onClick,
  variant,
  size,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  /** What this button is doing right now, e.g. "Pushing…". */
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'outline' | 'destructive';
  size?: 'sm';
}): React.JSX.Element {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || pending}
      onClick={onClick}
      aria-busy={pending}
    >
      {pending ? (
        <Spinner className={`${iconSize} animate-spin`} />
      ) : (
        Icon && <Icon className={iconSize} />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function GitTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

function GitTab({
  projectId,
  folderPath,
  watchedActions,
  diffrayInstalled,
  onReviewWithDiffray,
}: {
  projectId: string;
  folderPath: string;
  watchedActions: ProjectGithubAction[];
  diffrayInstalled: boolean;
  onReviewWithDiffray: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();

  const [setupOpen, setSetupOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [defaultBranchPick, setDefaultBranchPick] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [suggestingBranch, setSuggestingBranch] = useState(false);
  const [suggestingCommit, setSuggestingCommit] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [applyVersionTag, setApplyVersionTag] = useState<string | null>(null);
  const [historyBranch, setHistoryBranch] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<GitBranchInfo | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [renameRemote, setRenameRemote] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GitBranchInfo | null>(null);
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [deleteForce, setDeleteForce] = useState(false);
  const branchRequestRef = useRef<string | null>(null);
  const commitRequestRef = useRef<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.gitStatus(projectId),
    queryFn: () => window.agentmat.git.status(projectId),
  });

  const tagsQuery = useQuery({
    queryKey: queryKeys.gitTags(projectId),
    queryFn: () => window.agentmat.git.tags(projectId),
    enabled: statusQuery.data?.isRepo === true,
  });

  function invalidateStatus(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
  }

  function reportOpResult(result: { ok: boolean; message: string }): void {
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    invalidateStatus();
  }

  const fetchMutation = useMutation({
    mutationFn: () => window.agentmat.git.fetch(projectId),
    onSuccess: reportOpResult,
    meta: GIT_OP_META,
  });
  const pullMutation = useMutation({
    mutationFn: () => window.agentmat.git.pull(projectId),
    onSuccess: reportOpResult,
    meta: GIT_OP_META,
  });
  const pushMutation = useMutation({
    mutationFn: () => window.agentmat.git.push(projectId),
    onSuccess: (result) => {
      reportOpResult(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.pipelineStatus(projectId) });
    },
    meta: GIT_OP_META,
  });
  const syncMutation = useMutation({
    mutationFn: () => window.agentmat.git.sync(projectId),
    onSuccess: (result) => {
      reportOpResult(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.pipelineStatus(projectId) });
    },
    meta: GIT_OP_META,
  });
  const createBranchMutation = useMutation({
    mutationFn: (name: string) => window.agentmat.git.createBranch(projectId, name),
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) setBranchName('');
    },
    meta: GIT_OP_META,
  });
  const checkoutBranchMutation = useMutation({
    mutationFn: (name: string) => window.agentmat.git.checkoutBranch(projectId, name),
    onSuccess: reportOpResult,
    meta: GIT_OP_META,
  });
  const setDefaultBranchMutation = useMutation({
    mutationFn: (name: string) => window.agentmat.git.setDefaultBranch(projectId, name),
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) setDefaultBranchPick('');
    },
    meta: GIT_OP_META,
  });
  const renameBranchMutation = useMutation({
    mutationFn: () => {
      if (!renameTarget) return Promise.resolve({ ok: false, message: 'No branch selected.' });
      return window.agentmat.git.renameBranch({
        projectId,
        from: renameTarget.name,
        to: renameTo,
        updateRemote: renameRemote,
      });
    },
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) {
        setRenameTarget(null);
        setRenameTo('');
        setRenameRemote(false);
      }
    },
    meta: GIT_OP_META,
  });
  const deleteBranchMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) return Promise.resolve({ ok: false, message: 'No branch selected.' });
      return window.agentmat.git.deleteBranch({
        projectId,
        branchName: deleteTarget.name,
        deleteRemote,
        force: deleteForce,
      });
    },
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) {
        setDeleteTarget(null);
        setDeleteRemote(false);
        setDeleteForce(false);
      }
    },
    meta: GIT_OP_META,
  });
  const commitMutation = useMutation({
    mutationFn: (message: string) => window.agentmat.git.commit(projectId, message),
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) setCommitMessage('');
    },
    meta: GIT_OP_META,
  });

  /** Kills the CLI process behind an in-flight suggestion, rather than just ignoring its answer. */
  function cancelSuggestion(
    ref: React.MutableRefObject<string | null>,
    cancel: (requestId: string) => Promise<boolean>,
  ): void {
    const requestId = ref.current;
    if (!requestId) return;
    ref.current = null;
    void cancel(requestId);
  }

  async function handleSuggestBranchName(): Promise<void> {
    const requestId = crypto.randomUUID();
    branchRequestRef.current = requestId;
    setSuggestingBranch(true);
    try {
      const result = await window.agentmat.git.suggestBranchName(projectId, requestId);
      if (result.cancelled) return;
      if (result.ok && result.text?.trim()) {
        setBranchName(sanitizeBranchName(result.text));
      } else {
        toast.error(result.error || 'The CLI did not return a branch name.');
      }
    } finally {
      branchRequestRef.current = null;
      setSuggestingBranch(false);
    }
  }

  async function handleSuggestCommitMessage(): Promise<void> {
    const requestId = crypto.randomUUID();
    commitRequestRef.current = requestId;
    setSuggestingCommit(true);
    try {
      const result = await window.agentmat.git.suggestCommitMessage(projectId, requestId);
      if (result.cancelled) return;
      if (result.ok && result.text?.trim()) {
        setCommitMessage(sanitizeCommitMessage(result.text));
      } else {
        toast.error(result.error || 'The CLI did not return a commit message.');
      }
    } finally {
      commitRequestRef.current = null;
      setSuggestingCommit(false);
    }
  }

  if (statusQuery.isLoading) {
    return <GitTabSkeleton />;
  }

  if (!statusQuery.data?.isRepo) {
    return (
      <>
        <ProjectEmptyState
          icon={GitBranch}
          title="This folder isn't a git repository yet"
          description="Start one on a master branch, then publish it to a GitHub account or organization without leaving the app."
          action={
            <Button onClick={() => setSetupOpen(true)}>
              <GitBranch className="h-4 w-4" /> Initialize repository
            </Button>
          }
        />

        <GitSetupWizard
          projectId={projectId}
          folderPath={folderPath}
          isRepo={false}
          currentBranch={null}
          open={setupOpen}
          onOpenChange={setSetupOpen}
        />
      </>
    );
  }

  const status = statusQuery.data;
  // Git serialises on the repo's index, so one running command locks the other buttons out.
  // Only the button that was clicked shows the spinner, the rest just grey out.
  const anyOpPending =
    fetchMutation.isPending ||
    pullMutation.isPending ||
    pushMutation.isPending ||
    syncMutation.isPending ||
    createBranchMutation.isPending ||
    checkoutBranchMutation.isPending ||
    setDefaultBranchMutation.isPending ||
    renameBranchMutation.isPending ||
    deleteBranchMutation.isPending ||
    commitMutation.isPending;

  const pullPrimary = status.hasRemote && status.behind > 0 && status.ahead === 0;
  const pushPrimary = status.hasRemote && status.ahead > 0 && status.behind === 0;
  const tagInfo = tagsQuery.data;
  const commitsSince = tagInfo?.commitsSinceLatestTag ?? 0;
  const branchOptions = gitBranchOptions(
    status.branches ?? [],
    status.branch,
    status.defaultBranch,
  );
  const defaultBranchOptions = gitBranchOptions(
    status.hasRemote
      ? (status.branches ?? []).filter((branch) => branch.remote)
      : (status.branches ?? []),
    status.branch,
    status.defaultBranch,
  );
  const defaultBranchValue = defaultBranchPick || status.defaultBranch || '';
  const canSetDefault =
    status.hasRemote &&
    Boolean(defaultBranchValue) &&
    defaultBranchValue !== status.defaultBranch;
  const listedBranches = [...(status.branches ?? [])].sort((a, b) => {
    if (a.name === status.branch) return -1;
    if (b.name === status.branch) return 1;
    if (a.name === status.defaultBranch) return -1;
    if (b.name === status.defaultBranch) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div className="flex min-w-0 items-center gap-3">
          <GitIconWell>
            <GitBranch className="h-4 w-4" />
          </GitIconWell>
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <Combobox
                options={branchOptions}
                value={status.branch ?? ''}
                onChange={(name) => {
                  if (!name || name === status.branch) return;
                  checkoutBranchMutation.mutate(name);
                }}
                placeholder={status.branch ?? 'detached HEAD'}
                searchPlaceholder="Search branches…"
                emptyText="Fetch to see remote branches, or create one below."
                disabled={anyOpPending}
                className="h-8 w-[min(20rem,100%)] font-mono text-sm font-semibold"
              />
              {checkoutBranchMutation.isPending ? (
                <Spinner className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
              {status.branch ? (
                <SimpleTooltip label="Chart and history">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={anyOpPending}
                    onClick={() => setHistoryBranch(status.branch)}
                    aria-label="Branch chart and history"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </SimpleTooltip>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {status.hasRemote && status.ahead === 0 && status.behind === 0 && (
                <Badge variant="success" className="gap-1">
                  <CircleCheck className="h-3 w-3" /> In sync
                </Badge>
              )}
              {status.hasRemote && status.ahead > 0 && (
                <Badge variant="warning" className="gap-1">
                  <ArrowUp className="h-3 w-3" /> {status.ahead} ahead
                </Badge>
              )}
              {status.hasRemote && status.behind > 0 && (
                <Badge variant="warning" className="gap-1">
                  <ArrowDown className="h-3 w-3" /> {status.behind} behind
                </Badge>
              )}
              {!status.hasRemote && (
                <Badge variant="outline" className="gap-1">
                  <LinkOff className="h-3 w-3" /> No remote
                </Badge>
              )}
              {status.files.length > 0 ? (
                <Badge variant="outline">
                  {status.files.length} changed file{status.files.length === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge variant="success">Clean</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {diffrayInstalled && (
            <Button size="sm" variant="outline" onClick={onReviewWithDiffray} disabled={anyOpPending}>
              <GitPullRequest /> Review with diffray
            </Button>
          )}
          <GitOpButton
            size="sm"
            variant="outline"
            icon={CloudDownload}
            label="Fetch"
            pendingLabel="Fetching…"
            pending={fetchMutation.isPending}
            disabled={anyOpPending}
            onClick={() => fetchMutation.mutate()}
          />
          <GitOpButton
            size="sm"
            variant={pullPrimary ? undefined : 'outline'}
            icon={Download}
            label="Pull"
            pendingLabel="Pulling…"
            pending={pullMutation.isPending}
            disabled={anyOpPending || !status.hasRemote}
            onClick={() => pullMutation.mutate()}
          />
          <GitOpButton
            size="sm"
            variant={pushPrimary ? undefined : 'outline'}
            icon={CloudUpload}
            label="Push"
            pendingLabel="Pushing…"
            pending={pushMutation.isPending}
            disabled={anyOpPending || !status.hasRemote}
            onClick={() => pushMutation.mutate()}
          />
          {status.hasRemote ? (
            <GitOpButton
              size="sm"
              variant={pullPrimary || pushPrimary ? 'outline' : undefined}
              icon={RefreshCw}
              label="Sync"
              pendingLabel="Syncing…"
              pending={syncMutation.isPending}
              disabled={anyOpPending}
              onClick={() => syncMutation.mutate()}
            />
          ) : (
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              <CloudUpload className="h-3.5 w-3.5" /> Connect to GitHub
            </Button>
          )}
        </div>
      </div>

      {status.files.length > 0 && (
        <div className="glass space-y-2.5 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Changed files</p>
            <span className="text-xs text-muted-foreground">{status.files.length}</span>
          </div>
          <OverflowScroll className="max-h-56 space-y-1 pr-1" surface="card">
            {status.files.map((file) => {
              const kind = gitFileKind(file.x, file.y);
              const { dir, name } = splitGitPath(file.path);
              return (
                <SimpleTooltip key={file.path} label={file.path}>
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border-l-2 px-2.5 py-1.5 transition-colors hover:bg-foreground/5',
                      kind === 'deleted' && 'border-l-destructive',
                      kind === 'added' && 'border-l-success',
                      kind === 'modified' && 'border-l-warning',
                      kind === 'renamed' && 'border-l-primary',
                      kind === 'untracked' && 'border-l-muted-foreground/50',
                    )}
                  >
                    <p className="min-w-0 truncate font-mono text-xs">
                      {dir ? <span className="text-muted-foreground">{dir}</span> : null}
                      <span className="text-foreground">{name}</span>
                    </p>
                    <GitStatusBadge kind={kind} />
                  </div>
                </SimpleTooltip>
              );
            })}
          </OverflowScroll>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass space-y-3 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <GitIconWell>
              <GitBranch className="h-4 w-4" />
            </GitIconWell>
            <div className="min-w-0">
              <p className="text-sm font-medium">Branches</p>
              <p className="text-xs text-muted-foreground">
                Create one from the current HEAD, or change the default used for pull requests.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="git-branch-name">New branch</Label>
            <Input
              id="git-branch-name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feat/my-change"
              className="font-mono"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AiSuggestButton
              size="sm"
              label="Suggest with AI"
              pendingLabel="Thinking…"
              pendingTooltip="Generating a branch name, click to cancel"
              pending={suggestingBranch}
              disabled={status.files.length === 0}
              onStart={() => void handleSuggestBranchName()}
              onCancel={() =>
                cancelSuggestion(branchRequestRef, window.agentmat.git.cancelSuggestBranchName)
              }
            />
            <GitOpButton
              size="sm"
              label="Create"
              pendingLabel="Creating…"
              pending={createBranchMutation.isPending}
              disabled={anyOpPending || !branchName.trim()}
              onClick={() => createBranchMutation.mutate(branchName)}
            />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Default branch</Label>
            <p className="text-xs text-muted-foreground">
              {status.hasRemote
                ? 'Must already exist on the remote. GitHub is updated when the GitHub CLI is signed in.'
                : 'Connect a remote before changing the default branch.'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Combobox
                options={defaultBranchOptions}
                value={defaultBranchValue}
                onChange={setDefaultBranchPick}
                placeholder={status.defaultBranch ?? 'Select a branch'}
                searchPlaceholder="Search branches…"
                emptyText={
                  status.hasRemote
                    ? 'Fetch to see remote branches.'
                    : 'No local branches to choose from.'
                }
                disabled={anyOpPending || !status.hasRemote || defaultBranchOptions.length === 0}
                className="font-mono"
              />
              <SimpleTooltip
                label={
                  !status.hasRemote
                    ? 'Connect a remote before changing the default branch.'
                    : !canSetDefault
                      ? 'This is already the default branch.'
                      : null
                }
                wrapTrigger
              >
                <GitOpButton
                  size="sm"
                  label="Set default"
                  pendingLabel="Updating…"
                  pending={setDefaultBranchMutation.isPending}
                  disabled={anyOpPending || !canSetDefault}
                  onClick={() => setDefaultBranchMutation.mutate(defaultBranchValue)}
                />
              </SimpleTooltip>
            </div>
          </div>
          {listedBranches.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>All branches</Label>
                  <span className="text-xs text-muted-foreground">{listedBranches.length}</span>
                </div>
                <OverflowScroll className="max-h-56 space-y-0.5 pr-1" surface="card">
                  {listedBranches.map((branch) => {
                    const isCurrent = branch.name === status.branch;
                    const isDefault = branch.name === status.defaultBranch;
                    const canDelete = !isCurrent && !isDefault;
                    return (
                      <div
                        key={branch.name}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-foreground/5"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left font-mono text-xs disabled:cursor-default"
                          disabled={anyOpPending || isCurrent}
                          onClick={() => checkoutBranchMutation.mutate(branch.name)}
                          title={isCurrent ? 'Current branch' : `Switch to ${branch.name}`}
                        >
                          {branch.name}
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          {isCurrent ? (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              current
                            </Badge>
                          ) : null}
                          {isDefault ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              default
                            </Badge>
                          ) : null}
                          {!branch.local && branch.remote ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              remote
                            </Badge>
                          ) : null}
                          <SimpleTooltip label="Chart and history">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={anyOpPending}
                              onClick={() => setHistoryBranch(branch.name)}
                              aria-label={`History of ${branch.name}`}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                          </SimpleTooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={anyOpPending}
                                aria-label={`Actions for ${branch.name}`}
                              >
                                <EllipsisVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setHistoryBranch(branch.name)}>
                                <History className="h-4 w-4" /> History
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!branch.local}
                                onSelect={() => {
                                  setRenameTarget(branch);
                                  setRenameTo(branch.name);
                                  setRenameRemote(branch.remote);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={!canDelete}
                                className="text-destructive focus:text-destructive"
                                onSelect={() => {
                                  setDeleteTarget(branch);
                                  setDeleteRemote(!branch.local && branch.remote);
                                  setDeleteForce(false);
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </OverflowScroll>
              </div>
            </>
          ) : null}
        </div>

        <div
          className={cn(
            'glass space-y-3 rounded-xl p-4',
            status.files.length > 0 && 'ring-1 ring-primary/25',
          )}
        >
          <div className="flex items-start gap-3">
            <GitIconWell>
              <GitCommit className="h-4 w-4" />
            </GitIconWell>
            <div className="min-w-0">
              <p className="text-sm font-medium">Commit changes</p>
              <p className="text-xs text-muted-foreground">
                {status.files.length > 0
                  ? `${status.files.length} file${status.files.length === 1 ? '' : 's'} will be included.`
                  : 'Working tree is clean. Nothing to commit.'}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="git-commit-message">Commit message</Label>
            <Textarea
              id="git-commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe what changed…"
              rows={3}
              disabled={status.files.length === 0}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AiSuggestButton
              size="sm"
              label="Suggest with AI"
              pendingLabel="Thinking…"
              pendingTooltip="Writing a commit message, click to cancel"
              pending={suggestingCommit}
              disabled={status.files.length === 0}
              onStart={() => void handleSuggestCommitMessage()}
              onCancel={() =>
                cancelSuggestion(commitRequestRef, window.agentmat.git.cancelSuggestCommitMessage)
              }
            />
            <GitOpButton
              size="sm"
              label="Commit all changes"
              pendingLabel="Committing…"
              pending={commitMutation.isPending}
              disabled={anyOpPending || !commitMessage.trim() || status.files.length === 0}
              onClick={() => commitMutation.mutate(commitMessage)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass flex flex-col gap-3 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <GitIconWell>
              <Tag className="h-4 w-4" />
            </GitIconWell>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Version tag</p>
              {tagInfo?.latestTag ? (
                <p className="text-xs text-muted-foreground">
                  Latest <span className="font-mono text-foreground">{tagInfo.latestTag}</span>
                  {commitsSince > 0
                    ? ` · ${commitsSince} commit${commitsSince === 1 ? '' : 's'} since`
                    : ' · HEAD is on this tag'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No tags in this repository yet.</p>
              )}
            </div>
          </div>
          {tagInfo && tagInfo.recentTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagInfo.recentTags.slice(0, 4).map((existing) => (
                <Badge
                  key={existing}
                  variant={existing === tagInfo.latestTag ? 'secondary' : 'outline'}
                  className="font-mono text-[10px]"
                >
                  {existing}
                </Badge>
              ))}
            </div>
          )}
          <Button variant="outline" className="mt-auto self-start" onClick={() => setTagOpen(true)}>
            <Tag className="h-3.5 w-3.5" /> Tag a version
          </Button>
        </div>

        <div className="glass flex flex-col gap-3 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <GitIconWell>
              <GitPullRequest className="h-4 w-4" />
            </GitIconWell>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Pull request</p>
              <p className="text-xs text-muted-foreground">
                Pushes this branch and opens a pull request with the GitHub CLI, or the compare page
                in your browser if it isn't installed.
              </p>
            </div>
          </div>
          <SimpleTooltip
            label={!status.hasRemote ? 'Connect a remote before opening a pull request.' : null}
            wrapTrigger
          >
            <Button
              variant="outline"
              className="mt-auto self-start"
              onClick={() => setPrOpen(true)}
              disabled={!status.hasRemote}
            >
              <GitPullRequest className="h-3.5 w-3.5" /> Create pull request
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      {status.hasRemote ? (
        <GitActionsCard projectId={projectId} watched={watchedActions} />
      ) : null}

      <GitSetupWizard
        projectId={projectId}
        folderPath={folderPath}
        isRepo
        currentBranch={status.branch}
        open={setupOpen}
        onOpenChange={setSetupOpen}
      />

      <TagVersionDialog
        projectId={projectId}
        tagInfo={tagsQuery.data ?? null}
        status={status}
        open={tagOpen}
        onOpenChange={setTagOpen}
        onApplyVersion={(nextTag) => {
          // Swap dialogs rather than stacking them; the tag dialog keeps its fields for after.
          setTagOpen(false);
          setApplyVersionTag(nextTag);
        }}
      />

      <ApplyVersionDialog
        projectId={projectId}
        tag={applyVersionTag}
        open={applyVersionTag !== null}
        onOpenChange={(next) => {
          if (!next) setApplyVersionTag(null);
        }}
        onBackToTag={() => {
          setApplyVersionTag(null);
          setTagOpen(true);
        }}
      />

      <CreatePrDialog
        projectId={projectId}
        branch={status.branch}
        defaultBranch={status.defaultBranch}
        branches={status.branches ?? []}
        open={prOpen}
        onOpenChange={setPrOpen}
        suggestedTitle={commitMessage.split('\n')[0]}
      />

      <GitBranchHistoryDialog
        projectId={projectId}
        branch={historyBranch}
        open={historyBranch !== null}
        onOpenChange={(next) => {
          if (!next) setHistoryBranch(null);
        }}
      />

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameTarget(null);
            setRenameTo('');
            setRenameRemote(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename branch</DialogTitle>
            <DialogDescription>
              From <span className="font-mono">{renameTarget?.name}</span> to a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="git-rename-branch">New name</Label>
              <Input
                id="git-rename-branch"
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                className="font-mono"
                placeholder="feat/new-name"
              />
            </div>
            {renameTarget?.remote ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={renameRemote}
                  onCheckedChange={(checked) => setRenameRemote(checked === true)}
                />
                Also rename it on the remote
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <GitOpButton
              size="sm"
              icon={Pencil}
              label="Rename"
              pendingLabel="Renaming…"
              pending={renameBranchMutation.isPending}
              disabled={
                anyOpPending ||
                !renameTo.trim() ||
                renameTo.trim().replace(/\s+/g, '-') === renameTarget?.name
              }
              onClick={() => renameBranchMutation.mutate()}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
            setDeleteRemote(false);
            setDeleteForce(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete branch</DialogTitle>
            <DialogDescription>
              {deleteTarget && !deleteTarget.local && deleteTarget.remote
                ? `This removes '${deleteTarget.name}' on the remote.`
                : `This removes '${deleteTarget?.name ?? 'this branch'}' from the local repository.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {deleteTarget?.local && deleteTarget.remote ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={deleteRemote}
                  onCheckedChange={(checked) => setDeleteRemote(checked === true)}
                />
                Also delete it on the remote
              </label>
            ) : null}
            {deleteTarget?.local ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={deleteForce}
                  onCheckedChange={(checked) => setDeleteForce(checked === true)}
                />
                Delete even if it is not merged
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <GitOpButton
              size="sm"
              variant="destructive"
              icon={Trash2}
              label="Delete branch"
              pendingLabel="Deleting…"
              pending={deleteBranchMutation.isPending}
              disabled={anyOpPending}
              onClick={() => deleteBranchMutation.mutate()}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Runs the version bump in place and reports back here, rather than handing the user off
 * to a terminal. The CLI edits files with its write flags enabled, so the "Files changed"
 * list below comes from git's own before/after view of the working tree, not the CLI's word.
 */
function ApplyVersionDialog({
  projectId,
  tag,
  open,
  onOpenChange,
  onBackToTag,
}: {
  projectId: string;
  tag: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToTag: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const requestRef = useRef<string | null>(null);
  const startedForRef = useRef<string | null>(null);

  const applyMutation = useMutation({
    mutationFn: (versionTag: string) => {
      const requestId = crypto.randomUUID();
      requestRef.current = requestId;
      return window.agentmat.git.applyVersion({ projectId, tag: versionTag, requestId });
    },
    onSettled: () => {
      requestRef.current = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
    },
    meta: GIT_OP_META,
  });

  // Tagging is gated on a clean working tree (see TagVersionDialog), so the version bump
  // this dialog just wrote needs to be committed before the user can move on to tagging.
  const commitMutation = useMutation({
    mutationFn: (message: string) => window.agentmat.git.commit(projectId, message),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
    },
    meta: GIT_OP_META,
  });

  const { reset, mutate } = applyMutation;

  // The run starts as soon as the dialog opens: the user already asked for it by clicking
  // "Update version in files". The ref guards against a re-run on unrelated re-renders.
  useEffect(() => {
    if (!open || !tag) {
      startedForRef.current = null;
      return;
    }
    if (startedForRef.current === tag) return;
    startedForRef.current = tag;
    reset();
    mutate(tag);
  }, [open, tag, mutate, reset]);

  function handleCancel(): void {
    const requestId = requestRef.current;
    if (!requestId) return;
    requestRef.current = null;
    void window.agentmat.git.cancelApplyVersion(requestId);
  }

  function handleRetry(): void {
    if (!tag) return;
    startedForRef.current = tag;
    commitMutation.reset();
    reset();
    mutate(tag);
  }

  const result = applyMutation.data;
  const failed = applyMutation.isError || (result && !result.ok && !result.cancelled);
  const didNothing =
    !!result?.ok && result.changedFiles.length === 0 && !result.committedByCli;
  const canRetry = Boolean(failed || result?.cancelled || didNothing);
  const cliOutput = result?.output ? displayCliOutput(result.output) : '';
  const errorText = displayCliOutput(
    result?.error ?? (applyMutation.error as Error | null)?.message ?? 'Unknown error.',
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onBackToTag();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Update version in files</DialogTitle>
          <DialogDescription>
            Setting this project's version to <span className="font-mono">{tag}</span>.
          </DialogDescription>
        </DialogHeader>

        <OverflowScroll fill className="-mx-1 space-y-3 px-1">
          {applyMutation.isPending && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-3">
              <Spinner className="h-4 w-4 animate-spin text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Updating version strings</p>
                <p className="text-xs text-muted-foreground">
                  Your CLI is editing manifests. This can take a minute.
                </p>
              </div>
            </div>
          )}

          {result?.cancelled && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                Cancelled. Any edits already written are listed below.
              </p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {failed && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <TriangleAlert className="h-3.5 w-3.5" /> The run failed
                </p>
                <p className="text-xs text-muted-foreground">{errorText}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {result && result.changedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Files changed ({result.changedFiles.length})
              </p>
              <div className="space-y-1">
                {result.changedFiles.map((file) => {
                  const { dir, name } = splitGitPath(file);
                  return (
                    <div
                      key={file}
                      className="flex items-center gap-2 rounded-md border-l-2 border-l-success px-2.5 py-1.5"
                    >
                      <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                      <p className="min-w-0 truncate font-mono text-xs">
                        {dir ? <span className="text-muted-foreground">{dir}</span> : null}
                        <span>{name}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              {commitMutation.isSuccess && commitMutation.data.ok ? (
                <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <p className="text-xs text-muted-foreground">
                    Committed. Tagging is unlocked. Use "Back to tag" to continue.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Tagging is locked until this version bump is committed.
                  </p>
                  <GitOpButton
                    size="sm"
                    icon={GitCommit}
                    label="Commit version bump"
                    pendingLabel="Committing…"
                    pending={commitMutation.isPending}
                    onClick={() =>
                      tag &&
                      commitMutation.mutate(
                        `chore(release): bump version to ${tag.replace(/^v/, '')}`,
                      )
                    }
                  />
                </div>
              )}
            </div>
          )}

          {result?.ok && result.changedFiles.length === 0 && result.committedByCli && (
            <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <p className="text-sm text-muted-foreground">
                Your CLI committed the version bump itself (some version tools do this on their
                own). Tagging is unlocked. Use "Back to tag" to continue.
              </p>
            </div>
          )}

          {didNothing && (
            <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                The run finished without changing any files. The version may already be set, or the
                CLI could not find where it lives.
              </p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {cliOutput && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {result?.cliName ?? 'CLI'} output
              </p>
              <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-card/60 p-3 text-xs whitespace-pre-wrap">
                {cliOutput}
              </pre>
            </div>
          )}
        </OverflowScroll>

        <DialogFooter>
          {applyMutation.isPending ? (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-destructive/40 hover:bg-destructive/10"
            >
              <X className="h-4 w-4 text-destructive" /> Cancel
            </Button>
          ) : (
            <>
              {canRetry ? (
                <Button variant="outline" onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              ) : null}
              <Button onClick={onBackToTag}>
                <Tag className="h-4 w-4" /> Back to tag
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagVersionDialog({
  projectId,
  tagInfo,
  status,
  open,
  onOpenChange,
  onApplyVersion,
}: {
  projectId: string;
  tagInfo: GitTagInfo | null;
  status: GitStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands the entered tag to the apply-version dialog. */
  onApplyVersion: (tag: string) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [tag, setTag] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [updatedVersionFor, setUpdatedVersionFor] = useState<string | null>(null);
  const suggestRequestRef = useRef<string | null>(null);
  const keepFieldsRef = useRef(false);
  const confirmingSkipRef = useRef(false);

  const hasRemote = tagInfo?.hasRemote ?? false;
  // Gate tagging (and the push that follows it) on a clean tree: a version bump's edits must
  // land in a commit first, otherwise the tag would point at a commit missing those edits.
  const dirtyFileCount = status?.files.length ?? 0;
  const isDirty = dirtyFileCount > 0;
  const bumpOptions = [
    {
      kind: 'patch' as const,
      label: 'Patch',
      next: bumpSemverTag(tagInfo?.latestTag ?? null, 'patch'),
    },
    {
      kind: 'minor' as const,
      label: 'Minor',
      next: bumpSemverTag(tagInfo?.latestTag ?? null, 'minor'),
    },
    {
      kind: 'major' as const,
      label: 'Major',
      next: bumpSemverTag(tagInfo?.latestTag ?? null, 'major'),
    },
  ];

  const suggestMutation = useMutation({
    mutationFn: () => {
      const requestId = crypto.randomUUID();
      suggestRequestRef.current = requestId;
      return window.agentmat.git.suggestTag(projectId, requestId);
    },
    onSettled: () => {
      suggestRequestRef.current = null;
    },
    onSuccess: (result) => {
      if (result.cancelled) return;
      if (result.ok && result.tag) {
        setTag(result.tag);
        setReason(result.reason ?? null);
        if (result.message) setMessage(result.message);
        toast.success(`${result.cliName ?? 'Your CLI'} suggested ${result.tag}.`);
      } else {
        toast.error(result.error ?? 'The CLI could not work out a version.');
      }
    },
    meta: GIT_OP_META,
  });

  /** Kills the CLI process behind the running suggestion, rather than just ignoring its answer. */
  function handleCancelSuggest(): void {
    const requestId = suggestRequestRef.current;
    if (!requestId) return;
    suggestRequestRef.current = null;
    void window.agentmat.git.cancelSuggestTag(requestId);
  }

  const createTagMutation = useMutation({
    mutationFn: () =>
      window.agentmat.git.createTag({ projectId, tag: tag.trim(), message, push: hasRemote }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        void queryClient.invalidateQueries({ queryKey: queryKeys.gitTags(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
        handleOpenChange(false);
      } else {
        toast.error(result.message);
      }
    },
    meta: GIT_OP_META,
  });

  function handleOpenChange(next: boolean): void {
    // The shared confirm dialog sits on top of this one. Ignore dismissals
    // that come from clicking it, so the tag form stays put.
    if (!next && confirmingSkipRef.current) return;
    if (!next && !keepFieldsRef.current) {
      setTag('');
      setMessage('');
      setReason(null);
      setUpdatedVersionFor(null);
    }
    keepFieldsRef.current = false;
    onOpenChange(next);
  }

  function handleApplyVersion(): void {
    const next = tag.trim();
    if (!next) return;
    keepFieldsRef.current = true;
    setUpdatedVersionFor(next);
    onApplyVersion(next);
  }

  function handleCreateTag(): void {
    const next = tag.trim();
    if (!next) return;
    if (updatedVersionFor === next) {
      createTagMutation.mutate();
      return;
    }
    confirmingSkipRef.current = true;
    void confirmDialog({
      title: 'Skip updating version in files?',
      description:
        'You have not run Update version in files for this tag. Package manifests and other version strings may still show the old version.',
      confirmLabel: hasRemote ? 'Create & push anyway' : 'Create anyway',
      cancelLabel: 'Go back',
    }).then((confirmed) => {
      confirmingSkipRef.current = false;
      if (confirmed) createTagMutation.mutate();
    });
  }

  function handleBump(nextTag: string): void {
    setTag(nextTag);
    setReason(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Tag a version</DialogTitle>
          <DialogDescription>
            {tagInfo?.latestTag ? (
              <>
                {tagInfo.commitsSinceLatestTag} commit
                {tagInfo.commitsSinceLatestTag === 1 ? '' : 's'} since{' '}
                <span className="font-mono">{tagInfo.latestTag}</span>.
              </>
            ) : (
              'This repository has no tags yet. Pick a first version below.'
            )}
          </DialogDescription>
        </DialogHeader>
        <OverflowScroll fill className="-mx-1 space-y-4 px-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-3">
            <div className="min-w-0 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Latest
              </p>
              <p className="truncate font-mono text-lg font-semibold">
                {tagInfo?.latestTag ?? 'None'}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-primary">Next</p>
              <p className="truncate font-mono text-lg font-semibold text-primary">
                {tag.trim() || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {bumpOptions.map((option) => {
              const selected = tag.trim() === option.next;
              return (
                <button
                  key={option.kind}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${option.label} bump to ${option.next}`}
                  onClick={() => handleBump(option.next)}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border bg-card/40 text-muted-foreground hover:border-foreground/20 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span className="text-xs font-medium">{option.label}</span>
                  <span className="font-mono text-[10px]">{option.next}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="git-tag-name">Tag name</Label>
            <Input
              id="git-tag-name"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setReason(null);
              }}
              placeholder="v1.0.1"
              className="font-mono"
            />
            {reason && (
              <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-xs text-muted-foreground">{reason}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="git-tag-message">Tag message (optional)</Label>
            <Textarea
              id="git-tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What this release contains…"
            />
          </div>

          <div className="space-y-2.5 rounded-xl border border-border bg-card/60 p-3">
            <div className="flex items-start gap-3">
              <GitIconWell>
                <FileCog className="h-4 w-4" />
              </GitIconWell>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Update version in files</p>
                <p className="text-xs text-muted-foreground">
                  Runs your CLI over package.json, other manifests and any version shown in the app.
                  Commit those edits before tagging.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!tag.trim() || createTagMutation.isPending}
              onClick={handleApplyVersion}
            >
              <FileCog className="h-3.5 w-3.5" /> Update version in files
            </Button>
          </div>

          {tagInfo && tagInfo.recentTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Recent tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tagInfo.recentTags.map((existing) => (
                  <Badge
                    key={existing}
                    variant={existing === tagInfo.latestTag ? 'secondary' : 'outline'}
                    className="font-mono text-[10px]"
                  >
                    {existing}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {isDirty && (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-xs text-muted-foreground">
                Commit {dirtyFileCount} changed file{dirtyFileCount === 1 ? '' : 's'} before
                tagging. The tag has to point at a commit that already includes the version bump.
              </p>
            </div>
          )}
        </OverflowScroll>
        <DialogFooter className="flex-col gap-1.5 sm:flex-col sm:items-stretch">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {suggestMutation.isPending ? (
              <AiSuggestButton
                label="Suggest with AI"
                pendingLabel="Asking your CLI…"
                pendingTooltip="Reading the commits since the latest tag, click to cancel"
                pending
                onStart={() => suggestMutation.mutate()}
                onCancel={handleCancelSuggest}
              />
            ) : (
              <SimpleTooltip label="Reads the commits since the latest tag with your CLI and proposes the next semantic version">
                <AiSuggestButton
                  label="Suggest with AI"
                  pendingLabel="Asking your CLI…"
                  pendingTooltip=""
                  pending={false}
                  disabled={createTagMutation.isPending}
                  onStart={() => suggestMutation.mutate()}
                  onCancel={handleCancelSuggest}
                />
              </SimpleTooltip>
            )}
            <SimpleTooltip
              label={isDirty ? 'Commit the changed files above before tagging.' : null}
              wrapTrigger
            >
              <GitOpButton
                icon={Tag}
                label={hasRemote ? 'Create & push tag' : 'Create tag'}
                pendingLabel={hasRemote ? 'Creating & pushing…' : 'Creating tag…'}
                pending={createTagMutation.isPending}
                disabled={!tag.trim() || isDirty}
                onClick={handleCreateTag}
              />
            </SimpleTooltip>
          </div>
          <p className="text-[11px] text-muted-foreground sm:text-right">
            {hasRemote
              ? 'Creates the tag, then pushes the current branch and tag to origin.'
              : 'No remote is configured, so the tag stays local.'}
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePrDialog({
  projectId,
  branch,
  defaultBranch,
  branches,
  open,
  onOpenChange,
  suggestedTitle,
}: {
  projectId: string;
  branch: string | null;
  defaultBranch: string | null;
  branches: GitBranchInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedTitle: string;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: only seed title/base once, when the dialog opens; don't fight the user's edits
  useEffect(() => {
    if (open) {
      setTitle((current) => current || suggestedTitle);
      setBase((current) => current || defaultBranch || 'main');
    }
  }, [open]);

  const createPrMutation = useMutation({
    mutationFn: () => window.agentmat.git.createPullRequest({ projectId, title, body, base }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          result.usedFallback ? 'Opened compare page in your browser.' : 'Pull request created.',
        );
        if (result.url) void window.agentmat.shell.openExternal(result.url);
        onOpenChange(false);
        setTitle('');
        setBody('');
      } else {
        toast.error(result.error ?? 'Failed to create pull request.');
      }
    },
    meta: GIT_OP_META,
  });

  const baseOptions = gitBranchOptions(branches, null, defaultBranch);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create pull request</DialogTitle>
          <DialogDescription>
            From <span className="font-mono">{branch ?? 'current branch'}</span> into base branch
            below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="PR title"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Base branch</Label>
            {baseOptions.length > 0 ? (
              <Combobox
                options={baseOptions}
                value={base}
                onChange={setBase}
                placeholder={defaultBranch || 'main'}
                searchPlaceholder="Search branches…"
                emptyText="No branches found."
                className="font-mono"
              />
            ) : (
              <Input
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="main"
                className="font-mono"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="What changed and why…"
            />
          </div>
        </div>
        <DialogFooter>
          <GitOpButton
            icon={GitPullRequest}
            label="Create Pull Request"
            pendingLabel="Pushing & opening PR…"
            pending={createPrMutation.isPending}
            disabled={!title.trim()}
            onClick={() => createPrMutation.mutate()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HooksTab({ project }: { project: Project }): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingHook, setEditingHook] = useState<DetectedClaudeHook | null>(null);

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  const claudeHooksQuery = useQuery({
    queryKey: queryKeys.claudeHooks(project.id),
    queryFn: () => window.agentmat.projects.listClaudeHooks(project.id),
  });
  const otherHooks = (claudeHooksQuery.data ?? []).filter((h) => !h.managedByAgentMate);

  const installedAgents = CLI_REGISTRY.filter(
    (cli) => cliQuery.data?.find((c) => c.id === cli.id)?.installed,
  );
  const telegramConfigured = Boolean(
    settingsQuery.data?.telegramBotToken && settingsQuery.data?.telegramChatId,
  );

  const saveMutation = useMutation({
    mutationFn: (notifications: ProjectNotificationSettings) =>
      window.agentmat.projects.updateNotifications(project.id, notifications),
    onSuccess: () => {
      toast.success('Notification hook saved.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const deleteHookMutation = useMutation({
    mutationFn: (hookId: string) => window.agentmat.projects.deleteClaudeHook(project.id, hookId),
    onSuccess: () => {
      toast.success('Hook removed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.claudeHooks(project.id) });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Wire an installed agent to a Telegram notification for this project. Completion and
        confirmation are configured as two independent hooks.
      </p>

      {!telegramConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-muted-foreground" />
            Set up your Telegram bot in Settings before enabling these hooks.
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
            Open Settings
          </Button>
        </div>
      )}

      <NotificationHookCard
        kind="completion"
        icon={CircleCheck}
        title="Completion"
        description="Sends a Telegram message when the agent finishes its work."
        project={project}
        installedAgents={installedAgents}
        onSave={(hook) => saveMutation.mutate({ ...project.notifications, completion: hook })}
        saving={saveMutation.isPending}
      />
      <NotificationHookCard
        kind="confirmation"
        icon={CircleQuestion}
        title="Confirmation"
        description="Sends a Telegram message when the agent needs your confirmation to continue. Reply on Telegram and AgentMate forwards your reply to this project's open terminal."
        project={project}
        installedAgents={installedAgents}
        onSave={(hook) => saveMutation.mutate({ ...project.notifications, confirmation: hook })}
        saving={saveMutation.isPending}
      />

      <Separator />

      <div className="space-y-1">
        <p className="text-sm font-medium">Other hooks</p>
        <p className="text-xs text-muted-foreground">
          Hooks found in this project's{' '}
          <code className="rounded bg-muted px-1">.claude/settings.json</code> and{' '}
          <code className="rounded bg-muted px-1">settings.local.json</code> that AgentMate didn't
          create.
        </p>
      </div>

      {otherHooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other hooks found.</p>
      ) : (
        <div className="space-y-2">
          {otherHooks.map((hook) => (
            <div
              key={hook.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <HookAgentIcon cliId={hook.cliId} className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{hook.event}</span>
                  {hook.matcher && <span>· {hook.matcher}</span>}
                  <Badge variant="outline" className="text-[10px]">
                    {sourceFileLabel(hook.id)}
                  </Badge>
                </div>
                {/* The command is often far wider than the row, so the tooltip
                    is where you actually read it, so let it wrap generously. */}
                <SimpleTooltip label={summarizeHook(hook.hook)} align="start" className="font-mono">
                  <p className="truncate font-mono text-xs text-muted-foreground/80">
                    {summarizeHook(hook.hook)}
                  </p>
                </SimpleTooltip>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <SimpleTooltip label="Edit hook">
                  <Button variant="ghost" size="icon" onClick={() => setEditingHook(hook)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip label="Delete hook">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void confirmDialog({
                        title: `Remove ${hook.event} hook?`,
                        description: `This removes it from ${sourceFileLabel(hook.id)}.`,
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      }).then((confirmed) => {
                        if (confirmed) deleteHookMutation.mutate(hook.id);
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </SimpleTooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditClaudeHookDialog
        projectId={project.id}
        hook={editingHook}
        onOpenChange={(open) => {
          if (!open) setEditingHook(null);
        }}
      />
    </div>
  );
}

interface NotificationHookCardProps {
  kind: NotificationHookKind;
  title: string;
  description: string;
  icon: typeof CircleCheck;
  project: Project;
  installedAgents: CliDefinition[];
  onSave: (hook: ProjectNotificationHook) => void;
  saving: boolean;
}

function NotificationHookCard({
  kind,
  title,
  description,
  icon: Icon,
  project,
  installedAgents,
  onSave,
  saving,
}: NotificationHookCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const saved = project.notifications[kind];
  const [enabled, setEnabled] = useState(saved.enabled);
  const [cliId, setCliId] = useState(saved.cliId ?? '');
  const [message, setMessage] = useState(saved.message);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-syncs from `saved` only; `dirty` is read as a guard, not a re-trigger
  useEffect(() => {
    if (dirty) return;
    setEnabled(saved.enabled);
    setCliId(saved.cliId ?? '');
    setMessage(saved.message);
  }, [saved.enabled, saved.cliId, saved.message]);

  const scriptFileName =
    kind === 'completion' ? 'notify-completion.cjs' : 'notify-confirmation.cjs';
  const scriptPath = `${project.folderPath}/.agentmate/hooks/${scriptFileName}`;
  const savedCli = CLI_REGISTRY.find((c) => c.id === saved.cliId);
  const wiredAutomatically = saved.cliId === 'claude-code';

  async function handleCopyScriptPath(): Promise<void> {
    await navigator.clipboard.writeText(scriptPath);
    toast.success('Script path copied.');
  }

  async function handleTest(): Promise<void> {
    setTesting(true);
    try {
      const rendered = message.replaceAll('{{project}}', project.name);
      const result = await window.agentmat.notifications.sendTest({ message: rendered });
      if (result.ok) {
        toast.success('Sent. Check Telegram.');
      } else {
        toast.error(result.error ?? 'Failed to send test message.');
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="glass rounded-lg p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" /> {title}
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            setDirty(true);
          }}
        />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Installed agent</Label>
          <Combobox
            className="max-w-xs"
            value={cliId}
            onChange={(v) => {
              setCliId(v);
              setDirty(true);
            }}
            placeholder={installedAgents.length ? 'Select an agent…' : 'No installed CLIs detected'}
            emptyText="No installed CLIs detected."
            disabled={installedAgents.length === 0}
            options={installedAgents.map((cli) => ({
              value: cli.id,
              label: cli.name,
              icon: cliOptionIcon(cli.id),
            }))}
          />
          {installedAgents.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Install a CLI from the{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => navigate('/cli-manager')}
              >
                CLI Manager
              </button>{' '}
              first.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Telegram message</Label>
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setDirty(true);
            }}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1">{'{{project}}'}</code> to insert the project
            name.
          </p>
        </div>

        {saved.enabled && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <CliLogo cliId={saved.cliId ?? ''} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {wiredAutomatically ? (
              <span>
                Automatically wired into{' '}
                <code className="rounded bg-muted px-1">.claude/settings.json</code> for{' '}
                {savedCli?.name ?? 'Claude Code'}.
              </span>
            ) : (
              <span>
                No automatic wiring available for {savedCli?.name ?? 'this agent'} yet. Run the
                generated script from its hook/automation config:{' '}
                <button
                  type="button"
                  onClick={() => void handleCopyScriptPath()}
                  className="break-all rounded bg-muted px-1 font-mono underline underline-offset-2 hover:text-foreground"
                >
                  {scriptPath}
                </button>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() => {
              onSave({ enabled, cliId: cliId || null, message });
              setDirty(false);
            }}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testing || !message.trim()}
            onClick={() => void handleTest()}
          >
            <Send className="h-4 w-4" /> {testing ? 'Sending…' : 'Send test'}
          </Button>
        </div>
      </div>
    </div>
  );
}
