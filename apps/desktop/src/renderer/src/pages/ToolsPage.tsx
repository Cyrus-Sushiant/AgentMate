import {
  AGENT_TOOL_REGISTRY,
  type AgentToolDefinition,
  CODEQL_TOOL_ID,
  LANGUAGETOOL_DOWNLOAD_URL,
  LANGUAGETOOL_TOOL_ID,
  SECURITY_TOOL_CATEGORY,
  type SupportedOS,
  type ToolSettingsAction,
  type ToolSettingsValues,
} from '@agentmat/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CloudDownload,
  Download,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Globe,
  Play,
  RefreshCw,
  Shield,
  StopCircle,
  TerminalSquare,
  Trash2,
  Wrench,
} from '@/components/icons';
import { CodeqlInstallCard } from '@/components/tools/CodeqlInstallCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';

type DockerAction = 'run' | 'start' | 'stop' | 'reset' | 'remove';

interface PendingToolUpdate {
  tool: AgentToolDefinition;
  currentVersion: string | null;
  latestVersion: string;
  command: string;
}

/**
 * Category names read well on a card badge but are too long for a tab, so the tab shows the
 * distinctive half. "Security & Code Scanning" becomes "Security", "Token & Cost Optimization"
 * becomes "Token & Cost".
 */
/**
 * Names the install button after whatever actually runs, rather than assuming npm. Every tool
 * with a Docker option used to be npm-installed, so the button was hardcoded to "Install (npm)",
 * which became a lie the moment a pip or winget tool gained a Docker option.
 */
function installLabel(command: string | undefined): string {
  if (!command) return 'Install';
  const first = command.trim().split(/\s+/)[0].toLowerCase();
  const known: Record<string, string> = {
    npm: 'npm',
    pnpm: 'pnpm',
    pip: 'pip',
    pip3: 'pip',
    pipx: 'pipx',
    brew: 'brew',
    winget: 'winget',
    choco: 'choco',
    scoop: 'scoop',
    go: 'go',
    cargo: 'cargo',
    curl: 'script',
    wget: 'script',
    sudo: 'apt',
  };
  const manager = known[first];
  return manager ? `Install (${manager})` : 'Install';
}

function shortCategoryLabel(category: string): string {
  const first = category.split(' & ')[0];
  return first === 'Token' ? 'Token & Cost' : first;
}

function CountPill({ value }: { value: number }): React.JSX.Element | null {
  if (value <= 0) return null;
  return (
    <span className="min-w-4 rounded-full bg-muted px-1.5 text-center text-[10px] font-medium tabular-nums text-muted-foreground group-data-[state=active]:bg-foreground/10 group-data-[state=active]:text-foreground">
      {value}
    </span>
  );
}

export default function ToolsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openSession = useTerminalStore((s) => s.openSession);

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [settingsTool, setSettingsTool] = useState<AgentToolDefinition | null>(null);
  const [settingsValues, setSettingsValues] = useState<ToolSettingsValues>({});
  const [checkingToolId, setCheckingToolId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingToolUpdate | null>(null);
  const [, setUpdateQueue] = useState<PendingToolUpdate[]>([]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const statusQuery = useQuery({
    queryKey: queryKeys.toolsStatus,
    queryFn: () => window.agentmat.tools.detectAll(),
  });
  // CodeQL can live in AgentMate's tools folder rather than on PATH, which the shared
  // detectAll probe cannot see, so its card asks separately.
  const codeqlQuery = useQuery({
    queryKey: queryKeys.codeqlStatus,
    queryFn: () => window.agentmat.security.codeqlStatus(),
    meta: { silentLoading: true },
  });
  // LanguageTool isn't on PATH: it lives in the app's tools folder, so its card
  // reads the grammar status instead of the PATH probe every other tool uses.
  const languageToolQuery = useQuery({
    queryKey: queryKeys.grammarLocalStatus,
    queryFn: () => window.agentmat.grammar.localStatus(),
  });

  const selectedProject = projectsQuery.data?.find((p) => p.id === selectedProjectId);

  function statusFor(toolId: string) {
    return statusQuery.data?.find((s) => s.id === toolId);
  }

  async function openToolsFolder(): Promise<void> {
    const dir = await window.agentmat.grammar.openToolsFolder();
    toast.info(`Extract LanguageTool-stable.zip into ${dir}`);
  }

  async function toggleLanguageToolServer(action: 'start' | 'stop'): Promise<void> {
    if (action === 'start') toast.info('Starting LanguageTool. The first start loads its rules.');
    const next =
      action === 'start'
        ? await window.agentmat.grammar.startLocal()
        : await window.agentmat.grammar.stopLocal();
    queryClient.setQueryData(queryKeys.grammarLocalStatus, next);
    if (action === 'start') {
      if (next.serverState === 'running') toast.success('LanguageTool is running.');
      else toast.error(next.error ?? 'LanguageTool did not start.');
    }
  }

  async function runAction(
    action: ToolSettingsAction,
    tool: AgentToolDefinition,
    title: string,
  ): Promise<void> {
    if (action.kind === 'command') {
      if (action.cwd === 'project' && !selectedProject) {
        toast.error('Choose a target project first.');
        return;
      }
      openSession({
        title,
        initialInput: action.command,
        cwd: action.cwd === 'project' ? selectedProject!.folderPath : undefined,
      });
      toast.info(`Press Enter in the terminal to run this for ${tool.name}.`);
      return;
    }
    if (action.kind === 'write-project-file') {
      if (!selectedProject) {
        toast.error('Choose a target project first.');
        return;
      }
      await window.agentmat.fs.writeFile(
        `${selectedProject.folderPath}/${action.relativePath}`,
        action.content,
      );
      toast.success(`${action.relativePath} written to ${selectedProject.name}.`);
      return;
    }
    await navigator.clipboard.writeText(action.content);
    toast.success('Copied to clipboard. ' + action.instructions);
  }

  async function handleInstall(tool: AgentToolDefinition): Promise<void> {
    const command = await window.agentmat.tools.getInstallCommand(tool.id);
    if (!command) {
      toast.error(`No install command available for ${tool.name} on this OS.`);
      return;
    }
    openSession({ title: `Install ${tool.name}`, initialInput: command });
    toast.info(`Press Enter in the terminal to install ${tool.name}.`);
  }

  async function buildPendingUpdate(
    tool: AgentToolDefinition,
    currentVersion: string | null,
  ): Promise<PendingToolUpdate | 'uncheckable' | 'up-to-date' | null> {
    const result = await window.agentmat.tools.checkForUpdate(tool.id, currentVersion);
    if (!result.supported || !result.latestVersion) return 'uncheckable';
    if (!result.updateAvailable) return 'up-to-date';
    const command = await window.agentmat.tools.getUpdateCommand(tool.id);
    if (!command) return null;
    return { tool, currentVersion, latestVersion: result.latestVersion, command };
  }

  async function handleCheckForUpdate(
    tool: AgentToolDefinition,
    currentVersion: string | null,
  ): Promise<void> {
    setCheckingToolId(tool.id);
    try {
      const pending = await buildPendingUpdate(tool, currentVersion);
      if (pending === 'uncheckable') {
        toast.info(`Can't check updates for ${tool.name} automatically.`);
        return;
      }
      if (pending === 'up-to-date') {
        toast.success(`${tool.name} is up to date.`);
        return;
      }
      if (!pending) {
        toast.error(`No update command available for ${tool.name} on this OS.`);
        return;
      }
      setPendingUpdate(pending);
    } finally {
      setCheckingToolId(null);
    }
  }

  function dismissPendingUpdate(): void {
    setUpdateQueue((queue) => {
      const [next, ...rest] = queue;
      setPendingUpdate(next ?? null);
      return rest;
    });
  }

  function handleConfirmUpdate(): void {
    if (!pendingUpdate) return;
    openSession({
      title: `Update ${pendingUpdate.tool.name}`,
      initialInput: pendingUpdate.command,
    });
    toast.info(`Press Enter in the terminal to update ${pendingUpdate.tool.name}.`);
    dismissPendingUpdate();
  }

  async function handleCheckAllForUpdates(): Promise<void> {
    const installedTools = AGENT_TOOL_REGISTRY.filter(
      (tool) => tool.updateCheck && statusFor(tool.id)?.installed,
    );
    if (installedTools.length === 0) {
      toast.info('No installed tools to check.');
      return;
    }

    setCheckingAll(true);
    try {
      const updates: PendingToolUpdate[] = [];
      let uncheckable = 0;
      for (const tool of installedTools) {
        const pending = await buildPendingUpdate(tool, statusFor(tool.id)?.version ?? null);
        if (pending === 'uncheckable' || pending === null) {
          uncheckable += 1;
          continue;
        }
        if (pending !== 'up-to-date') updates.push(pending);
      }

      if (updates.length === 0) {
        toast.success(
          uncheckable > 0
            ? `All checkable tools are up to date (${uncheckable} could not be checked).`
            : 'All tools are up to date.',
        );
        return;
      }

      toast.info(`${updates.length} tool update${updates.length > 1 ? 's' : ''} available.`);
      const [first, ...rest] = updates;
      setPendingUpdate(first);
      setUpdateQueue(rest);
    } finally {
      setCheckingAll(false);
    }
  }

  async function handleUninstall(tool: AgentToolDefinition): Promise<void> {
    const command = await window.agentmat.tools.getUninstallCommand(tool.id);
    if (!command) {
      toast.error(`No uninstall command available for ${tool.name} on this OS.`);
      return;
    }
    openSession({ title: `Uninstall ${tool.name}`, initialInput: command });
    toast.info(`Press Enter in the terminal to uninstall ${tool.name}.`);
  }

  function handleCopyManualInstructions(tool: AgentToolDefinition): void {
    void navigator.clipboard.writeText(tool.manualInstallInstructions ?? '');
    toast.success(`Setup commands copied. Run them inside ${tool.name}'s target agent.`);
  }

  async function handleInteractiveInstall(tool: AgentToolDefinition): Promise<void> {
    if (!tool.interactiveInstall) return;
    const launchCommand = await window.agentmat.tools.getInteractiveLaunchCommand(tool.id);
    if (!launchCommand) {
      toast.error(`No launch command available for ${tool.name} on this OS.`);
      return;
    }
    // Open the terminal first; if the clipboard write below fails (e.g. no OS focus yet),
    // the user still gets a working terminal instead of the click silently doing nothing.
    openSession({ title: `Install ${tool.name}`, initialInput: launchCommand });
    // xterm.js reserves plain Ctrl+V for the shell's own control-character convention (^V) and
    // doesn't paste with it. Its actual paste shortcut is Ctrl+Shift+V (Cmd+V on macOS, which
    // isn't used for anything else there so it works as a normal paste).
    const pasteShortcut = window.agentmat.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+Shift+V';
    try {
      await navigator.clipboard.writeText(tool.interactiveInstall.pasteCommands);
      toast.info(
        `Press Enter to launch ${launchCommand}, then paste (${pasteShortcut}, not Ctrl+V) and press Enter again to install ${tool.name}.`,
      );
    } catch {
      toast.info(
        `Press Enter to launch ${launchCommand}, then type: ${tool.interactiveInstall.pasteCommands.replace('\n', ', then ')}`,
      );
    }
  }

  function handleCopyManualUninstall(tool: AgentToolDefinition): void {
    void navigator.clipboard.writeText(tool.manualUninstallInstructions ?? '');
    toast.success(`Uninstall commands copied. Run them inside ${tool.name}'s target agent.`);
  }

  async function handleDockerAction(
    tool: AgentToolDefinition,
    action: DockerAction,
  ): Promise<void> {
    const command = await window.agentmat.tools.getDockerCommand(tool.id, action);
    if (!command) {
      toast.error('Docker command unavailable for this tool.');
      return;
    }
    const verb = action === 'run' ? 'install' : action === 'remove' ? 'delete' : action;
    openSession({ title: `${action} ${tool.name} container`, initialInput: command });
    toast.info(`Press Enter in the terminal to ${verb} the container.`);
  }

  function openSettings(tool: AgentToolDefinition): void {
    const defaults: ToolSettingsValues = {};
    for (const field of tool.settingsFields ?? []) defaults[field.key] = field.defaultValue;
    setSettingsValues(defaults);
    setSettingsTool(tool);
  }

  const preview = useMemo(() => {
    if (!settingsTool?.buildSettingsAction) return null;
    return settingsTool.buildSettingsAction(settingsValues);
  }, [settingsTool, settingsValues]);

  const requiresProject =
    preview?.kind === 'write-project-file' ||
    (preview?.kind === 'command' && preview.cwd === 'project');

  async function handleApplySettings(): Promise<void> {
    if (!settingsTool || !preview) return;
    await runAction(preview, settingsTool, `Configure ${settingsTool.name}`);
    setSettingsTool(null);
  }

  // Derived from the registry rather than hardcoded, so adding a tool with a new category adds
  // its tab automatically. Security leads because it is the one people come here looking for.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of AGENT_TOOL_REGISTRY) {
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    }
    const rest = [...counts.keys()]
      .filter((c) => c !== SECURITY_TOOL_CATEGORY)
      .sort((a, b) => a.localeCompare(b));
    const ordered = counts.has(SECURITY_TOOL_CATEGORY) ? [SECURITY_TOOL_CATEGORY, ...rest] : rest;
    return ordered.map((category) => ({ category, count: counts.get(category) ?? 0 }));
  }, []);

  const tabParam = searchParams.get('tab');
  const activeCategory =
    tabParam === 'security'
      ? SECURITY_TOOL_CATEGORY
      : categories.some((c) => c.category === tabParam)
        ? (tabParam as string)
        : 'all';

  function setActiveCategory(next: string): void {
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        if (next === 'all') updated.delete('tab');
        else updated.set('tab', next === SECURITY_TOOL_CATEGORY ? 'security' : next);
        return updated;
      },
      { replace: true },
    );
  }

  const visibleTools = useMemo(
    () =>
      activeCategory === 'all'
        ? AGENT_TOOL_REGISTRY
        : AGENT_TOOL_REGISTRY.filter((tool) => tool.category === activeCategory),
    [activeCategory],
  );

  usePageHeader(
    'Agent Tools',
    'Curated third-party tools that cut agent token spend or improve code quality. Install, configure, and run them from here.',
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label>Target project</Label>
          <Combobox
            className="w-56"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="Choose a project"
            searchPlaceholder="Search projects…"
            options={projectsQuery.data?.map((p) => ({ value: p.id, label: p.name })) ?? []}
            clearable
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={checkingAll}
            onClick={() => void handleCheckAllForUpdates()}
          >
            <CloudDownload className={checkingAll ? 'animate-pulse' : undefined} />
            {checkingAll ? 'Checking updates…' : 'Check all for updates'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.toolsStatus });
              toast.info('Re-checking installed tools…');
            }}
          >
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Some actions (initializing a tool in a project, writing its config) need a target project
        above. Docker and global setup actions don't.
      </p>

      <Tabs
        value={activeCategory}
        onValueChange={setActiveCategory}
        className="flex flex-col gap-4"
      >
        <div className="flex items-end gap-3 border-b border-border">
          <TabsList containerClassName="min-w-0 flex-1 border-b-0">
            <TabsTrigger value="all" className="group gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              All
              <CountPill value={AGENT_TOOL_REGISTRY.length} />
            </TabsTrigger>
            {categories.map(({ category, count }) => (
              <TabsTrigger key={category} value={category} className="group gap-1.5">
                {category === SECURITY_TOOL_CATEGORY ? <Shield className="h-3.5 w-3.5" /> : null}
                {shortCategoryLabel(category)}
                <CountPill value={count} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTools.map((tool) => {
          const isLanguageTool = tool.id === LANGUAGETOOL_TOOL_ID;
          const isCodeql = tool.id === CODEQL_TOOL_ID;
          // A shell tool with no command for this OS must not offer an Install button that
          // can only fail; it falls back to its written instructions instead.
          const osInstallCommand = tool.installCommand?.[window.agentmat.platform as SupportedOS];
          const canShellInstall = tool.installKind === 'shell' && Boolean(osInstallCommand);
          const languageTool = isLanguageTool ? languageToolQuery.data : undefined;
          const codeql = isCodeql ? codeqlQuery.data : undefined;
          const status = isLanguageTool
            ? {
                id: tool.id,
                installed: Boolean(languageTool?.installPath),
                version: languageTool?.version ? `v${languageTool.version}` : null,
                dockerStatus: 'unavailable' as const,
                lastCheckedAt: '',
              }
            : isCodeql
              ? {
                  id: tool.id,
                  installed: Boolean(codeql?.installed),
                  version: codeql?.version ?? null,
                  dockerStatus: 'unavailable' as const,
                  lastCheckedAt: '',
                }
              : statusFor(tool.id);
          return (
            <Card key={tool.id} className="glass flex flex-col hover:border-primary/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{tool.name}</CardTitle>
                  <Badge variant="outline">{tool.category}</Badge>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {/* "Not detected" is a result, not a starting state, so shimmer
                      the badge until the scan actually says so. */}
                  {(
                    isLanguageTool
                      ? languageToolQuery.isPending
                      : isCodeql
                        ? codeqlQuery.isPending
                        : statusQuery.isPending
                  ) ? (
                    <Skeleton className="h-5 w-24 rounded-full" />
                  ) : (
                    <Badge variant={status?.installed ? 'success' : 'secondary'}>
                      {status?.installed
                        ? (status.version ?? 'Installed')
                        : isLanguageTool
                          ? 'Not in tools folder'
                          : isCodeql
                            ? 'Not downloaded'
                            : 'Not detected'}
                    </Badge>
                  )}
                  {isLanguageTool && languageTool?.serverState === 'running' ? (
                    <Badge variant="success">Server running</Badge>
                  ) : null}
                  {tool.docker && statusQuery.isPending && (
                    <Skeleton className="h-5 w-28 rounded-full" />
                  )}
                  {tool.docker && !statusQuery.isPending && (
                    <Badge
                      variant={
                        status?.dockerStatus === 'running'
                          ? 'success'
                          : status?.dockerStatus === 'stopped'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      Docker: {status?.dockerStatus ?? 'unknown'}
                    </Badge>
                  )}
                  {tool.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{tool.author}</div>

                <div className="flex flex-wrap items-center gap-2">
                  {isCodeql ? (
                    <CodeqlInstallCard />
                  ) : isLanguageTool ? (
                    <>
                      <Button
                        size="sm"
                        variant={status?.installed ? 'outline' : 'default'}
                        onClick={() =>
                          void window.agentmat.shell.openExternal(LANGUAGETOOL_DOWNLOAD_URL)
                        }
                      >
                        <Download /> Download zip
                      </Button>
                      <SimpleTooltip label="Extract the zip here, then start the server">
                        <Button size="sm" variant="outline" onClick={() => void openToolsFolder()}>
                          <FolderOpen /> Open tools folder
                        </Button>
                      </SimpleTooltip>
                      {languageTool?.serverState === 'running' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleLanguageToolServer('stop')}
                        >
                          <StopCircle /> Stop server
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!status?.installed}
                          onClick={() => void toggleLanguageToolServer('start')}
                        >
                          <Play /> Start server
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate('/settings?tab=ai')}
                      >
                        <Wrench /> Writing settings
                      </Button>
                    </>
                  ) : canShellInstall ? (
                    status?.installed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleUninstall(tool)}
                      >
                        <Trash2 /> Uninstall
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void handleInstall(tool)}>
                        <TerminalSquare /> {installLabel(osInstallCommand)}
                      </Button>
                    )
                  ) : tool.installKind === 'interactive' ? (
                    <SimpleTooltip
                      label={`Opens a terminal running ${tool.name}'s target agent and copies the setup commands to paste in`}
                    >
                      <Button size="sm" onClick={() => void handleInteractiveInstall(tool)}>
                        <TerminalSquare /> Install
                      </Button>
                    </SimpleTooltip>
                  ) : (
                    <SimpleTooltip
                      label={
                        tool.installKind === 'shell'
                          ? `${tool.name} has no install command for this operating system. Copies its setup notes instead.`
                          : ''
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyManualInstructions(tool)}
                      >
                        <TerminalSquare />
                        {tool.installKind === 'shell'
                          ? 'Setup instructions'
                          : 'Copy setup commands'}
                      </Button>
                    </SimpleTooltip>
                  )}
                  {tool.updateCheck && status?.installed && (
                    <SimpleTooltip
                      label="Check for updates"
                      wrapTrigger={checkingToolId === tool.id}
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={checkingToolId === tool.id}
                        onClick={() => void handleCheckForUpdate(tool, status.version)}
                      >
                        <CloudDownload
                          className={
                            checkingToolId === tool.id ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'
                          }
                        />
                      </Button>
                    </SimpleTooltip>
                  )}

                  {tool.manualUninstallInstructions && (
                    <SimpleTooltip label="Copy uninstall commands">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyManualUninstall(tool)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}

                  {tool.docker &&
                    (status?.dockerStatus === 'unavailable' ? (
                      <SimpleTooltip label="Docker isn't installed on this machine">
                        <Button variant="outline" size="sm" disabled>
                          Install with Docker
                        </Button>
                      </SimpleTooltip>
                    ) : status?.dockerStatus === 'not-created' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDockerAction(tool, 'run')}
                      >
                        <Play /> Install with Docker
                      </Button>
                    ) : (
                      <>
                        <SimpleTooltip label="Start container">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={status?.dockerStatus === 'running'}
                            onClick={() => void handleDockerAction(tool, 'start')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </SimpleTooltip>
                        <SimpleTooltip label="Stop container">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={status?.dockerStatus === 'stopped'}
                            onClick={() => void handleDockerAction(tool, 'stop')}
                          >
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        </SimpleTooltip>
                        <SimpleTooltip label="Reset container (recreate from image)">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => void handleDockerAction(tool, 'reset')}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </SimpleTooltip>
                        <SimpleTooltip label="Delete container">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => void handleDockerAction(tool, 'remove')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </SimpleTooltip>
                        {tool.docker.dashboardUrl && status?.dockerStatus === 'running' && (
                          <SimpleTooltip label="Open dashboard">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                void window.agentmat.shell.openExternal(tool.docker!.dashboardUrl!)
                              }
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          </SimpleTooltip>
                        )}
                      </>
                    ))}

                  {tool.settingsFields && tool.settingsFields.length > 0 && (
                    <SimpleTooltip label="Configure">
                      <Button variant="outline" size="icon" onClick={() => openSettings(tool)}>
                        <Wrench className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}

                  {tool.quickActions?.map((qa) => (
                    <Button
                      key={qa.id}
                      variant="outline"
                      size="sm"
                      onClick={() => void runAction(qa.action, tool, qa.label)}
                    >
                      {qa.label}
                    </Button>
                  ))}

                  {tool.websiteUrl && (
                    <SimpleTooltip label="Website">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void window.agentmat.shell.openExternal(tool.websiteUrl!)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                  <SimpleTooltip label="GitHub">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void window.agentmat.shell.openExternal(tool.repositoryUrl)}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={pendingUpdate !== null}
        onOpenChange={(open) => !open && dismissPendingUpdate()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {pendingUpdate?.tool.name}?</DialogTitle>
            <DialogDescription>
              This opens a terminal session and runs the update command below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Current version:</span>{' '}
              {pendingUpdate?.currentVersion ?? 'unknown'}
            </p>
            <p>
              <span className="text-muted-foreground">Latest version:</span>{' '}
              {pendingUpdate?.latestVersion}
            </p>
            <code className="block overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {pendingUpdate?.command}
            </code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={dismissPendingUpdate}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!settingsTool} onOpenChange={(open) => !open && setSettingsTool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {settingsTool?.name}</DialogTitle>
            <DialogDescription>
              {settingsTool?.settingsScope === 'global'
                ? 'This applies machine-wide, not to a specific project.'
                : 'This applies to the target project selected above.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {settingsTool?.settingsFields?.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                {field.type === 'select' && (
                  <Combobox
                    value={String(settingsValues[field.key] ?? '')}
                    onChange={(v) => setSettingsValues((prev) => ({ ...prev, [field.key]: v }))}
                    options={field.options ?? []}
                  />
                )}
                {field.type === 'text' && (
                  <Input
                    value={String(settingsValues[field.key] ?? '')}
                    onChange={(e) =>
                      setSettingsValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                )}
                {field.type === 'boolean' && (
                  <Switch
                    checked={!!settingsValues[field.key]}
                    onCheckedChange={(checked) =>
                      setSettingsValues((prev) => ({ ...prev, [field.key]: checked }))
                    }
                  />
                )}
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
              </div>
            ))}

            {preview && (
              <div className="space-y-1.5">
                <Label>
                  {preview.kind === 'command' && 'Command to run'}
                  {preview.kind === 'write-project-file' && `File: ${preview.relativePath}`}
                  {preview.kind === 'copy-text' && preview.instructions}
                </Label>
                <code className="block overflow-x-auto whitespace-pre rounded bg-muted px-3 py-2 font-mono text-xs">
                  {preview.kind === 'command' ? preview.command : preview.content}
                </code>
                {requiresProject && !selectedProject && (
                  <p className="text-xs text-amber-500">
                    Choose a target project above before applying.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!preview || (requiresProject && !selectedProject)}
              onClick={() => void handleApplySettings()}
            >
              {preview?.kind === 'command' && 'Run in terminal'}
              {preview?.kind === 'write-project-file' && 'Write to project'}
              {preview?.kind === 'copy-text' && 'Copy to clipboard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
