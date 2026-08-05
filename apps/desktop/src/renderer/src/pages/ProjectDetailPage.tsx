import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Blocks,
  CalendarDays,
  Check,
  CircleCheck,
  CircleQuestion,
  CloudUpload,
  Copy,
  Download,
  File,
  FileCog,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitCommit,
  GitPullRequest,
  History,
  MessageSquare,
  Package,
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
import { CliLogo } from '@/components/cliLogos';
import { CLI_REGISTRY } from '@agentmat/core';
import type {
  BootstrapResult,
  GitTagInfo,
  PackageInfo,
  PackageManagerSection,
  PackageUpdateRequest,
} from '@shared/apiTypes';
import type {
  CliDefinition,
  DetectedClaudeHook,
  NotificationHookKind,
  Project,
  ProjectDraftStatus,
  ProjectNotificationHook,
  ProjectNotificationSettings,
  ScheduledTask,
} from '@agentmat/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { ProjectFileBrowser } from '@/components/projects/ProjectFileBrowser';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
import { ProjectPromptDialog } from '@/components/projects/ProjectPromptDialog';
import {
  BootstrapDescriptionDialog,
  type BootstrapDescription,
} from '@/components/projects/BootstrapDescriptionDialog';
import { ProjectPromptHistory } from '@/components/projects/ProjectPromptHistory';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useAskAiStore } from '@/stores/askAiStore';
import { confirmDialog } from '@/stores/confirmStore';
import type { AiProvider } from '../../../shared/apiTypes';

const TARGET_AI_TO_CLI_ID: Record<string, string> = {
  Claude: 'claude-code',
  Gemini: 'gemini-cli',
  OpenCode: 'opencode',
  Codex: 'codex-cli',
  Qwen: 'qwen-cli',
  Aider: 'aider',
  Goose: 'goose',
  Continue: 'continue-cli',
};

export default function ProjectDetailPage(): React.JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);
  const [editOpen, setEditOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const project = projectsQuery.data?.find((p) => p.id === projectId);

  usePageHeader(project?.name ?? '', project?.folderPath);

  const installedSkillsQuery = useQuery({
    queryKey: queryKeys.installedSkills(projectId ?? ''),
    queryFn: () => window.agentmat.skills.listInstalled(projectId!),
    enabled: !!projectId,
  });

  // Shares its key with the Overview tab's drafts list, so both read one fetch.
  const draftsQuery = useQuery({
    queryKey: queryKeys.projectDrafts(projectId ?? ''),
    queryFn: () => window.agentmat.projectDrafts.listByProject(projectId!),
    enabled: !!projectId,
  });
  const drafts = draftsQuery.data ?? [];
  const openDraftCount = drafts.filter((draft) => draft.status === 'draft').length;

  const installedMcpServersQuery = useQuery({
    queryKey: queryKeys.installedMcpServers(projectId ?? ''),
    queryFn: () => window.agentmat.mcp.listInstalled(projectId!),
    enabled: !!projectId,
  });

  // The preload bridge is only attached when the window is created, so a
  // hot-reloaded renderer can outrun it. Feature-detect instead of calling
  // blind, which would throw a bare TypeError.
  const planBridgeReady = typeof window.agentmat?.projects?.bootstrapPlan === 'function';

  // Fetched from the main process rather than computed here, so the preview is
  // literally the plan that gets written. Keyed on the fields the plan derives
  // from, so editing the project's agent refreshes it.
  const bootstrapPlanQuery = useQuery({
    queryKey: ['bootstrap-plan', projectId, project?.agentType, project?.name, project?.description],
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
    mutationFn: (skillId: string) => window.agentmat.skills.remove({ projectId: projectId!, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(projectId ?? '') });
    },
  });

  const removeMcpServerMutation = useMutation({
    mutationFn: (serverId: string) => window.agentmat.mcp.remove({ projectId: projectId!, serverId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedMcpServers(projectId ?? '') });
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
    if (!project || !project.runCommand) return;
    openSession({
      title: project.name,
      cwd: project.folderPath,
      projectId: project.id,
      initialInput: project.runCommand,
    });
    toast.info(`Press Enter in the terminal to run "${project.runCommand}".`);
  }

  if (projectsQuery.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  }

  if (!project) {
    return (
      <div className="space-y-3 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="-ml-2">
          <ArrowLeft /> Back to Projects
        </Button>
        <p className="text-sm text-muted-foreground">This project could not be found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="-ml-2">
        <ArrowLeft /> Projects
      </Button>

      <div className="glass rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="truncate text-lg font-semibold">{project.name}</h1>
              {project.description && (
                <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{project.agentType}</Badge>
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex max-w-full items-center gap-1">
                <SimpleTooltip label={`Copy path: ${project.folderPath}`}>
                  <button
                    type="button"
                    onClick={() => void handleCopyPath()}
                    className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Folder className="h-3 w-3 shrink-0" />
                    <span className="truncate">{project.folderPath}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </SimpleTooltip>
                <SimpleTooltip label="Open in File Explorer">
                  <button
                    type="button"
                    onClick={() => void handleOpenInFileExplorer()}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <FolderOpen className="h-3 w-3" />
                  </button>
                </SimpleTooltip>
                <SimpleTooltip label="Open terminal here">
                  <button
                    type="button"
                    onClick={handleOpenTerminalHere}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <TerminalSquare className="h-3 w-3" />
                  </button>
                </SimpleTooltip>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {project.runCommand && (
              <Button size="sm" onClick={handleRun}>
                <Play /> Run
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setPromptOpen(true)}>
              <MessageSquare /> Prompt
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                void confirmDialog({
                  title: `Remove "${project.name}"?`,
                  description: 'This removes it from AgentMate. Files on disk are kept.',
                  confirmLabel: 'Remove',
                  variant: 'destructive',
                }).then((confirmed) => {
                  if (confirmed) deleteMutation.mutate();
                });
              }}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="min-w-0 xl:col-span-3">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <File className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="bootstrap" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Bootstrap
              </TabsTrigger>
              <TabsTrigger value="prompts" className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Prompt History
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-1.5">
                <Blocks className="h-3.5 w-3.5" /> Skills
              </TabsTrigger>
              <TabsTrigger value="mcp" className="gap-1.5">
                <Plug className="h-3.5 w-3.5" /> MCP
              </TabsTrigger>
              <TabsTrigger value="packages" className="gap-1.5">
                <Package className="h-3.5 w-3.5" /> Packages
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Git
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Schedule
              </TabsTrigger>
              <TabsTrigger value="hooks" className="gap-1.5">
                <Bell className="h-3.5 w-3.5" /> Hooks
              </TabsTrigger>
              <TabsTrigger value="terminal" className="gap-1.5">
                <TerminalSquare className="h-3.5 w-3.5" /> Terminal
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-1.5">
                <FileCog className="h-3.5 w-3.5" /> Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Project prompt</p>
                <Button variant="ghost" size="sm" onClick={() => setPromptOpen(true)}>
                  <MessageSquare /> {project.prompt ? 'Edit prompt' : 'Define prompt'}
                </Button>
              </div>
              {project.prompt ? (
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm">
                  {project.prompt}
                </p>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No prompt defined yet. Set the standing context agents should start from on this
                  project.
                </p>
              )}

              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <Textarea value={project.notes} readOnly rows={6} placeholder="No notes yet." />

              <Separator />

              <DraftsSection projectId={project.id} />
            </TabsContent>

            <TabsContent value="bootstrap" className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {bootstrapPlanQuery.data ? (
                    <>
                      Scaffolds this project the way{' '}
                      <span className="font-medium">{bootstrapPlanQuery.data.agentLabel}</span> expects
                      it, following{' '}
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
                    the app and start it again (<code className="font-mono">pnpm dev</code>) to see it.
                    Bootstrapping still works.
                  </p>
                ) : bootstrapPlanQuery.isError ? (
                  <p className="text-xs text-destructive">
                    Could not load the plan: {(bootstrapPlanQuery.error as Error).message}
                  </p>
                ) : bootstrapPlanQuery.isPending ? (
                  <p className="text-xs text-muted-foreground">Loading plan…</p>
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
            </TabsContent>

            <TabsContent value="prompts">
              <ProjectPromptHistory projectId={project.id} />
            </TabsContent>

            <TabsContent value="skills" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Skills installed into this project.</p>
                <Button variant="outline" onClick={() => navigate(`/skills?projectId=${project.id}`)}>
                  <Blocks /> Browse Marketplace
                </Button>
              </div>
              {installedSkillsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills installed yet.</p>
              ) : (
                <div className="space-y-2">
                  {installedSkillsQuery.data?.map((skill) => (
                    <div key={skill.skillId} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span>
                        {skill.skillId} <span className="text-muted-foreground">v{skill.version}</span>
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeSkillMutation.mutate(skill.skillId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="mcp" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">MCP servers installed into this project.</p>
                <Button variant="outline" onClick={() => navigate(`/mcp?projectId=${project.id}`)}>
                  <Plug /> Browse Marketplace
                </Button>
              </div>
              {installedMcpServersQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No MCP servers installed yet.</p>
              ) : (
                <div className="space-y-2">
                  {installedMcpServersQuery.data?.map((server) => (
                    <div key={server.serverId} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span>
                        {server.serverId} <span className="text-muted-foreground">v{server.version}</span>
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeMcpServerMutation.mutate(server.serverId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="packages" className="space-y-4">
              <PackagesTab projectId={project.id} />
            </TabsContent>

            <TabsContent value="git" className="space-y-4">
              <GitTab
                projectId={project.id}
                projectPath={project.folderPath}
                projectCliId={project.cliId}
              />
            </TabsContent>

            <TabsContent value="schedule" className="space-y-3">
              <ScheduleTab projectId={project.id} />
            </TabsContent>

            <TabsContent value="hooks" className="space-y-4">
              <HooksTab project={project} />
            </TabsContent>

            <TabsContent value="terminal" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Open a terminal in this project's folder.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => openSession({ title: project.name, cwd: project.folderPath, projectId: project.id })}
                >
                  <TerminalSquare /> Open Terminal Here
                </Button>
                {project.runCommand && (
                  <Button variant="outline" onClick={handleRun}>
                    <Play /> Run "{project.runCommand}"
                  </Button>
                )}
              </div>
              {!project.runCommand && (
                <p className="text-xs text-muted-foreground">
                  Set a run command from Edit to add a one-click Run action here and on the Projects page.
                </p>
              )}
            </TabsContent>

            <TabsContent value="config">
              <ProjectConfigEditor projectFolderPath={project.folderPath} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 xl:col-span-1">
          <div className="glass rounded-lg p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Details</p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Agent</dt>
                <dd className="font-medium">{project.agentType}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">Run command</dt>
                <SimpleTooltip label={project.runCommand}>
                  <dd className="min-w-0 truncate text-right font-mono text-xs">
                    {project.runCommand || 'N/A'}
                  </dd>
                </SimpleTooltip>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{timeAgo(project.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{timeAgo(project.updatedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="text-right">{project.tags.length > 0 ? project.tags.length : 'N/A'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Drafts</dt>
                <dd className="text-right">
                  {drafts.length === 0
                    ? 'N/A'
                    : `${openDraftCount} open · ${drafts.length - openDraftCount} implemented`}
                </dd>
              </div>
            </dl>
          </div>
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
    </div>
  );
}

function ProjectConfigEditor({ projectFolderPath }: { projectFolderPath: string }): React.JSX.Element {
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

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

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
      <MonacoEditor value={content} onChange={setContent} language="json" className="min-h-[320px]" />
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
function HookAgentIcon({ cliId, className }: { cliId?: string; className?: string }): React.JSX.Element {
  const known = cliId != null && CLI_REGISTRY.some((c) => c.id === cliId);
  return <CliLogo cliId={known ? cliId : 'claude-code'} className={className} />;
}

/** Best-effort one-line summary of a raw hook body for the list view (command + args, if present). */
function summarizeHook(hook: Record<string, unknown>): string {
  const command = typeof hook.command === 'string' ? hook.command : '';
  const args = Array.isArray(hook.args) ? hook.args.filter((a): a is string => typeof a === 'string') : [];
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
        <p className="text-sm text-muted-foreground">Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No drafts yet. In Prompt Builder, set Status to "Draft", pick this project, and save.
        </p>
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
                  className={`whitespace-pre-wrap text-xs ${
                    implemented ? 'text-muted-foreground' : ''
                  }`}
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

function statusBadgeVariant(status: ScheduledTask['status']): 'warning' | 'success' | 'destructive' {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'destructive';
  return 'warning';
}

function ScheduleTab({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
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
    const cliId = defaultCliId ?? TARGET_AI_TO_CLI_ID[task.targetAI];
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
    return <p className="text-sm text-muted-foreground">Loading schedule…</p>;
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scheduled tasks yet. Build a series from Prompt Builder by setting its Status to
        "Scheduled" and choosing this project.
      </p>
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
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: 'completed' })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip label="Cancel">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: 'cancelled' })}
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

/** Strips markdown fences/quotes but keeps line breaks, for AI-suggested commit messages. */
function sanitizeCommitMessage(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

function GitStatusBadge({ x, y }: { x: string; y: string }): React.JSX.Element {
  const code = `${x}${y}`.trim();
  const label =
    code === '??'
      ? 'untracked'
      : code.includes('D')
        ? 'deleted'
        : code.includes('A')
          ? 'added'
          : code.includes('R')
            ? 'renamed'
            : 'modified';
  const variant = label === 'deleted' ? 'destructive' : label === 'added' ? 'success' : 'outline';
  return (
    <Badge variant={variant} className="shrink-0 font-mono text-[10px] uppercase">
      {label}
    </Badge>
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

function GitTab({
  projectId,
  projectPath,
  projectCliId,
}: {
  projectId: string;
  projectPath: string;
  projectCliId: string | null;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const provider = useAskAiStore((s) => s.provider);
  const openaiModel = useAskAiStore((s) => s.openaiModel);
  const ollamaModel = useAskAiStore((s) => s.ollamaModel);
  const geminiModel = useAskAiStore((s) => s.geminiModel);
  const model = provider === 'openai' ? openaiModel : provider === 'gemini' ? geminiModel : ollamaModel;

  const [branchName, setBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [suggestingBranch, setSuggestingBranch] = useState(false);
  const [suggestingCommit, setSuggestingCommit] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
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
  });
  const pullMutation = useMutation({
    mutationFn: () => window.agentmat.git.pull(projectId),
    onSuccess: reportOpResult,
  });
  const pushMutation = useMutation({
    mutationFn: () => window.agentmat.git.push(projectId),
    onSuccess: reportOpResult,
  });
  const syncMutation = useMutation({
    mutationFn: () => window.agentmat.git.sync(projectId),
    onSuccess: reportOpResult,
  });
  const createBranchMutation = useMutation({
    mutationFn: (name: string) => window.agentmat.git.createBranch(projectId, name),
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) setBranchName('');
    },
  });
  const commitMutation = useMutation({
    mutationFn: (message: string) => window.agentmat.git.commit(projectId, message),
    onSuccess: (result) => {
      reportOpResult(result);
      if (result.ok) setCommitMessage('');
    },
  });

  async function requireAiModel(): Promise<boolean> {
    if (!model.trim()) {
      toast.error(`Choose a ${provider} model in Ask AI first.`);
      return false;
    }
    return true;
  }

  /** Aborts whichever Ask AI request the given ref is tracking, if one is still running. */
  function cancelAiRequest(ref: React.MutableRefObject<string | null>): void {
    const requestId = ref.current;
    if (!requestId) return;
    ref.current = null;
    void window.agentmat.ai.cancel(requestId);
  }

  async function handleSuggestBranchName(): Promise<void> {
    if (!(await requireAiModel())) return;
    const requestId = crypto.randomUUID();
    branchRequestRef.current = requestId;
    setSuggestingBranch(true);
    try {
      const summary = await window.agentmat.git.changeSummary(projectId);
      const prompt =
        'Generate a single short git branch name (kebab-case, e.g. "feat/add-login" or ' +
        '"fix/null-check", max 60 characters, no spaces, no quotes, no markdown) describing these ' +
        `uncommitted changes. Reply with ONLY the branch name and nothing else.\n\n${summary}`;
      const result = await window.agentmat.ai.ask({
        provider: provider as AiProvider,
        model,
        prompt,
        requestId,
      });
      if (result.cancelled) return;
      if (result.ok && result.text.trim()) {
        setBranchName(sanitizeBranchName(result.text));
      } else {
        toast.error(result.error || 'AI did not return a branch name.');
      }
    } finally {
      branchRequestRef.current = null;
      setSuggestingBranch(false);
    }
  }

  async function handleSuggestCommitMessage(): Promise<void> {
    if (!(await requireAiModel())) return;
    const requestId = crypto.randomUUID();
    commitRequestRef.current = requestId;
    setSuggestingCommit(true);
    try {
      const summary = await window.agentmat.git.changeSummary(projectId);
      const prompt =
        'Write a concise, conventional-commit style git commit message (a short summary line, ' +
        'optionally followed by a brief body) describing these changes. Reply with ONLY the commit ' +
        `message, no code fences, no extra commentary.\n\n${summary}`;
      const result = await window.agentmat.ai.ask({
        provider: provider as AiProvider,
        model,
        prompt,
        requestId,
      });
      if (result.cancelled) return;
      if (result.ok && result.text.trim()) {
        setCommitMessage(sanitizeCommitMessage(result.text));
      } else {
        toast.error(result.error || 'AI did not return a commit message.');
      }
    } finally {
      commitRequestRef.current = null;
      setSuggestingCommit(false);
    }
  }

  if (statusQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Checking for a git repository…</p>;
  }

  if (!statusQuery.data?.isRepo) {
    return <p className="text-sm text-muted-foreground">This folder isn't a git repository.</p>;
  }

  const status = statusQuery.data;
  const anyOpPending =
    fetchMutation.isPending || pullMutation.isPending || pushMutation.isPending || syncMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="gap-1.5">
            <GitBranch className="h-3 w-3" /> {status.branch ?? 'detached HEAD'}
          </Badge>
          {status.hasRemote && status.ahead > 0 && <Badge variant="warning">{status.ahead} ahead</Badge>}
          {status.hasRemote && status.behind > 0 && <Badge variant="warning">{status.behind} behind</Badge>}
          {!status.hasRemote && <Badge variant="outline">No remote configured</Badge>}
          {status.files.length > 0 ? (
            <Badge variant="outline">{status.files.length} changed file{status.files.length === 1 ? '' : 's'}</Badge>
          ) : (
            <Badge variant="success">Working tree clean</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={anyOpPending}
            onClick={() => fetchMutation.mutate()}
          >
            <Download className="h-3.5 w-3.5" /> Fetch
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={anyOpPending || !status.hasRemote}
            onClick={() => pullMutation.mutate()}
          >
            <Download className="h-3.5 w-3.5" /> Pull
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={anyOpPending}
            onClick={() => pushMutation.mutate()}
          >
            <CloudUpload className="h-3.5 w-3.5" /> Push
          </Button>
          <Button
            size="sm"
            disabled={anyOpPending || !status.hasRemote}
            onClick={() => syncMutation.mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      {status.files.length > 0 && (
        <div className="glass space-y-1.5 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Changed files</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {status.files.map((file) => (
              <div key={file.path} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs">{file.path}</span>
                <GitStatusBadge x={file.x} y={file.y} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass space-y-2 rounded-lg p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="h-3.5 w-3.5" /> Create branch
          </p>
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="feat/my-change"
          />
          <div className="flex items-center gap-2 pt-1">
            <AiSuggestButton
              size="sm"
              label="Suggest with AI"
              pendingLabel="Thinking…"
              pendingTooltip="Generating a branch name, click to cancel"
              pending={suggestingBranch}
              disabled={status.files.length === 0}
              onStart={() => void handleSuggestBranchName()}
              onCancel={() => cancelAiRequest(branchRequestRef)}
            />
            <Button
              size="sm"
              disabled={createBranchMutation.isPending || !branchName.trim()}
              onClick={() => createBranchMutation.mutate(branchName)}
            >
              Create
            </Button>
          </div>
        </div>

        <div className="glass space-y-2 rounded-lg p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <GitCommit className="h-3.5 w-3.5" /> Commit changes
          </p>
          <Textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Describe what changed…"
            rows={3}
          />
          <div className="flex items-center gap-2 pt-1">
            <AiSuggestButton
              size="sm"
              label="Suggest with AI"
              pendingLabel="Thinking…"
              pendingTooltip="Writing a commit message, click to cancel"
              pending={suggestingCommit}
              disabled={status.files.length === 0}
              onStart={() => void handleSuggestCommitMessage()}
              onCancel={() => cancelAiRequest(commitRequestRef)}
            />
            <Button
              size="sm"
              disabled={commitMutation.isPending || !commitMessage.trim() || status.files.length === 0}
              onClick={() => commitMutation.mutate(commitMessage)}
            >
              Commit all changes
            </Button>
          </div>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Tag className="h-3.5 w-3.5" /> Version tag
          </p>
          <p className="text-xs text-muted-foreground">
            {tagsQuery.data?.latestTag
              ? `Latest tag ${tagsQuery.data.latestTag} · ${tagsQuery.data.commitsSinceLatestTag} commit${
                  tagsQuery.data.commitsSinceLatestTag === 1 ? '' : 's'
                } since then.`
              : 'No tags in this repository yet.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setTagOpen(true)}>
          <Tag className="h-3.5 w-3.5" /> Tag a version
        </Button>
      </div>

      <div className="glass flex items-center justify-between rounded-lg p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <GitPullRequest className="h-3.5 w-3.5" /> Pull request
          </p>
          <p className="text-xs text-muted-foreground">
            Pushes the current branch and opens a pull request via the GitHub CLI (or the compare page
            in your browser if it isn't installed).
          </p>
        </div>
        <Button variant="outline" onClick={() => setPrOpen(true)} disabled={!status.hasRemote}>
          <GitPullRequest className="h-3.5 w-3.5" /> Create Pull Request
        </Button>
      </div>

      <TagVersionDialog
        projectId={projectId}
        projectPath={projectPath}
        projectCliId={projectCliId}
        tagInfo={tagsQuery.data ?? null}
        open={tagOpen}
        onOpenChange={setTagOpen}
      />

      <CreatePrDialog
        projectId={projectId}
        branch={status.branch}
        defaultBranch={status.defaultBranch}
        open={prOpen}
        onOpenChange={setPrOpen}
        suggestedTitle={commitMessage.split('\n')[0]}
      />
    </div>
  );
}

/** Prompt handed to the agent CLI to roll a new version number through the project's files. */
function buildVersionBumpPrompt(tag: string): string {
  const version = tag.replace(/^v/, '');
  return [
    `Update this project's version to ${version} (git tag ${tag}).`,
    '',
    '- Set the version field in every manifest this repo actually uses: package.json (including',
    '  workspace packages), pyproject.toml, Cargo.toml, *.csproj, app.json, build.gradle,',
    '  Info.plist, and so on.',
    '- Update hard-coded version strings the application itself displays (about screens, footers,',
    '  constants such as APP_VERSION).',
    '- Leave lockfiles alone. Only touch a CHANGELOG if this project clearly keeps one.',
    '- Do not commit, tag or push anything. Just make the edits and list the files you changed.',
  ].join('\n');
}

function TagVersionDialog({
  projectId,
  projectPath,
  projectCliId,
  tagInfo,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectPath: string;
  projectCliId: string | null;
  tagInfo: GitTagInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);
  const appDefaultCliId = useCliStore((s) => s.defaultCliId);
  const [tag, setTag] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const suggestRequestRef = useRef<string | null>(null);

  const hasRemote = tagInfo?.hasRemote ?? false;
  // A project can pin its own CLI; otherwise it follows the app-wide default from Settings.
  const effectiveCliId = projectCliId ?? appDefaultCliId;

  /**
   * Version bumps edit source files, so this runs in a visible terminal session rather than
   * headlessly: the CLI starts with the prompt typed in, and the user hits Enter and reviews
   * the edits as the agent makes them.
   */
  async function handleApplyVersion(): Promise<void> {
    const cliDef = CLI_REGISTRY.find((cli) => cli.id === effectiveCliId);
    if (!cliDef) {
      toast.error("Choose a CLI for this project, or a default CLI in Settings.");
      return;
    }

    const promptFile = await window.agentmat.fs.writeScratchFile(
      `version-bump-${tag.trim().replace(/[^A-Za-z0-9._-]/g, '-')}.md`,
      buildVersionBumpPrompt(tag.trim()),
    );
    const executable = cliDef.executableNames[0];
    const command =
      window.agentmat.platform === 'win32'
        ? `& ${executable} (Get-Content -Raw -LiteralPath "${promptFile}")`
        : `${executable} "$(cat '${promptFile}')"`;

    openSession({
      title: `Bump to ${tag.trim()}`,
      cwd: projectPath,
      projectId,
      initialInput: command,
    });
    // Close without clearing the fields: the tag still has to be created once the bump is committed.
    onOpenChange(false);
  }

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
  });

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setTag('');
      setMessage('');
      setReason(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag a version</DialogTitle>
          <DialogDescription>
            {tagInfo?.latestTag ? (
              <>
                Latest tag is <span className="font-mono">{tagInfo.latestTag}</span>, with{' '}
                {tagInfo.commitsSinceLatestTag} commit
                {tagInfo.commitsSinceLatestTag === 1 ? '' : 's'} on top of it.
              </>
            ) : (
              'This repository has no tags yet.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tag name</Label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="v1.0.1"
              className="font-mono"
            />
            {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tag message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="What this release contains…"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Apply this version to the project</p>
              <p className="text-xs text-muted-foreground">
                Opens your default CLI in a terminal with a prompt to update package.json, other
                manifests and any version shown in the app. Commit those edits before tagging.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!tag.trim()}
              onClick={() => void handleApplyVersion()}
            >
              <FileCog className="h-3.5 w-3.5" /> Update version in files
            </Button>
          </div>

          {tagInfo && tagInfo.recentTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Existing:</span>
              {tagInfo.recentTags.map((existing) => (
                <Badge key={existing} variant="outline" className="font-mono text-[10px]">
                  {existing}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {hasRemote
              ? 'The tag is created locally and pushed to origin.'
              : 'No remote is configured, so the tag is only created locally.'}
          </p>
        </div>
        <DialogFooter>
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
          <Button
            disabled={createTagMutation.isPending || !tag.trim()}
            onClick={() => createTagMutation.mutate()}
          >
            <Tag className="h-4 w-4" /> {hasRemote ? 'Create & push tag' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePrDialog({
  projectId,
  branch,
  defaultBranch,
  open,
  onOpenChange,
  suggestedTitle,
}: {
  projectId: string;
  branch: string | null;
  defaultBranch: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedTitle: string;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');

  useEffect(() => {
    if (open) {
      setTitle((current) => current || suggestedTitle);
      setBase((current) => current || defaultBranch || 'main');
    }
    // Only seed title/base once, when the dialog opens; don't fight the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createPrMutation = useMutation({
    mutationFn: () => window.agentmat.git.createPullRequest({ projectId, title, body, base }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.usedFallback ? 'Opened compare page in your browser.' : 'Pull request created.');
        if (result.url) void window.agentmat.shell.openExternal(result.url);
        onOpenChange(false);
        setTitle('');
        setBody('');
      } else {
        toast.error(result.error ?? 'Failed to create pull request.');
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create pull request</DialogTitle>
          <DialogDescription>
            From <span className="font-mono">{branch ?? 'current branch'}</span> into base branch below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PR title" />
          </div>
          <div className="space-y-1.5">
            <Label>Base branch</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="main" />
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
          <Button
            disabled={createPrMutation.isPending || !title.trim()}
            onClick={() => createPrMutation.mutate()}
          >
            <GitPullRequest className="h-4 w-4" /> Create Pull Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function packageKey(pkg: PackageInfo): string {
  return `${pkg.manifestPath}::${pkg.name}`;
}

function ecosystemLabel(section: PackageManagerSection): string {
  if (section.ecosystem === 'dotnet') return 'NuGet (.NET)';
  if (section.manager === 'yarn') return 'Yarn';
  if (section.manager === 'pnpm') return 'pnpm';
  return 'npm';
}

/** Staggered widths so placeholder rows read as a list of names, not a stack of identical bars. */
const PACKAGE_SKELETON_WIDTHS = ['w-40', 'w-56', 'w-32', 'w-48', 'w-36', 'w-52'];

function PackageRowSkeleton({ nameWidth }: { nameWidth: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
      <Skeleton className="h-4 w-4 shrink-0 rounded-[4px]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={`h-3.5 ${nameWidth}`} />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
    </div>
  );
}

/**
 * Stand-in for one ecosystem card while the scan runs. It mirrors the real
 * card's shape (header, select-all bar, package rows) so the tab doesn't jump
 * when the data lands. A .NET scan shells out to `dotnet list package` for every
 * project in the solution and can take the better part of a minute, which is far
 * too long to leave the tab empty.
 */
function PackagesSectionSkeleton({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div className="glass space-y-3 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center rounded-md bg-card/60 px-3 py-1.5">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, i) => (
            <PackageRowSkeleton key={i} nameWidth={PACKAGE_SKELETON_WIDTHS[i % PACKAGE_SKELETON_WIDTHS.length]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PackagesTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <PackagesSectionSkeleton rows={5} />
      <PackagesSectionSkeleton rows={3} />
    </div>
  );
}

function PackagesTab({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showOutdatedOnly, setShowOutdatedOnly] = useState(false);
  const [progress, setProgress] = useState<
    Map<string, { status: 'running' | 'done' | 'error'; message?: string }>
  >(new Map());

  const scanQuery = useQuery({
    queryKey: queryKeys.packages(projectId),
    queryFn: () => window.agentmat.packages.list(projectId),
  });

  useEffect(() => {
    return window.agentmat.packages.onUpdateProgress((p) => {
      if (p.projectId !== projectId) return;
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(p.packageName, { status: p.status, message: p.message });
        return next;
      });
    });
  }, [projectId]);

  const updateMutation = useMutation({
    mutationFn: (updates: PackageUpdateRequest[]) => window.agentmat.packages.update(projectId, updates),
    onSuccess: (result) => {
      const failed = result.results.filter((r) => !r.ok);
      const count = result.results.length;
      if (result.ok) {
        toast.success(`Updated ${count} package${count === 1 ? '' : 's'}.`);
      } else {
        toast.error(`${failed.length} of ${count} package${count === 1 ? '' : 's'} failed to update.`);
      }
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: queryKeys.packages(projectId) });
    },
  });

  function toggle(key: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllOutdated(section: PackageManagerSection, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const pkg of section.packages) {
        if (!pkg.isOutdated) continue;
        if (checked) next.add(packageKey(pkg));
        else next.delete(packageKey(pkg));
      }
      return next;
    });
  }

  function updateSection(section: PackageManagerSection): void {
    const updates: PackageUpdateRequest[] = section.packages
      .filter((pkg) => selected.has(packageKey(pkg)))
      .map((pkg) => ({
        ecosystem: section.ecosystem,
        name: pkg.name,
        targetVersion: pkg.latestVersion ?? pkg.currentVersion,
        manifestPath: pkg.manifestPath,
      }));
    if (updates.length === 0) return;
    setProgress(new Map());
    updateMutation.mutate(updates);
  }

  if (scanQuery.isLoading) {
    return <PackagesTabSkeleton />;
  }

  const sections = scanQuery.data?.sections ?? [];
  // A refresh keeps the current list on screen rather than collapsing back to
  // skeletons: the versions shown are still the last known good ones, and a
  // .NET rescan is slow enough that blanking them out would be a regression.
  const isRefreshing = scanQuery.isFetching;

  if (sections.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={scanQuery.isFetching}
            onClick={() => void scanQuery.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          No npm/yarn/pnpm or .NET project files were found in this project's folder.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={showOutdatedOnly} onCheckedChange={setShowOutdatedOnly} />
          Show outdated only
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={scanQuery.isFetching}
          onClick={() => void scanQuery.refetch()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {sections.map((section) => {
        const outdatedPackages = section.packages.filter((p) => p.isOutdated);
        const sectionSelectedCount = section.packages.filter((p) => selected.has(packageKey(p))).length;
        const allOutdatedSelected =
          outdatedPackages.length > 0 && outdatedPackages.every((p) => selected.has(packageKey(p)));
        const showProjectLabel = new Set(section.packages.map((p) => p.projectLabel)).size > 1;
        const visiblePackages = showOutdatedOnly ? outdatedPackages : section.packages;

        return (
          <div
            key={`${section.ecosystem}-${section.manager}`}
            className="glass relative space-y-3 overflow-hidden rounded-xl p-4"
          >
            {isRefreshing && <Skeleton className="absolute inset-x-0 top-0 h-0.5 rounded-none" />}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {ecosystemLabel(section)}
                    {outdatedPackages.length > 0 && (
                      <Badge variant="warning">{outdatedPackages.length} outdated</Badge>
                    )}
                    {section.status === 'ok' &&
                      outdatedPackages.length === 0 &&
                      section.packages.length > 0 && <Badge variant="success">Up to date</Badge>}
                  </span>
                  {section.status === 'ok' && section.packages.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {section.packages.length} package{section.packages.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
              {section.status === 'ok' && section.packages.length > 0 && (
                <Button
                  size="sm"
                  disabled={sectionSelectedCount === 0 || updateMutation.isPending}
                  onClick={() => updateSection(section)}
                >
                  {updateMutation.isPending ? (
                    <Spinner className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Update Selected ({sectionSelectedCount})
                </Button>
              )}
            </div>

            {section.status === 'cli-missing' && (
              <p className="text-sm text-muted-foreground">{section.message}</p>
            )}

            {section.status === 'error' && <p className="text-sm text-destructive">{section.message}</p>}

            {section.status === 'ok' && section.message && (
              <p className="text-sm text-muted-foreground">{section.message}</p>
            )}

            {section.status === 'ok' && section.packages.length === 0 && (
              <p className="text-sm text-muted-foreground">No dependencies declared.</p>
            )}

            {section.status === 'ok' && section.packages.length > 0 && visiblePackages.length === 0 && (
              <p className="text-sm text-muted-foreground">All packages are up to date.</p>
            )}

            {section.status === 'ok' && visiblePackages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md bg-card/60 px-3 py-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allOutdatedSelected}
                      disabled={outdatedPackages.length === 0}
                      onCheckedChange={(checked) => toggleAllOutdated(section, checked === true)}
                    />
                    Select all outdated
                  </label>
                  {sectionSelectedCount > 0 && (
                    <span className="text-xs text-muted-foreground">{sectionSelectedCount} selected</span>
                  )}
                </div>
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {visiblePackages.map((pkg) => {
                    const key = packageKey(pkg);
                    const tick = progress.get(pkg.name);
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 transition-colors hover:bg-card"
                      >
                        <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{pkg.name}</span>
                            {pkg.isDev && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] leading-4">
                                dev
                              </Badge>
                            )}
                            {showProjectLabel && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] leading-4">
                                {pkg.projectLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <span>{pkg.currentVersion}</span>
                            {pkg.isOutdated && pkg.latestVersion && (
                              <>
                                <ArrowRight className="h-2.5 w-2.5" />
                                <span className="text-foreground">{pkg.latestVersion}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex w-28 shrink-0 items-center justify-end gap-2">
                          {tick?.status === 'running' && (
                            <Spinner className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                          {tick?.status === 'done' && <Check className="h-3.5 w-3.5 text-success" />}
                          {tick?.status === 'error' && (
                            <SimpleTooltip label={tick.message ?? 'Update failed'} wrapTrigger>
                              <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
                            </SimpleTooltip>
                          )}
                          {!tick &&
                            (pkg.isOutdated ? (
                              <Badge variant="warning">Outdated</Badge>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Check className="h-3 w-3 text-success" /> Up to date
                              </span>
                            ))}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
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
          Hooks found in this project's <code className="rounded bg-muted px-1">.claude/settings.json</code>{' '}
          and <code className="rounded bg-muted px-1">settings.local.json</code> that AgentMate didn't create.
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

  useEffect(() => {
    if (dirty) return;
    setEnabled(saved.enabled);
    setCliId(saved.cliId ?? '');
    setMessage(saved.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.enabled, saved.cliId, saved.message]);

  const scriptFileName = kind === 'completion' ? 'notify-completion.cjs' : 'notify-confirmation.cjs';
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
            options={installedAgents.map((cli) => ({ value: cli.id, label: cli.name }))}
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
                Automatically wired into <code className="rounded bg-muted px-1">.claude/settings.json</code>{' '}
                for {savedCli?.name ?? 'Claude Code'}.
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
