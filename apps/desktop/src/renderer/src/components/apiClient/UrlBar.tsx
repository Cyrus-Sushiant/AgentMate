import { HTTP_METHODS } from '@agentmat/core';
import { ChevronDown, Save, Send, StopCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { methodTone } from './format';

interface UrlBarProps {
  method: string;
  url: string;
  sending: boolean;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Method, URL, Send and Save: the row every request starts from. */
export function UrlBar({
  method,
  url,
  sending,
  onMethodChange,
  onUrlChange,
  onSend,
  onCancel,
  onSave,
}: UrlBarProps): React.JSX.Element {
  const canSend = url.trim().length > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 min-w-0 flex-1 items-stretch rounded-lg border border-input bg-background shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)] transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Method ${method}`}
              className={cn(
                'flex w-[6.5rem] shrink-0 items-center justify-between gap-1 rounded-l-lg border-r border-border px-3 font-mono text-xs font-bold tracking-wide transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                methodTone(method),
              )}
            >
              {method}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[8rem]">
            {HTTP_METHODS.map((m) => (
              <DropdownMenuItem
                key={m}
                onSelect={() => onMethodChange(m)}
                className={cn('font-mono text-xs font-bold', methodTone(m))}
              >
                {m}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          aria-label="Request URL"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSend && !sending) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Enter a URL, like https://api.example.com/users or {{baseUrl}}/users"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
        />
      </div>

      {sending ? (
        <Button variant="secondary" className="h-10 w-[6.5rem]" onClick={onCancel}>
          <StopCircle /> Cancel
        </Button>
      ) : (
        <SimpleTooltip label="Send (Ctrl+Enter)" wrapTrigger={!canSend}>
          <Button className="h-10 w-[6.5rem]" disabled={!canSend} onClick={onSend}>
            <Send /> Send
          </Button>
        </SimpleTooltip>
      )}

      <SimpleTooltip label="Save (Ctrl+S)">
        <Button variant="outline" className="h-10" onClick={onSave}>
          <Save /> Save
        </Button>
      </SimpleTooltip>
    </div>
  );
}
