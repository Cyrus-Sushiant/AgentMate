import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, History, Languages, Search, Sparkles, Tag, Trash2, X } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import type { PromptHistoryEntry } from '../../../shared/apiTypes';

function TagEditor({ entry }: { entry: PromptHistoryEntry }): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const queryClient = useQueryClient();

  const setTagsMutation = useMutation({
    mutationFn: (tags: string[]) => window.agentmat.promptHistory.setTags(entry.id, tags),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-history'] });
    },
    onError: () => toast.error('Could not update tags.'),
  });

  function commitTag(): void {
    const value = draft.trim();
    setDraft('');
    setAdding(false);
    if (!value || entry.tags.includes(value)) return;
    setTagsMutation.mutate([...entry.tags, value]);
  }

  function removeTag(tag: string): void {
    setTagsMutation.mutate(entry.tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.tags.map((tag) => (
        <Badge key={tag} variant="outline" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <Input
          autoFocus
          className="h-6 w-28 px-2 text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTag();
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          onBlur={commitTag}
          placeholder="Tag name…"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <Tag className="h-3 w-3" /> Add tag
        </Button>
      )}
    </div>
  );
}

export default function PromptHistoryPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: search.trim() ? queryKeys.promptHistorySearch(search.trim()) : queryKeys.promptHistory,
    queryFn: () =>
      search.trim() ? window.agentmat.promptHistory.search(search.trim()) : window.agentmat.promptHistory.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.agentmat.promptHistory.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-history'] });
    },
    onError: () => toast.error('Could not delete this entry.'),
  });

  async function handleCopy(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard.');
  }

  usePageHeader('Prompt History', "Every prompt you've generated or translated, searchable.");

  const entries = historyQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search prompt history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {historyQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading prompt history…</p>
      ) : historyQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 py-16 text-center">
          <p className="text-sm font-medium">Couldn't load prompt history.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {historyQuery.error instanceof Error ? historyQuery.error.message : 'An unexpected error occurred.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => void historyQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {search.trim() ? 'No matching prompts found.' : 'Nothing here yet'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search.trim()
                ? `No prompts match "${search.trim()}".`
                : 'Generate or translate a prompt in Prompt Builder and it will show up here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CardTitle className="text-sm">{entry.promptType}</CardTitle>
                    <Badge variant="outline">{entry.targetAI}</Badge>
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
                <CardDescription className="line-clamp-3 whitespace-pre-wrap">
                  {entry.content}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <TagEditor entry={entry} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleCopy(entry.content)}>
                    <Copy /> Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(entry.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
