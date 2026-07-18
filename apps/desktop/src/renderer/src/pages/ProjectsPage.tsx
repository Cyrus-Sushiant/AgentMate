import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Folder, FolderPlus, Plus, Search, Trash2 } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { confirmDialog } from '@/stores/confirmStore';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';

export default function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => window.agentmat.projects.delete(projectId),
    onSuccess: () => {
      toast.success('Project removed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  usePageHeader('Projects', 'Manage the projects AgentMate bootstraps and works with.');

  const projects = projectsQuery.data ?? [];
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
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <Card
              key={project.id}
              className="group flex cursor-pointer flex-col transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void confirmDialog({
                        title: `Remove "${project.name}"?`,
                        description: 'This removes it from AgentMate. Files on disk are kept.',
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      }).then((confirmed) => {
                        if (confirmed) deleteMutation.mutate(project.id);
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => createMutation.mutate(values)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
