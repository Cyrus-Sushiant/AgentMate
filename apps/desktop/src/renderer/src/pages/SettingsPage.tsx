import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Blocks,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  Robot,
  SatelliteDish,
  Send,
  Sun,
} from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useThemeStore } from '@/stores/themeStore';
import { usePingTargetsStore } from '@/stores/pingTargetsStore';
import { useUpdateStore } from '@/stores/updateStore';
import type { ThemeMode } from '@agentmat/core';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

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
        toast.success('Test message sent — check Telegram.');
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
  const [aiDirty, setAiDirty] = useState(false);

  useEffect(() => {
    if (!aiDirty && settingsQuery.data) {
      setOpenaiApiKey(settingsQuery.data.openaiApiKey ?? '');
      setOpenaiModel(settingsQuery.data.openaiModel);
      setOllamaBaseUrl(settingsQuery.data.ollamaBaseUrl);
      setGeminiApiKey(settingsQuery.data.geminiApiKey ?? '');
      setGeminiModel(settingsQuery.data.geminiModel);
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
        return `Downloading v${updateStatus.info.version} — ${updateStatus.progress.percent.toFixed(0)}%.`;
      case 'downloaded':
        return `v${updateStatus.info.version} downloaded — restart to install.`;
      case 'error':
        return updateStatus.message;
      default:
        return 'Checks run automatically every hour.';
    }
  }

  usePageHeader('Settings', 'Configure defaults for AgentMate.');

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Default CLI</CardTitle>
          <CardDescription>
            Used whenever a feature needs an AI provider without asking explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Combobox
            className="w-64"
            value={defaultCliId ?? ''}
            onChange={(v) => setDefaultCliId(v || null)}
            placeholder="No default set"
            searchPlaceholder="Search CLIs…"
            options={CLI_REGISTRY.map((cli) => ({ value: cli.id, label: cli.name }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how AgentMate looks.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={theme === option.value ? 'secondary' : 'outline'}
              className={cn(theme === option.value && 'ring-1 ring-primary')}
              onClick={() => setTheme(option.value)}
            >
              <option.icon /> {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skill Repositories</CardTitle>
          <CardDescription>
            {reposQuery.data?.length ?? 0} repositor{reposQuery.data?.length === 1 ? 'y' : 'ies'} configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/skills')}>
            <Blocks /> Manage repositories
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SatelliteDish className="h-4 w-4" /> Network Ping Targets
          </CardTitle>
          <CardDescription>
            Hosts or IPs pinged for the dashboard&apos;s Network Status graph. Each one gets its own
            line on the chart.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={pingTargetsText}
            onChange={(e) => {
              setPingTargetsText(e.target.value);
              setPingTargetsDirty(true);
            }}
            placeholder="1.1.1.1, 8.8.8.8"
            className="max-w-md"
          />
          <Button
            variant="outline"
            disabled={!pingTargetsDirty}
            onClick={handleSavePingTargets}
          >
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Ask AI Providers
          </CardTitle>
          <CardDescription>
            Configure the providers used by Ask AI — an OpenAI API key for GPT models, a Gemini API
            key for Google's models, and/or the address of a local Ollama server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="openai-api-key">OpenAI API key</Label>
            <Input
              id="openai-api-key"
              type="password"
              value={openaiApiKey}
              onChange={(e) => {
                setOpenaiApiKey(e.target.value);
                setAiDirty(true);
              }}
              placeholder="sk-…"
              className="max-w-md font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Create one at{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() =>
                  void window.agentmat.shell.openExternal('https://platform.openai.com/api-keys')
                }
              >
                platform.openai.com/api-keys
              </button>
              .
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openai-model">Default OpenAI model</Label>
            <Input
              id="openai-model"
              value={openaiModel}
              onChange={(e) => {
                setOpenaiModel(e.target.value);
                setAiDirty(true);
              }}
              placeholder="gpt-4o-mini"
              className="max-w-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ollama-base-url">Ollama server URL</Label>
            <Input
              id="ollama-base-url"
              value={ollamaBaseUrl}
              onChange={(e) => {
                setOllamaBaseUrl(e.target.value);
                setAiDirty(true);
              }}
              placeholder="http://localhost:11434"
              className="max-w-xs font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Address of a running{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => void window.agentmat.shell.openExternal('https://ollama.com')}
              >
                Ollama
              </button>{' '}
              instance. Leave the default if it runs on this machine.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gemini-api-key">Gemini API key</Label>
            <Input
              id="gemini-api-key"
              type="password"
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value);
                setAiDirty(true);
              }}
              placeholder="AIza…"
              className="max-w-md font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Create one at{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() =>
                  void window.agentmat.shell.openExternal('https://aistudio.google.com/apikey')
                }
              >
                aistudio.google.com/apikey
              </button>
              .
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gemini-model">Default Gemini model</Label>
            <Input
              id="gemini-model"
              value={geminiModel}
              onChange={(e) => {
                setGeminiModel(e.target.value);
                setAiDirty(true);
              }}
              placeholder="gemini-2.0-flash"
              className="max-w-xs font-mono"
            />
          </div>
          <Button
            disabled={!aiDirty || saveAiMutation.isPending}
            onClick={() => saveAiMutation.mutate()}
          >
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Robot className="h-4 w-4" /> Telegram Bot
          </CardTitle>
          <CardDescription>
            Used by project Notification hooks to message you on completion or when confirmation is
            needed. Create a bot via{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => void window.agentmat.shell.openExternal('https://t.me/BotFather')}
            >
              @BotFather
            </button>
            , then paste its token below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="telegram-bot-token">Bot token</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-chat-id">Chat ID</Label>
            <div className="flex gap-2">
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
                disabled={detectingChatId || !botToken.trim()}
                onClick={() => void handleDetectChatId()}
              >
                {detectingChatId ? 'Detecting…' : 'Detect from last message'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Message your bot on Telegram once, then click detect — no need to hunt for your chat ID
              manually.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-scheduled-tasks-chat-id">Scheduled tasks chat/group ID</Label>
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
            <p className="text-xs text-muted-foreground">
              Optional. When set, every scheduled task is posted here and the message is edited in
              place whenever its status changes.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              disabled={!telegramDirty || saveTelegramMutation.isPending}
              onClick={() => saveTelegramMutation.mutate()}
            >
              Save
            </Button>
            <Button
              variant="outline"
              disabled={sendingTest || (!botToken.trim() && !settingsQuery.data?.telegramBotToken)}
              onClick={() => void handleSendTest()}
            >
              <Send className="h-4 w-4" /> {sendingTest ? 'Sending…' : 'Send test message'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>
            AgentMate{' '}
            {appVersionQuery.data == null
              ? '…'
              : appVersionQuery.data === 'dev'
                ? '(dev build)'
                : `v${appVersionQuery.data}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{updateStatusLabel()}</p>
          <Button
            variant="outline"
            disabled={checkingForUpdates}
            onClick={() => void handleCheckForUpdates()}
          >
            <RefreshCw className={cn('h-4 w-4', checkingForUpdates && 'animate-spin')} />
            {checkingForUpdates ? 'Checking…' : 'Check for updates'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
