import type { Project } from '@agentmat/core';
import type { ImageFileData } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatImageSize, type ImageSize, ImageView } from '@/components/editor/ImageView';
import { ImageIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { WorkspaceDiffTab } from '@/stores/workspaceStore';

function Notice({ title, detail }: { title: string; detail: string }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/** One version of the picture, under a label saying which side of the change it is. */
function Side({
  label,
  image,
  alt,
  missing,
}: {
  label: string;
  image: ImageFileData | null;
  alt: string;
  /** What to say when this side has no picture, as on a new or a deleted file. */
  missing: string;
}): React.JSX.Element {
  const [size, setSize] = useState<ImageSize | null>(null);
  const caption = [formatImageSize(size), image ? formatBytes(image.bytes) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex-1" />
        {caption ? (
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">{caption}</span>
        ) : null}
      </div>
      {image ? (
        <ImageView src={image.dataUrl} alt={alt} onSize={setSize} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-foreground">{missing}</p>
        </div>
      )}
    </div>
  );
}

/**
 * A changed image, side by side, where the text diff would be. Git only reports "binary" for a
 * picture, so this is the only way to see what actually changed without leaving the app.
 */
export function ImageDiffView({
  project,
  tab,
}: {
  project: Project;
  tab: WorkspaceDiffTab;
}): React.JSX.Element {
  const image = useQuery({
    queryKey: tab.commit
      ? queryKeys.gitFileImage(project.id, `commit:${tab.commit}`, tab.path)
      : queryKeys.gitFileImage(project.id, tab.side, tab.path),
    queryFn: () =>
      tab.commit
        ? window.agentmat.git.commitFileImage(project.id, tab.commit, tab.path, tab.origPath)
        : window.agentmat.git.fileImage(project.id, tab.path, tab.side, tab.origPath),
    staleTime: tab.commit ? Number.POSITIVE_INFINITY : undefined,
    meta: { silentLoading: true },
    // Keep the old picture up while a refreshed one loads, but never another file's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === tab.path ? previous : undefined,
  });
  const name = tab.path.split('/').pop() ?? tab.path;

  if (image.isPending) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Skeleton className="h-full w-full max-w-2xl rounded-lg" />
      </div>
    );
  }
  if (image.isError || !image.data) {
    return (
      <Notice
        title="This image could not be read"
        detail={
          image.error instanceof Error
            ? image.error.message
            : 'Git could not hand over one of the two versions.'
        }
      />
    );
  }
  if (image.data.tooLarge) {
    return (
      <Notice
        title="This image is too large to show here"
        detail="Open it in your image editor to see what changed."
      />
    );
  }
  const { original, modified } = image.data;
  if (!original && !modified) {
    return (
      <Notice
        title="There is nothing to show"
        detail="Neither side of this change holds a picture any more."
      />
    );
  }
  // A new or a deleted file has one side only, and gets the whole pane for it.
  if (!original || !modified) {
    return (
      <div className="flex h-full min-h-0">
        <Side
          label={original ? 'Deleted' : 'Added'}
          image={original ?? modified}
          alt={name}
          missing=""
        />
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 divide-x divide-border/60">
      <Side label="Before" image={original} alt={`${name} before the change`} missing="No file" />
      <Side label="After" image={modified} alt={`${name} after the change`} missing="No file" />
    </div>
  );
}
