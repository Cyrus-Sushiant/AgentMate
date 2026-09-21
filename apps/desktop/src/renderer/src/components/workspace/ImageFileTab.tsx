import type { Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatImageSize, type ImageSize, ImageView } from '@/components/editor/ImageView';
import { ExternalLink, FileText, ImageIcon, RefreshCw } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import type { WorkspaceFileTab } from '@/stores/workspaceStore';

/** An image file opened from the explorer or the changes panel, shown instead of its bytes. */
export function ImageFileTab({
  project,
  tab,
  onEditSource,
}: {
  project: Project;
  tab: WorkspaceFileTab;
  /** Set for an SVG, whose source is worth editing by hand. */
  onEditSource?: () => void;
}): React.JSX.Element {
  const image = useQuery({
    queryKey: queryKeys.workspaceImage(tab.path),
    queryFn: () => window.agentmat.fs.readImage(tab.path),
    meta: { silentLoading: true },
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [size, setSize] = useState<ImageSize | null>(null);

  const relative = tab.path.startsWith(project.folderPath)
    ? tab.path.slice(project.folderPath.length).replace(/^[\\/]/, '')
    : tab.path;
  const parts = relative.split(/[\\/]/);
  const name = parts.pop() ?? relative;
  const dir = parts.join('/');
  const caption = [formatImageSize(size), image.data ? formatBytes(image.data.bytes) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-[3rem] shrink truncate text-xs font-medium">{name}</span>
        {dir ? (
          <span className="min-w-0 shrink truncate text-[11px] text-muted-foreground [direction:rtl]">
            <bdi>{dir}</bdi>
          </span>
        ) : null}
        <span className="min-w-0 flex-1" />
        {caption ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{caption}</span>
        ) : null}
        {onEditSource ? (
          <SimpleTooltip label="Edit the source">
            <button
              type="button"
              aria-label="Edit the source"
              onClick={onEditSource}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            >
              <FileText className="h-2.5 w-2.5" />
            </button>
          </SimpleTooltip>
        ) : null}
        <SimpleTooltip label="Reload from disk">
          <button
            type="button"
            aria-label="Reload from disk"
            onClick={() => {
              setSize(null);
              void image.refetch();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', image.isFetching && 'animate-spin')} />
          </button>
        </SimpleTooltip>
        <SimpleTooltip label="Open in its default app">
          <button
            type="button"
            aria-label="Open in its default app"
            onClick={() => void window.agentmat.shell.openPath(tab.path)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        </SimpleTooltip>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {image.isPending ? (
          <div className="flex h-full items-center justify-center p-6">
            <Skeleton className="h-full w-full max-w-2xl rounded-lg" />
          </div>
        ) : image.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">This image could not be opened</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {image.error instanceof Error
                ? image.error.message
                : 'It may have been moved or deleted.'}
            </p>
          </div>
        ) : (
          <ImageView src={image.data.dataUrl} alt={name} onSize={setSize} />
        )}
      </div>
    </div>
  );
}
