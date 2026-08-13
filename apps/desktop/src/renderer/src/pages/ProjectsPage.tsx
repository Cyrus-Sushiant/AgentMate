import type { AgentType, Project } from '@agentmat/core';
import {
  AGENT_TYPE_CLI_ID,
  AGENT_TYPE_LABELS,
  configuredRunCommands,
  projectRunCommandHint,
} from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CliLogo } from '@/components/cliLogos';
import {
  Folder,
  FolderKanban,
  FolderPlus,
  GitBranch,
  Globe,
  GripVertical,
  ListUnordered,
  Pin,
  Plus,
  Run,
  Search,
  Sparkles,
  X,
} from '@/components/icons';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { ProjectPromptBuildDialog } from '@/components/projects/ProjectPromptBuildDialog';
import { useProjectRun } from '@/components/projects/useProjectRun';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { openCliInTerminal } from '@/lib/openCli';
import { persianTextProps } from '@/lib/rtl';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';

const VIEW_STORAGE_KEY = 'agentmate.projects.view';
const MAX_VISIBLE_TAGS = 3;
const AGENT_TYPE_ORDER = Object.keys(AGENT_TYPE_LABELS) as AgentType[];

type ProjectsView = 'grid' | 'list';
type AgentFilter = 'all' | AgentType;

function agentFilterLabel(filter: AgentFilter): string {
  return filter === 'all' ? 'all agents' : AGENT_TYPE_LABELS[filter];
}

/** Moves `draggedId` to sit just before `targetId` within one pin group. */
function reorderWithinGroup(list: Project[], draggedId: string, targetId: string): Project[] {
  if (draggedId === targetId) return list;
  const next = [...list];
  const from = next.findIndex((p) => p.id === draggedId);
  const to = next.findIndex((p) => p.id === targetId);
  if (from === -1 || to === -1) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function readStoredView(): ProjectsView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function folderBasename(folderPath: string): string {
  const trimmed = folderPath.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || folderPath;
}

function stripUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export default function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptBuildOpen, setPromptBuildOpen] = useState(false);
  const [promptBuildProject, setPromptBuildProject] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [view, setView] = useState<ProjectsView>(readStoredView);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { requestRun, runPicker } = useProjectRun();

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setDialogOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private mode and quota errors shouldn't block the page.
    }
  }, [view]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (dialogOpen || promptBuildOpen) return;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen, promptBuildOpen]);

  const createMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => window.agentmat.projects.create(values),
    onSuccess: () => {
      toast.success('Project created.');
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ projectId, pinned }: { projectId: string; pinned: boolean }) =>
      window.agentmat.projects.setPinned(projectId, pinned),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (prev) =>
        prev?.map((p) => (p.id === updated.id ? updated : p)),
      );
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => window.agentmat.projects.reorder(orderedIds),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.projects, updated);
    },
  });

  usePageHeader('Projects', 'Open a workspace, pin favorites, or start a new one.');

  function handleRun(project: Project): void {
    requestRun(project, {
      onEmpty: () => {
        toast.info('Set a run command on this project first.');
        navigate(`/projects/${project.id}`);
      },
    });
  }

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const query = search.trim().toLowerCase();

  const agentTypesPresent = useMemo(
    () => AGENT_TYPE_ORDER.filter((type) => projects.some((project) => project.agentType === type)),
    [projects],
  );

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (agentFilter !== 'all' && project.agentType !== agentFilter) return false;
      if (!query) return true;
      return [project.name, project.description, project.folderPath, ...project.tags]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [projects, query, agentFilter]);

  // Reordering is disabled while the visible list is a subset, so a drag
  // couldn't express where a card should land among hidden siblings.
  const dragEnabled = query.length === 0 && agentFilter === 'all';
  const pinnedProjects = useMemo(() => filtered.filter((p) => p.pinned), [filtered]);
  const unpinnedProjects = useMemo(() => filtered.filter((p) => !p.pinned), [filtered]);
  const draggedProject = draggedId ? projects.find((p) => p.id === draggedId) : undefined;
  const filtersActive = query.length > 0 || agentFilter !== 'all';

  function handleDrop(group: 'pinned' | 'unpinned', targetId: string): void {
    if (!draggedId || !dragEnabled) return;
    const isPinnedGroup = group === 'pinned';
    const sourceList = isPinnedGroup ? pinnedProjects : unpinnedProjects;
    if (!sourceList.some((p) => p.id === draggedId)) return;
    const reordered = reorderWithinGroup(sourceList, draggedId, targetId);
    const fullOrder = isPinnedGroup
      ? [...reordered, ...unpinnedProjects]
      : [...pinnedProjects, ...reordered];
    queryClient.setQueryData(queryKeys.projects, fullOrder);
    reorderMutation.mutate(fullOrder.map((p) => p.id));
  }

  function clearFilters(): void {
    setSearch('');
    setAgentFilter('all');
    searchRef.current?.focus();
  }

  function renderProject(project: Project, group: 'pinned' | 'unpinned'): React.JSX.Element {
    const cardProps: ProjectItemProps = {
      project,
      view,
      draggable: dragEnabled,
      isDragging: draggedId === project.id,
      isDropTarget:
        dropTargetId === project.id &&
        draggedId !== project.id &&
        draggedProject?.pinned === project.pinned,
      onDragStart: () => setDraggedId(project.id),
      onDragEnd: () => {
        setDraggedId(null);
        setDropTargetId(null);
      },
      onDragOver: () => {
        if (dragEnabled && draggedProject?.pinned === project.pinned) {
          setDropTargetId(project.id);
        }
      },
      onDropOn: (targetId) => handleDrop(group, targetId),
      onNavigate: () => navigate(`/projects/${project.id}`),
      onRun: () => handleRun(project),
      onBuildPrompt: () => {
        setPromptBuildProject({ id: project.id, name: project.name });
        setPromptBuildOpen(true);
      },
      onTogglePin: () => pinMutation.mutate({ projectId: project.id, pinned: !project.pinned }),
    };
    return <ProjectItem key={project.id} {...cardProps} />;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.preventDefault();
                setSearch('');
              }
            }}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="pl-8 pr-10"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-px text-[10px] font-medium text-muted-foreground sm:inline-block">
              /
            </kbd>
          )}
        </div>

        {projects.length > 0 && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {filtered.length === projects.length
              ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
              : `${filtered.length} of ${projects.length}`}
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          {projects.length > 0 && (
            <div className="flex h-9 items-center rounded-lg border border-border p-0.5">
              <SimpleTooltip label="Grid view">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  className={cn('h-8 w-8', view === 'grid' && 'bg-accent text-foreground')}
                  onClick={() => setView('grid')}
                >
                  <FolderKanban className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip label="List view">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  className={cn('h-8 w-8', view === 'list' && 'bg-accent text-foreground')}
                  onClick={() => setView('list')}
                >
                  <ListUnordered className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            </div>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> New Project
          </Button>
        </div>
      </div>

      {projects.length > 0 && agentTypesPresent.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by agent">
          <FilterChip active={agentFilter === 'all'} onClick={() => setAgentFilter('all')}>
            All agents
          </FilterChip>
          {agentTypesPresent.map((type) => {
            const cliId = AGENT_TYPE_CLI_ID[type];
            return (
              <FilterChip
                key={type}
                active={agentFilter === type}
                onClick={() => setAgentFilter(agentFilter === type ? 'all' : type)}
              >
                {cliId ? <CliLogo cliId={cliId} className="h-3 w-3" /> : null}
                {AGENT_TYPE_LABELS[type]}
              </FilterChip>
            );
          })}
        </div>
      )}

      {projectsQuery.isLoading ? (
        view === 'list' ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="glass flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="glass flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="mt-3 h-3 w-full" />
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
                <CardFooter className="gap-2 border-t border-border/70 pt-3">
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderPlus className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Add a folder AgentMate can bootstrap and work in. You can pin it, run it, and build
              prompts from here.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> New Project
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No matching projects</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {query
                ? `Nothing matches “${search.trim()}”${agentFilter === 'all' ? '' : ` in ${agentFilterLabel(agentFilter)}`}.`
                : `No ${agentFilterLabel(agentFilter)} projects yet.`}
            </p>
          </div>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {pinnedProjects.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Pin className="h-3 w-3 text-primary" /> Pinned
                </p>
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  {pinnedProjects.length}
                </span>
              </div>
              <div
                className={
                  view === 'list'
                    ? 'space-y-2'
                    : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
                }
              >
                {pinnedProjects.map((project) => renderProject(project, 'pinned'))}
              </div>
            </section>
          )}

          {unpinnedProjects.length > 0 && (
            <section className="space-y-3">
              {pinnedProjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {filtersActive ? 'Matches' : 'All projects'}
                  </p>
                  <span className="text-xs tabular-nums text-muted-foreground/70">
                    {unpinnedProjects.length}
                  </span>
                </div>
              )}
              <div
                className={
                  view === 'list'
                    ? 'space-y-2'
                    : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
                }
              >
                {unpinnedProjects.map((project) => renderProject(project, 'unpinned'))}
              </div>
            </section>
          )}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => createMutation.mutate(values)}
        isSubmitting={createMutation.isPending}
      />

      {promptBuildProject && (
        <ProjectPromptBuildDialog
          open={promptBuildOpen}
          onOpenChange={setPromptBuildOpen}
          projectId={promptBuildProject.id}
          projectName={promptBuildProject.name}
        />
      )}
      {runPicker}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

interface ProjectItemProps {
  project: Project;
  view: ProjectsView;
  draggable: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDropOn: (targetId: string) => void;
  onNavigate: () => void;
  onRun: () => void;
  onBuildPrompt: () => void;
  onTogglePin: () => void;
}

function ProjectItem(props: ProjectItemProps): React.JSX.Element {
  return props.view === 'list' ? <ProjectRow {...props} /> : <ProjectCard {...props} />;
}

function projectSurfaceClass({
  project,
  isDragging,
  isDropTarget,
}: Pick<ProjectItemProps, 'project' | 'isDragging' | 'isDropTarget'>): string {
  return cn(
    'glass group cursor-pointer transition-all duration-150 motion-reduce:transition-none',
    'hover:border-primary/40 focus-within:border-primary/40',
    project.pinned && 'border-l-2 border-l-primary',
    isDragging && 'opacity-50',
    isDropTarget && 'border-primary ring-2 ring-primary/35',
  );
}

function projectDragHandlers(props: ProjectItemProps): {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
} {
  return {
    onDragOver: (e) => {
      if (props.draggable) {
        e.preventDefault();
        props.onDragOver();
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      props.onDropOn(props.project.id);
    },
  };
}

function ProjectCard(props: ProjectItemProps): React.JSX.Element {
  const { project, onNavigate } = props;
  const drag = projectDragHandlers(props);
  const description = persianTextProps(project.description);
  const extraTags = Math.max(0, project.tags.length - MAX_VISIBLE_TAGS);

  return (
    <Card
      className={cn(
        projectSurfaceClass(props),
        'flex flex-col hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
      )}
      onClick={onNavigate}
      {...drag}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectIcon
              iconDataUrl={project.iconDataUrl}
              className="h-11 w-11"
              glyphClassName="h-5 w-5"
            />
            <div className="min-w-0">
              <button
                type="button"
                className="block max-w-full truncate rounded-sm text-left text-sm font-semibold leading-tight hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate();
                }}
              >
                {project.name}
              </button>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                Updated {timeAgo(project.updatedAt)}
              </p>
            </div>
          </div>
          <ProjectQuickActions {...props} compact />
        </div>
        {project.description ? (
          <p
            dir={description.dir}
            className={cn('line-clamp-2 text-sm text-muted-foreground', description.className)}
          >
            {project.description}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <AgentBadge project={project} />
          {project.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {extraTags > 0 && (
            <SimpleTooltip label={project.tags.slice(MAX_VISIBLE_TAGS).join(', ')} wrapTrigger>
              <Badge variant="outline">+{extraTags}</Badge>
            </SimpleTooltip>
          )}
        </div>
        <ProjectMetaLinks project={project} />
      </CardContent>
      <CardFooter className="mt-auto gap-2 border-t border-border/70 pt-3">
        <RunButton project={project} onRun={props.onRun} />
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            props.onBuildPrompt();
          }}
        >
          <Sparkles /> Prompt
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProjectRow(props: ProjectItemProps): React.JSX.Element {
  const { project, onNavigate } = props;
  const drag = projectDragHandlers(props);
  const description = persianTextProps(project.description);

  return (
    <Card
      className={cn(projectSurfaceClass(props), 'flex items-center gap-3 px-3 py-2.5')}
      onClick={onNavigate}
      {...drag}
    >
      <ProjectIcon iconDataUrl={project.iconDataUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-0.5">
          <button
            type="button"
            className="min-w-0 truncate rounded-sm text-left text-sm font-semibold leading-tight hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
          >
            {project.name}
          </button>
          <ProjectQuickActions {...props} compact />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums">Updated {timeAgo(project.updatedAt)}</span>
          {project.description ? (
            <span
              dir={description.dir}
              className={cn('hidden truncate sm:inline', description.className)}
            >
              {project.description}
            </span>
          ) : null}
        </div>
      </div>
      <div className="hidden shrink-0 md:block">
        <AgentBadge project={project} />
      </div>
      <RunButton project={project} onRun={props.onRun} iconOnly />
      <SimpleTooltip label="Build a prompt for this project">
        <Button
          size="icon"
          variant="outline"
          aria-label="Build a prompt for this project"
          onClick={(e) => {
            e.stopPropagation();
            props.onBuildPrompt();
          }}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
    </Card>
  );
}

function ProjectQuickActions({
  project,
  draggable,
  onDragStart,
  onDragEnd,
  onTogglePin,
  compact,
}: ProjectItemProps & { compact: boolean }): React.JSX.Element {
  const grip = draggable ? (
    <SimpleTooltip label="Drag to reorder">
      <span
        draggable
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={cn(
          'flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 transition-opacity hover:bg-accent hover:text-accent-foreground active:cursor-grabbing',
          compact && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <GripVertical className="h-4 w-4" />
      </span>
    </SimpleTooltip>
  ) : null;

  const pin = (
    <SimpleTooltip label={project.pinned ? 'Unpin project' : 'Pin to top'}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={project.pinned ? 'Unpin project' : 'Pin to top'}
        aria-pressed={project.pinned}
        className={cn(
          compact && 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          project.pinned && 'text-primary opacity-100',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
      >
        <Pin className="h-4 w-4" />
      </Button>
    </SimpleTooltip>
  );

  return (
    <div className="flex shrink-0 items-center">
      {grip}
      {pin}
    </div>
  );
}

function RunButton({
  project,
  onRun,
  iconOnly = false,
}: {
  project: Project;
  onRun: () => void;
  iconOnly?: boolean;
}): React.JSX.Element {
  const commands = configuredRunCommands(project);
  const label =
    commands.length === 0
      ? 'No run command yet. Open the project to set one.'
      : commands.length === 1
        ? projectRunCommandHint(commands[0])
        : 'Choose which command to run';
  return (
    <SimpleTooltip label={label}>
      <Button
        size={iconOnly ? 'icon' : 'sm'}
        variant={iconOnly ? 'outline' : 'default'}
        aria-label={iconOnly ? 'Run' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onRun();
        }}
      >
        <Run className={iconOnly ? 'h-4 w-4' : undefined} />
        {iconOnly ? null : 'Run'}
      </Button>
    </SimpleTooltip>
  );
}

function AgentBadge({ project }: { project: Project }): React.JSX.Element {
  const cliId = AGENT_TYPE_CLI_ID[project.agentType];
  const label = AGENT_TYPE_LABELS[project.agentType];
  const inner = (
    <>
      {cliId ? <CliLogo cliId={cliId} className="h-3 w-3" /> : null}
      {label}
    </>
  );

  if (!cliId) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        {inner}
      </Badge>
    );
  }

  return (
    <SimpleTooltip label={`Open ${label} in the terminal`}>
      <button
        type="button"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          openCliInTerminal({
            cliId,
            cwd: project.folderPath,
            projectId: project.id,
          });
        }}
      >
        <Badge variant="secondary" className="cursor-pointer gap-1.5 hover:border-primary/40 hover:bg-primary/10">
          {inner}
        </Badge>
      </button>
    </SimpleTooltip>
  );
}

function ProjectMetaLinks({ project }: { project: Project }): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <SimpleTooltip label={`Open folder: ${project.folderPath}`}>
        <button
          type="button"
          className="flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            void window.agentmat.shell.openPath(project.folderPath);
          }}
        >
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{folderBasename(project.folderPath)}</span>
        </button>
      </SimpleTooltip>
      {project.websiteUrl ? (
        <SimpleTooltip label={`Open ${stripUrl(project.websiteUrl)}`}>
          <button
            type="button"
            aria-label={`Open ${stripUrl(project.websiteUrl)}`}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              void window.agentmat.shell.openExternal(project.websiteUrl);
            }}
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
      ) : null}
      {project.repoUrl ? (
        <SimpleTooltip label={`Open ${stripUrl(project.repoUrl)}`}>
          <button
            type="button"
            aria-label={`Open ${stripUrl(project.repoUrl)}`}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              void window.agentmat.shell.openExternal(project.repoUrl);
            }}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
      ) : null}
    </div>
  );
}
