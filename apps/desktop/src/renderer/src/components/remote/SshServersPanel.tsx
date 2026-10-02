import type { SshSavedServer } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { History, Link, Pencil, Plus, Server, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { ServersVaultControls } from './ServersVaultControls';
import { SshHistoryPanel } from './SshHistoryPanel';
import { SshServerFormDialog } from './SshServerFormDialog';
import { SshVaultUnlockDialog } from './SshVaultUnlockDialog';

type ServerAction = 'connect' | 'history';

function authMethodLabel(server: SshSavedServer): string {
  return server.authMethod === 'password' ? 'Password' : 'Private key';
}

function SavedSshServerRow({
  server,
  onConnect,
  onHistory,
  onEdit,
  onRemoved,
}: {
  server: SshSavedServer;
  onConnect: (server: SshSavedServer) => Promise<void>;
  onHistory: (server: SshSavedServer) => Promise<void>;
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
      <SimpleTooltip label="AI history on this server">
        <Button
          size="icon"
          variant="ghost"
          aria-label="AI history on this server"
          onClick={() => void onHistory(server)}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
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
  // What to do with a server once the vault is unlocked: connect to it, or show its history.
  const [pendingAction, setPendingAction] = useState<{
    server: SshSavedServer;
    action: ServerAction;
  } | null>(null);
  const [historyServer, setHistoryServer] = useState<SshSavedServer | null>(null);

  const serversQuery = useQuery({
    queryKey: queryKeys.sshServers,
    queryFn: () => window.agentmat.ssh.listServers(),
  });
  const servers = serversQuery.data ?? [];

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

  function runAction(server: SshSavedServer, action: ServerAction): void {
    if (action === 'connect') {
      openSshSession(server);
      return;
    }
    setHistoryServer(server);
    // Coming back from an unlock the panel may hold a vault-locked error; read again.
    void queryClient.invalidateQueries({ queryKey: queryKeys.sshConversations(server.id) });
  }

  function askToUnlock(server: SshSavedServer, action: ServerAction): void {
    setPendingAction({ server, action });
    setUnlockMode('unlock');
    setUnlockOpen(true);
  }

  /** Both actions read the server's stored secret, so a locked vault asks for its passkey first. */
  async function withUnlockedVault(server: SshSavedServer, action: ServerAction): Promise<void> {
    const status = await window.agentmat.ssh.vaultStatus();
    if (status.hasPasskey && !status.unlocked) {
      askToUnlock(server, action);
      return;
    }
    runAction(server, action);
  }

  function handleUnlocked(): void {
    void refreshVault();
    if (pendingAction) {
      runAction(pendingAction.server, pendingAction.action);
      setPendingAction(null);
    }
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
                  onConnect={(s) => withUnlockedVault(s, 'connect')}
                  onHistory={(s) => withUnlockedVault(s, 'history')}
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
        onOpenChange={(open) => {
          setUnlockOpen(open);
          // Backing out drops the action, so a later unlock from the header doesn't run it.
          // `handleUnlocked` still sees it: it reads this render's value.
          if (!open) setPendingAction(null);
        }}
        mode={unlockMode}
        onUnlocked={handleUnlocked}
      />
      <SshHistoryPanel
        server={historyServer}
        onOpenChange={(open) => {
          if (!open) setHistoryServer(null);
        }}
        onRequestUnlock={() => {
          if (historyServer) askToUnlock(historyServer, 'history');
        }}
      />
    </div>
  );
}
