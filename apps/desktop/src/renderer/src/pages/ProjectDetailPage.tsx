import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
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
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Pencil,
  Play,
  Plug,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Wand2,
  X,
} from '@/components/icons';
import { CliLogo } from '@/components/cliLogos';
import { CLI_REGISTRY } from '@agentmat/core';
import type {
  CliDefinition,
  DetectedClaudeHook,
  NotificationHookKind,
  Project,
  ProjectNotificationHook,
  ProjectNotificationSettings,
  ScheduledTask,
} from '@agentmat/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { ProjectFileBrowser } from '@/components/projects/ProjectFileBrowser';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
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

  const installedMcpServersQuery = useQuery({
    queryKey: queryKeys.installedMcpServers(projectId ?? ''),
    queryFn: () => window.agentmat.mcp.listInstalled(projectId!),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => window.agentmat.projects.update(projectId!, values),
    onSuccess: () => {
      toast.success('Project updated.');
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: () => window.agentmat.projects.bootstrap(projectId!),
    onSuccess: (result) => {
      toast.success(`Bootstrapped ${result.createdFiles.length} file(s).`);
      void queryClient.invalidateQueries({ queryKey: ['project-dir'] });
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

      <div className="rounded-lg border border-border bg-card p-5">
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
                <button
                  type="button"
                  onClick={() => void handleCopyPath()}
                  className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"
                  title="Copy path"
                >
                  <Folder className="h-3 w-3 shrink-0" />
                  <span className="truncate">{project.folderPath}</span>
                  <Copy className="h-3 w-3 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenInFileExplorer()}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Open in File Explorer"
                >
                  <FolderOpen className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenTerminalHere}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Open terminal here"
                >
                  <TerminalSquare className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {project.runCommand && (
              <Button size="sm" onClick={handleRun}>
                <Play /> Run
              </Button>
            )}
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
        <div className="xl:col-span-3">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <File className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="bootstrap" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Bootstrap
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-1.5">
                <Blocks className="h-3.5 w-3.5" /> Skills
              </TabsTrigger>
              <TabsTrigger value="mcp" className="gap-1.5">
                <Plug className="h-3.5 w-3.5" /> MCP
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
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <Textarea value={project.notes} readOnly rows={6} placeholder="No notes yet." />
            </TabsContent>

            <TabsContent value="bootstrap" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Creates the standard AgentMate folder structure and starter docs for this project.
                </p>
                <Button onClick={() => bootstrapMutation.mutate()} disabled={bootstrapMutation.isPending}>
                  <Wand2 /> Bootstrap Project
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderTree className="h-3.5 w-3.5" /> Browse and edit project files
              </div>
              <ProjectFileBrowser rootPath={project.folderPath} />
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

            <TabsContent value="git" className="space-y-4">
              <GitTab projectId={project.id} />
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
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Details</p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Agent</dt>
                <dd className="font-medium">{project.agentType}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">Run command</dt>
                <dd className="min-w-0 truncate text-right font-mono text-xs" title={project.runCommand}>
                  {project.runCommand || '—'}
                </dd>
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
                <dd className="text-right">{project.tags.length > 0 ? project.tags.length : '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

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
                  <Button variant="ghost" size="icon" title="Run now" onClick={() => void handleRun(task)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Mark completed"
                    onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: 'completed' })}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Cancel"
                    onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: 'cancelled' })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => removeMutation.mutate(task.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.rawInput}</p>
        </div>
      ))}
    </div>
  );
}

/** Strips markdown fences/quotes and collapses to a single line — for AI-suggested branch names. */
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

/** Strips markdown fences/quotes but keeps line breaks — for AI-suggested commit messages. */
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

function GitTab({ projectId }: { projectId: string }): React.JSX.Element {
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

  const statusQuery = useQuery({
    queryKey: queryKeys.gitStatus(projectId),
    queryFn: () => window.agentmat.git.status(projectId),
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

  async function handleSuggestBranchName(): Promise<void> {
    if (!(await requireAiModel())) return;
    setSuggestingBranch(true);
    try {
      const summary = await window.agentmat.git.changeSummary(projectId);
      const prompt =
        'Generate a single short git branch name (kebab-case, e.g. "feat/add-login" or ' +
        '"fix/null-check", max 60 characters, no spaces, no quotes, no markdown) describing these ' +
        `uncommitted changes. Reply with ONLY the branch name and nothing else.\n\n${summary}`;
      const result = await window.agentmat.ai.ask({ provider: provider as AiProvider, model, prompt });
      if (result.ok && result.text.trim()) {
        setBranchName(sanitizeBranchName(result.text));
      } else {
        toast.error(result.error || 'AI did not return a branch name.');
      }
    } finally {
      setSuggestingBranch(false);
    }
  }

  async function handleSuggestCommitMessage(): Promise<void> {
    if (!(await requireAiModel())) return;
    setSuggestingCommit(true);
    try {
      const summary = await window.agentmat.git.changeSummary(projectId);
      const prompt =
        'Write a concise, conventional-commit style git commit message (a short summary line, ' +
        'optionally followed by a brief body) describing these changes. Reply with ONLY the commit ' +
        `message, no code fences, no extra commentary.\n\n${summary}`;
      const result = await window.agentmat.ai.ask({ provider: provider as AiProvider, model, prompt });
      if (result.ok && result.text.trim()) {
        setCommitMessage(sanitizeCommitMessage(result.text));
      } else {
        toast.error(result.error || 'AI did not return a commit message.');
      }
    } finally {
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
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
          <Button disabled={anyOpPending || !status.hasRemote} onClick={() => syncMutation.mutate()}>
            <RefreshCw className="h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      {status.files.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
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
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="h-3.5 w-3.5" /> Create branch
          </p>
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="feat/my-change"
          />
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={suggestingBranch || status.files.length === 0}
              onClick={() => void handleSuggestBranchName()}
            >
              <Sparkles className="h-3.5 w-3.5" /> {suggestingBranch ? 'Thinking…' : 'Suggest with AI'}
            </Button>
            <Button
              size="sm"
              disabled={createBranchMutation.isPending || !branchName.trim()}
              onClick={() => createBranchMutation.mutate(branchName)}
            >
              Create
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
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
            <Button
              variant="outline"
              size="sm"
              disabled={suggestingCommit || status.files.length === 0}
              onClick={() => void handleSuggestCommitMessage()}
            >
              <Sparkles className="h-3.5 w-3.5" /> {suggestingCommit ? 'Thinking…' : 'Suggest with AI'}
            </Button>
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

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
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

      <CreatePrDialog
        projectId={projectId}
        branch={status.branch}
        open={prOpen}
        onOpenChange={setPrOpen}
        suggestedTitle={commitMessage.split('\n')[0]}
      />
    </div>
  );
}

function CreatePrDialog({
  projectId,
  branch,
  open,
  onOpenChange,
  suggestedTitle,
}: {
  projectId: string;
  branch: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedTitle: string;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('main');

  useEffect(() => {
    if (open) setTitle((current) => current || suggestedTitle);
    // Only seed the title once, when the dialog opens — don't fight the user's edits.
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
                <p
                  className="truncate font-mono text-xs text-muted-foreground/80"
                  title={summarizeHook(hook.hook)}
                >
                  {summarizeHook(hook.hook)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" title="Edit hook" onClick={() => setEditingHook(hook)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete hook"
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
        toast.success('Sent — check Telegram.');
      } else {
        toast.error(result.error ?? 'Failed to send test message.');
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
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
