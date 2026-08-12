import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Blocks,
  Download,
  FolderOpen,
  HardDrive,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  Robot,
  SettingsIcon,
  Sun,
  Upload,
} from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { cliOptionIcon } from '@/components/cliLogos';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useThemeStore } from '@/stores/themeStore';
import { usePingTargetsStore } from '@/stores/pingTargetsStore';
import { useUpdateStore } from '@/stores/updateStore';
import { confirmDialog } from '@/stores/confirmStore';
import type { AiProvider, ThemeMode } from '@agentmat/core';
import { cn } from '@/lib/utils';

const PROMPT_BUILDER_PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama' },
];

// Whisper's most common languages for voice input; "auto" lets the model
// detect the spoken language. Codes match Prompt Builder's translate list.
const SPEECH_LANGUAGES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'Persian (فارسی)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ru', label: 'Russian' },
  { value: 'hi', label: 'Hindi' },
  { value: 'tr', label: 'Turkish' },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function SettingsPanel({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="glass divide-y divide-border/60 rounded-lg">{children}</div>;
}

function SettingsSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <section className="px-5 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ExternalLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="underline underline-offset-2 hover:text-foreground"
      onClick={() => void window.agentmat.shell.openExternal(href)}
    >
      {children}
    </button>
  );
}

export default function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const setDefaultCliId = useCliStore((s) => s.setDefaultCliId);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const pingTargets = usePingTargetsStore((s) => s.pingTargets);
  const setPingTargets = usePingTargetsStore((s) => s.setPingTargets);

  const queryClient = useQueryClient();

  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });

  const appVersionQuery = useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => window.agentmat.app.getVersion(),
  });

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [scheduledTasksChatId, setScheduledTasksChatId] = useState('');
  const [telegramDirty, setTelegramDirty] = useState(false);
  const [detectingChatId, setDetectingChatId] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (!telegramDirty && settingsQuery.data) {
      setBotToken(settingsQuery.data.telegramBotToken ?? '');
      setChatId(settingsQuery.data.telegramChatId ?? '');
      setScheduledTasksChatId(settingsQuery.data.telegramScheduledTasksChatId ?? '');
    }
  }, [settingsQuery.data, telegramDirty]);

  const saveTelegramMutation = useMutation({
    mutationFn: () =>
      window.agentmat.settings.update({
        telegramBotToken: botToken.trim() || null,
        telegramChatId: chatId.trim() || null,
        telegramScheduledTasksChatId: scheduledTasksChatId.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Telegram bot settings saved.');
      setTelegramDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  async function handleDetectChatId(): Promise<void> {
    if (!botToken.trim()) {
      toast.error('Enter your bot token first.');
      return;
    }
    setDetectingChatId(true);
    try {
      await saveTelegramMutation.mutateAsync();
      const result = await window.agentmat.notifications.detectChatId();
      if (!result.chatId) {
        toast.error(result.error ?? 'Could not detect a chat ID.');
        return;
      }
      setChatId(result.chatId);
      setTelegramDirty(true);
      toast.success(`Detected chat ID ${result.chatId}.`);
    } finally {
      setDetectingChatId(false);
    }
  }

  async function handleSendTest(): Promise<void> {
    setSendingTest(true);
    try {
      if (telegramDirty) await saveTelegramMutation.mutateAsync();
      const result = await window.agentmat.notifications.sendTest({
        message: '👋 This is a test notification from AgentMate.',
      });
      if (result.ok) {
        toast.success('Test message sent. Check Telegram.');
      } else {
        toast.error(result.error ?? 'Failed to send test message.');
      }
    } finally {
      setSendingTest(false);
    }
  }

  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [promptBuilderProvider, setPromptBuilderProvider] = useState<AiProvider>('openai');
  const [aiDirty, setAiDirty] = useState(false);

  useEffect(() => {
    if (!aiDirty && settingsQuery.data) {
      setOpenaiApiKey(settingsQuery.data.openaiApiKey ?? '');
      setOpenaiModel(settingsQuery.data.openaiModel);
      setOllamaBaseUrl(settingsQuery.data.ollamaBaseUrl);
      setGeminiApiKey(settingsQuery.data.geminiApiKey ?? '');
      setGeminiModel(settingsQuery.data.geminiModel);
      setPromptBuilderProvider(settingsQuery.data.promptBuilderProvider);
    }
  }, [settingsQuery.data, aiDirty]);

  const saveAiMutation = useMutation({
    mutationFn: () =>
      window.agentmat.settings.update({
        openaiApiKey: openaiApiKey.trim() || null,
        openaiModel: openaiModel.trim() || 'gpt-4o-mini',
        ollamaBaseUrl: ollamaBaseUrl.trim() || 'http://localhost:11434',
        geminiApiKey: geminiApiKey.trim() || null,
        geminiModel: geminiModel.trim() || 'gemini-2.0-flash',
        promptBuilderProvider,
      }),
    onSuccess: () => {
      toast.success('AI provider settings saved.');
      setAiDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const [pingTargetsText, setPingTargetsText] = useState(() => pingTargets.join(', '));
  const [pingTargetsDirty, setPingTargetsDirty] = useState(false);

  useEffect(() => {
    if (!pingTargetsDirty) setPingTargetsText(pingTargets.join(', '));
  }, [pingTargets, pingTargetsDirty]);

  function handleSavePingTargets(): void {
    const parsed = Array.from(
      new Set(
        pingTargetsText
          .split(',')
          .map((host) => host.trim())
          .filter(Boolean),
      ),
    );
    setPingTargets(parsed);
    setPingTargetsDirty(false);
    toast.success('Ping targets updated.');
  }

  const [projectsRootPath, setProjectsRootPath] = useState('');
  const [projectsRootDirty, setProjectsRootDirty] = useState(false);

  useEffect(() => {
    if (!projectsRootDirty && settingsQuery.data) {
      setProjectsRootPath(settingsQuery.data.projectsRootPath ?? '');
    }
  }, [settingsQuery.data, projectsRootDirty]);

  const saveProjectsRootMutation = useMutation({
    mutationFn: () =>
      window.agentmat.settings.update({ projectsRootPath: projectsRootPath.trim() || null }),
    onSuccess: (settings) => {
      setProjectsRootPath(settings.projectsRootPath ?? '');
      toast.success(
        settings.projectsRootPath
          ? 'Projects folder saved.'
          : 'Projects folder cleared. Folder pickers open wherever your system last left off.',
      );
      setProjectsRootDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  async function handleBrowseProjectsRoot(): Promise<void> {
    const picked = await window.agentmat.projects.pickFolder();
    if (!picked) return;
    setProjectsRootPath(picked);
    setProjectsRootDirty(true);
  }

  const [translateMaxRetriesText, setTranslateMaxRetriesText] = useState('3');
  const [translateRetriesDirty, setTranslateRetriesDirty] = useState(false);

  useEffect(() => {
    if (!translateRetriesDirty && settingsQuery.data) {
      setTranslateMaxRetriesText(String(settingsQuery.data.translateMaxRetries));
    }
  }, [settingsQuery.data, translateRetriesDirty]);

  const saveTranslateRetriesMutation = useMutation({
    mutationFn: () => {
      const parsed = Math.max(0, Math.trunc(Number(translateMaxRetriesText)) || 0);
      return window.agentmat.settings.update({ translateMaxRetries: parsed });
    },
    onSuccess: (settings) => {
      setTranslateMaxRetriesText(String(settings.translateMaxRetries));
      toast.success('Translation retry setting saved.');
      setTranslateRetriesDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const [speechModel, setSpeechModel] = useState('base');
  const [speechLanguage, setSpeechLanguage] = useState('auto');
  const [speechDirty, setSpeechDirty] = useState(false);

  useEffect(() => {
    if (!speechDirty && settingsQuery.data) {
      setSpeechModel(settingsQuery.data.speechModel);
      setSpeechLanguage(settingsQuery.data.speechLanguage);
    }
  }, [settingsQuery.data, speechDirty]);

  const saveSpeechMutation = useMutation({
    mutationFn: () => window.agentmat.settings.update({ speechModel, speechLanguage }),
    onSuccess: () => {
      toast.success('Voice input settings saved.');
      setSpeechDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [compressBackup, setCompressBackup] = useState(false);

  async function handleExportBackup(): Promise<void> {
    setExportingBackup(true);
    try {
      const result = await window.agentmat.backup.export(compressBackup);
      if (result.ok && result.path) toast.success(`Backup saved to ${result.path}`);
    } finally {
      setExportingBackup(false);
    }
  }

  async function handleImportBackup(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Restore from backup?',
      description:
        "This replaces your current projects, settings, templates, and other AgentMate data with a backup file's contents. This cannot be undone.",
      confirmLabel: 'Choose backup file…',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setImportingBackup(true);
    try {
      const result = await window.agentmat.backup.import();
      if (!result.ok) {
        if (result.error) toast.error(result.error);
        return;
      }
      const restart = await confirmDialog({
        title: 'Backup restored',
        description: 'AgentMate needs to restart to load the restored data.',
        confirmLabel: 'Restart now',
        cancelLabel: 'Later',
      });
      if (restart) void window.agentmat.app.relaunch();
    } finally {
      setImportingBackup(false);
    }
  }

  const updateStatus = useUpdateStore((s) => s.status);
  const checkingForUpdates = updateStatus.state === 'checking';

  async function handleCheckForUpdates(): Promise<void> {
    const result = await window.agentmat.app.checkForUpdates();
    if (result.state === 'not-available') toast.success("You're on the latest version.");
    else if (result.state === 'error') toast.error(result.message);
    // 'available' is surfaced globally as a confirm dialog once the check resolves.
  }

  function updateStatusLabel(): string {
    switch (updateStatus.state) {
      case 'checking':
        return 'Checking for updates…';
      case 'not-available':
        return "You're on the latest version.";
      case 'available':
        return `Update available: v${updateStatus.info.version}.`;
      case 'downloading':
        return `Downloading v${updateStatus.info.version} (${updateStatus.progress.percent.toFixed(0)}%).`;
      case 'downloaded':
        return `v${updateStatus.info.version} downloaded. Restart to install.`;
      case 'error':
        return updateStatus.message;
      default:
        return 'Checks run automatically every hour.';
    }
  }

  const versionLabel =
    appVersionQuery.data == null
      ? '…'
      : appVersionQuery.data === 'dev'
        ? 'dev build'
        : `v${appVersionQuery.data}`;

  usePageHeader('Settings', 'Configure defaults for AgentMate.');

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Tabs defaultValue="general" className="flex flex-col gap-4">
        <TabsList containerClassName="self-start">
          <TabsTrigger value="general" className="gap-1.5">
            <SettingsIcon className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Robot className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <HardDrive className="h-3.5 w-3.5" /> Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <SettingsPanel>
            <SettingsSection title="Appearance" description="How AgentMate looks on this machine.">
              <div
                role="group"
                aria-label="Theme"
                className="inline-flex rounded-md border border-border bg-background/40 p-0.5"
              >
                {THEME_OPTIONS.map((option) => {
                  const active = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-sm transition-colors',
                        active
                          ? 'bg-secondary text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <option.icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Default CLI"
              description="Used when a feature needs an AI provider without asking."
            >
              <Combobox
                className="w-64"
                value={defaultCliId ?? ''}
                onChange={(v) => setDefaultCliId(v || null)}
                placeholder="No default set"
                searchPlaceholder="Search CLIs…"
                options={CLI_REGISTRY.map((cli) => ({
                  value: cli.id,
                  label: cli.name,
                  icon: cliOptionIcon(cli.id),
                }))}
                clearable
              />
            </SettingsSection>

            <SettingsSection
              title="Projects folder"
              description="Folder pickers open here instead of the system default. Leave empty to use the last system location."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!projectsRootDirty || saveProjectsRootMutation.isPending}
                  onClick={() => saveProjectsRootMutation.mutate()}
                >
                  Save
                </Button>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={projectsRootPath}
                  onChange={(e) => {
                    setProjectsRootPath(e.target.value);
                    setProjectsRootDirty(true);
                  }}
                  placeholder="C:\Users\you\Projects"
                  className="min-w-[16rem] flex-1 font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleBrowseProjectsRoot}>
                  <FolderOpen /> Browse…
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Skill repositories"
              description={`${reposQuery.data?.length ?? 0} repositor${reposQuery.data?.length === 1 ? 'y' : 'ies'} configured.`}
              action={
                <Button variant="outline" size="sm" onClick={() => navigate('/skills')}>
                  <Blocks /> Manage
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                Add and sync skill sources from the Skills page.
              </p>
            </SettingsSection>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <SettingsPanel>
            <SettingsSection
              title="Providers"
              description="Keys and models used by Ask AI and Prompt Builder."
              action={
                <Button
                  size="sm"
                  disabled={!aiDirty || saveAiMutation.isPending}
                  onClick={() => saveAiMutation.mutate()}
                >
                  Save
                </Button>
              }
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    OpenAI
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="API key"
                      htmlFor="openai-api-key"
                      hint={
                        <>
                          Create one at{' '}
                          <ExternalLinkButton href="https://platform.openai.com/api-keys">
                            platform.openai.com/api-keys
                          </ExternalLinkButton>
                          .
                        </>
                      }
                      className="sm:col-span-2"
                    >
                      <Input
                        id="openai-api-key"
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => {
                          setOpenaiApiKey(e.target.value);
                          setAiDirty(true);
                        }}
                        placeholder="sk-…"
                        className="font-mono"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Default model" htmlFor="openai-model">
                      <Input
                        id="openai-model"
                        value={openaiModel}
                        onChange={(e) => {
                          setOpenaiModel(e.target.value);
                          setAiDirty(true);
                        }}
                        placeholder="gpt-4o-mini"
                        className="font-mono"
                      />
                    </Field>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gemini
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="API key"
                      htmlFor="gemini-api-key"
                      hint={
                        <>
                          Create one at{' '}
                          <ExternalLinkButton href="https://aistudio.google.com/apikey">
                            aistudio.google.com/apikey
                          </ExternalLinkButton>
                          .
                        </>
                      }
                      className="sm:col-span-2"
                    >
                      <Input
                        id="gemini-api-key"
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => {
                          setGeminiApiKey(e.target.value);
                          setAiDirty(true);
                        }}
                        placeholder="AIza…"
                        className="font-mono"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Default model" htmlFor="gemini-model">
                      <Input
                        id="gemini-model"
                        value={geminiModel}
                        onChange={(e) => {
                          setGeminiModel(e.target.value);
                          setAiDirty(true);
                        }}
                        placeholder="gemini-2.0-flash"
                        className="font-mono"
                      />
                    </Field>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ollama
                  </p>
                  <Field
                    label="Server URL"
                    htmlFor="ollama-base-url"
                    hint={
                      <>
                        Address of a running{' '}
                        <ExternalLinkButton href="https://ollama.com">Ollama</ExternalLinkButton>{' '}
                        instance. Leave the default if it runs on this machine.
                      </>
                    }
                  >
                    <Input
                      id="ollama-base-url"
                      value={ollamaBaseUrl}
                      onChange={(e) => {
                        setOllamaBaseUrl(e.target.value);
                        setAiDirty(true);
                      }}
                      placeholder="http://localhost:11434"
                      className="max-w-md font-mono"
                    />
                  </Field>
                </div>

                <Separator />

                <Field
                  label="Prompt Builder provider"
                  hint="Used by Generate Prompt. Uses the key and model for that provider above."
                >
                  <Combobox
                    className="w-40"
                    value={promptBuilderProvider}
                    onChange={(v) => {
                      setPromptBuilderProvider(v as AiProvider);
                      setAiDirty(true);
                    }}
                    options={PROMPT_BUILDER_PROVIDER_OPTIONS}
                  />
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Voice input"
              description="Local Whisper transcription for Prompt Builder. The model downloads once and stays cached."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!speechDirty || saveSpeechMutation.isPending}
                  onClick={() => saveSpeechMutation.mutate()}
                >
                  Save
                </Button>
              }
            >
              <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Model">
                  <Combobox
                    value={speechModel}
                    onChange={(v) => {
                      setSpeechModel(v);
                      setSpeechDirty(true);
                    }}
                    options={[
                      { value: 'tiny', label: 'Tiny (fastest, ~75 MB)' },
                      { value: 'base', label: 'Base (balanced, ~145 MB)' },
                      { value: 'small', label: 'Small (most accurate, ~490 MB)' },
                    ]}
                  />
                </Field>
                <Field label="Spoken language">
                  <Combobox
                    value={speechLanguage}
                    onChange={(v) => {
                      setSpeechLanguage(v);
                      setSpeechDirty(true);
                    }}
                    options={SPEECH_LANGUAGES}
                  />
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Translation retries"
              description="Extra attempts Prompt Builder makes if a translate request fails."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!translateRetriesDirty || saveTranslateRetriesMutation.isPending}
                  onClick={() => saveTranslateRetriesMutation.mutate()}
                >
                  Save
                </Button>
              }
            >
              <Input
                type="number"
                min={0}
                max={10}
                value={translateMaxRetriesText}
                onChange={(e) => {
                  setTranslateMaxRetriesText(e.target.value);
                  setTranslateRetriesDirty(true);
                }}
                className="w-24"
              />
            </SettingsSection>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SettingsPanel>
            <SettingsSection
              title="Telegram bot"
              description={
                <>
                  Used by project notification hooks. Create a bot with{' '}
                  <ExternalLinkButton href="https://t.me/BotFather">@BotFather</ExternalLinkButton>,
                  then paste its token below.
                </>
              }
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      sendingTest || (!botToken.trim() && !settingsQuery.data?.telegramBotToken)
                    }
                    onClick={() => void handleSendTest()}
                  >
                    {sendingTest ? 'Sending…' : 'Send test'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!telegramDirty || saveTelegramMutation.isPending}
                    onClick={() => saveTelegramMutation.mutate()}
                  >
                    Save
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <Field label="Bot token" htmlFor="telegram-bot-token">
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    value={botToken}
                    onChange={(e) => {
                      setBotToken(e.target.value);
                      setTelegramDirty(true);
                    }}
                    placeholder="123456789:AAExampleTokenFromBotFather"
                    className="max-w-md font-mono"
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="Chat ID"
                  htmlFor="telegram-chat-id"
                  hint="Message your bot once on Telegram, then click detect."
                >
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="telegram-chat-id"
                      value={chatId}
                      onChange={(e) => {
                        setChatId(e.target.value);
                        setTelegramDirty(true);
                      }}
                      placeholder="e.g. 123456789"
                      className="max-w-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={detectingChatId || !botToken.trim()}
                      onClick={() => void handleDetectChatId()}
                    >
                      {detectingChatId ? 'Detecting…' : 'Detect from last message'}
                    </Button>
                  </div>
                </Field>

                <Field
                  label="Scheduled tasks chat/group ID"
                  htmlFor="telegram-scheduled-tasks-chat-id"
                  hint="Optional. Scheduled tasks post here and the message updates as status changes."
                >
                  <Input
                    id="telegram-scheduled-tasks-chat-id"
                    value={scheduledTasksChatId}
                    onChange={(e) => {
                      setScheduledTasksChatId(e.target.value);
                      setTelegramDirty(true);
                    }}
                    placeholder="e.g. -1001234567890"
                    className="max-w-xs font-mono"
                  />
                </Field>
              </div>
            </SettingsSection>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="data" className="mt-0">
          <SettingsPanel>
            <SettingsSection
              title="Network ping targets"
              description="Hosts shown on the dashboard Network Status graph."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pingTargetsDirty}
                  onClick={handleSavePingTargets}
                >
                  Save
                </Button>
              }
            >
              <Input
                value={pingTargetsText}
                onChange={(e) => {
                  setPingTargetsText(e.target.value);
                  setPingTargetsDirty(true);
                }}
                placeholder="1.1.1.1, 8.8.8.8"
                className="max-w-md font-mono text-xs"
              />
            </SettingsSection>

            <SettingsSection
              title="Backup & restore"
              description="Exports include projects, settings, templates, and saved keys. Keep the file private. Restoring replaces everything on this machine."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="compress-backup"
                    checked={compressBackup}
                    onCheckedChange={setCompressBackup}
                  />
                  <Label htmlFor="compress-backup" className="font-normal text-muted-foreground">
                    Compress export as a .zip file
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingBackup}
                    onClick={() => void handleExportBackup()}
                  >
                    <Download className="h-4 w-4" />{' '}
                    {exportingBackup ? 'Exporting…' : 'Export backup'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={importingBackup}
                    onClick={() => void handleImportBackup()}
                  >
                    <Upload className="h-4 w-4" />{' '}
                    {importingBackup ? 'Restoring…' : 'Restore from backup…'}
                  </Button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="About"
              description={`AgentMate ${versionLabel}`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checkingForUpdates}
                  onClick={() => void handleCheckForUpdates()}
                >
                  <RefreshCw className={cn('h-4 w-4', checkingForUpdates && 'animate-spin')} />
                  {checkingForUpdates ? 'Checking…' : 'Check for updates'}
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">{updateStatusLabel()}</p>
            </SettingsSection>
          </SettingsPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
