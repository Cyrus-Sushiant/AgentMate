import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CliLogo } from '@/components/cliLogos';
import { ArrowDown, ArrowUp, GripVertical, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { orderedClis } from '@/components/workspace/useAgentChoices';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useCliStore } from '@/stores/cliStore';

/**
 * The order agents are offered in when launching one: the Workspace "+" menu, the tiles of an
 * empty pane, and the digit keys that pick them. Drag a row, or use the arrows.
 */
export function CliOrderSettings(): React.JSX.Element {
  const cliOrder = useCliStore((s) => s.cliOrder);
  const setCliOrder = useCliStore((s) => s.setCliOrder);
  const status = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
    staleTime: 5 * 60_000,
  });
  const installed = new Set((status.data ?? []).filter((c) => c.installed).map((c) => c.id));
  const clis = orderedClis(cliOrder);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function move(id: string, to: number): void {
    const ids = clis.map((cli) => cli.id);
    const from = ids.indexOf(id);
    if (from === -1) return;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
    setCliOrder(ids);
  }

  // Digit hints count installed agents only, since those are the ones a launcher lists.
  let installedPosition = 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Installed agents get number keys 1 to 9 in this order.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={cliOrder.length === 0}
          onClick={() => setCliOrder([])}
        >
          <RefreshCw /> Default order
        </Button>
      </div>
      <ol
        className="overflow-hidden rounded-lg border border-border/70"
        onDragOver={(event) => {
          if (!dragging) return;
          event.preventDefault();
          const rows = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('[data-cli-row]'),
          );
          const index = rows.findIndex((row) => {
            const rect = row.getBoundingClientRect();
            return event.clientY < rect.top + rect.height / 2;
          });
          setDropIndex(index === -1 ? rows.length : index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (dragging && dropIndex !== null) {
            const from = clis.findIndex((cli) => cli.id === dragging);
            move(dragging, from < dropIndex ? dropIndex - 1 : dropIndex);
          }
          setDragging(null);
          setDropIndex(null);
        }}
      >
        {clis.map((cli, index) => {
          const isInstalled = installed.has(cli.id);
          const digit = isInstalled ? ++installedPosition : null;
          return (
            <li
              key={cli.id}
              data-cli-row
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                setDragging(cli.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropIndex(null);
              }}
              className={cn(
                'relative flex h-10 cursor-grab items-center gap-3 border-b border-border/50 bg-background/40 px-3 last:border-b-0 active:cursor-grabbing',
                dragging === cli.id && 'opacity-40',
              )}
            >
              {dropIndex === index && dragging ? (
                <span className="absolute inset-x-2 -top-px h-0.5 rounded-full bg-primary" />
              ) : null}
              <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <CliLogo cliId={cli.id} className="h-4 w-4" />
              <span
                className={cn('flex-1 truncate text-sm', !isInstalled && 'text-muted-foreground')}
              >
                {cli.name}
              </span>
              {isInstalled ? (
                digit !== null && digit <= 9 ? (
                  <kbd className="rounded border border-border/80 px-1.5 font-mono text-[10px] text-muted-foreground">
                    {digit}
                  </kbd>
                ) : null
              ) : (
                <span className="text-[11px] text-muted-foreground/70">Not installed</span>
              )}
              <span className="flex items-center gap-0.5">
                <SimpleTooltip label="Move up">
                  <button
                    type="button"
                    aria-label={`Move ${cli.name} up`}
                    disabled={index === 0}
                    onClick={() => move(cli.id, index - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp className="h-2.5 w-2.5" />
                  </button>
                </SimpleTooltip>
                <SimpleTooltip label="Move down">
                  <button
                    type="button"
                    aria-label={`Move ${cli.name} down`}
                    disabled={index === clis.length - 1}
                    onClick={() => move(cli.id, index + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown className="h-2.5 w-2.5" />
                  </button>
                </SimpleTooltip>
              </span>
            </li>
          );
        })}
      </ol>
      {dropIndex === clis.length && dragging ? (
        <span className="block h-0.5 rounded-full bg-primary" />
      ) : null}
    </div>
  );
}
