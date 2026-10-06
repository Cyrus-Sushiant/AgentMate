import { AskAiChat } from '@/components/askAi/AskAiChat';
import { Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAskAiStore } from '@/stores/askAiStore';
import { usePageHeader } from '@/stores/pageHeaderStore';

export default function AskAiPage(): React.JSX.Element {
  const messageCount = useAskAiStore((s) => s.messages.length);
  const clearMessages = useAskAiStore((s) => s.clearMessages);

  usePageHeader('Ask AI', 'Full conversation history, the same thread the Ask AI popup uses.');

  return (
    // One glass card filling the island, like the API Client's request area: a slim title bar,
    // the thread in a centred column and the composer pinned to the bottom.
    <div className="flex min-h-0 flex-1 overflow-hidden p-2">
      <section
        aria-label="Conversation"
        className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[calc(var(--radius)+2px)]"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 pl-4 pr-2 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
          <h2 className="select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
            Conversation
          </h2>
          {messageCount > 0 && (
            <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[10px] font-semibold leading-4 tabular-nums text-muted-foreground">
              {messageCount}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="search-pill ml-auto h-7 rounded-full px-3 text-foreground/85 hover:text-foreground"
            disabled={messageCount === 0}
            onClick={clearMessages}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
        </div>
        <AskAiChat variant="page" className="flex-1" />
      </section>
    </div>
  );
}
