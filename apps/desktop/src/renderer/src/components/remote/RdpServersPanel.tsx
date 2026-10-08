import type { RdpSavedServer } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link, Monitor, Pencil, Plus, Shield, Trash2 } from '@/components/icons';
import { EmptyState, FOOTER_HAIRLINE } from '@/components/pageKit';
import { ipcErrorMessage } from '@/components/projects/environments/ipcError';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { RdpCertificateDialog } from './RdpCertificateDialog';
import { RdpServerFormDialog } from './RdpServerFormDialog';
import { REMOTE_CARD, RemoteCardHeader, ServerRowsSkeleton } from './remoteCard';
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
  onCertificate,
  onRemoved,
}: {
  server: RdpSavedServer;
  onConnect: (server: RdpSavedServer) => Promise<void>;
  onEdit: (server: RdpSavedServer) => void;
  onCertificate: (server: RdpSavedServer) => void;
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
        <Monitor className="h-4 w-4" />
      </span>
      <div className="min-w-[min(100%,12rem)] flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{server.nickname}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            <span className="font-mono">{account}</span> on{' '}
            <span className="font-mono">
              {server.host}
              {server.port !== 3389 ? `:${server.port}` : ''}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 text-[10px] font-medium leading-4">
            {resolutionLabel(server)}
          </span>
          {server.lastConnectedAt ? (
            <span className="truncate">
              last connected {timeAgo(new Date(server.lastConnectedAt).toISOString())}
            </span>
          ) : null}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SimpleTooltip label="Edit this server">
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            aria-label={`Edit ${server.nickname}`}
            onClick={() => onEdit(server)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip
          label={
            server.certFingerprint
              ? "View the saved certificate, get the server's current one, or forget it"
              : "Get the server's certificate"
          }
        >
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            aria-label={`Certificate for ${server.nickname}`}
            onClick={() => onCertificate(server)}
          >
            <Shield className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Remove this server">
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${server.nickname}`}
            onClick={() => void remove()}
            disabled={removing}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <Button className="ml-1" onClick={() => void connect()} disabled={connecting}>
          <Link className="h-3.5 w-3.5" /> {connecting ? 'Opening…' : 'Connect'}
        </Button>
      </div>
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
  const [certificateServerId, setCertificateServerId] = useState<string | null>(null);

  const serversQuery = useQuery({
    queryKey: queryKeys.rdpServers,
    queryFn: () => window.agentmat.rdp.listServers(),
  });
  const servers = serversQuery.data ?? [];
  // Looked up by id so the dialog shows the saved certificate as it is after a change.
  const certificateServer = servers.find((server) => server.id === certificateServerId) ?? null;

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
      toast.error(ipcErrorMessage(error, 'Could not open the session.'));
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
    <div className="flex flex-col gap-2">
      <section className={REMOTE_CARD}>
        <RemoteCardHeader
          icon={Monitor}
          title="Remote Desktop servers"
          description="Sign in to Windows servers in their own window, with shared clipboard and file copy."
          actions={
            <>
              <ServersVaultControls
                onRequestDialog={(mode) => {
                  setUnlockMode(mode);
                  setUnlockOpen(true);
                }}
              />
              {servers.length > 0 ? (
                <Button onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5" /> Add server
                </Button>
              ) : null}
            </>
          }
        />
        <div className={FOOTER_HAIRLINE}>
          {serversQuery.isPending ? (
            <ServerRowsSkeleton />
          ) : servers.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Monitor}
              title="No Remote Desktop servers yet"
              description="Add a Windows Server or Windows PC with Remote Desktop turned on, then connect with one click."
              action={
                <Button onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5" /> Add server
                </Button>
              }
            />
          ) : (
            <ul className="settings-rows">
              {servers.map((server) => (
                <SavedRdpServerRow
                  key={server.id}
                  server={server}
                  onConnect={handleConnect}
                  onEdit={openEdit}
                  onCertificate={(target) => setCertificateServerId(target.id)}
                  onRemoved={() => void refreshServers()}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <RdpServerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={() => void refreshServers()}
      />
      <RdpCertificateDialog
        key={certificateServer?.id ?? 'none'}
        server={certificateServer}
        onOpenChange={(open) => !open && setCertificateServerId(null)}
        onChanged={() => void refreshServers()}
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
