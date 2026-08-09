import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from '@/components/icons';
import type { SkillRepositorySourceType } from '@agentmat/core';
import { bundledSkillsShDirectory, SKILLS_SH_SNAPSHOT_DATE } from '@agentmat/core';
import type { SkillsShSearchResult, SkillUpdateInfo } from '../../../shared/apiTypes';
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
import { CatalogCardSkeleton } from '@/components/CatalogCardSkeleton';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';

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

/** What the install picker modal is currently installing, and where it came from. */
type InstallTarget =
  | { kind: 'repo'; skillId: string; skillName: string }
  | { kind: 'skillsSh'; skill: SkillsShDisplayEntry };

const installsFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Agent ids the `skills` CLI recognizes, scoped to the agents AgentMate itself targets. */
const SKILLS_CLI_AGENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'opencode', label: 'opencode' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
];
const ALL_SKILLS_CLI_AGENTS = SKILLS_CLI_AGENT_OPTIONS.map((a) => a.value);

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

/**
 * Uses skills.sh's own published install command verbatim (the same one shown on the skill's
 * page), only appending `-g` for a global install, so what runs matches what the user sees there.
 * It runs in a terminal the user drives, since the CLI can prompt mid-install (e.g. a
 * security-risk confirmation).
 */
function skillsShInstallCommand(skill: SkillsShDisplayEntry, global: boolean): string {
  return global ? `${skill.installCommand} -g` : skill.installCommand;
}

export default function SkillsPage(): React.JSX.Element {
  const location = useLocation();
  const navState = location.state as { repositoryId?: string; query?: string } | null;
  const queryClient = useQueryClient();
  const openTerminalSession = useTerminalStore((s) => s.openSession);

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

  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null);
  const [installPickerProjectIds, setInstallPickerProjectIds] = useState<Set<string>>(new Set());
  const [installGlobally, setInstallGlobally] = useState(false);
  const [installPickerSearch, setInstallPickerSearch] = useState('');
  const [globalSkillsModalOpen, setGlobalSkillsModalOpen] = useState(false);
  const [globalSkillsAgentFilter, setGlobalSkillsAgentFilter] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => setShDebouncedSearch(shSearch), 350);
    return () => clearTimeout(timer);
  }, [shSearch]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });

  const filteredProjectsForPicker = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const q = installPickerSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.folderPath.toLowerCase().includes(q),
    );
  }, [projectsQuery.data, installPickerSearch]);

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

  const installBatchMutation = useMutation({
    mutationFn: async ({ projectIds, global }: { projectIds: string[]; global: boolean }) => {
      if (!installTarget) return { succeeded: [] as (string | null)[], failed: [] as (string | null)[] };
      const targets: (string | null)[] = global ? [...projectIds, null] : projectIds;

      if (installTarget.kind === 'skillsSh') {
        const skill = installTarget.skill;
        const agents = ALL_SKILLS_CLI_AGENTS;
        const projectById = new Map((projectsQuery.data ?? []).map((p) => [p.id, p]));
        const succeeded: (string | null)[] = [];
        const failed: (string | null)[] = [];
        let firstFailureMessage: string | undefined;
        for (const target of targets) {
          const project = target === null ? null : projectById.get(target);
          try {
            openTerminalSession({
              title: `Install ${skill.name}`,
              initialInput: skillsShInstallCommand(skill, target === null),
              cwd: project?.folderPath,
              projectId: project?.id,
            });
            await window.agentmat.skills.recordSkillsShInstall({
              projectId: target,
              owner: skill.owner,
              repo: skill.repo,
              skillName: skill.name,
              agents,
            });
            succeeded.push(target);
          } catch (error) {
            failed.push(target);
            firstFailureMessage ??= error instanceof Error ? error.message : String(error);
          }
        }
        return { succeeded, failed, firstFailureMessage, skillsSh: true };
      }

      const results = await Promise.allSettled(
        targets.map((projectId) =>
          window.agentmat.skills.install({
            projectId,
            repositoryId: selectedRepoId,
            skillId: installTarget.skillId,
          }),
        ),
      );
      const succeeded = targets.filter((_, i) => results[i].status === 'fulfilled');
      const failed = targets.filter((_, i) => results[i].status === 'rejected');
      const firstFailureReason = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )?.reason;
      const firstFailureMessage =
        firstFailureReason instanceof Error ? firstFailureReason.message : undefined;
      return { succeeded, failed, firstFailureMessage, skillsSh: false };
    },
    onSuccess: ({ succeeded, failed, firstFailureMessage, skillsSh }) => {
      for (const target of succeeded) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(target) });
        if (target === null) void queryClient.invalidateQueries({ queryKey: queryKeys.skillUpdates(null) });
      }
      if (succeeded.length > 0 && skillsSh) {
        toast.info(
          succeeded.length === 1
            ? 'Press Enter in the terminal to install the skill.'
            : `Press Enter in each of the ${succeeded.length} terminals opened to install the skill.`,
        );
      } else if (succeeded.length > 0) {
        toast.success(
          `Installed to ${succeeded.length} location${succeeded.length === 1 ? '' : 's'}.`,
        );
      }
      if (failed.length > 0) {
        toast.error(
          `Failed to install to ${failed.length} location${failed.length === 1 ? '' : 's'}.` +
            (firstFailureMessage ? ` ${firstFailureMessage}` : ''),
        );
      }
      if (failed.length === 0) {
        setInstallTarget(null);
        setInstallPickerProjectIds(new Set());
        setInstallGlobally(false);
        setInstallPickerSearch('');
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  const globalInstalledQuery = useQuery({
    queryKey: queryKeys.installedSkills(null),
    queryFn: () => window.agentmat.skills.listInstalled(null),
  });

  const globalSkillUpdatesQuery = useQuery({
    queryKey: queryKeys.skillUpdates(null),
    queryFn: () => window.agentmat.skills.checkForUpdates(null),
    enabled: (globalInstalledQuery.data?.length ?? 0) > 0,
  });

  const globalSkillUpdateBySkillId = useMemo(
    () => new Map((globalSkillUpdatesQuery.data ?? []).map((u) => [u.skillId, u])),
    [globalSkillUpdatesQuery.data],
  );

  const filteredGlobalSkills = useMemo(() => {
    const skills = globalInstalledQuery.data ?? [];
    if (globalSkillsAgentFilter === 'all') return skills;
    return skills.filter((s) => s.agents?.includes(globalSkillsAgentFilter));
  }, [globalInstalledQuery.data, globalSkillsAgentFilter]);

  const removeGlobalSkillMutation = useMutation({
    mutationFn: (skillId: string) => window.agentmat.skills.remove({ projectId: null, skillId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(null) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillUpdates(null) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateGlobalSkillMutation = useMutation({
    mutationFn: (update: SkillUpdateInfo) =>
      window.agentmat.skills.install({
        projectId: null,
        repositoryId: update.repositoryId,
        skillId: update.skillId,
      }),
    onSuccess: (_data, update) => {
      toast.success(`Updated ${update.skillId} to v${update.latestVersion}.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedSkills(null) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillUpdates(null) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handlePickLocalFolder(): Promise<void> {
    const picked = await window.agentmat.skills.pickLocalRepository();
    if (picked) setRepoSource(picked);
  }

  function handleCopyInstallCommand(command: string): void {
    void navigator.clipboard.writeText(command);
    toast.success('Install command copied to clipboard.');
  }

  function openInstallPicker(target: InstallTarget): void {
    setInstallTarget(target);
    setInstallPickerProjectIds(new Set());
    setInstallGlobally(false);
    setInstallPickerSearch('');
  }

  function toggleInstallPickerProject(projectId: string): void {
    setInstallPickerProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  const installTargetName = installTarget
    ? installTarget.kind === 'repo'
      ? installTarget.skillName
      : installTarget.skill.name
    : '';

  usePageHeader('Skill Marketplace', 'Install skills from configurable repositories or skills.sh.');

  return (
    <div className="space-y-6 p-6">
      <Tabs defaultValue="marketplace">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="marketplace">My Repositories</TabsTrigger>
            <TabsTrigger value="directory">skills.sh Directory</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={() => setGlobalSkillsModalOpen(true)}>
            <Globe className="h-4 w-4" /> Global Skills
            {(globalInstalledQuery.data?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {globalInstalledQuery.data?.length}
              </Badge>
            )}
          </Button>
        </div>

        <TabsContent value="marketplace" className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
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

            <Button onClick={() => setAddRepoOpen(true)}>
              <Plus /> Add Repository
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* The repository index is fetched per repo, so the grid shimmers
                while it lands instead of sitting empty. */}
            {(reposQuery.isPending || (!!selectedRepoId && repoIndexQuery.isPending)) &&
              Array.from({ length: 6 }, (_, i) => <CatalogCardSkeleton key={i} />)}
            {filteredSkills.map((skill) => (
              <Card key={skill.id} className="glass flex flex-col">
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
                    <Button
                      size="sm"
                      onClick={() =>
                        openInstallPicker({
                          kind: 'repo',
                          skillId: skill.id,
                          skillName: skill.name,
                        })
                      }
                    >
                      Install
                    </Button>
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
            ))}
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
            as of {SKILLS_SH_SNAPSHOT_DATE} for offline browsing, switch to{' '}
            <span className="font-medium text-foreground">Live</span> to search skills.sh's full
            catalog directly. The{' '}
            <Badge variant="default" className="align-middle">
              Official
            </Badge>{' '}
            badge mirrors skills.sh's own verified-publisher mark (Anthropic, Vercel, Microsoft,
            Firebase, Supabase, and other verified owners); everything else is community-published.
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
              <Card key={skill.id} className="glass flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-1.5">
                      {skill.name}
                      {skill.official && (
                        <SimpleTooltip label="Official: skills.sh has verified this publisher">
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
                    <Button
                      size="sm"
                      onClick={() => openInstallPicker({ kind: 'skillsSh', skill })}
                    >
                      Install
                    </Button>
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
                <SimpleTooltip label="Official: skills.sh has verified this publisher">
                  <CircleCheck className="h-4 w-4 shrink-0 text-blue-500" />
                </SimpleTooltip>
              )}
            </DialogTitle>
            <DialogDescription>
              {shSelected?.repo} · {shModalInstallsLabel} installs
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 -my-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
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
              disabled={!shSelected}
              onClick={() =>
                shSelected && openInstallPicker({ kind: 'skillsSh', skill: shSelected })
              }
            >
              Install…
            </Button>
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

      <Dialog
        open={!!installTarget}
        onOpenChange={(open) => {
          if (!open) {
            setInstallTarget(null);
            setInstallPickerProjectIds(new Set());
            setInstallGlobally(false);
            setInstallPickerSearch('');
          }
        }}
      >
        <DialogContent className="flex max-h-[70vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Install {installTargetName}</DialogTitle>
            <DialogDescription>
              Select one or more projects, or install it globally for use in every project.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="Search projects…"
              value={installPickerSearch}
              onChange={(e) => setInstallPickerSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted',
              installGlobally && 'border-primary bg-muted',
            )}
            onClick={() => setInstallGlobally((v) => !v)}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border',
                installGlobally && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {installGlobally && <Check className="h-3 w-3" />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <Globe className="h-3.5 w-3.5" /> Install globally
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Available to every project
              </span>
            </span>
          </button>
          <div className="border-t border-border" />
          <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
            {filteredProjectsForPicker.map((p) => {
              const checked = installPickerProjectIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted',
                    checked && 'border-primary bg-muted',
                  )}
                  onClick={() => toggleInstallPickerProject(p.id)}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border',
                      checked && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.folderPath}</span>
                  </span>
                </button>
              );
            })}
            {filteredProjectsForPicker.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {projectsQuery.data?.length === 0
                  ? 'No projects yet. Create one first.'
                  : 'No projects match your search.'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={
                (installPickerProjectIds.size === 0 && !installGlobally) ||
                installBatchMutation.isPending
              }
              onClick={() =>
                installBatchMutation.mutate({
                  projectIds: [...installPickerProjectIds],
                  global: installGlobally,
                })
              }
            >
              Install
              {installPickerProjectIds.size + (installGlobally ? 1 : 0) > 0
                ? ` (${installPickerProjectIds.size + (installGlobally ? 1 : 0)})`
                : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={globalSkillsModalOpen}
        onOpenChange={(open) => {
          setGlobalSkillsModalOpen(open);
          if (!open) setGlobalSkillsAgentFilter('all');
        }}
      >
        <DialogContent className="flex max-h-[70vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Global Skills
            </DialogTitle>
            <DialogDescription>Available to every project.</DialogDescription>
          </DialogHeader>
          {(globalInstalledQuery.data?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={globalSkillsAgentFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setGlobalSkillsAgentFilter('all')}
              >
                All
              </Button>
              {SKILLS_CLI_AGENT_OPTIONS.map((agent) => (
                <Button
                  key={agent.value}
                  type="button"
                  size="sm"
                  variant={globalSkillsAgentFilter === agent.value ? 'default' : 'outline'}
                  onClick={() => setGlobalSkillsAgentFilter(agent.value)}
                >
                  {agent.label}
                </Button>
              ))}
            </div>
          )}
          <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
            {(globalInstalledQuery.data?.length ?? 0) === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No skills installed globally yet.
              </p>
            ) : filteredGlobalSkills.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No skills installed for this agent.
              </p>
            ) : (
              filteredGlobalSkills.map((skill) => {
                const update = globalSkillUpdateBySkillId.get(skill.skillId);
                return (
                  <div
                    key={skill.skillId}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {skill.skillId}{' '}
                      <span className="text-muted-foreground">v{skill.version}</span>
                      {skill.agents?.map((a) => (
                        <Badge key={a} variant="outline">
                          {SKILLS_CLI_AGENT_OPTIONS.find((o) => o.value === a)?.label ?? a}
                        </Badge>
                      ))}
                      {update?.hasUpdate && (
                        <Badge variant="secondary">v{update.latestVersion} available</Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {update?.hasUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            updateGlobalSkillMutation.isPending &&
                            updateGlobalSkillMutation.variables?.skillId === skill.skillId
                          }
                          onClick={() => updateGlobalSkillMutation.mutate(update)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Update
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          void confirmDialog({
                            title: `Remove "${skill.skillId}"?`,
                            description: 'This removes it globally.',
                            confirmLabel: 'Remove',
                            variant: 'destructive',
                          }).then((confirmed) => {
                            if (confirmed) removeGlobalSkillMutation.mutate(skill.skillId);
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
