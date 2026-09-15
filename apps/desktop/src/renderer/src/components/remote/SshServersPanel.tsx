import type { SshSavedServer } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Key, Link, Lock, LockOpen, Pencil, Plus, Server, Trash2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { SshServerFormDialog } from './SshServerFormDialog';
import { SshVaultUnlockDialog } from './SshVaultUnlockDialog';

function authMethodLabel(server: SshSavedServer): string {
  return server.authMethod === 'password' ? 'Password' : 'Private key';
}

function SavedSshServerRow({
  server,
  onConnect,
  onEdit,
  onRemoved,
}: {
  server: SshSavedServer;
  onConnect: (server: SshSavedServer) => Promise<void>;
  onEdit: (server: SshSavedServer) => void;
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
      await window.agentmat.ssh.removeServer(server.id);
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

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{server.nickname}</p>
        <p className="truncate text-xs text-muted-foreground">
          {server.username}@{server.host}:{server.port} · {authMethodLabel(server)}
          {server.lastConnectedAt
            ? ` · last connected ${timeAgo(new Date(server.lastConnectedAt).toISOString())}`
            : ''}
        </p>
      </div>
      <Button size="sm" onClick={() => void connect()} disabled={connecting}>
        <Link className="h-3.5 w-3.5" /> {connecting ? 'Connecting…' : 'Connect'}
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

export function SshServersPanel(): React.JSX.Element {
  const queryClient = useQueryClient();
  const openSshSession = useTerminalStore((s) => s.openSshSession);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SshSavedServer | undefined>(undefined);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockMode, setUnlockMode] = useState<'unlock' | 'set'>('unlock');
  const [pendingConnect, setPendingConnect] = useState<SshSavedServer | null>(null);

  const serversQuery = useQuery({
    queryKey: queryKeys.sshServers,
    queryFn: () => window.agentmat.ssh.listServers(),
  });
  const vaultQuery = useQuery({
    queryKey: queryKeys.sshVaultStatus,
    queryFn: () => window.agentmat.ssh.vaultStatus(),
  });
  const servers = serversQuery.data ?? [];
  const vault = vaultQuery.data ?? { hasPasskey: false, unlocked: false };

  async function refreshServers(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sshServers });
  }
  async function refreshVault(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
  }

  function openAdd(): void {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(server: SshSavedServer): void {
    setEditing(server);
    setFormOpen(true);
  }

  async function handleConnect(server: SshSavedServer): Promise<void> {
    const status = await window.agentmat.ssh.vaultStatus();
    if (status.hasPasskey && !status.unlocked) {
      setPendingConnect(server);
      setUnlockMode('unlock');
      setUnlockOpen(true);
      return;
    }
    openSshSession(server);
  }

  function handleUnlocked(): void {
    void refreshVault();
    if (pendingConnect) {
      openSshSession(pendingConnect);
      setPendingConnect(null);
    }
  }

  async function removePasskey(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Remove the Servers passkey?',
      description: 'Saved passwords and key passphrases go back to OS-keychain-only protection.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;
    const result = await window.agentmat.ssh.setPasskey(null);
    if (!result.ok) {
      toast.error(result.error ?? 'Could not remove the passkey.');
      return;
    }
    await refreshVault();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="glass">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Saved servers
            </CardTitle>
            <CardDescription>Connect over SSH with one click, no terminal typing.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vault.hasPasskey ? (
              vault.unlocked ? (
                <>
                  <Badge variant="success" className="gap-1.5">
                    <LockOpen className="h-3 w-3" /> Vault unlocked
                  </Badge>
                  <SimpleTooltip label="Change the Servers passkey">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setUnlockMode('set');
                        setUnlockOpen(true);
                      }}
                    >
                      <Key className="h-3.5 w-3.5" />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip label="Remove the Servers passkey">
                    <Button size="icon" variant="ghost" onClick={() => void removePasskey()}>
                      <Lock className="h-3.5 w-3.5" />
                    </Button>
                  </SimpleTooltip>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUnlockMode('unlock');
                    setUnlockOpen(true);
                  }}
                >
                  <Lock className="h-3.5 w-3.5" /> Unlock vault
                </Button>
              )
            ) : (
              <SimpleTooltip label="Encrypt saved passwords and key passphrases with a passkey instead of just the OS keychain">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setUnlockMode('set');
                    setUnlockOpen(true);
                  }}
                >
                  <Lock className="h-3.5 w-3.5" /> Protect with a passkey
                </Button>
              </SimpleTooltip>
            )}
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add server
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Server className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No servers yet</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Add one to connect with a click, right from a terminal tab.
                </p>
              </div>
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" /> Add server
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {servers.map((server) => (
                <SavedSshServerRow
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

      <SshServerFormDialog
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
