import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ExternalLink,
  GitBranch,
  Globe,
  Play,
  RefreshCw,
  StopCircle,
  TerminalSquare,
  Trash2,
  Wrench,
} from '@/components/icons';
import {
  AGENT_TOOL_REGISTRY,
  type AgentToolDefinition,
  type ToolSettingsAction,
  type ToolSettingsValues,
} from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';

type DockerAction = 'run' | 'start' | 'stop' | 'reset' | 'remove';

export default function ToolsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [settingsTool, setSettingsTool] = useState<AgentToolDefinition | null>(null);
  const [settingsValues, setSettingsValues] = useState<ToolSettingsValues>({});

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const statusQuery = useQuery({
    queryKey: queryKeys.toolsStatus,
    queryFn: () => window.agentmat.tools.detectAll(),
  });

  const selectedProject = projectsQuery.data?.find((p) => p.id === selectedProjectId);

  function statusFor(toolId: string) {
    return statusQuery.data?.find((s) => s.id === toolId);
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
      openSession({ title, initialInput: action.command, cwd: action.cwd === 'project' ? selectedProject!.folderPath : undefined });
      toast.info(`Press Enter in the terminal to run this for ${tool.name}.`);
      return;
    }
    if (action.kind === 'write-project-file') {
      if (!selectedProject) {
        toast.error('Choose a target project first.');
        return;
      }
      await window.agentmat.fs.writeFile(`${selectedProject.folderPath}/${action.relativePath}`, action.content);
      toast.success(`${action.relativePath} written to ${selectedProject.name}.`);
      return;
    }
    await navigator.clipboard.writeText(action.content);
    toast.success('Copied to clipboard — ' + action.instructions);
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
    toast.success(`Setup commands copied — run them inside ${tool.name}'s target agent.`);
  }

  async function handleInteractiveInstall(tool: AgentToolDefinition): Promise<void> {
    if (!tool.interactiveInstall) return;
    const launchCommand = await window.agentmat.tools.getInteractiveLaunchCommand(tool.id);
    if (!launchCommand) {
      toast.error(`No launch command available for ${tool.name} on this OS.`);
      return;
    }
    // Open the terminal first — if the clipboard write below fails (e.g. no OS focus yet),
    // the user still gets a working terminal instead of the click silently doing nothing.
    openSession({ title: `Install ${tool.name}`, initialInput: launchCommand });
    try {
      await navigator.clipboard.writeText(tool.interactiveInstall.pasteCommands);
      toast.info(
        `Press Enter to launch ${launchCommand}, then paste (Ctrl+V) and press Enter again to install ${tool.name} — the commands are on your clipboard.`,
      );
    } catch {
      toast.info(
        `Press Enter to launch ${launchCommand}, then type: ${tool.interactiveInstall.pasteCommands.replace('\n', ', then ')}`,
      );
    }
  }

  function handleCopyManualUninstall(tool: AgentToolDefinition): void {
    void navigator.clipboard.writeText(tool.manualUninstallInstructions ?? '');
    toast.success(`Uninstall commands copied — run them inside ${tool.name}'s target agent.`);
  }

  async function handleDockerAction(tool: AgentToolDefinition, action: DockerAction): Promise<void> {
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
    preview?.kind === 'write-project-file' || (preview?.kind === 'command' && preview.cwd === 'project');

  async function handleApplySettings(): Promise<void> {
    if (!settingsTool || !preview) return;
    await runAction(preview, settingsTool, `Configure ${settingsTool.name}`);
    setSettingsTool(null);
  }

  usePageHeader(
    'Agent Tools',
    'Curated third-party tools that cut agent token spend or improve code quality — install, configure, and run them from here.',
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

      <p className="text-sm text-muted-foreground">
        Some actions (initializing a tool in a project, writing its config) need a target project above. Docker and
        global setup actions don't.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENT_TOOL_REGISTRY.map((tool) => {
          const status = statusFor(tool.id);
          return (
            <Card key={tool.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{tool.name}</CardTitle>
                  <Badge variant="outline">{tool.category}</Badge>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={status?.installed ? 'success' : 'secondary'}>
                    {status?.installed ? (status.version ?? 'Installed') : 'Not detected'}
                  </Badge>
                  {tool.docker && (
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
                  {tool.installKind === 'shell' ? (
                    status?.installed ? (
                      <Button size="sm" variant="outline" onClick={() => void handleUninstall(tool)}>
                        <Trash2 /> Uninstall
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void handleInstall(tool)}>
                        <TerminalSquare /> {tool.docker ? 'Install (npm)' : 'Install'}
                      </Button>
                    )
                  ) : tool.installKind === 'interactive' ? (
                    <SimpleTooltip label={`Opens a terminal running ${tool.name}'s target agent and copies the setup commands to paste in`}>
                      <Button size="sm" onClick={() => void handleInteractiveInstall(tool)}>
                        <TerminalSquare /> Install
                      </Button>
                    </SimpleTooltip>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleCopyManualInstructions(tool)}>
                      <TerminalSquare /> Copy setup commands
                    </Button>
                  )}
                  {tool.manualUninstallInstructions && (
                    <SimpleTooltip label="Copy uninstall commands">
                      <Button variant="outline" size="icon" onClick={() => handleCopyManualUninstall(tool)}>
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
                              onClick={() => void window.agentmat.shell.openExternal(tool.docker!.dashboardUrl!)}
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
                      <Button variant="ghost" size="icon" onClick={() => void window.agentmat.shell.openExternal(tool.websiteUrl!)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                  <SimpleTooltip label="GitHub">
                    <Button variant="ghost" size="icon" onClick={() => void window.agentmat.shell.openExternal(tool.repositoryUrl)}>
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!settingsTool} onOpenChange={(open) => !open && setSettingsTool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {settingsTool?.name}</DialogTitle>
            <DialogDescription>
              {settingsTool?.settingsScope === 'global'
                ? "This applies machine-wide, not to a specific project."
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
                    onChange={(e) => setSettingsValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
                {field.type === 'boolean' && (
                  <Switch
                    checked={!!settingsValues[field.key]}
                    onCheckedChange={(checked) => setSettingsValues((prev) => ({ ...prev, [field.key]: checked }))}
                  />
                )}
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
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
                  <p className="text-xs text-amber-500">Choose a target project above before applying.</p>
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
