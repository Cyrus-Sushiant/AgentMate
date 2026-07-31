import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { Project } from '@agentmat/core';
import {
  Folder,
  FolderPlus,
  GripVertical,
  Pin,
  Play,
  Plus,
  Search,
  Sparkles,
} from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
import { ProjectPromptBuildDialog } from '@/components/projects/ProjectPromptBuildDialog';

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

export default function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptBuildOpen, setPromptBuildOpen] = useState(false);
  const [promptBuildProject, setPromptBuildProject] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);

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

  usePageHeader('Projects', 'Manage the projects AgentMate bootstraps and works with.');

  function handleRun(project: { id: string; name: string; folderPath: string; runCommand: string }): void {
    openSession({
      title: project.name,
      cwd: project.folderPath,
      projectId: project.id,
      initialInput: project.runCommand,
    });
    toast.info(`Press Enter in the terminal to run "${project.runCommand}".`);
  }

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return projects;
    return projects.filter((project) =>
      [project.name, project.description, project.folderPath, ...project.tags]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [projects, query]);

  // Reordering is disabled while searching: the visible list is a subset, so a
  // drag couldn't express where a card should land among hidden siblings.
  const dragEnabled = query.length === 0;
  const pinnedProjects = useMemo(() => filtered.filter((p) => p.pinned), [filtered]);
  const unpinnedProjects = useMemo(() => filtered.filter((p) => !p.pinned), [filtered]);

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus /> New Project
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="glass flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-3 w-full" />
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first project and AgentMate will help you bootstrap its folder structure,
              skills, and config.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> New Project
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects match “{search.trim()}”.</p>
      ) : (
        <div className="space-y-6">
          {pinnedProjects.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Pin className="h-3 w-3" /> Pinned
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pinnedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    draggable={dragEnabled}
                    isDragging={draggedId === project.id}
                    onDragStart={() => setDraggedId(project.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onDropOn={(targetId) => handleDrop('pinned', targetId)}
                    onNavigate={() => navigate(`/projects/${project.id}`)}
                    onRun={() => handleRun(project)}
                    onBuildPrompt={() => {
                      setPromptBuildProject({ id: project.id, name: project.name });
                      setPromptBuildOpen(true);
                    }}
                    onTogglePin={() =>
                      pinMutation.mutate({ projectId: project.id, pinned: !project.pinned })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {unpinnedProjects.length > 0 && (
            <div className="space-y-2">
              {pinnedProjects.length > 0 && (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  All projects
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {unpinnedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    draggable={dragEnabled}
                    isDragging={draggedId === project.id}
                    onDragStart={() => setDraggedId(project.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onDropOn={(targetId) => handleDrop('unpinned', targetId)}
                    onNavigate={() => navigate(`/projects/${project.id}`)}
                    onRun={() => handleRun(project)}
                    onBuildPrompt={() => {
                      setPromptBuildProject({ id: project.id, name: project.name });
                      setPromptBuildOpen(true);
                    }}
                    onTogglePin={() =>
                      pinMutation.mutate({ projectId: project.id, pinned: !project.pinned })
                    }
                  />
                ))}
              </div>
            </div>
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
    </div>
  );
}

// Only the grip handle is draggable, so clicking anywhere else on the card
// (the run/prompt buttons, the pin toggle, the card body) never gets mistaken
// for a drag gesture.
function ProjectCard({
  project,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onNavigate,
  onRun,
  onBuildPrompt,
  onTogglePin,
}: {
  project: Project;
  draggable: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: (targetId: string) => void;
  onNavigate: () => void;
  onRun: () => void;
  onBuildPrompt: () => void;
  onTogglePin: () => void;
}): React.JSX.Element {
  return (
    <Card
      className={cn(
        'glass group flex cursor-pointer flex-col transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg',
        isDragging && 'opacity-50',
      )}
      onClick={onNavigate}
      onDragOver={(e) => {
        if (draggable) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn(project.id);
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {draggable && (
              <SimpleTooltip label="Drag to reorder">
                <span
                  draggable
                  onClick={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    onDragStart();
                  }}
                  onDragEnd={onDragEnd}
                  className="shrink-0 cursor-grab text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
              </SimpleTooltip>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Folder className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate">{project.name}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Updated {timeAgo(project.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SimpleTooltip label={project.pinned ? 'Unpin project' : 'Pin to top'}>
              <Button
                variant="ghost"
                size="icon"
                className={project.pinned ? 'text-primary' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
              >
                <Pin className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
            {project.runCommand && (
              <SimpleTooltip label={`Run "${project.runCommand}"`}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRun();
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            )}
            <SimpleTooltip label="Build a prompt for this project">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onBuildPrompt();
                }}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>
        </div>
        <CardDescription className="line-clamp-2">
          {project.description || 'No description yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{project.folderPath}</span>
        </div>
        {project.runCommand && (
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Play className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{project.runCommand}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{project.agentType}</Badge>
          {project.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
