import type { Project } from '@agentmat/core';
import { AGENT_TYPE_CLI_ID, AGENT_TYPE_LABELS, configuredRunCommands } from '@agentmat/core';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CliLogo } from '@/components/cliLogos';
import { GrammarTextarea } from '@/components/grammar/GrammarTextarea';
import {
  ArrowLeft,
  Bell,
  Blocks,
  CalendarDays,
  Copy,
  EllipsisVertical,
  File,
  FileCog,
  Folder,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  Globe,
  History,
  MessageSquare,
  Package,
  Pencil,
  Plug,
  Run,
  TerminalSquare,
  Trash2,
  Wand2,
} from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { openCliInTerminal } from '@/lib/openCli';
import { persianTextProps } from '@/lib/rtl';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

export const PROJECT_SECTION_IDS = [
  'overview',
  'prompts',
  'git',
  'review',
  'packages',
  'schedule',
  'terminal',
  'bootstrap',
  'skills',
  'mcp',
  'hooks',
  'config',
] as const;

export type ProjectSectionId = (typeof PROJECT_SECTION_IDS)[number];

export { AGENT_TYPE_LABELS };

const SECTIONS: {
  id: ProjectSectionId;
  label: string;
  icon: typeof File;
  group: 'work' | 'setup';
}[] = [
  { id: 'overview', label: 'Overview', icon: File, group: 'work' },
  { id: 'prompts', label: 'Prompt history', icon: History, group: 'work' },
  { id: 'git', label: 'Git', icon: GitBranch, group: 'work' },
  { id: 'review', label: 'Review', icon: GitPullRequest, group: 'work' },
  { id: 'packages', label: 'Packages', icon: Package, group: 'work' },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays, group: 'work' },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare, group: 'work' },
  { id: 'bootstrap', label: 'Bootstrap', icon: Wand2, group: 'setup' },
  { id: 'skills', label: 'Skills', icon: Blocks, group: 'setup' },
  { id: 'mcp', label: 'MCP', icon: Plug, group: 'setup' },
  { id: 'hooks', label: 'Hooks', icon: Bell, group: 'setup' },
  { id: 'config', label: 'Config', icon: FileCog, group: 'setup' },
];

export type SectionBadge = { count?: number; attention?: boolean };

export function isProjectSectionId(value: string | null): value is ProjectSectionId {
  return value !== null && (PROJECT_SECTION_IDS as readonly string[]).includes(value);
}

function stripUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function ProjectEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof File;
  title: string;
  description: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ProjectDetailSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col gap-5 p-6">
      <Skeleton className="h-8 w-24" />
      <div className="glass rounded-lg p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-wrap gap-1 lg:w-52 lg:flex-col">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28 lg:w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailHeader({
  project,
  onBack,
  onRun,
  onPrompt,
  onEdit,
  onDelete,
  onCopyPath,
  onOpenFolder,
  onOpenTerminal,
}: {
  project: Project;
  onBack: () => void;
  onRun: () => void;
  onPrompt: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
  onOpenFolder: () => void;
  onOpenTerminal: () => void;
}): React.JSX.Element {
  const agentLabel = AGENT_TYPE_LABELS[project.agentType];
  const agentCliId = AGENT_TYPE_CLI_ID[project.agentType];
  const hasRunCommand = configuredRunCommands(project).length > 0;
  const description = persianTextProps(project.description);

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft /> Projects
      </Button>

      <div className="glass rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <ProjectIcon
              iconDataUrl={project.iconDataUrl}
              bgColor={project.iconBgColor}
              iconColor={project.iconColor}
              className="h-12 w-12"
              glyphClassName="h-5 w-5"
            />
            <div className="min-w-0 space-y-2">
              <div className="space-y-1">
                <h1 className="truncate text-lg font-semibold leading-tight">{project.name}</h1>
                {project.description ? (
                  <p
                    dir={description.dir}
                    className={cn(
                      'max-w-2xl text-sm leading-relaxed text-muted-foreground',
                      description.className,
                    )}
                  >
                    {project.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {agentCliId ? (
                  <SimpleTooltip label={`Open ${agentLabel} in the terminal`}>
                    <button
                      type="button"
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        openCliInTerminal({
                          cliId: agentCliId,
                          cwd: project.folderPath,
                          projectId: project.id,
                        })
                      }
                    >
                      <Badge
                        variant="secondary"
                        className="cursor-pointer gap-1.5 hover:border-primary/40 hover:bg-primary/10"
                      >
                        <CliLogo cliId={agentCliId} className="h-3 w-3" />
                        {agentLabel}
                      </Badge>
                    </button>
                  </SimpleTooltip>
                ) : (
                  <Badge variant="secondary" className="gap-1.5">
                    {agentLabel}
                  </Badge>
                )}
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <PathChip path={project.folderPath} onCopy={onCopyPath} />
                <IconAction label="Open in File Explorer" onClick={onOpenFolder}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction label="Open terminal here" onClick={onOpenTerminal}>
                  <TerminalSquare className="h-3.5 w-3.5" />
                </IconAction>
                {project.websiteUrl ? (
                  <LinkChip
                    href={project.websiteUrl}
                    label={stripUrl(project.websiteUrl)}
                    icon={Globe}
                  />
                ) : null}
                {project.repoUrl ? (
                  <LinkChip
                    href={project.repoUrl}
                    label={stripUrl(project.repoUrl)}
                    icon={GitBranch}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasRunCommand ? (
              <Button size="sm" onClick={onRun}>
                <Run /> Run
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onPrompt}>
              <MessageSquare /> Prompt
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More project actions">
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="h-4 w-4" /> Edit project
                </DropdownMenuItem>
                {!hasRunCommand ? (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Run className="h-4 w-4" /> Set a run command
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={onOpenFolder}>
                  <FolderOpen className="h-4 w-4" /> Open folder
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onOpenTerminal}>
                  <TerminalSquare className="h-4 w-4" /> Open terminal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={onDelete}
                >
                  <Trash2 className="h-4 w-4" /> Remove project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathChip({ path, onCopy }: { path: string; onCopy: () => void }): React.JSX.Element {
  return (
    <SimpleTooltip label={`Copy path: ${path}`}>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-8 max-w-[min(100%,28rem)] cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{path}</span>
        <Copy className="h-3 w-3 shrink-0" />
      </button>
    </SimpleTooltip>
  );
}

function LinkChip({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Globe;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={`Open ${href}`}>
      <button
        type="button"
        onClick={() => void window.agentmat.shell.openExternal(href)}
        className="inline-flex h-8 max-w-[min(100%,18rem)] cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </SimpleTooltip>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

export function ProjectSectionNav({
  section,
  onSectionChange,
  badges,
  createdAt,
  updatedAt,
  hiddenIds,
}: {
  section: ProjectSectionId;
  onSectionChange: (id: ProjectSectionId) => void;
  badges: Partial<Record<ProjectSectionId, SectionBadge>>;
  createdAt: string;
  updatedAt: string;
  hiddenIds?: readonly ProjectSectionId[];
}): React.JSX.Element {
  const hidden = new Set(hiddenIds ?? []);
  return (
    <nav
      aria-label="Project sections"
      className="flex flex-col gap-3 lg:sticky lg:top-0 lg:w-52 lg:shrink-0"
    >
      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
        <SectionGroup
          label="Work"
          section={section}
          onSectionChange={onSectionChange}
          badges={badges}
          items={SECTIONS.filter((item) => item.group === 'work' && !hidden.has(item.id))}
        />
        <div className="mx-1 w-px shrink-0 self-stretch bg-border lg:mx-0 lg:my-1 lg:h-px lg:w-auto" />
        <SectionGroup
          label="Setup"
          section={section}
          onSectionChange={onSectionChange}
          badges={badges}
          items={SECTIONS.filter((item) => item.group === 'setup' && !hidden.has(item.id))}
        />
      </div>
      <dl className="hidden gap-1.5 px-2 text-xs text-muted-foreground lg:grid">
        <div className="flex items-center justify-between gap-2">
          <dt>Created</dt>
          <dd className="text-foreground/80">{timeAgo(createdAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Updated</dt>
          <dd className="text-foreground/80">{timeAgo(updatedAt)}</dd>
        </div>
      </dl>
    </nav>
  );
}

function SectionGroup({
  label,
  items,
  section,
  onSectionChange,
  badges,
}: {
  label: string;
  items: typeof SECTIONS;
  section: ProjectSectionId;
  onSectionChange: (id: ProjectSectionId) => void;
  badges: Partial<Record<ProjectSectionId, SectionBadge>>;
}): React.JSX.Element {
  return (
    <div className="flex gap-1 lg:flex-col">
      <p className="hidden px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:block">
        {label}
      </p>
      {items.map((item) => {
        const active = section === item.id;
        const badge = badges[item.id];
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/15 font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
            {badge?.count ? (
              <span
                className={cn(
                  'ml-auto min-w-4 rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums',
                  badge.attention
                    ? 'bg-warning/20 text-warning'
                    : active
                      ? 'bg-foreground/10 text-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {badge.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ProjectNotesCard({
  notes,
  onSave,
  saving,
}: {
  notes: string;
  onSave: (notes: string) => void;
  saving: boolean;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const savedValue = useRef<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(notes);
  }, [notes, editing]);

  useEffect(() => {
    if (savedValue.current !== null && notes === savedValue.current) {
      savedValue.current = null;
      setEditing(false);
    }
  }, [notes]);

  function handleSave(): void {
    const next = draft.trim();
    if (next === notes) {
      setEditing(false);
      return;
    }
    savedValue.current = next;
    onSave(next);
  }

  if (editing) {
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">Notes</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                savedValue.current = null;
                setDraft(notes);
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </div>
        <GrammarTextarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          placeholder="Scratchpad for this project. Anything you want agents or yourself to remember."
          autoFocus
          disabled={saving}
        />
      </section>
    );
  }

  if (!notes) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted-foreground">Notes</h2>
        <ProjectEmptyState
          icon={Pencil}
          title="No notes yet"
          description="Keep a scratchpad on this project for context you do not want in the standing prompt."
          action={
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Add notes
            </Button>
          }
        />
      </section>
    );
  }

  const persian = persianTextProps(notes);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Notes</h2>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Edit notes
        </Button>
      </div>
      <p
        dir={persian.dir}
        className={cn(
          'whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm leading-relaxed',
          persian.className,
        )}
      >
        {notes}
      </p>
    </section>
  );
}
