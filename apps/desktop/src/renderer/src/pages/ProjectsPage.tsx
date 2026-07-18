import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2 } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';

export default function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus /> New Project
        </Button>
      </div>

      {projectsQuery.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet — create your first one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectsQuery.data?.map((project) => (
            <Card
              key={project.id}
              className="flex cursor-pointer flex-col transition-colors hover:border-primary/50"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{project.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove "${project.name}" from AgentMate? Files on disk are kept.`)) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="line-clamp-2">
                  {project.description || project.folderPath}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap gap-1.5">
                <Badge variant="secondary">{project.agentType}</Badge>
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
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
