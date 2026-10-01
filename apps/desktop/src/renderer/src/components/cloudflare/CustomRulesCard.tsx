import type { CloudflareCustomRule, CloudflareZone } from '@shared/cloudflareTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Shield, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cloudflareFailureText, useCloudflareError } from '@/lib/cloudflare/feedback';
import { ruleActionLabel } from '@/lib/cloudflare/labels';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { Problem } from './fields';
import { RuleBuilderDialog } from './RuleBuilderDialog';

function nameOf(rule: CloudflareCustomRule): string {
  return rule.description || 'this rule';
}

/**
 * The zone's WAF custom rules (T4), in the order Cloudflare runs them. Each can be switched off
 * without losing it; a delete asks first. New rules come from the builder.
 */
export function CustomRulesCard({ zone }: { zone: CloudflareZone }): React.JSX.Element {
  const queryClient = useQueryClient();
  const key = queryKeys.cloudflareCustomRules(zone.id);
  const rules = useQuery({
    queryKey: key,
    queryFn: () => window.agentmat.cloudflare.listCustomRules(zone.id),
  });
  const loadError = useCloudflareError(rules.error);
  const [building, setBuilding] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  async function setEnabled(rule: CloudflareCustomRule, enabled: boolean): Promise<void> {
    setChanging(rule.id);
    try {
      queryClient.setQueryData(
        key,
        await window.agentmat.cloudflare.setCustomRuleEnabled(zone.id, rule.id, enabled),
      );
      toast.success(`${rule.description || 'The rule'} is ${enabled ? 'on' : 'off'}.`);
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    } finally {
      setChanging(null);
    }
  }

  async function remove(rule: CloudflareCustomRule): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete the rule ${nameOf(rule)}?`,
      description:
        'Requests it matched go through as if it was never there. To pause it instead, switch it off.',
      confirmLabel: 'Delete rule',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      queryClient.setQueryData(
        key,
        await window.agentmat.cloudflare.deleteCustomRule(zone.id, rule.id),
      );
      toast.success(`Deleted the rule ${nameOf(rule)}.`);
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    }
  }

  let body: React.ReactNode;
  if (rules.isPending) {
    body = (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  } else if (rules.isError) {
    body = <Problem message={loadError ?? ''} onRetry={() => void rules.refetch()} />;
  } else if (rules.data.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        No custom rules yet. Add one to block countries, challenge a login page or let your office
        through.
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
        {rules.data.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {rule.description || 'No description'}
                </span>
                <span className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                  {ruleActionLabel(rule.action)}
                </span>
              </p>
              <SimpleTooltip label={rule.expression.length > 60 ? rule.expression : null}>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {rule.expression}
                </p>
              </SimpleTooltip>
            </div>
            <span className="flex items-center gap-2">
              <span className="w-6 text-xs text-muted-foreground">
                {rule.enabled ? 'On' : 'Off'}
              </span>
              <Switch
                checked={rule.enabled}
                disabled={changing === rule.id}
                aria-label={nameOf(rule)}
                onCheckedChange={(checked) => void setEnabled(rule, checked)}
              />
              <SimpleTooltip label="Delete rule">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={`Delete the rule ${nameOf(rule)}`}
                  onClick={() => void remove(rule)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </SimpleTooltip>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> WAF custom rules
          </CardTitle>
          <CardDescription>
            Cloudflare runs them top to bottom. An allow rule skips the ones below it.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setBuilding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add rule
        </Button>
      </CardHeader>
      <CardContent>{body}</CardContent>
      {building && <RuleBuilderDialog zone={zone} open onOpenChange={setBuilding} />}
    </Card>
  );
}
