import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderOpen, Plus, RefreshCw, Search, Trash2 } from '@/components/icons';
import type { SkillRepositorySourceType } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';

const SOURCE_TYPES: { value: SkillRepositorySourceType; label: string }[] = [
  { value: 'url', label: 'URL (JSON index)' },
  { value: 'git', label: 'Git repository' },
  { value: 'local-folder', label: 'Local folder' },
];

export default function SkillsPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoSourceType, setRepoSourceType] = useState<SkillRepositorySourceType>('local-folder');
  const [repoSource, setRepoSource] = useState('');

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
  });

  useEffect(() => {
    if (!selectedRepoId && reposQuery.data && reposQuery.data.length > 0) {
      setSelectedRepoId(reposQuery.data[0].id);
    }
  }, [reposQuery.data, selectedRepoId]);

  const repoIndexQuery = useQuery({
    queryKey: queryKeys.repositoryIndex(selectedRepoId),
    queryFn: () => window.agentmat.skills.getRepositoryIndex(selectedRepoId),
    enabled: !!selectedRepoId,
  });

  const installedSkillsQuery = useQuery({
    queryKey: queryKeys.installedSkills(selectedProjectId),
    queryFn: () => window.agentmat.skills.listInstalled(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const addRepoMutation = useMutation({
    mutationFn: () =>
      window.agentmat.skills.addRepository({
        name: repoName,
        sourceType: repoSourceType,
        source: repoSource,
      }),
    onSuccess: () => {
      toast.success('Repository added.');
      setAddRepoOpen(false);
      setRepoName('');
      setRepoSource('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repositories });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRepoMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.skills.removeRepository(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repositories });
      setSelectedRepoId('');
    },
  });

  const refreshRepoMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.skills.refreshRepository(id),
    onSuccess: () => {
      toast.success('Repository refreshed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repositoryIndex(selectedRepoId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const installMutation = useMutation({
    mutationFn: (skillId: string) =>
      window.agentmat.skills.install({
        projectId: selectedProjectId,
        repositoryId: selectedRepoId,
        skillId,
      }),
    onSuccess: () => {
      toast.success('Skill installed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(selectedProjectId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) =>
      window.agentmat.skills.remove({ projectId: selectedProjectId, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(selectedProjectId) });
    },
  });

  const installedIds = useMemo(
    () => new Set(installedSkillsQuery.data?.map((s) => s.skillId) ?? []),
    [installedSkillsQuery.data],
  );

  const filteredSkills = useMemo(() => {
    const skills = repoIndexQuery.data?.skills ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [repoIndexQuery.data, search]);

  async function handlePickLocalFolder(): Promise<void> {
    const picked = await window.agentmat.skills.pickLocalRepository();
    if (picked) setRepoSource(picked);
  }

  usePageHeader('Skill Marketplace', 'Install skills into a project from configurable repositories.');

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-end">
        <Button onClick={() => setAddRepoOpen(true)}>
          <Plus /> Add Repository
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Target project</Label>
          <Combobox
            className="w-56"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="Choose a project"
            searchPlaceholder="Search projects…"
            options={projectsQuery.data?.map((p) => ({ value: p.id, label: p.name })) ?? []}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Repository</Label>
          <div className="flex items-center gap-2">
            <Combobox
              className="w-56"
              value={selectedRepoId}
              onChange={setSelectedRepoId}
              placeholder="Choose a repository"
              searchPlaceholder="Search repositories…"
              options={reposQuery.data?.map((r) => ({ value: r.id, label: r.name })) ?? []}
            />
            {selectedRepoId && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  title="Refresh"
                  onClick={() => refreshRepoMutation.mutate(selectedRepoId)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Remove repository"
                  onClick={() => removeRepoMutation.mutate(selectedRepoId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="relative min-w-64 flex-1 space-y-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search skills by name, tag, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!selectedProjectId && (
        <p className="text-sm text-amber-500">Choose a target project to enable installing skills.</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSkills.map((skill) => {
          const isInstalled = installedIds.has(skill.id);
          return (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{skill.name}</CardTitle>
                  <Badge variant="outline">{skill.category}</Badge>
                </div>
                <CardDescription>{skill.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {skill.author} · v{skill.version}
                </div>
                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeSkillMutation.mutate(skill.id)}
                    >
                      <Trash2 /> Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!selectedProjectId || installMutation.isPending}
                      onClick={() => installMutation.mutate(skill.id)}
                    >
                      Install
                    </Button>
                  )}
                  {skill.documentationUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void window.agentmat.shell.openExternal(skill.documentationUrl!)}
                    >
                      Docs
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addRepoOpen} onOpenChange={setAddRepoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="Community Repository" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Combobox
                value={repoSourceType}
                onChange={(v) => setRepoSourceType(v as SkillRepositorySourceType)}
                options={SOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{repoSourceType === 'local-folder' ? 'Folder' : 'Source'}</Label>
              {repoSourceType === 'local-folder' ? (
                <div className="flex gap-2">
                  <Input value={repoSource} readOnly placeholder="Choose a folder…" />
                  <Button type="button" variant="outline" size="icon" onClick={() => void handlePickLocalFolder()}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  value={repoSource}
                  onChange={(e) => setRepoSource(e.target.value)}
                  placeholder={
                    repoSourceType === 'git'
                      ? 'https://github.com/org/skills.git'
                      : 'https://example.com/repository.json'
                  }
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!repoName.trim() || !repoSource.trim() || addRepoMutation.isPending}
              onClick={() => addRepoMutation.mutate()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
