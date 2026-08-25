import type { AiProvider, ThemeMode } from '@agentmat/core';
import { CLI_REGISTRY } from '@agentmat/core';
import type { OllamaConnectionTest } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CliArgsField } from '@/components/CliArgsField';
import { cliOptionIcon } from '@/components/cliLogos';
import {
  Bell,
  Blocks,
  CircleQuestion,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  Keyboard,
  Languages,
  MessageSquare,
  Microphone,
  Monitor,
  Moon,
  NetworkIcon,
  Pause,
  Paw,
  Play,
  RefreshCw,
  Save,
  Search,
  SettingsIcon,
  Sun,
  TerminalSquare,
  Upload,
  X,
} from '@/components/icons';
import { CompanionSettings } from '@/components/pet/CompanionSettings';
import { ProxySettings } from '@/components/settings/ProxySettings';
import { ShortcutSettings } from '@/components/settings/ShortcutSettings';
import { WritingCheckSettings } from '@/components/settings/WritingCheckSettings';
import { formatUpdateBytes, UpdateProgressTrack, updatePercent } from '@/components/UpdateManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { isShortcutLetter } from '@/lib/shortcutKey';
import { cn } from '@/lib/utils';
import { useCliStore } from '@/stores/cliStore';
import { confirmDialog } from '@/stores/confirmStore';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { usePingTargetsStore } from '@/stores/pingTargetsStore';
import { useThemeStore } from '@/stores/themeStore';
import { openUpdateDialog, useUpdateStore } from '@/stores/updateStore';

const PROMPT_BUILDER_PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama' },
];

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

const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', hint: 'Bright canvas', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Near-black canvas', icon: Moon },
  { value: 'system', label: 'System', hint: 'Follow this machine', icon: Monitor },
];

const SETTINGS_TABS = [
  'general',
  'shortcuts',
  'companion',
  'ai',
  'notifications',
  'network',
  'data',
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

const PROXY_KEYWORDS =
  'proxy http proxy https proxy socks socks5 socks4 system proxy vpn bypass no_proxy corporate firewall connection internet network offline pac auth username password port host';

const TAB_META: {
  id: SettingsTab;
  label: string;
  icon: typeof SettingsIcon;
  keywords: string;
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: SettingsIcon,
    keywords: 'appearance theme cli projects folder skills',
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: Keyboard,
    keywords:
      'keyboard shortcut shortcuts keybinding hotkey ctrl cmd alt terminal projects palette',
  },
  {
    id: 'companion',
    label: 'AI Pet',
    icon: Paw,
    keywords:
      'pet ai pet my ai pet companion desktop character walk mascot climb rope size click area tight wander gif png webp custom add pipeline github actions fail pass notify internet quality ping offline',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: MessageSquare,
    keywords:
      'openai gemini ollama api key whisper voice translate writing grammar spelling style languagetool context length num_ctx keep alive test connection local model',
  },
  { id: 'notifications', label: 'Notifications', icon: Bell, keywords: 'telegram bot chat notify' },
  {
    id: 'network',
    label: 'Network',
    icon: NetworkIcon,
    keywords: PROXY_KEYWORDS,
  },
  {
    id: 'data',
    label: 'Data',
    icon: HardDrive,
    keywords: 'backup restore ping network about version update',
  },
];

const WRITING_CHECK_KEYWORDS =
  'writing grammar grammarly spelling spellcheck spell check style languagetool language tool proofread punctuation local server offline java tools folder mother tongue picky rules';

const SHORTCUT_KEYWORDS =
  'keyboard shortcut shortcuts keybinding hotkey ctrl cmd alt terminal projects command palette layout language';

function matchesQuery(query: string, ...parts: Array<string | undefined>): boolean {
  if (!query) return true;
  return parts.some((part) => part?.toLowerCase().includes(query));
}

function saveShortcutLabel(): string {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
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
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn('pr-9 font-mono', className)}
      />
      <button
        type="button"
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide value' : 'Show value'}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  dirty,
  children,
}: {
  icon: typeof Sun;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  dirty?: boolean;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <Card className={cn('glass', dirty && 'ring-1 ring-primary/35')}>
      <CardHeader className={cn('flex-row items-start justify-between gap-4', !children && 'pb-5')}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{title}</CardTitle>
              {dirty ? (
                <Badge variant="warning" className="font-normal">
                  Unsaved
                </Badge>
              ) : null}
            </div>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }): React.JSX.Element {
  if (mode === 'system') {
    return (
      <div className="flex h-16 overflow-hidden rounded-md border border-border">
        <MiniWindow dark={false} className="w-1/2 rounded-none border-0 border-r border-black/10" />
        <MiniWindow dark className="w-1/2 rounded-none border-0" />
      </div>
    );
  }
  return <MiniWindow dark={mode === 'dark'} className="h-16" />;
}

function MiniWindow({ dark, className }: { dark: boolean; className?: string }): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-md border',
        dark ? 'border-white/10 bg-[#0a0a0a]' : 'border-black/10 bg-[#f4f4f4]',
        className,
      )}
    >
      <div className={cn('w-5 shrink-0', dark ? 'bg-[#1c1c1c]' : 'bg-[#e4e4e4]')} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-1.5">
        <div className={cn('h-1.5 w-7 rounded-full', dark ? 'bg-white/25' : 'bg-black/20')} />
        <div className="h-1.5 w-10 rounded-full bg-[hsl(var(--primary))]" />
        <div
          className={cn('mt-0.5 min-h-0 flex-1 rounded-sm', dark ? 'bg-white/8' : 'bg-black/8')}
        />
      </div>
    </div>
  );
}

function HostChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const hosts = useMemo(
    () =>
      Array.from(
        new Set(
          value
            .split(',')
            .map((host) => host.trim())
            .filter(Boolean),
        ),
      ),
    [value],
  );

  function commit(raw: string): void {
    const next = raw.trim();
    if (!next || hosts.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...hosts, next].join(', '));
    setDraft('');
  }

  function remove(host: string): void {
    onChange(hosts.filter((item) => item !== host).join(', '));
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)] transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/50">
      {hosts.map((host) => (
        <span
          key={host}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs"
        >
          {host}
          <button
            type="button"
            className="cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Remove ${host}`}
            onClick={() => remove(host)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit(draft);
          } else if (event.key === 'Backspace' && !draft && hosts.length > 0) {
            remove(hosts[hosts.length - 1]);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={hosts.length === 0 ? '1.1.1.1' : 'Add host'}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export default function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const setDefaultCliId = useCliStore((s) => s.setDefaultCliId);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const pingTargets = usePingTargetsStore((s) => s.pingTargets);
  const setPingTargets = usePingTargetsStore((s) => s.setPingTargets);

  const queryClient = useQueryClient();
  const tab: SettingsTab = isSettingsTab(searchParams.get('tab'))
    ? (searchParams.get('tab') as SettingsTab)
    : 'general';
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

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
  const [proxyDirty, setProxyDirty] = useState(false);
  const [proxyResetToken, setProxyResetToken] = useState(0);
  const proxySaveRef = useRef<(() => Promise<void>) | null>(null);
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
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaContextLength, setOllamaContextLength] = useState('');
  const [ollamaKeepAlive, setOllamaKeepAlive] = useState('');
  const [debouncedOllamaUrl, setDebouncedOllamaUrl] = useState('');
  const [ollamaTest, setOllamaTest] = useState<OllamaConnectionTest | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [promptBuilderProvider, setPromptBuilderProvider] = useState<AiProvider>('openai');
  const [aiDirty, setAiDirty] = useState(false);

  useEffect(() => {
    if (!aiDirty && settingsQuery.data) {
      setOpenaiApiKey(settingsQuery.data.openaiApiKey ?? '');
      setOpenaiModel(settingsQuery.data.openaiModel);
      setOllamaBaseUrl(settingsQuery.data.ollamaBaseUrl);
      setOllamaModel(settingsQuery.data.ollamaModel);
      setOllamaContextLength(
        settingsQuery.data.ollamaContextLength
          ? String(settingsQuery.data.ollamaContextLength)
          : '',
      );
      setOllamaKeepAlive(settingsQuery.data.ollamaKeepAlive);
      setGeminiApiKey(settingsQuery.data.geminiApiKey ?? '');
      setGeminiModel(settingsQuery.data.geminiModel);
      setPromptBuilderProvider(settingsQuery.data.promptBuilderProvider);
    }
  }, [settingsQuery.data, aiDirty]);

  // Typing in the URL field shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOllamaUrl(ollamaBaseUrl), 400);
    return () => clearTimeout(timer);
  }, [ollamaBaseUrl]);

  // Only probed while the AI tab is on screen, so a stopped Ollama doesn't error on every visit.
  const ollamaModelsQuery = useQuery({
    queryKey: ['settings-ollama-models', debouncedOllamaUrl],
    queryFn: () => window.agentmat.ai.listOllamaModels(debouncedOllamaUrl),
    enabled: tab === 'ai' || Boolean(query),
    retry: false,
    staleTime: 30_000,
  });

  const ollamaModelOptions = useMemo(
    () => (ollamaModelsQuery.data ?? []).map((name) => ({ value: name, label: name })),
    [ollamaModelsQuery.data],
  );

  const parsedContext = Number.parseInt(ollamaContextLength.trim(), 10);
  const parsedOllamaContext =
    Number.isFinite(parsedContext) && parsedContext > 0 ? parsedContext : null;

  async function handleTestOllama(): Promise<void> {
    setTestingOllama(true);
    try {
      const result = await window.agentmat.ai.testOllama(ollamaBaseUrl);
      setOllamaTest(result);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not reach Ollama.');
      } else if (result.modelCount === 0) {
        toast.warning('Connected, but no models are installed. Pull one with "ollama pull".');
      } else {
        toast.success(
          `Connected to Ollama${result.version ? ` ${result.version}` : ''}. ${result.modelCount} model${result.modelCount === 1 ? '' : 's'} installed.`,
        );
      }
      void ollamaModelsQuery.refetch();
    } finally {
      setTestingOllama(false);
    }
  }

  const saveAiMutation = useMutation({
    mutationFn: () =>
      window.agentmat.settings.update({
        openaiApiKey: openaiApiKey.trim() || null,
        openaiModel: openaiModel.trim() || 'gpt-4o-mini',
        ollamaBaseUrl: ollamaBaseUrl.trim() || 'http://localhost:11434',
        ollamaModel: ollamaModel.trim(),
        ollamaContextLength: parsedOllamaContext,
        ollamaKeepAlive: ollamaKeepAlive.trim() || '5m',
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
      else if (result.error) toast.error(result.error);
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
      // Rows that could not be read, plus any setting the backup carried that
      // decides what the app will execute later.
      for (const warning of result.warnings ?? []) toast.warning(warning);
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
  }

  function updateStatusLabel(): string {
    switch (updateStatus.state) {
      case 'checking':
        return 'Checking for updates…';
      case 'not-available':
        return "You're on the latest version.";
      case 'available':
        return updateStatus.partialBytes > 0
          ? `v${updateStatus.info.version} is available. ${formatUpdateBytes(updateStatus.partialBytes)} already on disk.`
          : `v${updateStatus.info.version} is available. Downloads resume if the connection drops.`;
      case 'downloading':
        return updateStatus.reconnecting
          ? `Connection dropped. Keeping ${formatUpdateBytes(updateStatus.progress.transferredBytes)} and retrying.`
          : `Downloading v${updateStatus.info.version}.`;
      case 'paused':
        return updateStatus.message;
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

  const tabDirty: Record<SettingsTab, boolean> = {
    general: projectsRootDirty,
    // Shortcuts persist the moment they change, so there is nothing to save.
    shortcuts: false,
    companion: false,
    ai: aiDirty || speechDirty || translateRetriesDirty,
    notifications: telegramDirty,
    network: proxyDirty,
    data: pingTargetsDirty,
  };
  const anyDirty = Object.values(tabDirty).some(Boolean);
  const saving =
    saveProjectsRootMutation.isPending ||
    saveAiMutation.isPending ||
    saveSpeechMutation.isPending ||
    saveTranslateRetriesMutation.isPending ||
    saveTelegramMutation.isPending;

  async function handleSaveAll(): Promise<void> {
    if (projectsRootDirty) await saveProjectsRootMutation.mutateAsync();
    if (aiDirty) await saveAiMutation.mutateAsync();
    if (speechDirty) await saveSpeechMutation.mutateAsync();
    if (translateRetriesDirty) await saveTranslateRetriesMutation.mutateAsync();
    if (telegramDirty) await saveTelegramMutation.mutateAsync();
    // The proxy card keeps its own draft, so it hands its save back through a ref.
    if (proxyDirty) await proxySaveRef.current?.();
    if (pingTargetsDirty) handleSavePingTargets();
  }

  function handleDiscardAll(): void {
    setProjectsRootDirty(false);
    setAiDirty(false);
    setSpeechDirty(false);
    setTranslateRetriesDirty(false);
    setTelegramDirty(false);
    setPingTargetsDirty(false);
    // Bumping the token is what tells the proxy card to drop its own draft.
    setProxyResetToken((token) => token + 1);
  }

  const saveAllRef = useRef(handleSaveAll);
  saveAllRef.current = handleSaveAll;
  const anyDirtyRef = useRef(anyDirty);
  anyDirtyRef.current = anyDirty;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // The shortcut recorder swallows the keys it is capturing.
      if (event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (!isShortcutLetter(event, 's')) return;
      if (!anyDirtyRef.current) return;
      event.preventDefault();
      void saveAllRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  usePageHeader('Settings', anyDirty ? 'You have unsaved changes.' : 'Defaults for this machine.');

  function selectTab(next: SettingsTab): void {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'general') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
    setSearch('');
  }

  function showSection(sectionTab: SettingsTab, keywords: string, title: string): boolean {
    if (query)
      return matchesQuery(
        query,
        title,
        keywords,
        TAB_META.find((item) => item.id === sectionTab)?.label,
      );
    return tab === sectionTab;
  }

  const visibleCount = [
    showSection('general', 'appearance theme dark light system look', 'Appearance'),
    showSection('shortcuts', SHORTCUT_KEYWORDS, 'Keyboard shortcuts'),
    showSection(
      'companion',
      'pet ai pet my ai pet companion desktop character walk mascot climb rope size click area tight wander pipeline github actions fail pass internet quality',
      'My AI Pet',
    ),
    showSection('general', 'default cli provider agent arguments args flags model', 'Default CLI'),
    showSection('general', 'projects folder path directory', 'Projects folder'),
    showSection('general', 'skills repositories sources', 'Skill repositories'),
    showSection(
      'ai',
      'openai gemini ollama api key model prompt builder provider context length num_ctx keep alive test connection',
      'Providers',
    ),
    showSection('ai', 'voice whisper speech microphone transcription', 'Voice input'),
    showSection('ai', WRITING_CHECK_KEYWORDS, 'Writing check'),
    showSection('ai', 'translation retries translate', 'Translation retries'),
    showSection('notifications', 'telegram bot token chat notify', 'Telegram bot'),
    showSection('network', PROXY_KEYWORDS, 'Proxy'),
    showSection('data', 'ping network hosts dashboard', 'Network ping targets'),
    showSection('data', 'backup restore export import zip', 'Backup & restore'),
    showSection('data', 'about version update check', 'About'),
  ].filter(Boolean).length;

  const repoCount = reposQuery.data?.length ?? 0;
  const telegramReady = Boolean(botToken.trim() && chatId.trim());

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-border/80 bg-background/80 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search settings…"
              className="pl-8 pr-8"
              aria-label="Search settings"
            />
            {search ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {!query ? (
            <Tabs
              value={tab}
              onValueChange={(value) => selectTab(value as SettingsTab)}
              className="lg:hidden"
            >
              <TabsList containerClassName="border-0">
                {TAB_META.map((item) => (
                  <TabsTrigger key={item.id} value={item.id} className="gap-1.5">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                    {tabDirty[item.id] ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        aria-label="Unsaved changes"
                      />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-6">
        {!query ? (
          <nav
            aria-label="Settings categories"
            className="sticky top-[4.75rem] hidden h-fit w-48 shrink-0 lg:block"
          >
            <ul className="space-y-1">
              {TAB_META.map((item) => {
                const active = tab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                        active
                          ? 'bg-primary/15 font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className={cn('h-3.5 w-3.5', active && 'text-primary')} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {tabDirty[item.id] ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          aria-label="Unsaved changes"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        <div className="min-w-0 flex-1 space-y-4">
          {settingsQuery.isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <Card key={index} className="glass">
                <CardHeader className="flex-row items-start gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))
          ) : settingsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-16 text-center">
              <p className="text-sm font-medium">Could not load settings</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Something went wrong reading this machine's defaults.
              </p>
              <Button variant="outline" size="sm" onClick={() => void settingsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : visibleCount === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Search className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No settings match “{search.trim()}”</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try theme, AI Pet, API key, Telegram, backup, or a category name.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <>
              {showSection('general', 'appearance theme dark light system look', 'Appearance') && (
                <SettingsCard
                  icon={theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor}
                  title="Appearance"
                  description="How AgentMate looks on this machine."
                >
                  <div
                    role="group"
                    aria-label="Theme"
                    className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                  >
                    {THEME_OPTIONS.map((option) => {
                      const active = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value)}
                          className={cn(
                            'cursor-pointer rounded-lg border p-3 text-left transition-all duration-150',
                            active
                              ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40'
                              : 'border-border bg-background/40 hover:border-foreground/20 hover:bg-accent/40',
                          )}
                          aria-pressed={active}
                        >
                          <ThemePreview mode={option.value} />
                          <div className="mt-2.5 flex items-center gap-2">
                            <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{option.label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{option.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </SettingsCard>
              )}

              {showSection('shortcuts', SHORTCUT_KEYWORDS, 'Keyboard shortcuts') && (
                <SettingsCard
                  icon={Keyboard}
                  title="Keyboard shortcuts"
                  description="Rebind the app-wide shortcuts. Changes apply right away."
                >
                  <ShortcutSettings />
                </SettingsCard>
              )}

              {showSection(
                'companion',
                'pet ai pet my ai pet companion desktop character walk mascot climb rope size click area tight wander pipeline github actions fail pass internet quality',
                'My AI Pet',
              ) && settingsQuery.data ? (
                <CompanionSettings settings={settingsQuery.data} />
              ) : null}

              {showSection(
                'general',
                'default cli provider agent arguments args flags model',
                'Default CLI',
              ) && (
                <SettingsCard
                  icon={TerminalSquare}
                  title="Default CLI"
                  description="Used when a feature needs an AI provider without asking."
                >
                  <div className="max-w-sm space-y-3">
                    <Combobox
                      value={defaultCliId ?? ''}
                      onChange={(value) => setDefaultCliId(value || null)}
                      placeholder="No default set"
                      searchPlaceholder="Search CLIs…"
                      options={CLI_REGISTRY.map((cli) => ({
                        value: cli.id,
                        label: cli.name,
                        icon: cliOptionIcon(cli.id),
                      }))}
                      clearable
                    />
                    {/* Per CLI, not per default: switching the default brings up that
                        CLI's own flags. Every CLI has the same field in CLI Manager. */}
                    {defaultCliId && <CliArgsField cliId={defaultCliId} />}
                  </div>
                </SettingsCard>
              )}

              {showSection('general', 'projects folder path directory', 'Projects folder') && (
                <SettingsCard
                  icon={FolderOpen}
                  title="Projects folder"
                  description="Folder pickers open here instead of the system default. Leave empty to use the last system location."
                  dirty={projectsRootDirty}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={projectsRootPath}
                      onChange={(event) => {
                        setProjectsRootPath(event.target.value);
                        setProjectsRootDirty(true);
                      }}
                      placeholder="C:\Users\you\Projects"
                      className="min-w-[16rem] flex-1 font-mono text-xs"
                      spellCheck={false}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBrowseProjectsRoot()}
                    >
                      <FolderOpen /> Browse…
                    </Button>
                  </div>
                </SettingsCard>
              )}

              {showSection('general', 'skills repositories sources', 'Skill repositories') && (
                <SettingsCard
                  icon={Blocks}
                  title="Skill repositories"
                  description={
                    reposQuery.isLoading
                      ? 'Loading repositories…'
                      : `${repoCount} repositor${repoCount === 1 ? 'y' : 'ies'} configured. Add and sync sources from the Skills page.`
                  }
                  action={
                    <Button variant="outline" size="sm" onClick={() => navigate('/skills')}>
                      <Blocks /> Manage
                    </Button>
                  }
                />
              )}

              {showSection(
                'ai',
                'openai gemini ollama api key model prompt builder provider context length num_ctx keep alive test connection',
                'Providers',
              ) && (
                <SettingsCard
                  icon={MessageSquare}
                  title="Providers"
                  description="Keys and models used by Ask AI and Prompt Builder."
                  dirty={aiDirty}
                >
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          OpenAI
                        </p>
                        <Badge
                          variant={openaiApiKey.trim() ? 'success' : 'secondary'}
                          className="font-normal"
                        >
                          {openaiApiKey.trim() ? 'Key set' : 'No key'}
                        </Badge>
                      </div>
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
                          <SecretInput
                            id="openai-api-key"
                            value={openaiApiKey}
                            onChange={(value) => {
                              setOpenaiApiKey(value);
                              setAiDirty(true);
                            }}
                            placeholder="sk-…"
                          />
                        </Field>
                        <Field label="Default model" htmlFor="openai-model">
                          <Input
                            id="openai-model"
                            value={openaiModel}
                            onChange={(event) => {
                              setOpenaiModel(event.target.value);
                              setAiDirty(true);
                            }}
                            placeholder="gpt-4o-mini"
                            className="font-mono"
                            spellCheck={false}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Gemini
                        </p>
                        <Badge
                          variant={geminiApiKey.trim() ? 'success' : 'secondary'}
                          className="font-normal"
                        >
                          {geminiApiKey.trim() ? 'Key set' : 'No key'}
                        </Badge>
                      </div>
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
                          <SecretInput
                            id="gemini-api-key"
                            value={geminiApiKey}
                            onChange={(value) => {
                              setGeminiApiKey(value);
                              setAiDirty(true);
                            }}
                            placeholder="AIza…"
                          />
                        </Field>
                        <Field label="Default model" htmlFor="gemini-model">
                          <Input
                            id="gemini-model"
                            value={geminiModel}
                            onChange={(event) => {
                              setGeminiModel(event.target.value);
                              setAiDirty(true);
                            }}
                            placeholder="gemini-2.0-flash"
                            className="font-mono"
                            spellCheck={false}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Ollama
                        </p>
                        {ollamaTest ? (
                          <Badge
                            variant={ollamaTest.ok ? 'success' : 'destructive'}
                            className="font-normal"
                          >
                            {ollamaTest.ok
                              ? ollamaTest.version
                                ? `Connected · ${ollamaTest.version}`
                                : 'Connected'
                              : 'Not reachable'}
                          </Badge>
                        ) : null}
                      </div>
                      <Field
                        label="Server URL"
                        htmlFor="ollama-base-url"
                        hint={
                          <>
                            Address of a running{' '}
                            <ExternalLinkButton href="https://ollama.com">
                              Ollama
                            </ExternalLinkButton>{' '}
                            instance. Leave the default if it runs on this machine.
                          </>
                        }
                      >
                        <div className="flex max-w-xl items-center gap-2">
                          <Input
                            id="ollama-base-url"
                            value={ollamaBaseUrl}
                            onChange={(event) => {
                              setOllamaBaseUrl(event.target.value);
                              setOllamaTest(null);
                              setAiDirty(true);
                            }}
                            placeholder="http://localhost:11434"
                            className="font-mono"
                            spellCheck={false}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={testingOllama}
                            onClick={() => void handleTestOllama()}
                          >
                            {testingOllama ? 'Testing…' : 'Test connection'}
                          </Button>
                        </div>
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Default model"
                          hint="Picked first on the Ask AI page and used by Prompt Builder. The list comes from the server above."
                        >
                          <div className="flex items-center gap-2">
                            <Combobox
                              className="min-w-0 flex-1"
                              value={ollamaModel}
                              onChange={(value) => {
                                setOllamaModel(value);
                                setAiDirty(true);
                              }}
                              options={ollamaModelOptions}
                              placeholder={
                                ollamaModelsQuery.isFetching ? 'Loading models…' : 'Choose a model'
                              }
                              emptyText="No models found. Is Ollama running?"
                              clearable
                            />
                            <SimpleTooltip label="Refresh model list" wrapTrigger>
                              <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                disabled={ollamaModelsQuery.isFetching}
                                onClick={() => void ollamaModelsQuery.refetch()}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </SimpleTooltip>
                          </div>
                        </Field>
                        <Field
                          label="Context length"
                          htmlFor="ollama-context-length"
                          hint="Tokens the model keeps in its window (num_ctx). Leave empty to use whatever the model ships with. Bigger values need more RAM or VRAM."
                        >
                          <Input
                            id="ollama-context-length"
                            inputMode="numeric"
                            value={ollamaContextLength}
                            onChange={(event) => {
                              setOllamaContextLength(event.target.value.replace(/[^0-9]/g, ''));
                              setAiDirty(true);
                            }}
                            placeholder="Model default (e.g. 8192)"
                            className="font-mono"
                            spellCheck={false}
                          />
                        </Field>
                        <Field
                          label="Keep model in memory"
                          htmlFor="ollama-keep-alive"
                          hint='How long Ollama holds the model in RAM after a request (keep_alive). Use "5m", "1h", "0" to free it right away, or "-1" to keep it loaded.'
                        >
                          <Input
                            id="ollama-keep-alive"
                            value={ollamaKeepAlive}
                            onChange={(event) => {
                              setOllamaKeepAlive(event.target.value);
                              setAiDirty(true);
                            }}
                            placeholder="5m"
                            className="font-mono"
                            spellCheck={false}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-5">
                      <Field
                        label="Prompt Builder provider"
                        hint="Used by Generate Prompt. Uses the key and model for that provider above."
                      >
                        <Combobox
                          className="w-40"
                          value={promptBuilderProvider}
                          onChange={(value) => {
                            setPromptBuilderProvider(value as AiProvider);
                            setAiDirty(true);
                          }}
                          options={PROMPT_BUILDER_PROVIDER_OPTIONS}
                        />
                      </Field>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {showSection(
                'ai',
                'voice whisper speech microphone transcription',
                'Voice input',
              ) && (
                <SettingsCard
                  icon={Microphone}
                  title="Voice input"
                  description="Local Whisper transcription for Prompt Builder. The model downloads once and stays cached."
                  dirty={speechDirty}
                >
                  <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Model">
                      <Combobox
                        value={speechModel}
                        onChange={(value) => {
                          setSpeechModel(value);
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
                        onChange={(value) => {
                          setSpeechLanguage(value);
                          setSpeechDirty(true);
                        }}
                        options={SPEECH_LANGUAGES}
                      />
                    </Field>
                  </div>
                </SettingsCard>
              )}

              {showSection('ai', WRITING_CHECK_KEYWORDS, 'Writing check') && settingsQuery.data ? (
                <WritingCheckSettings settings={settingsQuery.data} />
              ) : null}

              {showSection('ai', 'translation retries translate', 'Translation retries') && (
                <SettingsCard
                  icon={Languages}
                  title="Translation retries"
                  description="Extra attempts Prompt Builder makes if a translate request fails."
                  dirty={translateRetriesDirty}
                >
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={translateMaxRetriesText}
                    onChange={(event) => {
                      setTranslateMaxRetriesText(event.target.value);
                      setTranslateRetriesDirty(true);
                    }}
                    className="w-24"
                  />
                </SettingsCard>
              )}

              {showSection('notifications', 'telegram bot token chat notify', 'Telegram bot') && (
                <SettingsCard
                  icon={Bell}
                  title="Telegram bot"
                  description="Used by project notification hooks and scheduled task updates."
                  dirty={telegramDirty}
                  action={
                    <Badge
                      variant={telegramReady ? 'success' : 'secondary'}
                      className="font-normal"
                    >
                      {telegramReady ? 'Ready' : 'Not configured'}
                    </Badge>
                  }
                >
                  <div className="space-y-4">
                    <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                      <li>
                        Create a bot with{' '}
                        <ExternalLinkButton href="https://t.me/BotFather">
                          @BotFather
                        </ExternalLinkButton>{' '}
                        and paste its token.
                      </li>
                      <li>Message the bot once on Telegram, then detect the chat ID.</li>
                    </ol>

                    <Field label="Bot token" htmlFor="telegram-bot-token">
                      <SecretInput
                        id="telegram-bot-token"
                        value={botToken}
                        onChange={(value) => {
                          setBotToken(value);
                          setTelegramDirty(true);
                        }}
                        placeholder="123456789:AAExampleTokenFromBotFather"
                        className="max-w-md"
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
                          onChange={(event) => {
                            setChatId(event.target.value);
                            setTelegramDirty(true);
                          }}
                          placeholder="e.g. 123456789"
                          className="max-w-xs font-mono"
                          spellCheck={false}
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
                        onChange={(event) => {
                          setScheduledTasksChatId(event.target.value);
                          setTelegramDirty(true);
                        }}
                        placeholder="e.g. -1001234567890"
                        className="max-w-xs font-mono"
                        spellCheck={false}
                      />
                    </Field>

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
                  </div>
                </SettingsCard>
              )}

              {showSection('network', PROXY_KEYWORDS, 'Proxy') && settingsQuery.data ? (
                <ProxySettings
                  settings={settingsQuery.data}
                  onDirtyChange={setProxyDirty}
                  saveRef={proxySaveRef}
                  resetToken={proxyResetToken}
                />
              ) : null}

              {showSection('data', 'ping network hosts dashboard', 'Network ping targets') && (
                <SettingsCard
                  icon={NetworkIcon}
                  title="Network ping targets"
                  description="Hosts shown on the dashboard Network Status graph. The AI pet uses these too if internet alerts are on. Press Enter to add one."
                  dirty={pingTargetsDirty}
                >
                  <HostChips
                    value={pingTargetsText}
                    onChange={(value) => {
                      setPingTargetsText(value);
                      setPingTargetsDirty(true);
                    }}
                  />
                </SettingsCard>
              )}

              {showSection('data', 'backup restore export import zip', 'Backup & restore') && (
                <SettingsCard
                  icon={HardDrive}
                  title="Backup & restore"
                  description="Exports include projects, settings, templates, and saved keys. Keep the file private. Restoring replaces everything on this machine."
                >
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background/40 p-4">
                        <p className="text-sm font-medium">Export</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Save a copy of this machine's AgentMate data.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Switch
                            id="compress-backup"
                            checked={compressBackup}
                            onCheckedChange={setCompressBackup}
                          />
                          <Label
                            htmlFor="compress-backup"
                            className="font-normal text-muted-foreground"
                          >
                            Compress as .zip
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          disabled={exportingBackup}
                          onClick={() => void handleExportBackup()}
                        >
                          <Download className="h-4 w-4" />
                          {exportingBackup ? 'Exporting…' : 'Export backup'}
                        </Button>
                      </div>
                      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                        <p className="text-sm font-medium">Restore</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Replaces current data. This cannot be undone.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-8"
                          disabled={importingBackup}
                          onClick={() => void handleImportBackup()}
                        >
                          <Upload className="h-4 w-4" />
                          {importingBackup ? 'Restoring…' : 'Restore from backup…'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {showSection('data', 'about version update check', 'About') && (
                <SettingsCard
                  icon={CircleQuestion}
                  title="About"
                  description={`AgentMate ${versionLabel}`}
                  action={
                    updateStatus.state === 'downloaded' ? (
                      <Button size="sm" onClick={() => void window.agentmat.app.quitAndInstall()}>
                        Restart now
                      </Button>
                    ) : updateStatus.state === 'downloading' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void window.agentmat.app.pauseDownload()}
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openUpdateDialog()}>
                          Show
                        </Button>
                      </div>
                    ) : updateStatus.state === 'paused' ||
                      (updateStatus.state === 'error' && updateStatus.resumable) ||
                      updateStatus.state === 'available' ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          openUpdateDialog();
                          void window.agentmat.app.downloadUpdate();
                        }}
                      >
                        {updateStatus.state === 'available' && updateStatus.partialBytes === 0 ? (
                          <>
                            <Download className="h-4 w-4" />
                            Download
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Resume download
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={checkingForUpdates}
                        onClick={() => void handleCheckForUpdates()}
                      >
                        <RefreshCw
                          className={cn('h-4 w-4', checkingForUpdates && 'animate-spin')}
                        />
                        {checkingForUpdates ? 'Checking…' : 'Check for updates'}
                      </Button>
                    )
                  }
                >
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{updateStatusLabel()}</p>
                    {updatePercent(updateStatus) != null &&
                    updateStatus.state !== 'downloaded' &&
                    updateStatus.state !== 'idle' ? (
                      <UpdateProgressTrack
                        percent={updatePercent(updateStatus) ?? 0}
                        live={updateStatus.state === 'downloading'}
                        reconnecting={
                          updateStatus.state === 'downloading' && updateStatus.reconnecting
                        }
                      />
                    ) : null}
                  </div>
                </SettingsCard>
              )}
            </>
          )}
        </div>
      </div>

      {anyDirty ? (
        <div className="sticky bottom-0 z-20 border-t border-border/80 bg-background/85 px-6 py-3 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Unsaved changes
              <span className="ml-2 hidden text-xs sm:inline">({saveShortcutLabel()} to save)</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={saving} onClick={handleDiscardAll}>
                Discard
              </Button>
              <SimpleTooltip label={`Save all changes (${saveShortcutLabel()})`}>
                <Button size="sm" disabled={saving} onClick={() => void handleSaveAll()}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </SimpleTooltip>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
