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
  Copy,
  File,
  FileCog,
  Folder,
  FolderTree,
  Pencil,
  Play,
  Save,
  Send,
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

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
              <button
                type="button"
                onClick={() => void handleCopyPath()}
                className="flex max-w-full items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"
                title="Copy path"
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.folderPath}</span>
                <Copy className="h-3 w-3 shrink-0" />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Remove "${project.name}" from AgentMate? Files on disk are kept.`)) {
                  deleteMutation.mutate();
                }
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
              <Button
                onClick={() => openSession({ title: project.name, cwd: project.folderPath, projectId: project.id })}
              >
                <TerminalSquare /> Open Terminal Here
              </Button>
            </TabsContent>

            <TabsContent value="config">
              <ProjectConfigEditor projectFolderPath={project.folderPath} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 xl:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Details</p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Agent</dt>
                <dd className="font-medium">{project.agentType}</dd>
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
                  <Bell className="h-3.5 w-3.5 shrink-0" />
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
                    if (confirm(`Remove this ${hook.event} hook from ${sourceFileLabel(hook.id)}?`)) {
                      deleteHookMutation.mutate(hook.id);
                    }
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
    <div className="rounded-2xl border border-border bg-card p-5">
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
