import type { PromptHistoryEntry } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, History, Languages, Search, Sparkles, Trash2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/queryKeys';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';

/**
 * The prompt history scoped to one project, currently the translated bootstrap
 * descriptions. The global Prompt History page stays the place for everything
 * else; this is the per-project slice of the same store.
 */
export function ProjectPromptHistory({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.promptHistory.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.promptHistory });
    },
    onError: () => toast.error('Could not delete this entry.'),
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
    </div>
  );
}
