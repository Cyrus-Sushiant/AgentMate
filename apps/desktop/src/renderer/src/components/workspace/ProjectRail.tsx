import type { Project } from '@agentmat/core';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Search, X } from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useTerminalSessionStore } from '@/lib/terminal/terminalRuntime';
import { cn } from '@/lib/utils';
import { attentionStatus, isSessionBusy, useAgentStatusStore } from '@/stores/agentStatusStore';
import { confirmDialog } from '@/stores/confirmStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentStatusDot } from './AgentStatusDot';

export function ProjectSearchList({
  projects,
  onPick,
  exclude,
}: {
  projects: Project[];
  onPick: (project: Project) => void;
  exclude?: ReadonlySet<string>;
}): React.JSX.Element {
  const available = projects.filter((p) => !p.archived && !exclude?.has(p.id));
  return (
    <CommandPrimitive
      className="flex flex-col"
      filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        <CommandPrimitive.Input
          autoFocus
          placeholder="Open a project…"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <CommandPrimitive.List className="max-h-72 overflow-y-auto p-1">
        <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
          {available.length === 0 ? 'Every project is already open.' : 'No matching project.'}
        </CommandPrimitive.Empty>
        {available.map((project) => (
          <CommandPrimitive.Item
            key={project.id}
            value={`${project.name} ${project.folderPath} ${project.id}`}
            onSelect={() => onPick(project)}
            className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none aria-selected:bg-primary/12"
          >
            <ProjectIcon
              iconDataUrl={project.iconDataUrl}
              bgColor={project.iconBgColor}
              iconColor={project.iconColor}
              className="h-6 w-6 rounded-md"
              glyphClassName="h-3 w-3"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{project.name}</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {project.folderPath}
              </span>
            </span>
          </CommandPrimitive.Item>
        ))}
      </CommandPrimitive.List>
    </CommandPrimitive>
  );
}

function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  const word = words[0] ?? '?';
  // CamelCase names ("AgentMate") read better as their two capitals.
  const capitals = word.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) return `${capitals[0]}${capitals[1]}`;
  return word.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

/** A stable hue per project, so its tile keeps its colour between sessions. */
function monogramStyle(project: Project): React.CSSProperties {
  if (project.iconBgColor) {
    return { backgroundColor: project.iconBgColor, color: project.iconColor ?? undefined };
  }
  let hash = 0;
  for (const char of project.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue} 55% 45% / 0.18)`,
    // A middle lightness that holds its contrast on both the light and the dark theme.
    color: `hsl(${hue} 65% 50%)`,
    boxShadow: `inset 0 0 0 1px hsl(${hue} 60% 55% / 0.25)`,
  };
}

/** Drag payload type for rail projects, kept apart from tab and file drags. */
const RAIL_PROJECT_MIME = 'application/x-agentmate-rail-project';

function isRailProjectDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(RAIL_PROJECT_MIME);
}

function RailItem({
  project,
  active,
  onOpen,
  onClose,
  dragging,
  dropIndicator,
  onDragStart,
  onDragEnd,
}: {
  project: Project;
  active: boolean;
  onOpen: () => void;
  onClose: () => void;
  dragging: boolean;
  /** Where a project dragged over the rail would land relative to this one. */
  dropIndicator: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const tabIds = useWorkspaceStore(
    useShallow((s) =>
      Object.values(s.workspaces[project.id]?.tabs ?? {})
        .filter((t) => t.kind === 'terminal')
        .map((t) => t.id),
    ),
  );
  const tabCount = tabIds.length;
  const attention = useAgentStatusStore((s) =>
    attentionStatus(tabIds.map((id) => s.statuses[id] ?? 'idle')),
  );
  const busyCount = useAgentStatusStore(
    (s) => tabIds.filter((id) => s.statuses[id] === 'working').length,
  );

  return (
    <div
      data-rail-project-id={project.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(RAIL_PROJECT_MIME, project.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex w-full justify-center transition-opacity',
        dragging && 'opacity-40',
      )}
    >
      {dropIndicator ? (
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]',
            dropIndicator === 'before' ? '-top-[6px]' : '-bottom-[6px]',
          )}
        />
      ) : null}
      {active ? (
        <motion.span
          layoutId="workspace-rail-active"
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]"
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34 }
          }
        />
      ) : null}
      <SimpleTooltip
        side="right"
        label={
          <span className="flex flex-col">
            <span className="font-semibold">{project.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {project.folderPath}
            </span>
            {tabCount > 0 ? (
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                {tabCount} terminal{tabCount === 1 ? '' : 's'} open
                {busyCount > 0 ? `, ${busyCount} working` : ''}
                {attention === 'needs-input'
                  ? ', waiting on you'
                  : attention === 'done'
                    ? ', something finished'
                    : ''}
              </span>
            ) : null}
          </span>
        }
      >
        <button
          type="button"
          aria-label={`Open ${project.name}`}
          aria-current={active ? 'page' : undefined}
          onClick={onOpen}
          className={cn(
            'relative rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active
              ? 'ring-2 ring-primary/55 ring-offset-2 ring-offset-background'
              : 'opacity-70 hover:opacity-100',
          )}
        >
          {project.iconDataUrl ? (
            <ProjectIcon
              iconDataUrl={project.iconDataUrl}
              bgColor={project.iconBgColor}
              iconColor={project.iconColor}
              className="h-9 w-9 rounded-xl"
            />
          ) : (
            // Folder glyphs all look alike in a column; initials tell projects apart at a glance.
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold tracking-tight"
              style={monogramStyle(project)}
            >
              {initials(project.name)}
            </span>
          )}
          {attention ? (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              <AgentStatusDot status={attention} />
            </span>
          ) : null}
        </button>
      </SimpleTooltip>
      <SimpleTooltip label="Close workspace" side="right">
        <button
          type="button"
          aria-label={`Close ${project.name} workspace`}
          onClick={onClose}
          className="absolute -top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground opacity-0 shadow transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="h-2 w-2" />
        </button>
      </SimpleTooltip>
    </div>
  );
}

/** The narrow strip on the left: projects with an open workspace, and a way to open another. */
export function ProjectRail({
  projects,
  activeProjectId,
}: {
  projects: Project[];
  activeProjectId: string | null;
}): React.JSX.Element {
  const navigate = useNavigate();
  const railProjectIds = useWorkspaceStore((s) => s.railProjectIds);
  const closeProject = useWorkspaceStore((s) => s.closeProject);
  const moveRailProject = useWorkspaceStore((s) => s.moveRailProject);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** The rail slot a dragged project would drop into, counted in the current order. */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const railProjects = railProjectIds.flatMap((id) => byId.get(id) ?? []);

  async function requestClose(project: Project): Promise<void> {
    const state = useWorkspaceStore.getState();
    const ended = useTerminalSessionStore.getState().ended;
    const running = Object.values(state.workspaces[project.id]?.tabs ?? {}).filter(
      (tab) => tab.kind === 'terminal' && !(tab.id in ended) && isSessionBusy(tab.id),
    ).length;
    if (running > 0) {
      const ok = await confirmDialog({
        title: `Close the ${project.name} workspace?`,
        description: `${running} terminal${running === 1 ? '' : 's'} will be stopped.`,
        confirmLabel: 'Close workspace',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    closeProject(project.id);
    const next = useWorkspaceStore.getState().activeProjectId;
    navigate(next ? `/workspace/${next}` : '/workspace', { replace: true });
  }

  function railInsertIndex(event: React.DragEvent<HTMLElement>): number {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-rail-project-id]'),
    );
    const index = items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    return index === -1 ? items.length : index;
  }

  function endDrag(): void {
    setDraggingId(null);
    setInsertAt(null);
  }

  // Dropping a project right next to where it already is would not move it, so no line for that.
  const draggingIndex = draggingId ? railProjects.findIndex((p) => p.id === draggingId) : -1;
  const showInsert =
    insertAt !== null &&
    draggingIndex !== -1 &&
    insertAt !== draggingIndex &&
    insertAt !== draggingIndex + 1;

  return (
    <nav
      aria-label="Open workspaces"
      onDragOver={(event) => {
        if (!isRailProjectDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setInsertAt(railInsertIndex(event));
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setInsertAt(null);
      }}
      onDrop={(event) => {
        if (!isRailProjectDrag(event)) return;
        event.preventDefault();
        const projectId = event.dataTransfer.getData(RAIL_PROJECT_MIME);
        const index = railInsertIndex(event);
        endDrag();
        if (!projectId) return;
        // The rail skips ids of projects that no longer exist, so map the slot back to the store.
        const before = railProjects[index];
        moveRailProject(
          projectId,
          before ? railProjectIds.indexOf(before.id) : railProjectIds.length,
        );
      }}
      className="flex w-14 shrink-0 flex-col items-center gap-2.5 border-r border-border/70 bg-card/30 py-3"
    >
      {railProjects.map((project, index) => (
        <RailItem
          key={project.id}
          project={project}
          active={project.id === activeProjectId}
          onOpen={() => navigate(`/workspace/${project.id}`)}
          onClose={() => void requestClose(project)}
          dragging={project.id === draggingId}
          dropIndicator={
            !showInsert
              ? null
              : insertAt === index
                ? 'before'
                : insertAt === railProjects.length && index === railProjects.length - 1
                  ? 'after'
                  : null
          }
          onDragStart={() => setDraggingId(project.id)}
          onDragEnd={endDrag}
        />
      ))}
      <PopoverPrimitive.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <SimpleTooltip label="Open another project" side="right">
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label="Open another project"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.06] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary/50 data-[state=open]:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverPrimitive.Trigger>
        </SimpleTooltip>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side="right"
            align="start"
            sideOffset={10}
            className="z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover/85 text-popover-foreground shadow-2xl backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          >
            <ProjectSearchList
              projects={projects}
              exclude={new Set(railProjectIds)}
              onPick={(project) => {
                setPickerOpen(false);
                navigate(`/workspace/${project.id}`);
              }}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </nav>
  );
}
