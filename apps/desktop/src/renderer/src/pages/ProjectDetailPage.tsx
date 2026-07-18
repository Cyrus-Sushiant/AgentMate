import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Blocks,
  Copy,
  File,
  FileCog,
  FolderTree,
  Pencil,
  TerminalSquare,
  Trash2,
  Wand2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { ProjectFileBrowser } from '@/components/projects/ProjectFileBrowser';
import { ProjectFormDialog, type ProjectFormValues } from '@/components/projects/ProjectFormDialog';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';

export default function ProjectDetailPage(): React.JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);
  const [editOpen, setEditOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const project = projectsQuery.data?.find((p) => p.id === projectId);

  usePageHeader(project?.name ?? '', project?.folderPath);

  const installedSkillsQuery = useQuery({
    queryKey: queryKeys.installedSkills(projectId ?? ''),
    queryFn: () => window.agentmat.skills.listInstalled(projectId!),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => window.agentmat.projects.update(projectId!, values),
    onSuccess: () => {
      toast.success('Project updated.');
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: () => window.agentmat.projects.bootstrap(projectId!),
    onSuccess: (result) => {
      toast.success(`Bootstrapped ${result.createdFiles.length} file(s).`);
      void queryClient.invalidateQueries({ queryKey: ['project-dir'] });
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => window.agentmat.skills.remove({ projectId: projectId!, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(projectId ?? '') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => window.agentmat.projects.delete(projectId!),
    onSuccess: () => {
      toast.success('Project removed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      navigate('/projects');
    },
  });

  async function handleCopyPath(): Promise<void> {
    if (!project) return;
    await navigator.clipboard.writeText(project.folderPath);
    toast.success('Path copied to clipboard.');
  }

  if (projectsQuery.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  }

  if (!project) {
    return (
      <div className="space-y-3 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="-ml-2">
          <ArrowLeft /> Back to Projects
        </Button>
        <p className="text-sm text-muted-foreground">This project could not be found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="-ml-2">
          <ArrowLeft /> Projects
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleCopyPath()}>
            <Copy /> Copy Path
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Remove "${project.name}" from AgentMate? Files on disk are kept.`)) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{project.agentType}</Badge>
          {project.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <File className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="bootstrap" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Bootstrap
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <Blocks className="h-3.5 w-3.5" /> Skills
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5" /> Terminal
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <FileCog className="h-3.5 w-3.5" /> Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <Textarea value={project.notes} readOnly rows={6} placeholder="No notes yet." />
        </TabsContent>

        <TabsContent value="bootstrap" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Creates the standard AgentMate folder structure and starter docs for this project.
            </p>
            <Button onClick={() => bootstrapMutation.mutate()} disabled={bootstrapMutation.isPending}>
              <Wand2 /> Bootstrap Project
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderTree className="h-3.5 w-3.5" /> Browse and edit project files
          </div>
          <ProjectFileBrowser rootPath={project.folderPath} />
        </TabsContent>

        <TabsContent value="skills" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Skills installed into this project.</p>
            <Button variant="outline" onClick={() => navigate(`/skills?projectId=${project.id}`)}>
              <Blocks /> Browse Marketplace
            </Button>
          </div>
          {installedSkillsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills installed yet.</p>
          ) : (
            <div className="space-y-2">
              {installedSkillsQuery.data?.map((skill) => (
                <div key={skill.skillId} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <span>
                    {skill.skillId} <span className="text-muted-foreground">v{skill.version}</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => removeSkillMutation.mutate(skill.skillId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="terminal" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Open a terminal in this project's folder.
          </p>
          <Button
            onClick={() => openSession({ title: project.name, cwd: project.folderPath })}
          >
            <TerminalSquare /> Open Terminal Here
          </Button>
        </TabsContent>

        <TabsContent value="config">
          <ProjectConfigEditor projectFolderPath={project.folderPath} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={project}
        onSubmit={(values) => updateMutation.mutate(values)}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}

function ProjectConfigEditor({ projectFolderPath }: { projectFolderPath: string }): React.JSX.Element {
  const configPath = `${projectFolderPath}/.agentmate/config.json`;
  const [content, setContent] = useState('{}');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.agentmat.fs
      .readFile(configPath)
      .catch(() => '{}')
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configPath]);

  async function handleSave(): Promise<void> {
    try {
      JSON.parse(content);
    } catch {
      toast.error('Config must be valid JSON.');
      return;
    }
    await window.agentmat.fs.writeFile(configPath, content);
    toast.success('Config saved.');
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileCog className="h-3.5 w-3.5" /> .agentmate/config.json
        </div>
        <Button size="sm" onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
      <MonacoEditor value={content} onChange={setContent} language="json" className="min-h-[320px]" />
    </div>
  );
}
