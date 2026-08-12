import type { McpRepositorySourceType, McpServer } from '@agentmat/core';
import { BOWORA_MCP_REPOSITORY_ID } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CircleCheck,
  FolderOpen,
  GitBranch,
  Globe,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Spinner,
  Trash2,
  X,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { usePageHeader } from '@/stores/pageHeaderStore';

const SOURCE_TYPES: { value: McpRepositorySourceType; label: string }[] = [
  { value: 'url', label: 'URL (JSON index)' },
  { value: 'git', label: 'Git repository' },
  { value: 'local-folder', label: 'Local folder' },
];

const EMPTY_SERVERS: McpServer[] = [];

function monogramLetter(name: string): string {
  const match = name.match(/[A-Za-z0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
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
      className={cn(
        'h-7 shrink-0 cursor-pointer rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function MarketplaceEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plug className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function McpCardSkeleton(): React.JSX.Element {
  return (
    <Card className="glass flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardContent>
    </Card>
  );
}

const McpServerCard = memo(function McpServerCard({
  server,
  isInstalled,
  canInstall,
  isInstalling,
  isRemoving,
  showCategory,
  onInstall,
  onRemove,
}: {
  server: McpServer;
  isInstalled: boolean;
  canInstall: boolean;
  isInstalling: boolean;
  isRemoving: boolean;
  showCategory: boolean;
  onInstall: (server: McpServer) => void;
  onRemove: (server: McpServer) => void;
}): React.JSX.Element {
  const canAutoInstall =
    server.config.transport === 'stdio' ? !!server.config.command : !!server.config.url;
  const installDisabled = !canInstall || isInstalling;

  return (
    <Card
      className={cn(
        'glass flex flex-col transition-all duration-150 hover:-translate-y-0.5',
        isInstalled ? 'border-success/35 hover:border-success/55' : 'hover:border-primary/40',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 font-semibold text-primary"
          >
            {monogramLetter(server.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{server.name}</span>
                {server.official && (
                  <SimpleTooltip label="Official, maintained by the vendor or organization behind this integration">
                    <CircleCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  </SimpleTooltip>
                )}
              </CardTitle>
              {isInstalled ? (
                <Badge variant="success">Installed</Badge>
              ) : (
                showCategory && (
                  <span className="shrink-0 text-xs text-muted-foreground">{server.category}</span>
                )
              )}
            </div>
            {isInstalled && showCategory && (
              <p className="mt-0.5 text-xs text-muted-foreground">{server.category}</p>
            )}
          </div>
        </div>
        <CardDescription className="line-clamp-2">{server.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {server.author}
            {server.version && server.version !== 'latest' ? ` · v${server.version}` : ''}
            {` · ${server.config.transport}`}
          </span>
          {!canAutoInstall && <Badge variant="outline">Manual setup</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isRemoving}
              onClick={() => onRemove(server)}
            >
              {isRemoving ? <Spinner className="animate-spin" /> : <Trash2 />}
              {isRemoving ? 'Removing…' : 'Remove'}
            </Button>
          ) : canAutoInstall ? (
            <SimpleTooltip
              label={canInstall ? undefined : 'Choose a project first'}
              wrapTrigger={installDisabled}
            >
              <Button size="sm" disabled={installDisabled} onClick={() => onInstall(server)}>
                {isInstalling ? <Spinner className="animate-spin" /> : <Plug />}
                {isInstalling ? 'Installing…' : 'Install'}
              </Button>
            </SimpleTooltip>
          ) : (
            <SimpleTooltip
              label="No install command available yet. See the server's docs to set it up manually."
              wrapTrigger
            >
              <Button size="sm" disabled>
                <Plug /> Install
              </Button>
            </SimpleTooltip>
          )}
          <div className="ml-auto flex items-center">
            {server.websiteUrl && (
              <SimpleTooltip label="Website">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open ${server.name} website`}
                  onClick={() => void window.agentmat.shell.openExternal(server.websiteUrl!)}
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            )}
            {server.repositoryUrl && (
              <SimpleTooltip label="Source repository">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open ${server.name} source repository`}
                  onClick={() => void window.agentmat.shell.openExternal(server.repositoryUrl!)}
                >
                  <GitBranch className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default function McpPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyOfficial, setOnlyOfficial] = useState(false);
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoSourceType, setRepoSourceType] = useState<McpRepositorySourceType>('local-folder');
  const [repoSource, setRepoSource] = useState('');
  const [envServer, setEnvServer] = useState<McpServer | null>(null);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const reposQuery = useQuery({
    queryKey: queryKeys.mcpRepositories,
    queryFn: () => window.agentmat.mcp.listRepositories(),
  });

  useEffect(() => {
    if (!selectedRepoId && reposQuery.data && reposQuery.data.length > 0) {
      setSelectedRepoId(reposQuery.data[0].id);
      setCategoryFilter('all');
    }
  }, [reposQuery.data, selectedRepoId]);

  const repoIndexQuery = useQuery({
    queryKey: queryKeys.mcpRepositoryIndex(selectedRepoId),
    queryFn: () => window.agentmat.mcp.getRepositoryIndex(selectedRepoId),
    enabled: !!selectedRepoId,
  });

  const installedServersQuery = useQuery({
    queryKey: queryKeys.installedMcpServers(selectedProjectId),
    queryFn: () => window.agentmat.mcp.listInstalled(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const addRepoMutation = useMutation({
    mutationFn: () =>
      window.agentmat.mcp.addRepository({
        name: repoName,
        sourceType: repoSourceType,
        source: repoSource,
      }),
    onSuccess: () => {
      toast.success('Repository added.');
      setAddRepoOpen(false);
      setRepoName('');
      setRepoSource('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcpRepositories });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRepoMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.mcp.removeRepository(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcpRepositories });
      setSelectedRepoId('');
      setCategoryFilter('all');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshRepoMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.mcp.refreshRepository(id),
    onSuccess: () => {
      toast.success('Repository refreshed.');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mcpRepositoryIndex(selectedRepoId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const installMutation = useMutation({
    mutationFn: (params: { serverId: string; env?: Record<string, string> }) =>
      window.agentmat.mcp.install({
        projectId: selectedProjectId,
        repositoryId: selectedRepoId,
        serverId: params.serverId,
        env: params.env,
      }),
    onSuccess: () => {
      toast.success('MCP server installed.');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.installedMcpServers(selectedProjectId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeServerMutation = useMutation({
    mutationFn: (serverId: string) =>
      window.agentmat.mcp.remove({ projectId: selectedProjectId, serverId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.installedMcpServers(selectedProjectId),
      });
    },
  });

  const installedIds = useMemo(
    () => new Set(installedServersQuery.data?.map((s) => s.serverId) ?? []),
    [installedServersQuery.data],
  );

  const allServers = repoIndexQuery.data?.servers ?? EMPTY_SERVERS;

  const categories = useMemo(() => {
    return [...new Set(allServers.map((s) => s.category))].sort((a, b) => a.localeCompare(b));
  }, [allServers]);

  const installedInCatalog = useMemo(
    () => allServers.filter((s) => installedIds.has(s.id)).length,
    [allServers, installedIds],
  );

  const filteredServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allServers
      .filter((s) => {
        if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
        if (onlyOfficial && !s.official) return false;
        if (onlyInstalled && !installedIds.has(s.id)) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name));
  }, [allServers, search, categoryFilter, onlyOfficial, onlyInstalled, installedIds]);

  const filtersActive =
    categoryFilter !== 'all' || onlyOfficial || onlyInstalled || !!search.trim();

  const selectedProject = projectsQuery.data?.find((p) => p.id === selectedProjectId);
  const selectedRepo = reposQuery.data?.find((r) => r.id === selectedRepoId);
  const isBuiltIn = selectedRepoId === BOWORA_MCP_REPOSITORY_ID;
  const isLoadingIndex = reposQuery.isPending || (!!selectedRepoId && repoIndexQuery.isPending);

  async function handlePickLocalFolder(): Promise<void> {
    const picked = await window.agentmat.mcp.pickLocalRepository();
    if (picked) setRepoSource(picked);
  }

  const handleInstallClick = useCallback(
    (server: McpServer) => {
      if (server.requiredEnv.length > 0) {
        setEnvValues(Object.fromEntries(server.requiredEnv.map((key) => [key, ''])));
        setEnvServer(server);
        return;
      }
      installMutation.mutate({ serverId: server.id });
    },
    [installMutation.mutate],
  );

  function handleConfirmEnvInstall(): void {
    if (!envServer) return;
    installMutation.mutate({ serverId: envServer.id, env: envValues });
    setEnvServer(null);
  }

  async function handleRemoveRepo(id: string): Promise<void> {
    const repo = reposQuery.data?.find((r) => r.id === id);
    const confirmed = await confirmDialog({
      title: `Remove "${repo?.name ?? 'this repository'}"?`,
      description:
        'This only removes the repository from AgentMate. Servers already installed in projects stay put.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (confirmed) removeRepoMutation.mutate(id);
  }

  const handleRemoveServer = useCallback(
    async (server: McpServer) => {
      const confirmed = await confirmDialog({
        title: `Remove "${server.name}"?`,
        description: selectedProject
          ? `This removes it from ${selectedProject.name}.`
          : 'This removes it from the selected project.',
        confirmLabel: 'Remove',
        variant: 'destructive',
      });
      if (confirmed) removeServerMutation.mutate(server.id);
    },
    [removeServerMutation.mutate, selectedProject],
  );

  function clearFilters(): void {
    setSearch('');
    setCategoryFilter('all');
    setOnlyOfficial(false);
    setOnlyInstalled(false);
  }

  usePageHeader(
    'MCP Marketplace',
    'Plug extra tools into a project from a repository of MCP servers.',
  );

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Project</Label>
          <Combobox
            className={cn('w-56', !selectedProjectId && 'border-warning/40')}
            value={selectedProjectId}
            onChange={(id) => {
              setSelectedProjectId(id);
              if (!id) setOnlyInstalled(false);
            }}
            placeholder="Choose a project"
            searchPlaceholder="Search projects…"
            options={projectsQuery.data?.map((p) => ({ value: p.id, label: p.name })) ?? []}
            clearable
          />
        </div>

        <div className="space-y-1.5">
          <Label>Repository</Label>
          <div className="flex items-center gap-2">
            <Combobox
              className="w-56"
              value={selectedRepoId}
              onChange={(id) => {
                setSelectedRepoId(id);
                setCategoryFilter('all');
              }}
              placeholder="Choose a repository"
              searchPlaceholder="Search repositories…"
              options={reposQuery.data?.map((r) => ({ value: r.id, label: r.name })) ?? []}
            />
            {selectedRepoId && !isBuiltIn && (
              <>
                <SimpleTooltip label="Refresh">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Refresh repository"
                    disabled={refreshRepoMutation.isPending}
                    onClick={() => refreshRepoMutation.mutate(selectedRepoId)}
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', refreshRepoMutation.isPending && 'animate-spin')}
                    />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip label="Remove repository">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remove repository"
                    onClick={() => void handleRemoveRepo(selectedRepoId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              </>
            )}
            {isBuiltIn && (
              <SimpleTooltip label="Bundled with AgentMate, always available with no network fetch needed">
                <Badge variant="secondary">Built-in</Badge>
              </SimpleTooltip>
            )}
          </div>
        </div>

        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder="Search by name, author, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search MCP servers"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button onClick={() => setAddRepoOpen(true)}>
          <Plus /> Add repository
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {categories.length > 1 && (
          <>
            <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
              All
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category === categoryFilter ? 'all' : category)}
              >
                {category}
              </FilterChip>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          </>
        )}
        <FilterChip active={onlyOfficial} onClick={() => setOnlyOfficial((v) => !v)}>
          Official
        </FilterChip>
        {selectedProjectId && (
          <FilterChip active={onlyInstalled} onClick={() => setOnlyInstalled((v) => !v)}>
            Installed{installedInCatalog > 0 ? ` (${installedInCatalog})` : ''}
          </FilterChip>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {isLoadingIndex
            ? 'Loading…'
            : filtersActive
              ? `${filteredServers.length} of ${allServers.length}`
              : `${allServers.length} server${allServers.length === 1 ? '' : 's'}`}
          {selectedProject && installedInCatalog > 0 && !onlyInstalled && (
            <>
              {' · '}
              {installedInCatalog} in {selectedProject.name}
            </>
          )}
        </span>
      </div>

      {!selectedProjectId && (
        <p className="text-sm text-muted-foreground">
          Choose a project to install servers into it.
        </p>
      )}

      {repoIndexQuery.isError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>Couldn't load this repository.</span>
          {!isBuiltIn && selectedRepoId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshRepoMutation.mutate(selectedRepoId)}
            >
              <RefreshCw /> Try again
            </Button>
          )}
        </div>
      )}

      {isLoadingIndex ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <McpCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <MarketplaceEmpty
          title={
            allServers.length === 0
              ? selectedRepo
                ? `${selectedRepo.name} is empty`
                : 'No servers yet'
              : 'No servers match'
          }
          description={
            allServers.length === 0
              ? 'Refresh this repository, or add a different one to browse its servers.'
              : 'Try a different search or clear the filters.'
          }
          action={
            filtersActive ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAddRepoOpen(true)}>
                <Plus /> Add repository
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServers.map((server) => (
            <McpServerCard
              key={server.id}
              server={server}
              isInstalled={installedIds.has(server.id)}
              canInstall={!!selectedProjectId}
              isInstalling={
                installMutation.isPending && installMutation.variables?.serverId === server.id
              }
              showCategory={categories.length > 1}
              isRemoving={
                removeServerMutation.isPending && removeServerMutation.variables === server.id
              }
              onInstall={handleInstallClick}
              onRemove={handleRemoveServer}
            />
          ))}
        </div>
      )}

      <Dialog
        open={addRepoOpen}
        onOpenChange={(open) => {
          setAddRepoOpen(open);
          if (!open) {
            setRepoName('');
            setRepoSource('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add repository</DialogTitle>
            <DialogDescription>
              Point AgentMate at a folder of MCP servers, a git repository, or a JSON index.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="Community repository"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Combobox
                value={repoSourceType}
                onChange={(v) => setRepoSourceType(v as McpRepositorySourceType)}
                options={SOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{repoSourceType === 'local-folder' ? 'Folder' : 'Source'}</Label>
              {repoSourceType === 'local-folder' ? (
                <div className="flex gap-2">
                  <Input value={repoSource} readOnly placeholder="Choose a folder…" />
                  <SimpleTooltip label="Browse for a folder">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Browse for a folder"
                      onClick={() => void handlePickLocalFolder()}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </div>
              ) : (
                <Input
                  value={repoSource}
                  onChange={(e) => setRepoSource(e.target.value)}
                  placeholder={
                    repoSourceType === 'git'
                      ? 'https://github.com/org/mcp-servers.git'
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
              {addRepoMutation.isPending && <Spinner className="animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!envServer} onOpenChange={(open) => !open && setEnvServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {envServer?.name}</DialogTitle>
            <DialogDescription>
              This server needs a few values before it can connect. They're written to{' '}
              {selectedProject ? `${selectedProject.name}'s` : "this project's"}{' '}
              <code>.mcp.json</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {envServer?.requiredEnv.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`mcp-env-${key}`}>{key}</Label>
                <Input
                  id={`mcp-env-${key}`}
                  type="password"
                  autoComplete="off"
                  value={envValues[key] ?? ''}
                  onChange={(e) => setEnvValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvServer(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                installMutation.isPending ||
                (envServer?.requiredEnv.some((key) => !envValues[key]?.trim()) ?? false)
              }
              onClick={handleConfirmEnvInstall}
            >
              {installMutation.isPending ? <Spinner className="animate-spin" /> : <Plug />}
              Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
