import type { ApiTreeNode } from '@agentmat/core';
import type { ApiCollectionSummary } from '@shared/apiClientTypes';
import { useMemo, useState } from 'react';
import {
  ChevronRight,
  EllipsisVertical,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { methodLabel, methodTone } from './format';

interface CollectionsSidebarProps {
  collections: ApiCollectionSummary[];
  loading: boolean;
  activeItem: { collectionId: string; itemId: string } | null;
  onOpenRequest: (collectionId: string, itemId: string) => void;
  onNewCollection: () => void;
  onNewRequest: (collectionId: string, parentId: string | null) => void;
  onNewFolder: (collectionId: string, parentId: string | null) => void;
  onRenameCollection: (collection: ApiCollectionSummary) => void;
  onDeleteCollection: (collection: ApiCollectionSummary) => void;
  onDeleteItem: (collectionId: string, node: ApiTreeNode) => void;
}

/** Keeps matching nodes and the folders that lead to them. */
function filterTree(nodes: ApiTreeNode[], query: string): ApiTreeNode[] {
  const out: ApiTreeNode[] = [];
  for (const node of nodes) {
    const selfMatch = node.name.toLowerCase().includes(query);
    if (node.kind === 'folder') {
      const children = selfMatch ? (node.children ?? []) : filterTree(node.children ?? [], query);
      if (selfMatch || children.length > 0) out.push({ ...node, children });
    } else if (selfMatch) {
      out.push(node);
    }
  }
  return out;
}

const INDENT_REM = 0.85;

export function CollectionsSidebar(props: CollectionsSidebarProps): React.JSX.Element {
  const { collections, loading, onNewCollection } = props;
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return collections.map((c) => ({ collection: c, tree: c.tree }));
    return collections.flatMap((c) => {
      const tree = c.name.toLowerCase().includes(needle) ? c.tree : filterTree(c.tree, needle);
      return tree.length > 0 || c.name.toLowerCase().includes(needle)
        ? [{ collection: c, tree }]
        : [];
    });
  }, [collections, needle]);

  function toggle(key: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // While filtering, everything that is shown is open, so matches are never hidden in a fold.
  const isOpen = (key: string): boolean => needle.length > 0 || expanded.has(key);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 p-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Filter collections"
            placeholder="Filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <SimpleTooltip label="New collection">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="New collection"
            onClick={onNewCollection}
          >
            <Plus />
          </Button>
        </SimpleTooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {loading ? (
          <div role="status" aria-label="Loading collections" className="space-y-2 p-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderTree className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No collections yet</p>
              <p className="text-xs text-muted-foreground">
                Collections keep your saved requests together, organised in folders.
              </p>
            </div>
            <Button size="sm" onClick={onNewCollection}>
              <Plus /> Create a collection
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : (
          <div role="tree" aria-label="Collections">
            {visible.map(({ collection, tree }) => (
              <CollectionRow
                key={collection.id}
                {...props}
                collection={collection}
                tree={tree}
                isOpen={isOpen}
                toggle={toggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RowContext extends CollectionsSidebarProps {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
}

function CollectionRow({
  collection,
  tree,
  ...ctx
}: RowContext & { collection: ApiCollectionSummary; tree: ApiTreeNode[] }): React.JSX.Element {
  const open = ctx.isOpen(collection.id);
  const broken = collection.error !== null;

  return (
    <div>
      <TreeRow
        depth={0}
        label={collection.name}
        expanded={broken ? undefined : open}
        broken={broken}
        onActivate={() => !broken && ctx.toggle(collection.id)}
        icon={
          broken ? (
            <SimpleTooltip label={collection.error}>
              <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
            </SimpleTooltip>
          ) : (
            <FolderTree className="h-3.5 w-3.5 text-primary" />
          )
        }
        trailing={
          <span className="text-[10px] tabular-nums text-muted-foreground/80 group-hover:hidden">
            {collection.requestCount}
          </span>
        }
        menu={
          <>
            {!broken && (
              <>
                <DropdownMenuItem onSelect={() => ctx.onNewRequest(collection.id, null)}>
                  <FilePlus className="h-3.5 w-3.5" /> Add request
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ctx.onNewFolder(collection.id, null)}>
                  <FolderPlus className="h-3.5 w-3.5" /> Add folder
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ctx.onRenameCollection(collection)}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onSelect={() => ctx.onDeleteCollection(collection)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </>
        }
      />
      {open && !broken && (
        <div role="group">
          {tree.length === 0 ? (
            <p className="py-1.5 pl-9 text-xs text-muted-foreground">
              Empty.{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => ctx.onNewRequest(collection.id, null)}
              >
                Add a request
              </button>
            </p>
          ) : (
            tree.map((node) => (
              <NodeRow key={node.id} {...ctx} collectionId={collection.id} node={node} depth={1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NodeRow({
  collectionId,
  node,
  depth,
  ...ctx
}: RowContext & { collectionId: string; node: ApiTreeNode; depth: number }): React.JSX.Element {
  const key = `${collectionId}/${node.id}`;

  if (node.kind === 'request') {
    const active =
      ctx.activeItem?.collectionId === collectionId && ctx.activeItem.itemId === node.id;
    return (
      <TreeRow
        depth={depth}
        label={node.name}
        ariaLabel={`${methodLabel(node.method ?? 'GET')} ${node.name}`}
        selected={active}
        onActivate={() => ctx.onOpenRequest(collectionId, node.id)}
        icon={
          <span
            className={cn(
              'w-9 shrink-0 text-right font-mono text-[10px] font-bold',
              methodTone(node.method ?? 'GET'),
            )}
          >
            {methodLabel(node.method ?? 'GET')}
          </span>
        }
        menu={
          <DropdownMenuItem
            onSelect={() => ctx.onDeleteItem(collectionId, node)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        }
      />
    );
  }

  const open = ctx.isOpen(key);
  return (
    <div>
      <TreeRow
        depth={depth}
        label={node.name}
        expanded={open}
        onActivate={() => ctx.toggle(key)}
        icon={
          open ? (
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          )
        }
        menu={
          <>
            <DropdownMenuItem onSelect={() => ctx.onNewRequest(collectionId, node.id)}>
              <FilePlus className="h-3.5 w-3.5" /> Add request
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ctx.onNewFolder(collectionId, node.id)}>
              <FolderPlus className="h-3.5 w-3.5" /> Add folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => ctx.onDeleteItem(collectionId, node)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </>
        }
      />
      {open && (
        <div role="group">
          {(node.children ?? []).map((child) => (
            <NodeRow
              key={child.id}
              {...ctx}
              collectionId={collectionId}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreeRowProps {
  depth: number;
  label: string;
  /** What screen readers announce, when it should say more than the label. */
  ariaLabel?: string;
  icon: React.ReactNode;
  /** undefined for leaves, which get no chevron. */
  expanded?: boolean;
  selected?: boolean;
  broken?: boolean;
  trailing?: React.ReactNode;
  menu: React.ReactNode;
  onActivate: () => void;
}

function TreeRow({
  depth,
  label,
  ariaLabel,
  icon,
  expanded,
  selected = false,
  broken = false,
  trailing,
  menu,
  onActivate,
}: TreeRowProps): React.JSX.Element {
  return (
    <div
      role="treeitem"
      aria-label={ariaLabel ?? label}
      tabIndex={0}
      aria-expanded={expanded}
      aria-selected={selected}
      data-broken={broken || undefined}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      style={{ paddingLeft: `${0.35 + depth * INDENT_REM}rem` }}
      className={cn(
        'group relative flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-md pr-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'bg-primary/12 text-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
          : 'text-foreground/85 hover:bg-accent/60',
        broken && 'text-muted-foreground',
      )}
    >
      <span className="flex w-3 shrink-0 justify-center text-muted-foreground">
        {expanded !== undefined && (
          <ChevronRight
            className={cn('h-2.5 w-2.5 transition-transform', expanded && 'rotate-90')}
          />
        )}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${label}`}
            onClick={(event) => event.stopPropagation()}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <EllipsisVertical className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
