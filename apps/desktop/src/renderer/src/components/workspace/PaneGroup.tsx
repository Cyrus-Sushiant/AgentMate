import type { PaneGroupNode, Project } from '@agentmat/core';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CliLogo } from '@/components/cliLogos';
import {
  CodeCompare,
  Compress,
  Expand,
  File as FileIcon,
  GitCommit,
  Plus,
  RefreshCw,
  SplitView,
  TerminalSquare,
  X,
} from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useTerminalSessionStore } from '@/lib/terminal/terminalRuntime';
import { cn } from '@/lib/utils';
import { useLauncherStore } from '@/lib/workspace/commands';
import { modelDisplayName, useAgentRunInfo, useAgentStatus } from '@/stores/agentStatusStore';
import { confirmDialog } from '@/stores/confirmStore';
import { useShortcutLabel } from '@/stores/shortcutStore';
import {
  type ProjectWorkspace,
  terminalTabLabel,
  useWorkspaceStore,
  type WorkspaceTab,
} from '@/stores/workspaceStore';
import { AGENT_STATUS_LABEL, AgentStatusDot } from './AgentStatusDot';
import { LauncherMenu } from './LauncherMenu';
import { PaneLauncher } from './PaneLauncher';
import { TerminalSlot } from './TerminalSlot';

/** Monaco is heavy; it loads the first time a diff is opened. */
const DiffTab = lazy(() => import('./git/DiffTab'));
const FileTab = lazy(() => import('./FileTab'));

/** Drag payload type for workspace tabs, kept apart from OS file drags. */
const TAB_MIME = 'application/x-agentmate-tab';

interface DraggedTab {
  projectId: string;
  tabId: string;
  groupId: string;
}

function readDraggedTab(event: React.DragEvent): DraggedTab | null {
  try {
    const raw = event.dataTransfer.getData(TAB_MIME);
    return raw ? (JSON.parse(raw) as DraggedTab) : null;
  } catch {
    return null;
  }
}

function isTabDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(TAB_MIME);
}

type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom';

function zoneAt(event: React.DragEvent, el: HTMLElement): DropZone {
  const rect = el.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const edge = 0.22;
  if (x < edge) return 'left';
  if (x > 1 - edge) return 'right';
  if (y < edge) return 'top';
  if (y > 1 - edge) return 'bottom';
  return 'center';
}

const ZONE_PREVIEW: Record<DropZone, string> = {
  center: 'inset-2',
  left: 'inset-y-2 left-2 right-1/2',
  right: 'inset-y-2 right-2 left-1/2',
  top: 'inset-x-2 top-2 bottom-1/2',
  bottom: 'inset-x-2 bottom-2 top-1/2',
};

function PaneIconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'bg-foreground/10 text-foreground',
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

function TabIcon({ tab }: { tab: WorkspaceTab }): React.JSX.Element {
  if (tab.kind === 'diff') {
    return tab.commit ? (
      <GitCommit className="h-3 w-3 text-muted-foreground" />
    ) : (
      <CodeCompare className="h-3 w-3 text-muted-foreground" />
    );
  }
  if (tab.kind === 'file') return <FileIcon className="h-3 w-3 text-muted-foreground" />;
  if (tab.cliId) return <CliLogo cliId={tab.cliId} className="h-3.5 w-3.5" />;
  return <TerminalSquare className="h-3 w-3 text-muted-foreground" />;
}

function tabLabel(tab: WorkspaceTab): string {
  if (tab.kind === 'diff') {
    const name = tab.path.split('/').pop() ?? tab.path;
    return tab.commit ? `${name} @ ${tab.commit.slice(0, 7)}` : name;
  }
  if (tab.kind === 'file') return tab.path.split(/[\\/]/).pop() ?? tab.path;
  return terminalTabLabel(tab);
}

interface PaneTabProps {
  projectId: string;
  groupId: string;
  tab: WorkspaceTab;
  active: boolean;
  groupFocused: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function PaneTab({
  projectId,
  groupId,
  tab,
  active,
  groupFocused,
  onSelect,
  onClose,
}: PaneTabProps): React.JSX.Element {
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const openDiff = useWorkspaceStore((s) => s.openDiff);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const liveTitle = useTerminalSessionStore((s) => s.titles[tab.id]);
  const ended = useTerminalSessionStore((s) => tab.id in s.ended);
  const status = useAgentStatus(tab.id);
  const runInfo = useAgentRunInfo(tab.id);
  const [editing, setEditing] = useState(false);
  const label = tabLabel(tab);
  const attention = tab.kind === 'terminal' && !ended ? status : null;
  // What the agent reports it runs on right now, so a /model or /effort switch mid-session
  // shows up here. Before it reports, fall back to what the tab was launched with.
  const runLine =
    tab.kind !== 'terminal' || !tab.cliId
      ? null
      : runInfo?.model || runInfo?.effort
        ? [
            runInfo.model ? modelDisplayName(runInfo.model) : null,
            runInfo.effort ? `${runInfo.effort} effort` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : (tab.runLabel ?? null);
  const tooltip =
    tab.kind === 'terminal' ? (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        {runLine ? <span className="text-primary">{runLine}</span> : null}
        {liveTitle && liveTitle !== label ? (
          <span className="text-muted-foreground">{liveTitle}</span>
        ) : null}
        {attention && attention !== 'idle' && attention !== 'exited' ? (
          <span>{AGENT_STATUS_LABEL[attention]}</span>
        ) : null}
        <span className="font-mono text-[10px] text-muted-foreground">{tab.cwd}</span>
      </span>
    ) : (
      tab.path
    );

  return (
    <SimpleTooltip label={editing ? null : tooltip} delayDuration={600}>
      <div
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        draggable={!editing}
        data-tab-id={tab.id}
        onDragStart={(event) => {
          const payload: DraggedTab = { projectId, tabId: tab.id, groupId };
          event.dataTransfer.setData(TAB_MIME, JSON.stringify(payload));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            onClose();
          }
        }}
        onDoubleClick={() => {
          if (tab.kind === 'terminal') setEditing(true);
          else if (tab.kind === 'diff' && tab.preview) openDiff(projectId, tab, { pin: true });
          else if (tab.kind === 'file' && tab.preview) openFile(projectId, tab.path, { pin: true });
        }}
        className={cn(
          'group relative flex h-7 min-w-[4.5rem] max-w-[13rem] shrink cursor-pointer select-none items-center gap-1.5 rounded-md pl-2 pr-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          attention === 'needs-input'
            ? 'bg-warning/12 text-foreground ring-1 ring-inset ring-warning/30'
            : active
              ? 'bg-foreground/[0.08] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
        )}
      >
        {active && groupFocused ? (
          <span className="absolute inset-x-2 -bottom-[5px] h-[2px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        ) : null}
        <TabIcon tab={tab} />
        {editing && tab.kind === 'terminal' ? (
          <input
            autoFocus
            defaultValue={label}
            aria-label="Tab name"
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              renameTab(projectId, tab.id, event.currentTarget.value);
              setEditing(false);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setEditing(false);
            }}
            className="h-5 min-w-0 flex-1 rounded border border-primary/40 bg-background px-1 text-xs outline-none"
          />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              (tab.kind === 'diff' || tab.kind === 'file') && tab.preview && 'italic',
              ended && 'text-muted-foreground line-through decoration-foreground/30',
            )}
          >
            {label}
          </span>
        )}
        <AgentStatusDot status={attention} />
        <button
          type="button"
          aria-label={`Close ${label}`}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-foreground/15 hover:text-foreground',
            active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70',
          )}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </SimpleTooltip>
  );
}

function SessionEndedBar({
  exitCode,
  onRestart,
  onClose,
}: {
  exitCode: number | null;
  onRestart: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const message =
    exitCode === null
      ? 'This session ended while AgentMate was closed.'
      : `Process exited${exitCode === 0 ? '' : ` with code ${exitCode}`}.`;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-zinc-900/85 py-1 pl-4 pr-1 text-xs text-zinc-300 shadow-2xl backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-2">
        <span>{message}</span>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 font-semibold text-primary-foreground hover:brightness-110"
        >
          <RefreshCw className="h-3 w-3" /> Restart
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 items-center rounded-full px-3 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export interface PaneGroupProps {
  project: Project;
  workspace: ProjectWorkspace;
  group: PaneGroupNode;
  /** More than one pane is on screen, so focus and pane actions need to show. */
  multiPane: boolean;
}

export function PaneGroup({
  project,
  workspace,
  group,
  multiPane,
}: PaneGroupProps): React.JSX.Element {
  const projectId = project.id;
  const store = useWorkspaceStore;
  const focusGroup = useWorkspaceStore((s) => s.focusGroup);
  const activateTab = useWorkspaceStore((s) => s.activateTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const restartTab = useWorkspaceStore((s) => s.restartTab);
  const splitGroup = useWorkspaceStore((s) => s.splitGroup);
  const closeGroup = useWorkspaceStore((s) => s.closeGroup);
  const toggleZoom = useWorkspaceStore((s) => s.toggleZoom);
  const setLauncherFor = useLauncherStore((s) => s.setOpenFor);
  const splitRightLabel = useShortcutLabel('workspace.splitRight');
  const splitDownLabel = useShortcutLabel('workspace.splitDown');
  const zoomLabel = useShortcutLabel('workspace.zoomPane');
  const newTabLabel = useShortcutLabel('workspace.newTab');

  const focused = workspace.focusedGroupId === group.id;
  const zoomed = workspace.zoomedGroupId === group.id;
  const activeTab = group.activeTabId ? workspace.tabs[group.activeTabId] : undefined;
  const exitCode = useTerminalSessionStore((s) =>
    activeTab && activeTab.id in s.ended ? s.ended[activeTab.id] : undefined,
  );
  const workspaceEmpty = Object.keys(workspace.tabs).length === 0;

  const stripRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  // Wheel scrolls the strip sideways once tabs no longer fit.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent): void => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  async function requestCloseTab(tabId: string): Promise<void> {
    const tab = workspace.tabs[tabId];
    const ended = tabId in useTerminalSessionStore.getState().ended;
    if (tab?.kind === 'terminal' && tab.cliId && !ended) {
      const ok = await confirmDialog({
        title: `Close ${terminalTabLabel(tab)}?`,
        description: 'The agent running in this tab will be stopped.',
        confirmLabel: 'Close tab',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    closeTab(projectId, tabId);
  }

  async function requestCloseGroup(): Promise<void> {
    const running = group.tabIds.filter(
      (id) =>
        workspace.tabs[id]?.kind === 'terminal' &&
        !(id in useTerminalSessionStore.getState().ended),
    );
    if (running.length > 0) {
      const ok = await confirmDialog({
        title: 'Close this pane?',
        description: `${running.length} terminal${running.length === 1 ? '' : 's'} in it will be stopped.`,
        confirmLabel: 'Close pane',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    closeGroup(projectId, group.id);
  }

  function stripInsertIndex(event: React.DragEvent): number {
    const el = stripRef.current;
    if (!el) return group.tabIds.length;
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('[data-tab-id]'));
    const index = tabs.findIndex((tab) => {
      const rect = tab.getBoundingClientRect();
      return event.clientX < rect.left + rect.width / 2;
    });
    return index === -1 ? tabs.length : index;
  }

  function dropOnStrip(event: React.DragEvent): void {
    const dragged = readDraggedTab(event);
    const at = insertAt ?? group.tabIds.length;
    setInsertAt(null);
    if (!dragged || dragged.projectId !== projectId) return;
    event.preventDefault();
    const from = group.tabIds.indexOf(dragged.tabId);
    // Moving right within the same strip: the tab's own slot disappears first.
    const index = from !== -1 && from < at ? at - 1 : at;
    store.getState().moveTab(projectId, dragged.tabId, group.id, index);
  }

  function dropOnBody(event: React.DragEvent): void {
    const dragged = readDraggedTab(event);
    const zone = dropZone;
    setDropZone(null);
    if (!dragged || dragged.projectId !== projectId || !zone) return;
    event.preventDefault();
    const state = store.getState();
    if (zone === 'center') {
      if (dragged.groupId !== group.id) state.moveTab(projectId, dragged.tabId, group.id);
      return;
    }
    // Splitting a pane with its own only tab would put everything back where it was.
    if (dragged.groupId === group.id && group.tabIds.length === 1) return;
    const direction = zone === 'left' || zone === 'right' ? 'row' : 'column';
    const side = zone === 'left' || zone === 'top' ? 'before' : 'after';
    const target = state.splitGroup(projectId, group.id, direction, side);
    state.moveTab(projectId, dragged.tabId, target);
  }

  return (
    <section
      data-pane-group-id={group.id}
      aria-label={`${project.name} pane`}
      onPointerDownCapture={() => {
        if (!focused) focusGroup(projectId, group.id);
      }}
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card/40 transition-[border-color,box-shadow] duration-150',
        multiPane && focused
          ? 'border-primary/35 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_0_24px_-12px_hsl(var(--primary)/0.45)]'
          : 'border-border/70',
      )}
    >
      <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 bg-card/60 px-1.5">
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Tabs"
          onDragOver={(event) => {
            if (!isTabDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setInsertAt(stripInsertIndex(event));
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setInsertAt(null);
          }}
          onDrop={dropOnStrip}
          className="relative flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {group.tabIds.map((tabId, index) => {
            const tab = workspace.tabs[tabId];
            if (!tab) return null;
            return (
              <div key={tabId} className="relative flex min-w-0 shrink items-center">
                {insertAt === index ? (
                  <span className="absolute -left-[2px] top-1 bottom-1 w-[2px] rounded-full bg-primary" />
                ) : null}
                <PaneTab
                  projectId={projectId}
                  groupId={group.id}
                  tab={tab}
                  active={tabId === group.activeTabId}
                  groupFocused={focused}
                  onSelect={() => activateTab(projectId, tabId)}
                  onClose={() => void requestCloseTab(tabId)}
                />
              </div>
            );
          })}
          {insertAt === group.tabIds.length && group.tabIds.length > 0 ? (
            <span className="h-5 w-[2px] shrink-0 rounded-full bg-primary" />
          ) : null}
          <LauncherMenu project={project} groupId={group.id}>
            <button
              type="button"
              aria-label="New tab"
              className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          </LauncherMenu>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <PaneIconButton
            label={splitRightLabel ? `Split right (${splitRightLabel})` : 'Split right'}
            onClick={() => setLauncherFor(splitGroup(projectId, group.id, 'row'))}
          >
            <SplitView className="h-3 w-3" />
          </PaneIconButton>
          <PaneIconButton
            label={splitDownLabel ? `Split down (${splitDownLabel})` : 'Split down'}
            onClick={() => setLauncherFor(splitGroup(projectId, group.id, 'column'))}
          >
            <SplitView className="h-3 w-3 rotate-90" />
          </PaneIconButton>
          {multiPane ? (
            <>
              <PaneIconButton
                label={
                  zoomed ? 'Restore pane' : zoomLabel ? `Zoom pane (${zoomLabel})` : 'Zoom pane'
                }
                active={zoomed}
                onClick={() => toggleZoom(projectId, group.id)}
              >
                {zoomed ? <Compress className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
              </PaneIconButton>
              <PaneIconButton label="Close pane" onClick={() => void requestCloseGroup()}>
                <X className="h-3 w-3" />
              </PaneIconButton>
            </>
          ) : null}
        </div>
      </header>

      <div
        ref={bodyRef}
        className="relative min-h-0 flex-1"
        onDragOver={(event) => {
          if (!isTabDrag(event) || !bodyRef.current) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropZone(zoneAt(event, bodyRef.current));
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropZone(null);
        }}
        onDrop={dropOnBody}
      >
        {activeTab?.kind === 'terminal' ? (
          <>
            <TerminalSlot
              key={activeTab.id}
              projectId={projectId}
              tab={activeTab}
              focused={focused}
            />
            {exitCode !== undefined ? (
              <SessionEndedBar
                exitCode={exitCode}
                onRestart={() => restartTab(projectId, activeTab.id)}
                onClose={() => closeTab(projectId, activeTab.id)}
              />
            ) : null}
          </>
        ) : activeTab?.kind === 'diff' ? (
          <Suspense
            fallback={
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <DiffTab project={project} tab={activeTab} focused={focused} />
          </Suspense>
        ) : activeTab?.kind === 'file' ? (
          <Suspense
            fallback={
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <FileTab key={activeTab.id} project={project} tab={activeTab} />
          </Suspense>
        ) : (
          <PaneLauncher
            project={project}
            groupId={group.id}
            hero={workspaceEmpty && !multiPane}
            focused={focused}
          />
        )}

        {dropZone ? (
          <div
            className={cn(
              'pointer-events-none absolute z-20 rounded-lg border-2 border-dashed border-primary/60 bg-primary/10 transition-all duration-100',
              ZONE_PREVIEW[dropZone],
            )}
          />
        ) : null}
      </div>

      {!activeTab && newTabLabel && !workspaceEmpty ? (
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-muted-foreground/60">
          {newTabLabel} opens the tab menu
        </p>
      ) : null}
    </section>
  );
}
