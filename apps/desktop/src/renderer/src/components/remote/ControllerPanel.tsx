import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RemoteSavedServer } from '@shared/apiTypes';
import { ExternalLink, Folder, Link, LinkOff, Monitor, Pencil, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { useRemoteStore } from '@/stores/remoteStore';

function SavedServerRow({ server }: { server: RemoteSavedServer }): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(server.nickname);
  const [connecting, setConnecting] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.remoteSavedServers });
  }

  async function saveNickname(): Promise<void> {
    setEditing(false);
    const trimmed = nickname.trim();
    if (!trimmed || trimmed === server.nickname) {
      setNickname(server.nickname);
      return;
    }
    await window.agentmat.remote.renameSavedServer(server.id, trimmed);
    await refresh();
  }

  async function remove(): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Forget "${server.nickname}"?`,
      description: 'You can pair with it again later using a fresh code from that device.',
      confirmLabel: 'Forget',
      variant: 'destructive',
    });
    if (!confirmed) return;
    await window.agentmat.remote.removeSavedServer(server.id);
    await refresh();
  }

  async function connect(): Promise<void> {
    setConnecting(true);
    try {
      const result = await window.agentmat.remote.connectSaved(server.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not connect.');
        return;
      }
      await window.agentmat.remote.openSessionWindow();
    } finally {
      setConnecting(false);
    }
  }

  async function browseFiles(): Promise<void> {
    setBrowsing(true);
    try {
      const result = await window.agentmat.remote.connectSavedFiles(server.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not connect.');
        return;
      }
      navigate('/remote-files');
    } finally {
      setBrowsing(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => void saveNickname()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setNickname(server.nickname);
                setEditing(false);
              }
            }}
            className="h-7 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1.5 truncate text-sm font-medium text-foreground hover:text-primary"
          >
            <span className="truncate">{server.nickname}</span>
            <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {server.ip}:{server.port} · last connected{' '}
          {timeAgo(new Date(server.lastConnectedAt).toISOString())}
        </p>
      </div>
      <Button size="sm" onClick={() => void connect()} disabled={connecting}>
        <Link className="h-3.5 w-3.5" /> {connecting ? 'Connecting…' : 'Connect'}
      </Button>
      <SimpleTooltip label="Browse this machine's files, without opening a control session">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void browseFiles()}
          disabled={browsing}
        >
          <Folder className="h-3.5 w-3.5" /> {browsing ? 'Connecting…' : 'Browse files'}
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label="Forget this server">
        <Button size="icon" variant="ghost" onClick={() => void remove()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    </li>
  );
}

export function ControllerPanel(): React.JSX.Element {
  const navigate = useNavigate();
  const connection = useRemoteStore((s) => s.state?.connection);
  const [code, setCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectingFiles, setConnectingFiles] = useState(false);

  const savedServersQuery = useQuery({
    queryKey: queryKeys.remoteSavedServers,
    queryFn: () => window.agentmat.remote.listSavedServers(),
  });
  const savedServers = savedServersQuery.data ?? [];

  const status = connection?.status ?? 'idle';
  const connected = status === 'connected';
  const active = status === 'connecting' || status === 'connected';
  const filesOnly = connection?.intent === 'files';

  async function connect(): Promise<void> {
    if (!code.trim()) {
      toast.error('Paste a pairing code first.');
      return;
    }
    setConnecting(true);
    try {
      const result = await window.agentmat.remote.connect(code.trim());
      if (!result.ok) {
        toast.error(result.error ?? 'Could not connect.');
        return;
      }
      setCode('');
      await window.agentmat.remote.openSessionWindow();
    } finally {
      setConnecting(false);
    }
  }

  async function connectFiles(): Promise<void> {
    if (!code.trim()) {
      toast.error('Paste a pairing code first.');
      return;
    }
    setConnectingFiles(true);
    try {
      const result = await window.agentmat.remote.connectFiles(code.trim());
      if (!result.ok) {
        toast.error(result.error ?? 'Could not connect.');
        return;
      }
      setCode('');
      navigate('/remote-files');
    } finally {
      setConnectingFiles(false);
    }
  }

  if (active) {
    return (
      <Card className="glass">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'success' : 'warning'} className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {connected ? 'Connected' : 'Connecting…'}
            </Badge>
            <span className="text-sm font-medium">
              {connection?.remoteDeviceName ?? 'Remote device'}
            </span>
            <span className="text-xs text-muted-foreground">
              - {filesOnly ? 'files only, no control session' : 'open in its own window'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {filesOnly ? (
              <Button size="sm" variant="secondary" onClick={() => navigate('/remote-files')}>
                <Folder className="h-3.5 w-3.5" /> Open file manager
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void window.agentmat.remote.openSessionWindow()}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Show remote window
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void window.agentmat.remote.disconnect()}
            >
              <LinkOff className="h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {savedServers.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Saved servers
            </CardTitle>
            <CardDescription>Reconnect with one click, no pairing code needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {savedServers.map((server) => (
                <SavedServerRow key={server.id} server={server} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" /> Pair a new device
          </CardTitle>
          <CardDescription>
            Paste the pairing code generated by the other AgentMate (or the contents of its QR code)
            to take control over your local network. It's remembered afterwards, so you won't need
            the code again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Pairing code</Label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder="AGENTMATE1:…"
              className="h-24 resize-none rounded-md border border-input bg-background p-2 font-mono text-xs"
            />
          </div>
          {status === 'error' && connection?.error && (
            <p className="text-xs text-destructive">{connection.error}</p>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={() => void connect()} disabled={connecting || connectingFiles}>
              <Link className="h-4 w-4" /> {connecting ? 'Connecting…' : 'Connect'}
            </Button>
            <SimpleTooltip label="Skip the control session, just browse and transfer files">
              <Button
                variant="secondary"
                onClick={() => void connectFiles()}
                disabled={connecting || connectingFiles}
              >
                <Folder className="h-4 w-4" />{' '}
                {connectingFiles ? 'Connecting…' : 'Connect (files only)'}
              </Button>
            </SimpleTooltip>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
