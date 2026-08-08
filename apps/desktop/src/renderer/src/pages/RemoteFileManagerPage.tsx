import { useEffect, useState } from 'react';
import { formatBytes } from '@shared/remoteProtocol';
import type { RemoteFileManagerEntry } from '@shared/apiTypes';
import {
  ArrowLeft,
  Download,
  File,
  Folder,
  FolderPlus,
  HardDrive,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useRemoteStore } from '@/stores/remoteStore';
import { useRemoteFileManagerStore } from '@/stores/remoteFileManagerStore';
import { confirmDialog } from '@/stores/confirmStore';
import { cn } from '@/lib/utils';

function parentOf(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

function RenameRow({
  entry,
  onDone,
}: {
  entry: RemoteFileManagerEntry;
  onDone: () => void;
}): React.JSX.Element {
  const rename = useRemoteFileManagerStore((s) => s.rename);
  const [value, setValue] = useState(entry.name);

  async function submit(): Promise<void> {
    const trimmed = value.trim();
    onDone();
    if (!trimmed || trimmed === entry.name) return;
    await rename(entry, trimmed);
  }

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone();
      }}
      className="h-7 text-sm"
    />
  );
}

function EntryRow({ entry }: { entry: RemoteFileManagerEntry }): React.JSX.Element {
  const navigate = useRemoteFileManagerStore((s) => s.navigate);
  const deleteEntry = useRemoteFileManagerStore((s) => s.deleteEntry);
  const download = useRemoteFileManagerStore((s) => s.download);
  const [renaming, setRenaming] = useState(false);

  async function remove(): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete "${entry.name}"?`,
      description: entry.isDirectory
        ? 'This deletes the folder and everything inside it on the remote machine.'
        : 'This deletes the file on the remote machine.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) await deleteEntry(entry);
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
      {entry.isDirectory ? (
        <Folder className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        {renaming ? (
          <RenameRow entry={entry} onDone={() => setRenaming(false)} />
        ) : entry.isDirectory ? (
          <button
            type="button"
            onClick={() => void navigate(entry.path)}
            className="truncate text-sm font-medium text-foreground hover:text-primary"
          >
            {entry.name}
          </button>
        ) : (
          <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
        )}
        {!entry.isDirectory && (
          <p className="truncate text-xs text-muted-foreground">{formatBytes(entry.size)}</p>
        )}
      </div>
      {!entry.isDirectory && (
        <SimpleTooltip label="Download">
          <Button size="icon" variant="ghost" onClick={() => void download(entry)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      )}
      <SimpleTooltip label="Rename">
        <Button size="icon" variant="ghost" onClick={() => setRenaming(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label="Delete">
        <Button size="icon" variant="ghost" onClick={() => void remove()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    </li>
  );
}

function NewFolderRow(): React.JSX.Element {
  const mkdir = useRemoteFileManagerStore((s) => s.mkdir);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!editing) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        <FolderPlus className="h-3.5 w-3.5" /> New folder
      </Button>
    );
  }

  async function submit(): Promise<void> {
    const trimmed = name.trim();
    setEditing(false);
    setName('');
    if (trimmed) await mkdir(trimmed);
  }

  return (
    <Input
      autoFocus
      value={name}
      placeholder="Folder name"
      onChange={(e) => setName(e.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setEditing(false);
          setName('');
        }
      }}
      className="h-8 w-40 text-sm"
    />
  );
}

export default function RemoteFileManagerPage(): React.JSX.Element {
  const connection = useRemoteStore((s) => s.state?.connection);
  const transfers = useRemoteStore((s) => s.transfers);
  const { path, entries, roots, loading, error, loadRoots, navigate, upload } =
    useRemoteFileManagerStore();

  usePageHeader(
    'Remote files',
    connection?.remoteDeviceName
      ? `Browsing ${connection.remoteDeviceName}`
      : 'Browsing a remote machine.',
  );

  useEffect(() => {
    if (connection?.status === 'connected') void loadRoots();
  }, [connection?.status, loadRoots]);

  if (connection?.status !== 'connected') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Not connected. Go to Remote → Connect and use “Browse files” on a saved server, or connect
          with a pairing code first.
        </p>
      </div>
    );
  }

  const up = path ? parentOf(path) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <Card className="glass">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <HardDrive className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-mono text-sm font-normal">
              {path ?? 'This computer'}
            </span>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            {path !== null && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void (up ? navigate(up) : loadRoots())}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            <SimpleTooltip label="Refresh">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void (path === null ? loadRoots() : navigate(path))}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </SimpleTooltip>
            {path !== null && <NewFolderRow />}
            {path !== null && (
              <Button size="sm" onClick={() => void upload()}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          {(path === null ? roots : entries).length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">This folder is empty.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(path === null ? roots : entries).map((entry) => (
                <EntryRow key={entry.path} entry={entry} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {transfers.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Transfers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {transfers.map((t) => {
              const pct = t.total > 0 ? Math.round((t.transferred / t.total) * 100) : 0;
              return (
                <div key={t.transferId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">
                      {t.direction === 'incoming' ? '↓' : '↑'} {t.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {t.resuming && <span className="text-warning">Reconnecting…</span>}
                      {t.partsTotal !== undefined && (
                        <span>
                          {t.partsCompleted ?? 0}/{t.partsTotal} parts
                        </span>
                      )}
                      {t.error
                        ? t.error
                        : t.done
                          ? t.verified
                            ? 'Verified ✓'
                            : 'Hash mismatch ✗'
                          : `${formatBytes(t.transferred)} / ${formatBytes(t.total)}`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        t.error || t.verified === false ? 'bg-destructive' : 'bg-primary',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
