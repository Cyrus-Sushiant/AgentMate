import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from '@/components/icons';
import type { SkillRepositorySourceType } from '@agentmat/core';
import { bundledSkillsShDirectory, SKILLS_SH_SNAPSHOT_DATE } from '@agentmat/core';
import type { SkillsShSearchResult } from '../../../shared/apiTypes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type SkillsShSearchMode = 'bundled' | 'live';

/** A card/modal-ready skill.sh entry. `description` is absent for live results until fetched. */
interface SkillsShDisplayEntry {
  id: string;
  name: string;
  owner: string;
  repo: string;
  official: boolean;
  url: string;
  installCommand: string;
  installsLabel: string;
  description?: string;
}

const installsFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function liveResultToDisplayEntry(r: SkillsShSearchResult): SkillsShDisplayEntry {
  return {
    id: r.id,
    name: r.name,
    owner: r.owner,
    repo: r.repo,
    official: r.official,
    url: r.url,
    installCommand: r.installCommand,
    installsLabel: installsFormatter.format(r.installs),
  };
}

export default function SkillsPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navState = location.state as { repositoryId?: string; query?: string } | null;
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [selectedRepoId, setSelectedRepoId] = useState<string>(navState?.repositoryId ?? '');
  const [search, setSearch] = useState(navState?.query ?? '');
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoSourceType, setRepoSourceType] = useState<SkillRepositorySourceType>('local-folder');
  const [repoSource, setRepoSource] = useState('');
  const [shMode, setShMode] = useState<SkillsShSearchMode>('bundled');
  const [shSearch, setShSearch] = useState('');
  const [shDebouncedSearch, setShDebouncedSearch] = useState('');
  const [shOfficialOnly, setShOfficialOnly] = useState(false);
  const [shSelected, setShSelected] = useState<SkillsShDisplayEntry | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShDebouncedSearch(shSearch), 350);
    return () => clearTimeout(timer);
  }, [shSearch]);

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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.installedSkills(selectedProjectId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) =>
      window.agentmat.skills.remove({ projectId: selectedProjectId, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.installedSkills(selectedProjectId),
      });
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

  const bundledShResults = useMemo(() => {
    const q = shSearch.trim().toLowerCase();
    return bundledSkillsShDirectory.filter((s) => {
      if (shOfficialOnly && !s.official) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.repo.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [shSearch, shOfficialOnly]);

  const liveShSearchQuery = useQuery({
    queryKey: queryKeys.skillsShSearch(shDebouncedSearch.trim().toLowerCase()),
    queryFn: () => window.agentmat.skills.searchSkillsSh(shDebouncedSearch.trim()),
    enabled: shMode === 'live' && shDebouncedSearch.trim().length >= 2,
  });

  const liveShResults = useMemo(() => {
    const results = (liveShSearchQuery.data ?? []).map(liveResultToDisplayEntry);
    return shOfficialOnly ? results.filter((s) => s.official) : results;
  }, [liveShSearchQuery.data, shOfficialOnly]);

  const filteredShSkills: SkillsShDisplayEntry[] =
    shMode === 'live' ? liveShResults : bundledShResults;

  const shDetailQuery = useQuery({
    queryKey: queryKeys.skillsShDetail(shSelected?.id ?? ''),
    queryFn: () => window.agentmat.skills.getSkillsShDetail(shSelected!.id),
    enabled: !!shSelected && shSelected.description === undefined,
  });

  const shModalDescription = shSelected?.description ?? shDetailQuery.data?.description ?? null;
  const shModalInstallsLabel = shDetailQuery.data?.installsLabel ?? shSelected?.installsLabel ?? '';

  async function handlePickLocalFolder(): Promise<void> {
    const picked = await window.agentmat.skills.pickLocalRepository();
    if (picked) setRepoSource(picked);
  }

  function handleCopyInstallCommand(command: string): void {
    void navigator.clipboard.writeText(command);
    toast.success('Install command copied to clipboard.');
  }

  usePageHeader(
    'Skill Marketplace',
    'Install skills into a project from configurable repositories.',
  );

  return (
    <div className="space-y-6 p-6">
      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">My Repositories</TabsTrigger>
          <TabsTrigger value="directory">skills.sh Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-6">
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
                    <SimpleTooltip label="Refresh">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => refreshRepoMutation.mutate(selectedRepoId)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                    <SimpleTooltip label="Remove repository">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeRepoMutation.mutate(selectedRepoId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
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
            <p className="text-sm text-amber-500">
              Choose a target project to enable installing skills.
            </p>
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
                          onClick={() =>
                            void window.agentmat.shell.openExternal(skill.documentationUrl!)
                          }
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
        </TabsContent>

        <TabsContent value="directory" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {bundledSkillsShDirectory.length} popular skills bundled from{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => void window.agentmat.shell.openExternal('https://www.skills.sh')}
            >
              skills.sh
            </button>{' '}
            as of {SKILLS_SH_SNAPSHOT_DATE} for offline browsing — switch to{' '}
            <span className="font-medium text-foreground">Live</span> to search skills.sh's full
            catalog directly. The{' '}
            <Badge variant="default" className="align-middle">
              Official
            </Badge>{' '}
            badge mirrors skills.sh's own verified-publisher mark (Anthropic, Vercel, Microsoft,
            Firebase, Supabase, and other verified owners) — everything else is community-published.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-64 flex-1 space-y-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={
                    shMode === 'live'
                      ? 'Search skills.sh live (2+ characters)…'
                      : 'Search by name, owner, or description…'
                  }
                  value={shSearch}
                  onChange={(e) => setShSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={shMode === 'bundled' ? 'default' : 'ghost'}
                onClick={() => setShMode('bundled')}
              >
                Bundled
              </Button>
              <Button
                type="button"
                size="sm"
                variant={shMode === 'live' ? 'default' : 'ghost'}
                onClick={() => setShMode('live')}
              >
                Live
              </Button>
            </div>
            <Button
              type="button"
              variant={shOfficialOnly ? 'default' : 'outline'}
              onClick={() => setShOfficialOnly((v) => !v)}
            >
              <CircleCheck /> Official only
            </Button>
          </div>

          {shMode === 'live' && shDebouncedSearch.trim().length < 2 && (
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to search skills.sh live.
            </p>
          )}

          {shMode === 'live' && liveShSearchQuery.isFetching && (
            <p className="text-sm text-muted-foreground">Searching skills.sh…</p>
          )}

          {shMode === 'live' && liveShSearchQuery.isError && (
            <p className="text-sm text-destructive">
              Couldn't reach skills.sh. Check your connection and try again.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredShSkills.map((skill) => (
              <Card key={skill.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-1.5">
                      {skill.name}
                      {skill.official && (
                        <SimpleTooltip label="Official — skills.sh has verified this publisher">
                          <CircleCheck className="h-4 w-4 shrink-0 text-blue-500" />
                        </SimpleTooltip>
                      )}
                    </CardTitle>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {skill.description ?? 'Click View for the full description.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={skill.official ? 'default' : 'secondary'}>
                      {skill.official ? 'Official' : 'Community'}
                    </Badge>
                    <Badge variant="outline">{skill.installsLabel} installs</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{skill.repo}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShSelected(skill)}>
                      <Eye /> View
                    </Button>
                    <SimpleTooltip label="Open on skills.sh">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void window.agentmat.shell.openExternal(skill.url)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredShSkills.length === 0 &&
            !(
              shMode === 'live' &&
              (liveShSearchQuery.isFetching || shDebouncedSearch.trim().length < 2)
            ) && <p className="text-sm text-muted-foreground">No skills match your search.</p>}
        </TabsContent>
      </Tabs>

      <Dialog open={addRepoOpen} onOpenChange={setAddRepoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="Community Repository"
              />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void handlePickLocalFolder()}
                  >
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

      <Dialog open={!!shSelected} onOpenChange={(open) => !open && setShSelected(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 pr-6">
              {shSelected?.name}
              {shSelected?.official && (
                <SimpleTooltip label="Official — skills.sh has verified this publisher">
                  <CircleCheck className="h-4 w-4 shrink-0 text-blue-500" />
                </SimpleTooltip>
              )}
            </DialogTitle>
            <DialogDescription>
              {shSelected?.repo} · {shModalInstallsLabel} installs
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
            <Badge variant={shSelected?.official ? 'default' : 'secondary'}>
              {shSelected?.official ? 'Official' : 'Community'}
            </Badge>
            {shDetailQuery.isFetching && shModalDescription === null ? (
              <p className="text-sm text-muted-foreground">Loading description from skills.sh…</p>
            ) : shDetailQuery.isError && shModalDescription === null ? (
              <p className="text-sm text-destructive">
                Couldn't load the description from skills.sh.
              </p>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">{shModalDescription}</p>
            )}
            <div className="space-y-1.5">
              <Label>Install command</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shSelected?.installCommand ?? ''}
                  className="font-mono text-xs"
                />
                <SimpleTooltip label="Copy">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      shSelected && handleCopyInstallCommand(shSelected.installCommand)
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => shSelected && void window.agentmat.shell.openExternal(shSelected.url)}
            >
              <ExternalLink /> Open on skills.sh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
