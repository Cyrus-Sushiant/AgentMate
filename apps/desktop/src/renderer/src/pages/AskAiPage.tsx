import { Trash2 } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AskAiChat } from '@/components/askAi/AskAiChat';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useAskAiStore } from '@/stores/askAiStore';

export default function AskAiPage(): React.JSX.Element {
  const hasMessages = useAskAiStore((s) => s.messages.length > 0);
  const clearMessages = useAskAiStore((s) => s.clearMessages);

  usePageHeader('Ask AI', 'Full conversation history — the same thread the Ask AI popup uses.');

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-6">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-5">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled={!hasMessages} onClick={clearMessages}>
              <Trash2 className="h-3.5 w-3.5" /> Clear history
            </Button>
          </div>
          <AskAiChat variant="page" className="flex-1" />
        </CardContent>
      </Card>
    </div>
  );
}
