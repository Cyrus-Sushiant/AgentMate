import type { Project } from '@agentmat/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { languageFor } from '@/components/editor/MonacoDiffEditor';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { ExternalLink, File, RefreshCw, Save, Spinner } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WorkspaceFileTab } from '@/stores/workspaceStore';

/** Files past this open read-only: Monaco copes, but editing a multi-megabyte file here is a trap. */
const MAX_EDITABLE_CHARS = 2_000_000;

export function fileQueryKey(path: string): readonly unknown[] {
  return ['workspace-file', path];
}

/** A project file in an editor tab: Ctrl+S saves, and a clean file follows changes on disk. */
export default function FileTab({
  project,
  tab,
}: {
  project: Project;
  tab: WorkspaceFileTab;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const file = useQuery({
    queryKey: fileQueryKey(tab.path),
    queryFn: () => window.agentmat.fs.readFile(tab.path),
    meta: { silentLoading: true },
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dirty = draft !== null && draft !== file.data;
  const tooLarge = (file.data?.length ?? 0) > MAX_EDITABLE_CHARS;

  const relative = tab.path.startsWith(project.folderPath)
    ? tab.path.slice(project.folderPath.length).replace(/^[\\/]/, '')
    : tab.path;
  const parts = relative.split(/[\\/]/);
  const name = parts.pop() ?? relative;
  const dir = parts.join('/');

  async function save(): Promise<void> {
    if (!dirty || draft === null || saving) return;
    setSaving(true);
    try {
      await window.agentmat.fs.writeFile(tab.path, draft);
      queryClient.setQueryData(fileQueryKey(tab.path), draft);
      setDraft(null);
    } catch (error) {
      toast.error('Could not save the file', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  // Ctrl/Cmd+S saves while focus is anywhere in this tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: save reads the latest draft
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyS') {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    el.addEventListener('keydown', onKeyDown, true);
    return () => el.removeEventListener('keydown', onKeyDown, true);
  }, [draft, file.data, saving]);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-[3rem] shrink truncate text-xs font-medium">{name}</span>
        {dir ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground [direction:rtl]">
            <bdi>{dir}</bdi>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {dirty ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
          </span>
        ) : null}
        <SimpleTooltip label="Reload from disk">
          <button
            type="button"
            aria-label="Reload from disk"
            onClick={() => {
              setDraft(null);
              void file.refetch();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', file.isFetching && 'animate-spin')} />
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
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:bg-foreground/[0.08] disabled:text-muted-foreground"
        >
          {saving ? (
            <Spinner className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Save className="h-2.5 w-2.5" />
          )}
          Save
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {file.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-3.5 rounded"
                style={{ width: `${35 + ((i * 41) % 60)}%` }}
              />
            ))}
          </div>
        ) : file.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <File className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">This file could not be opened</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {file.error instanceof Error
                ? file.error.message
                : 'It may have been moved or deleted.'}
            </p>
          </div>
        ) : (
          <MonacoEditor
            value={draft ?? file.data ?? ''}
            onChange={(value) => setDraft(value)}
            language={languageFor(tab.path.replaceAll('\\', '/'))}
            readOnly={tooLarge}
            className="absolute inset-0 min-h-0 rounded-none border-0"
          />
        )}
      </div>
    </div>
  );
}
