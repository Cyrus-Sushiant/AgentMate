import type { RdpSavedServer } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link, Monitor, Pencil, Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { RdpServerFormDialog } from './RdpServerFormDialog';
import { ServersVaultControls } from './ServersVaultControls';
import { SshVaultUnlockDialog } from './SshVaultUnlockDialog';

function resolutionLabel(server: RdpSavedServer): string {
  const { resolution } = server.options;
  return resolution === 'fitWindow' ? 'Fits window' : `${resolution.width}×${resolution.height}`;
}

function SavedRdpServerRow({
  server,
  onConnect,
  onEdit,
  onRemoved,
}: {
  server: RdpSavedServer;
  onConnect: (server: RdpSavedServer) => Promise<void>;
  onEdit: (server: RdpSavedServer) => void;
  onRemoved: () => void;
}): React.JSX.Element {
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function remove(): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove "${server.nickname}"?`,
      description: 'You can add it again later with the same details.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setRemoving(true);
    try {
      await window.agentmat.rdp.removeServer(server.id);
      onRemoved();
    } finally {
      setRemoving(false);
    }
  }

  async function connect(): Promise<void> {
    setConnecting(true);
    try {
      await onConnect(server);
    } finally {
      setConnecting(false);
    }
  }

  const account = server.domain ? `${server.domain}\\${server.username}` : server.username;

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{server.nickname}</p>
        <p className="truncate text-xs text-muted-foreground">
          {account} on {server.host}
          {server.port !== 3389 ? `:${server.port}` : ''} · {resolutionLabel(server)}
          {server.lastConnectedAt
            ? ` · last connected ${timeAgo(new Date(server.lastConnectedAt).toISOString())}`
            : ''}
        </p>
      </div>
      <Button size="sm" onClick={() => void connect()} disabled={connecting}>
        <Link className="h-3.5 w-3.5" /> {connecting ? 'Opening…' : 'Connect'}
      </Button>
      <SimpleTooltip label="Edit this server">
        <Button size="icon" variant="ghost" onClick={() => onEdit(server)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label="Remove this server">
        <Button size="icon" variant="ghost" onClick={() => void remove()} disabled={removing}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    </li>
  );
}

export function RdpServersPanel(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RdpSavedServer | undefined>(undefined);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockMode, setUnlockMode] = useState<'unlock' | 'set'>('unlock');
  const [pendingConnect, setPendingConnect] = useState<RdpSavedServer | null>(null);

  const serversQuery = useQuery({
    queryKey: queryKeys.rdpServers,
    queryFn: () => window.agentmat.rdp.listServers(),
  });
  const servers = serversQuery.data ?? [];

  async function refreshServers(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.rdpServers });
  }

  function openAdd(): void {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(server: RdpSavedServer): void {
    setEditing(server);
    setFormOpen(true);
  }

  async function openSession(server: RdpSavedServer): Promise<void> {
    try {
      await window.agentmat.rdp.openSession(server.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the session.');
    }
  }

  async function handleConnect(server: RdpSavedServer): Promise<void> {
    const status = await window.agentmat.ssh.vaultStatus();
    if (status.hasPasskey && !status.unlocked) {
      setPendingConnect(server);
      setUnlockMode('unlock');
      setUnlockOpen(true);
      return;
    }
    await openSession(server);
  }

  function handleUnlocked(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
    if (pendingConnect) {
      void openSession(pendingConnect);
      setPendingConnect(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="glass">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Remote Desktop servers
            </CardTitle>
            <CardDescription>
              Sign in to Windows servers in their own window, with shared clipboard and file copy.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ServersVaultControls
              onRequestDialog={(mode) => {
                setUnlockMode(mode);
                setUnlockOpen(true);
              }}
            />
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add server
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No Remote Desktop servers yet</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Add a Windows Server or Windows PC with Remote Desktop turned on, then connect
                  with one click.
                </p>
              </div>
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" /> Add server
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {servers.map((server) => (
                <SavedRdpServerRow
                  key={server.id}
                  server={server}
                  onConnect={handleConnect}
                  onEdit={openEdit}
                  onRemoved={() => void refreshServers()}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RdpServerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={() => void refreshServers()}
      />
      <SshVaultUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        mode={unlockMode}
        onUnlocked={handleUnlocked}
      />
    </div>
  );
}
