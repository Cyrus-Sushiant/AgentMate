import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Copy, FileText, X } from '@/components/icons';
import { FilterChip, GLASS_CARD } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Within this many pixels of the bottom counts as "reading the latest", so new lines follow. */
const STICK_DISTANCE_PX = 24;

/**
 * The output of an install, for when a row says it failed and the reason is not enough. It
 * follows new lines while the person is at the bottom and stays put once they scroll up to read,
 * and it is a real `log` region so a screen reader can find it without being read every line.
 */
export function InstallLogDrawer({
  logs,
  nameOf,
  selected,
  onSelect,
  onClose,
}: {
  logs: Readonly<Record<string, readonly string[] | undefined>>;
  nameOf: (id: string) => string;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const lines = logs[selected] ?? [];
  const name = nameOf(selected);

  // The items worth switching between: those with something logged, and the one on show.
  const withLogs = Object.keys(logs).filter((id) => (logs[id]?.length ?? 0) > 0);
  const choices = [...new Set([...withLogs, selected])];

  const box = useRef<HTMLPreElement>(null);
  const following = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line or another item is the trigger; the effect itself reads neither
  useEffect(() => {
    const element = box.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [lines.length, selected]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(`Copied the log for ${name}.`);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  }

  return (
    <section aria-label="Install log" className={cn(GLASS_CARD, 'p-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText aria-hidden className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold leading-tight">Install log</h2>
        {choices.length > 1 && (
          <div role="group" aria-label="Show the log for" className="flex flex-wrap gap-1.5">
            {choices.map((id) => (
              <FilterChip key={id} active={id === selected} onClick={() => onSelect(id)}>
                {nameOf(id)}
              </FilterChip>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="soft"
            size="sm"
            disabled={lines.length === 0}
            onClick={() => void copy()}
          >
            <Copy /> Copy log
          </Button>
          <SimpleTooltip label="Close">
            <Button variant="ghost" size="icon-sm" aria-label="Close log" onClick={onClose}>
              <X />
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Nothing has been logged yet.</p>
      ) : (
        <pre
          ref={box}
          role="log"
          aria-label={`Log for ${name}`}
          aria-live="off"
          tabIndex={0}
          onScroll={(event) => {
            const element = event.currentTarget;
            following.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < STICK_DISTANCE_PX;
          }}
          className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed ring-1 ring-inset ring-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {lines.join('\n')}
        </pre>
      )}
    </section>
  );
}
