import { type AgentHistorySession, findGroup, type Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CliLogo } from '@/components/cliLogos';
import { Copy, GitBranch, History, Play, Search } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { HISTORY_CLI_ID, launchResumeTab, resumedConversationId } from '@/lib/workspace/launch';
import { modelDisplayName, useAgentStatusStore } from '@/stores/agentStatusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type ProviderFilter = 'all' | AgentHistorySession['provider'];

const PROVIDER_LABEL: Record<AgentHistorySession['provider'], string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
};

function dayBucket(at: number, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (at >= startOfToday) return 'Today';
  if (at >= startOfToday - day) return 'Yesterday';
  if (at >= startOfToday - 6 * day) return 'This week';
  if (at >= startOfToday - 29 * day) return 'This month';
  return 'Older';
}

function shortModel(model: string): string {
  return /^gpt/i.test(model) ? model.replace(/^gpt/i, 'GPT') : modelDisplayName(model);
}

/**
 * Tabs already running a conversation, by the CLI's conversation id. Claude Code reports its
 * id through hooks; a tab this section resumed carries the id in its launch command.
 */
function useOpenConversations(projectId: string): Map<string, string> {
  const tabs = useWorkspaceStore((s) => s.workspaces[projectId]?.tabs);
  const runInfos = useAgentStatusStore((s) => s.runInfos);
  return useMemo(() => {
    const open = new Map<string, string>();
    for (const tab of Object.values(tabs ?? {})) {
      if (tab.kind !== 'terminal' || !tab.cliId) continue;
      const id = runInfos[tab.id]?.conversationId;
      if (id) open.set(id, tab.id);
      if (tab.conversationId && !open.has(tab.conversationId)) open.set(tab.conversationId, tab.id);
      const resumed = resumedConversationId(tab.launchInput);
      if (resumed && !open.has(resumed)) open.set(resumed, tab.id);
    }
    return open;
  }, [tabs, runInfos]);
}

function HistoryRow({
  project,
  session,
  openTabId,
}: {
  project: Project;
  session: AgentHistorySession;
  openTabId: string | undefined;
}): React.JSX.Element {
  const activateTab = useWorkspaceStore((s) => s.activateTab);
  const headline = session.title ?? session.firstPrompt ?? 'Untitled conversation';
  const run = [
    session.model ? shortModel(session.model) : null,
    session.effort ? `${session.effort} effort` : null,
  ].filter(Boolean);
  const meta = [timeAgo(new Date(session.updatedAt).toISOString()), ...run];

  function resume(): void {
    if (openTabId) {
      activateTab(project.id, openTabId);
      return;
    }
    const ws = useWorkspaceStore.getState().workspaces[project.id];
    const group = ws ? findGroup(ws.root, ws.focusedGroupId) : null;
    launchResumeTab(project, session, group?.id);
  }

  const details = (
    <div className="max-w-[20rem] space-y-1.5 py-0.5 text-left">
      {session.title && session.firstPrompt ? (
        <p className="font-medium leading-snug">{session.title}</p>
      ) : null}
      {session.firstPrompt ? (
        <p className="leading-snug text-muted-foreground">
          <span className="text-foreground/80">First: </span>
          {session.firstPrompt}
        </p>
      ) : null}
      {session.lastPrompt ? (
        <p className="leading-snug text-muted-foreground">
          <span className="text-foreground/80">Last: </span>
          {session.lastPrompt}
        </p>
      ) : null}
      {run.length > 0 ? (
        <p className="leading-snug text-muted-foreground">
          <span className="text-foreground/80">Ran on: </span>
          {run.join(' · ')}
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        {PROVIDER_LABEL[session.provider]}
        {session.startedAt ? ` · started ${new Date(session.startedAt).toLocaleString()}` : ''}
      </p>
    </div>
  );

  return (
    <div className="group/history relative mx-1">
      <SimpleTooltip label={details} side="left">
        <button
          type="button"
          onClick={resume}
          className={cn(
            'flex w-full items-start gap-2 rounded-md py-1.5 pl-2 pr-2 text-left group-focus-within/history:pr-12 group-hover/history:pr-12 transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            openTabId && 'bg-primary/[0.07]',
          )}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-foreground/[0.06]">
            <CliLogo cliId={HISTORY_CLI_ID[session.provider]} className="h-2.5 w-2.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-[12px] leading-4',
                session.title ? 'font-medium' : 'text-foreground/90',
              )}
            >
              {headline}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground">
              {openTabId ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Open
                </span>
              ) : null}
              <span className="truncate tabular-nums">{meta.join(' · ')}</span>
              {session.gitBranch ? (
                <span className="inline-flex min-w-0 items-center gap-0.5">
                  <GitBranch className="h-2 w-2 shrink-0" />
                  <span className="truncate font-mono">{session.gitBranch}</span>
                </span>
              ) : null}
            </span>
          </span>
        </button>
      </SimpleTooltip>
      <span className="absolute right-1 top-1.5 hidden items-center gap-0.5 group-focus-within/history:flex group-hover/history:flex">
        <SimpleTooltip label="Copy conversation id">
          <button
            type="button"
            aria-label="Copy conversation id"
            onClick={() => {
              void navigator.clipboard.writeText(session.id);
              toast.success('Conversation id copied');
            }}
            className="flex h-5 w-5 items-center justify-center rounded bg-card text-muted-foreground shadow-sm hover:bg-foreground/10 hover:text-foreground"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        </SimpleTooltip>
        {openTabId ? null : (
          <SimpleTooltip label="Resume in a new tab">
            <button
              type="button"
              aria-label="Resume in a new tab"
              onClick={resume}
              className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-primary shadow-sm hover:bg-primary/25"
            >
              <Play className="h-2 w-2" />
            </button>
          </SimpleTooltip>
        )}
      </span>
    </div>
  );
}

/**
 * Past Claude Code and Codex conversations started in the project's folder. Clicking one
 * resumes it in a new tab, or jumps to the tab where it is already running.
 */
export function HistorySection({ project }: { project: Project }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [showBackground, setShowBackground] = useState(false);
  const openConversations = useOpenConversations(project.id);
  const history = useQuery({
    queryKey: queryKeys.agentHistory(project.id),
    queryFn: () => window.agentmat.agents.history(project.id),
    refetchInterval: 20_000,
    staleTime: 10_000,
    meta: { silentLoading: true },
  });

  const sessions = history.data ?? [];
  const providers = new Set(sessions.map((s) => s.provider));
  const backgroundCount = sessions.filter(
    (s) => s.background && (provider === 'all' || s.provider === provider),
  ).length;
  const needle = query.trim().toLowerCase();
  const visible = sessions.filter(
    (s) =>
      (showBackground || !s.background) &&
      (provider === 'all' || s.provider === provider) &&
      (!needle ||
        [s.title, s.firstPrompt, s.lastPrompt, s.gitBranch, s.model, s.id].some((field) =>
          field?.toLowerCase().includes(needle),
        )),
  );

  const now = new Date();
  const groups: { label: string; items: AgentHistorySession[] }[] = [];
  for (const session of visible) {
    const label = dayBucket(session.updatedAt, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(session);
    else groups.push({ label, items: [session] });
  }

  if (history.isPending) {
    return (
      <div className="space-y-2.5 p-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 rounded" style={{ width: `${85 - i * 12}%` }} />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-5 py-5 text-center">
        <History className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium">No conversations yet</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Claude Code and Codex sessions started in this folder show up here, ready to resume.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <Search className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="h-6 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/70"
        />
        {providers.size > 1 ? (
          <div
            role="radiogroup"
            aria-label="Agent"
            className="flex shrink-0 items-center rounded-md bg-foreground/[0.05] p-0.5"
          >
            {(['all', 'claude-code', 'codex'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={provider === value}
                onClick={() => setProvider(value)}
                className={cn(
                  'rounded px-1.5 py-px text-[10px] font-medium transition-colors',
                  provider === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'all' ? 'All' : PROVIDER_LABEL[value]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {group.label}
            </p>
            {group.items.map((session) => (
              <HistoryRow
                key={`${session.provider}:${session.id}`}
                project={project}
                session={session}
                openTabId={openConversations.get(session.id)}
              />
            ))}
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {needle || provider !== 'all'
              ? 'No conversation matches.'
              : 'Only runs started by tools so far.'}
          </p>
        ) : null}
        {backgroundCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowBackground((show) => !show)}
            className="mx-3 mt-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showBackground
              ? 'Hide runs started by tools'
              : `Show ${backgroundCount} run${backgroundCount === 1 ? '' : 's'} started by tools`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
