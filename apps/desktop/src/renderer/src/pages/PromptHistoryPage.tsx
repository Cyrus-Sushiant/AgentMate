import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Languages, Search, Sparkles, Trash2 } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/queryKeys';

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
  });

  async function handleCopy(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard.');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Prompt History</h1>
        <p className="text-sm text-muted-foreground">
          Every prompt you've generated or translated, searchable.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search prompt history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {historyQuery.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? 'No matching prompts found.' : 'Nothing here yet — generate or translate a prompt to see it show up.'}
        </p>
      ) : (
        <div className="space-y-3">
          {historyQuery.data?.map((entry) => (
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
              <CardContent className="flex items-center gap-2">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
