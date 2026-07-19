import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Trash2,
} from '@/components/icons';
import { BOWORA_MCP_REPOSITORY_ID } from '@agentmat/core';
import type { McpRepositorySourceType, McpServer } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { SimpleTooltip } from '@/components/ui/tooltip';
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

const SOURCE_TYPES: { value: McpRepositorySourceType; label: string }[] = [
  { value: 'url', label: 'URL (JSON index)' },
  { value: 'git', label: 'Git repository' },
  { value: 'local-folder', label: 'Local folder' },
];

export default function McpPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') ?? '');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [search, setSearch] = useState('');
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
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshRepoMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.mcp.refreshRepository(id),
    onSuccess: () => {
      toast.success('Repository refreshed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcpRepositoryIndex(selectedRepoId) });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedMcpServers(selectedProjectId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeServerMutation = useMutation({
    mutationFn: (serverId: string) =>
      window.agentmat.mcp.remove({ projectId: selectedProjectId, serverId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedMcpServers(selectedProjectId) });
    },
  });

  const installedIds = useMemo(
    () => new Set(installedServersQuery.data?.map((s) => s.serverId) ?? []),
    [installedServersQuery.data],
  );

  const filteredServers = useMemo(() => {
    const servers = repoIndexQuery.data?.servers ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [repoIndexQuery.data, search]);

  async function handlePickLocalFolder(): Promise<void> {
    const picked = await window.agentmat.mcp.pickLocalRepository();
    if (picked) setRepoSource(picked);
  }

  function handleInstallClick(server: McpServer): void {
    if (server.requiredEnv.length > 0) {
      setEnvValues(Object.fromEntries(server.requiredEnv.map((key) => [key, ''])));
      setEnvServer(server);
      return;
    }
    installMutation.mutate({ serverId: server.id });
  }

  function handleConfirmEnvInstall(): void {
    if (!envServer) return;
    installMutation.mutate({ serverId: envServer.id, env: envValues });
    setEnvServer(null);
  }

  usePageHeader('MCP Marketplace', 'Install MCP servers into a project from configurable repositories.');

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
            clearable
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
            {selectedRepoId && selectedRepoId !== BOWORA_MCP_REPOSITORY_ID && (
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
            {selectedRepoId === BOWORA_MCP_REPOSITORY_ID && (
              <SimpleTooltip label="Bundled with AgentMate — always available, no network fetch needed">
                <Badge variant="secondary">Built-in</Badge>
              </SimpleTooltip>
            )}
          </div>
        </div>

        <div className="relative min-w-64 flex-1 space-y-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search MCP servers by name, tag, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!selectedProjectId && (
        <p className="text-sm text-amber-500">Choose a target project to enable installing MCP servers.</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredServers.map((server) => {
          const isInstalled = installedIds.has(server.id);
          const canAutoInstall =
            server.config.transport === 'stdio' ? !!server.config.command : !!server.config.url;
          return (
            <Card key={server.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    {server.name}
                    {server.official && (
                      <SimpleTooltip label="Official — maintained by the vendor or organization behind this integration">
                        <CircleCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      </SimpleTooltip>
                    )}
                  </CardTitle>
                  <Badge variant="outline">{server.category}</Badge>
                </div>
                <CardDescription>{server.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={server.official ? 'default' : 'secondary'}>
                    {server.official ? 'Official' : 'Community'}
                  </Badge>
                  <Badge variant="secondary">{server.config.transport}</Badge>
                  {!canAutoInstall && <Badge variant="outline">Manual setup</Badge>}
                  {server.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {server.author} · v{server.version}
                </div>
                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeServerMutation.mutate(server.id)}
                    >
                      <Trash2 /> Remove
                    </Button>
                  ) : canAutoInstall ? (
                    <Button
                      size="sm"
                      disabled={!selectedProjectId || installMutation.isPending}
                      onClick={() => handleInstallClick(server)}
                    >
                      <Plug /> Install
                    </Button>
                  ) : (
                    <SimpleTooltip label="No install command available yet — see the server's docs to set it up manually.">
                      <Button size="sm" disabled>
                        <Plug /> Install
                      </Button>
                    </SimpleTooltip>
                  )}
                  {server.websiteUrl && (
                    <SimpleTooltip label="Website">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void window.agentmat.shell.openExternal(server.websiteUrl!)}
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                  {server.repositoryUrl && (
                    <SimpleTooltip label="GitHub">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void window.agentmat.shell.openExternal(server.repositoryUrl!)}
                      >
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
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
                onChange={(v) => setRepoSourceType(v as McpRepositorySourceType)}
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
              This server needs a few values before it can connect. They're written to this
              project's <code>.mcp.json</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {envServer?.requiredEnv.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label>{key}</Label>
                <Input
                  type="password"
                  value={envValues[key] ?? ''}
                  onChange={(e) => setEnvValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={
                installMutation.isPending ||
                (envServer?.requiredEnv.some((key) => !envValues[key]?.trim()) ?? false)
              }
              onClick={handleConfirmEnvInstall}
            >
              <Plug /> Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
