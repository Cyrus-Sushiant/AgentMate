import type { RemoteFileManagerEntry } from '@shared/apiTypes';
import { formatBytes } from '@shared/remoteProtocol';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Link,
  Monitor,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Upload,
} from '@/components/icons';
import { TransfersCard } from '@/components/remote/TransfersCard';
import { Button } from '@/components/ui/button';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { PANE_WIDTHS, usePaneWidth } from '@/stores/paneLayoutStore';
import { useRemoteFileManagerStore } from '@/stores/remoteFileManagerStore';
import { useRemoteStore } from '@/stores/remoteStore';

/** The page's cards: the app's glass card, rounded like the API Client and Settings cards. */
const PANEL = 'glass flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)+2px)]';

/** The same small uppercase heading the main menu puts over its groups. */
const SECTION_HEADING =
  'select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60';

/** A round icon button for the toolbar and the rows, with the main menu's hover wash. */
const ICON_BUTTON =
  'h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground';

/** An inline name field (rename, new folder), drawn with the shared field surface. */
const NAME_FIELD = 'field-surface h-7 w-full min-w-0 rounded-full px-3 text-sm outline-none';

function parentOf(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

/** The root a path lives under: the longest one it starts with, so `/home/me` beats `/`. */
function rootOf(path: string | null, roots: RemoteFileManagerEntry[]): string | null {
  if (path === null) return null;
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  let best: string | null = null;
  for (const root of roots) {
    const prefix = root.path.replace(/\\/g, '/').toLowerCase();
    if (normalized.startsWith(prefix) && (best === null || prefix.length > best.length)) {
      best = root.path;
    }
  }
  return best;
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
    <input
      autoFocus
      aria-label={`New name for ${entry.name}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone();
      }}
      className={NAME_FIELD}
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
    <li className="group flex h-10 items-center gap-3 rounded-lg pl-2.5 pr-1 transition-colors hover:bg-foreground/[0.06] focus-within:bg-foreground/[0.04]">
      {entry.isDirectory ? (
        <Folder className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 items-center">
        {renaming ? (
          <RenameRow entry={entry} onDone={() => setRenaming(false)} />
        ) : entry.isDirectory ? (
          <button
            type="button"
            onClick={() => void navigate(entry.path)}
            className="min-w-0 cursor-pointer truncate rounded-md text-left text-[13px] font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {entry.name}
          </button>
        ) : (
          <span className="truncate text-[13px] text-foreground">{entry.name}</span>
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
      </span>
      {/* The row's actions show on hover or focus, so a long listing reads as names and sizes. */}
      <div className="flex w-[6.25rem] shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!entry.isDirectory && (
          <SimpleTooltip label="Download">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Download ${entry.name}`}
              className={ICON_BUTTON}
              onClick={() => void download(entry)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
        )}
        <SimpleTooltip label="Rename">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Rename ${entry.name}`}
            className={ICON_BUTTON}
            onClick={() => setRenaming(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Delete">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${entry.name}`}
            className={cn(ICON_BUTTON, 'hover:bg-destructive/10 hover:text-destructive')}
            onClick={() => void remove()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      </div>
    </li>
  );
}

function NewFolderRow(): React.JSX.Element {
  const mkdir = useRemoteFileManagerStore((s) => s.mkdir);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!editing) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="search-pill h-8 shrink-0 rounded-full px-3 text-foreground/85 hover:text-foreground"
        onClick={() => setEditing(true)}
      >
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
    <input
      autoFocus
      aria-label="New folder name"
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
      className={cn(NAME_FIELD, 'h-8 w-40 shrink-0')}
    />
  );
}

/** One entry in the Places card: the main menu's row, with its sliding pill and accent bar. */
function PlaceRow({
  label,
  icon,
  active,
  mono = false,
  pillTransition,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  mono?: boolean;
  pillTransition: React.ComponentProps<typeof motion.span>['transition'];
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-current={active ? 'location' : undefined}
      onClick={onClick}
      className={cn(
        // `isolate` keeps the pill behind the row's text without lifting every child.
        'relative isolate flex h-8 w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'font-medium text-primary'
          : 'text-foreground/85 hover:bg-foreground/[0.06] hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId="remote-files-place-active"
          transition={pillTransition}
          className="absolute inset-0 -z-10 rounded-lg bg-primary/12"
        >
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        </motion.span>
      )}
      {icon}
      <span className={cn('min-w-0 flex-1 truncate', mono && 'font-mono text-xs')}>{label}</span>
    </button>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading the folder" className="flex flex-col gap-1 py-1">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex h-10 items-center gap-3 px-2.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${70 - index * 7}%` }} />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function RemoteFileManagerPage(): React.JSX.Element {
  const routerNavigate = useNavigate();
  const connection = useRemoteStore((s) => s.state?.connection);
  const transfers = useRemoteStore((s) => s.transfers);
  const { path, entries, roots, loading, error, loadRoots, navigate, upload } =
    useRemoteFileManagerStore();
  const [placesWidth, setPlacesWidth] = usePaneWidth('remoteFilesPlaces');
  const reduceMotion = useReducedMotion();
  const pillTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="glass flex w-full max-w-md flex-col items-center gap-4 rounded-[calc(var(--radius)+2px)] px-8 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]">
            <HardDrive className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight">No remote machine</h2>
            <p className="text-sm text-muted-foreground">
              Not connected. Go to Remote → Connect and use “Browse files” on a saved server, or
              connect with a pairing code first.
            </p>
          </div>
          <Button className="rounded-full px-5" onClick={() => routerNavigate('/remote')}>
            <Link /> Open Remote
          </Button>
        </div>
      </div>
    );
  }

  const up = path ? parentOf(path) : null;
  const listed = path === null ? roots : entries;
  const activeRoot = rootOf(path, roots);

  return (
    // The page already sits in the content island, so Places and the folder are glass cards on
    // it with a small gap between them, the way the API Client lays out its sidebar.
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Places"
          // The cap keeps a wide saved width from squeezing the folder on a narrow window.
          style={{ width: placesWidth, maxWidth: '36%' }}
          className={cn(PANEL, 'shrink-0')}
        >
          <div className="flex h-11 shrink-0 items-center pl-3.5 pr-2">
            <h2 className={cn(SECTION_HEADING, 'min-w-0 flex-1 truncate')}>Places</h2>
          </div>
          <LayoutGroup id="remote-files-places">
            <nav
              aria-label="Places on the remote machine"
              className="rail-scroll flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pb-2"
            >
              <PlaceRow
                label={connection.remoteDeviceName ?? 'Remote machine'}
                icon={<Monitor className="h-3.5 w-3.5 shrink-0" />}
                active={path === null}
                pillTransition={pillTransition}
                onClick={() => void loadRoots()}
              />
              {roots.map((root) => (
                <PlaceRow
                  key={root.path}
                  label={root.name}
                  mono
                  icon={<HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  active={activeRoot === root.path}
                  pillTransition={pillTransition}
                  onClick={() => void navigate(root.path)}
                />
              ))}
            </nav>
          </LayoutGroup>
        </aside>
        <ResizeHandle
          orientation="vertical"
          label="Resize places"
          size={placesWidth}
          min={PANE_WIDTHS.remoteFilesPlaces.min}
          max={PANE_WIDTHS.remoteFilesPlaces.max}
          defaultSize={PANE_WIDTHS.remoteFilesPlaces.default}
          onSizeChange={setPlacesWidth}
          quiet
          className="w-2"
        />

        <section aria-label="Files" className={cn(PANEL, 'min-w-0 flex-1')}>
          {/* Up, refresh and where you are share one row, like the API Client's URL bar. */}
          <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
            {path !== null && (
              <SimpleTooltip label="Up one folder">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Up one folder"
                  className={ICON_BUTTON}
                  onClick={() => void (up ? navigate(up) : loadRoots())}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </SimpleTooltip>
            )}
            <SimpleTooltip label="Refresh">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Refresh"
                className={ICON_BUTTON}
                onClick={() => void (path === null ? loadRoots() : navigate(path))}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </SimpleTooltip>
            <div className="search-pill flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full px-3">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span
                className={cn(
                  'min-w-0 truncate text-[13px]',
                  path === null ? 'text-foreground/85' : 'font-mono',
                )}
              >
                {path ?? 'This computer'}
              </span>
            </div>
            {path !== null && <NewFolderRow />}
            {path !== null && (
              <Button
                size="sm"
                className="h-8 shrink-0 rounded-full px-3.5"
                onClick={() => void upload()}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            )}
          </div>

          <div className="rail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
            {error && (
              <div
                role="alert"
                className="mx-0.5 mt-2 flex items-center gap-2 rounded-xl bg-destructive/[0.06] px-3 py-2 text-xs text-destructive ring-1 ring-inset ring-destructive/25"
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}
            {listed.length > 0 && (
              <div className="flex items-center gap-3 px-2.5 pb-1 pt-2.5">
                <span className={cn(SECTION_HEADING, 'flex-1 pl-7')}>Name</span>
                <span className={cn(SECTION_HEADING, 'w-20 text-right')}>Size</span>
                {/* Keeps the column over the sizes, past the room the row actions take. */}
                <span aria-hidden className="w-[6.25rem] shrink-0" />
              </div>
            )}
            {listed.length === 0 && loading ? (
              <ListSkeleton />
            ) : listed.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">This folder is empty.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-px">
                {listed.map((entry) => (
                  <EntryRow key={entry.path} entry={entry} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {transfers.length > 0 && (
        <TransfersCard
          title="Transfers"
          transfers={transfers}
          showParts
          className="max-h-[35%] shrink-0"
        />
      )}
    </div>
  );
}
