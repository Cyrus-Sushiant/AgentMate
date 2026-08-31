import type { Project } from '@agentmat/core';
import type { PromptHistoryEntry } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Copy, History, Languages, Search, Sparkles, Trash2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/queryKeys';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { ProjectIcon } from './ProjectIcon';

/**
 * The prompt history scoped to one project, currently the translated bootstrap
 * descriptions. The global Prompt History page stays the place for everything
 * else; this is the per-project slice of the same store.
 */
export function ProjectPromptHistory({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movingEntry, setMovingEntry] = useState<PromptHistoryEntry | null>(null);
  const [search, setSearch] = useState('');
  const trimmedSearch = search.trim();

  const historyQuery = useQuery({
    queryKey: trimmedSearch
      ? [...queryKeys.projectPromptHistory(projectId), trimmedSearch]
      : queryKeys.projectPromptHistory(projectId),
    queryFn: () =>
      trimmedSearch
        ? window.agentmat.promptHistory.search(trimmedSearch, projectId)
        : window.agentmat.promptHistory.list(projectId),
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  // Every project but this one: moving an entry where it already sits does nothing.
  const otherProjects = (projectsQuery.data ?? []).filter((p: Project) => p.id !== projectId);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.promptHistory.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.promptHistory });
    },
    onError: () => toast.error('Could not delete this entry.'),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, targetProjectId }: { id: string; targetProjectId: string }) =>
      window.agentmat.promptHistory.setProject(id, targetProjectId),
    onSuccess: (_result, { targetProjectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.promptHistory });
      setMovingEntry(null);
      const target = projectsQuery.data?.find((p) => p.id === targetProjectId);
      toast.success(target ? `Moved to ${target.name}.` : 'Moved to the other project.');
    },
    onError: () => toast.error('Could not move this entry.'),
  });

  async function handleCopy(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard.');
  }

  const entries = historyQuery.data ?? [];

  if (historyQuery.isPending && !trimmedSearch) {
    return <p className="text-sm text-muted-foreground">Loading prompt history…</p>;
  }

  if (historyQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load this project's prompt history: {(historyQuery.error as Error).message}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search original, translated, or generated text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {historyQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {trimmedSearch ? 'No matching prompts found.' : 'Nothing here yet'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {trimmedSearch
                ? `No prompts match "${trimmedSearch}".`
                : 'Prompts and translations tied to this project show up here, including the Persian description you translate when bootstrapping.'}
            </p>
          </div>
        </div>
      ) : (
        entries.map((entry: PromptHistoryEntry) => {
          const expanded = expandedId === entry.id;
          const contentPersian = persianTextProps(entry.content);
          const rawPersian = persianTextProps(entry.rawInput);
          return (
            <Card key={entry.id} className="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CardTitle className="text-sm">{entry.promptType || 'Translation'}</CardTitle>
                    {entry.targetAI ? <Badge variant="outline">{entry.targetAI}</Badge> : null}
                    <Badge variant="secondary">
                      {entry.source === 'translate' ? (
                        <>
                          <Languages className="h-3 w-3" /> Translated
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" /> Generated
                        </>
                      )}
                    </Badge>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <CardDescription
                  dir={contentPersian.dir}
                  className={cn(
                    expanded ? 'whitespace-pre-wrap' : 'line-clamp-2 whitespace-pre-wrap',
                    contentPersian.className,
                  )}
                >
                  {entry.content}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {expanded && entry.rawInput ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Original input</p>
                    <p
                      dir={rawPersian.dir}
                      className={cn(
                        'whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm',
                        rawPersian.className,
                      )}
                    >
                      {entry.rawInput}
                    </p>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    {expanded ? 'Hide details' : 'View details'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopy(entry.content)}
                  >
                    <Copy /> Copy
                  </Button>
                  {otherProjects.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => setMovingEntry(entry)}>
                      <ArrowRight /> Move
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void confirmDialog({
                        title: 'Delete this prompt history entry?',
                        description: 'This cannot be undone.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                      }).then((confirmed) => {
                        if (confirmed) deleteMutation.mutate(entry.id);
                      });
                    }}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <MoveEntryDialog
        key={movingEntry?.id ?? 'none'}
        entry={movingEntry}
        projects={otherProjects}
        pending={moveMutation.isPending}
        onClose={() => setMovingEntry(null)}
        onMove={(targetProjectId) => {
          if (movingEntry) moveMutation.mutate({ id: movingEntry.id, targetProjectId });
        }}
      />
    </div>
  );
}

/**
 * Picks the project an entry should be re-filed under. The caller keys this on
 * the entry id, so every open starts with an empty pick rather than inheriting
 * whatever was chosen for the previous entry.
 */
function MoveEntryDialog({
  entry,
  projects,
  pending,
  onClose,
  onMove,
}: {
  entry: PromptHistoryEntry | null;
  projects: Project[];
  pending: boolean;
  onClose: () => void;
  onMove: (targetProjectId: string) => void;
}): React.JSX.Element {
  const [selected, setSelected] = useState('');

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelected('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to another project</DialogTitle>
          <DialogDescription>
            The entry leaves this project's history and shows up under the one you pick. Nothing
            about the prompt itself changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Project</Label>
          <Combobox
            options={projects.map((p) => ({
              value: p.id,
              label: p.name,
              keywords: p.tags,
              icon: (
                <ProjectIcon
                  iconDataUrl={p.iconDataUrl}
                  bgColor={p.iconBgColor}
                  iconColor={p.iconColor}
                  className="h-5 w-5 rounded"
                  glyphClassName="h-3 w-3"
                />
              ),
            }))}
            value={selected}
            onChange={setSelected}
            placeholder="Pick a project…"
            searchPlaceholder="Search projects…"
            emptyText="No other projects."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!selected || pending} onClick={() => onMove(selected)}>
            {pending ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
