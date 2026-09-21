import { baseName, type GitChangeStatus, type Project } from '@agentmat/core';
import { isImagePath } from '@shared/imageFiles';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { File, FolderTree, ImageIcon, Search, X } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { changeStatusMeta } from '@/lib/git';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { patchExplorer } from '@/stores/explorerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { revealInTree } from './actions';
import { type FileHit, loweredPaths, searchFiles, toAbsolutePath } from './fileSearch';

const NO_FILES: string[] = [];
/** Roughly what the folder line fits in the panel at its usual width. */
const MAX_DIR_CHARS = 38;

/**
 * Where to start showing a folder path. The telling part of a deep path is its end, so a long
 * one is cut back to a whole segment, never past a letter that matched.
 */
function dirStart(dir: string, ranges: [number, number][]): number {
  if (dir.length <= MAX_DIR_CHARS) return 0;
  const firstMark = ranges.find(([start]) => start < dir.length)?.[0] ?? dir.length;
  let start = 0;
  for (let slash = dir.indexOf('/'); slash !== -1; slash = dir.indexOf('/', slash + 1)) {
    if (dir.length - slash - 1 <= MAX_DIR_CHARS) {
      start = slash + 1;
      break;
    }
  }
  return Math.min(start, firstMark);
}

/** Text with its matched stretches picked out. `offset` is where `text` starts in the path. */
function Highlighted({
  text,
  offset,
  ranges,
}: {
  text: string;
  offset: number;
  ranges: [number, number][];
}): React.JSX.Element {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    const from = Math.max(start - offset, 0);
    const to = Math.min(end - offset, text.length);
    if (to <= from || to <= at) continue;
    if (from > at) parts.push(text.slice(at, from));
    parts.push(
      <mark key={from} className="rounded-[2px] bg-primary/25 text-foreground">
        {text.slice(from, to)}
      </mark>,
    );
    at = to;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** Keeps the row the keyboard is on in view, as a ref so no effect has to chase it. */
function keepInView(row: HTMLDivElement | null): void {
  row?.scrollIntoView({ block: 'nearest' });
}

function ResultRow({
  hit,
  path,
  status,
  active,
  current,
  id,
  onOpen,
  onReveal,
  onHover,
}: {
  hit: FileHit;
  /** The file's full path on disk. */
  path: string;
  status: GitChangeStatus | undefined;
  /** The row the keyboard is on. */
  active: boolean;
  /** The file showing in the focused pane. */
  current: boolean;
  id: string;
  onOpen: (pin: boolean) => void;
  onReveal: () => void;
  onHover: () => void;
}): React.JSX.Element {
  const meta = status ? changeStatusMeta(status) : null;
  const dir = hit.path.slice(0, Math.max(hit.nameStart - 1, 0));
  const name = hit.path.slice(hit.nameStart);
  const from = dirStart(dir, hit.ranges);
  return (
    <SimpleTooltip label={hit.path} side="left" delayDuration={600}>
      <div
        ref={active ? keepInView : null}
        id={id}
        role="option"
        aria-selected={active}
        onMouseMove={onHover}
        onClick={() => onOpen(false)}
        onDoubleClick={() => onOpen(true)}
        className={cn(
          'group mx-1 flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px]',
          active
            ? 'bg-primary/15'
            : current
              ? 'bg-foreground/[0.06] hover:bg-foreground/[0.08]'
              : 'hover:bg-foreground/[0.05]',
        )}
      >
        {isImagePath(hit.path) ? (
          <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className={cn('block truncate', meta?.className, status === 'D' && 'line-through')}>
            <Highlighted text={name} offset={hit.nameStart} ranges={hit.ranges} />
          </span>
          {dir ? (
            <span className="block truncate text-[10px] text-muted-foreground">
              {from > 0 ? '…/' : null}
              <Highlighted text={dir.slice(from)} offset={from} ranges={hit.ranges} />
            </span>
          ) : null}
        </span>
        <SimpleTooltip label="Show in tree" side="left">
          <button
            type="button"
            aria-label={`Show ${baseName(path)} in tree`}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onReveal();
            }}
            className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground group-hover:flex"
          >
            <FolderTree className="h-2.5 w-2.5" />
          </button>
        </SimpleTooltip>
        {meta ? (
          <span
            className={cn(
              'shrink-0 font-mono text-[10px] font-semibold group-hover:hidden',
              meta.className,
            )}
          >
            {meta.letter}
          </span>
        ) : null}
      </div>
    </SimpleTooltip>
  );
}

/**
 * The explorer's search box and its results: one flat, ranked list of the project's files,
 * matched on the name first and then on the rest of the path. The file list is fetched once
 * and every keystroke is matched against it in memory, so typing never waits on disk.
 */
export function ExplorerSearch({
  project,
  query,
  statusByPath,
  projectPrefix,
  activePath,
  onClose,
}: {
  project: Project;
  query: string;
  /** Git status by repository-relative path. */
  statusByPath: Map<string, GitChangeStatus>;
  /** Where the project sits inside the repository, to turn a result into a status path. */
  projectPrefix: string;
  activePath: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const openFile = useWorkspaceStore((s) => s.openFile);

  const index = useQuery({
    queryKey: queryKeys.workspaceExplorerFiles(project.id),
    queryFn: () => window.agentmat.explorer.listFiles(project.id),
    meta: { silentLoading: true },
    staleTime: 30_000,
  });
  const files = index.data?.files ?? NO_FILES;
  const lowered = useMemo(() => loweredPaths(files), [files]);

  // Typing stays responsive on a big project: React keeps the old list on screen while the
  // new one is matched, and the box below dims until it catches up.
  const settled = useDeferredValue(query);
  const results = useMemo(
    () => searchFiles(files, settled, { lowered }),
    [files, lowered, settled],
  );
  const hits = results.hits;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new query starts at the top.
  useEffect(() => {
    setActive(0);
  }, [settled]);

  const optionId = (position: number): string => `explorer-search-${project.id}-${position}`;
  const current = Math.min(active, Math.max(hits.length - 1, 0));

  function fullPath(hit: FileHit): string {
    return toAbsolutePath(index.data?.root ?? project.folderPath, hit.path);
  }

  function open(hit: FileHit | undefined, pin: boolean): void {
    if (!hit) return;
    openFile(project.id, fullPath(hit), { pin });
  }

  function reveal(hit: FileHit): void {
    const path = fullPath(hit);
    onClose();
    revealInTree(project, path);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step !== 0 && hits.length > 0) {
      event.preventDefault();
      setActive((at) => (Math.min(at, hits.length - 1) + step + hits.length) % hits.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      open(hits[current], true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      // Escape clears what was typed first, so a second press is what closes the box.
      if (query) patchExplorer(project.id, { search: '' });
      else onClose();
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-2.5 w-2.5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={`explorer-search-list-${project.id}`}
            aria-activedescendant={hits.length > 0 ? optionId(current) : undefined}
            aria-label="Search files by name"
            placeholder="Search files by name"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(event) => patchExplorer(project.id, { search: event.target.value })}
            onKeyDown={onKeyDown}
            className="h-6 w-full rounded-md border border-border/60 bg-background/60 pl-6 pr-14 text-[12px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          {query ? (
            <span className="pointer-events-none absolute right-6 text-[10px] tabular-nums text-muted-foreground">
              {results.total > 999 ? '999+' : results.total}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="absolute right-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      {query ? (
        <div
          id={`explorer-search-list-${project.id}`}
          role="listbox"
          aria-label="Matching files"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto pb-1 transition-opacity',
            query !== settled && 'opacity-60',
          )}
        >
          {index.isPending ? (
            <div className="space-y-1.5 px-3 py-2">
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-3 w-full rounded" />
              ))}
            </div>
          ) : index.isError ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              Could not read this project's files.
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              No file matches “{query.trim()}”.
            </p>
          ) : (
            hits.map((hit, position) => {
              const path = fullPath(hit);
              return (
                <ResultRow
                  key={hit.path}
                  id={optionId(position)}
                  hit={hit}
                  path={path}
                  status={statusByPath.get(
                    projectPrefix ? `${projectPrefix}/${hit.path}` : hit.path,
                  )}
                  active={position === current}
                  current={activePath === path}
                  onOpen={(pin) => {
                    setActive(position);
                    open(hit, pin);
                  }}
                  onReveal={() => reveal(hit)}
                  onHover={() => setActive(position)}
                />
              );
            })
          )}
          {hits.length < results.total ? (
            <p className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
              Showing the best {hits.length} of {results.total} matches.
            </p>
          ) : null}
          {index.data?.truncated ? (
            <p className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
              This project has more files than the search can hold, so a match may be missing.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
