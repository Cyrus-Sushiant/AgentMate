import type {
  FirewallChange,
  FirewallRuleInfo,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { describeChange } from '@/lib/deploy/firewall/format';

/**
 * What is about to change, one line each, until it is reviewed and applied as one change set.
 * Nothing here has reached the server yet.
 */

export function StagedChanges({
  changes,
  rules,
  onDrop,
  onDiscard,
  onReview,
}: {
  changes: FirewallChange[];
  rules: FirewallRuleInfo[];
  onDrop: (index: number) => void;
  onDiscard: () => void;
  onReview: () => void;
}): React.JSX.Element | null {
  if (changes.length === 0) return null;
  return (
    <section
      aria-label="Staged changes"
      className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {changes.length === 1 ? '1 change staged' : `${changes.length} changes staged`}, not
          applied yet
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onReview}>
            Review and apply
          </Button>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {changes.map((change, index) => {
          const words = describeChange(change, rules);
          return (
            // Staged changes have no id of their own, and order matters to the core.
            <li key={index} className="flex items-center gap-2 text-sm text-foreground">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{words}</span>
              <SimpleTooltip label="Take this change out">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label={`Take out: ${words}`}
                  onClick={() => onDrop(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </SimpleTooltip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
