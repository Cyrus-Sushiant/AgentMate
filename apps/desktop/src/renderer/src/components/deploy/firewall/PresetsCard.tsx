import type {
  FirewallPreset,
  FirewallRuleInfo,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { Check, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Ready-made rules: SSH on the ports sshd really uses, HTTP, HTTPS and the common databases.
 * A preset whose ports are already allowed from anywhere says so. A database preset opens the
 * rule form first, so it can be kept to a network rather than the whole internet.
 */

function covered(preset: FirewallPreset, rules: FirewallRuleInfo[]): boolean {
  return preset.rules.every((spec) =>
    rules.some(
      (rule) =>
        rule.action === spec.action &&
        !rule.source &&
        rule.port === spec.port &&
        (rule.portTo ?? rule.port) === (spec.portTo ?? spec.port) &&
        (rule.protocol === spec.protocol || rule.protocol === 'any'),
    ),
  );
}

export function PresetsCard({
  presets,
  rules,
  loading,
  canEdit,
  onPick,
}: {
  presets: FirewallPreset[] | undefined;
  rules: FirewallRuleInfo[];
  loading: boolean;
  canEdit: boolean;
  onPick: (preset: FirewallPreset) => void;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Presets</CardTitle>
        <CardDescription>Common rules, staged with one click.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !presets ? (
          <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(presets ?? []).map((preset) => {
              const already = covered(preset, rules);
              return (
                <li
                  key={preset.id}
                  aria-label={preset.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{preset.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  {already ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3 w-3" /> Open
                    </span>
                  ) : (
                    canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Stage the ${preset.name} preset`}
                        onClick={() => onPick(preset)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Stage
                      </Button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
