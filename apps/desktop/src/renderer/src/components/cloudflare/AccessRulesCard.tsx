import { accessRuleTarget } from '@shared/cloudflare/rules';
import type {
  CloudflareAccessMode,
  CloudflareAccessRule,
  CloudflareZone,
} from '@shared/cloudflareTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Plus, Spinner, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cloudflareFailureText, useCloudflareError } from '@/lib/cloudflare/feedback';
import { ACCESS_MODES, accessModeLabel, accessTargetLabel } from '@/lib/cloudflare/labels';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { Field, NativeSelect, Problem } from './fields';

function article(word: string): string {
  return /^[AEIOU]/.test(word) ? 'an' : 'a';
}

/**
 * IP access rules (T4): block, challenge or allow one address, a range, a country or a network
 * (ASN) for the whole zone. What the value is read as shows while typing.
 */
export function AccessRulesCard({ zone }: { zone: CloudflareZone }): React.JSX.Element {
  const queryClient = useQueryClient();
  const id = useId();
  const key = queryKeys.cloudflareAccessRules(zone.id);
  const rules = useQuery({
    queryKey: key,
    queryFn: () => window.agentmat.cloudflare.listAccessRules(zone.id),
  });
  const loadError = useCloudflareError(rules.error);
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<CloudflareAccessMode>('block');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const target = value.trim() ? accessRuleTarget(value) : null;

  async function add(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!target?.ok) return;
    setBusy(true);
    try {
      const created = await window.agentmat.cloudflare.createAccessRule(zone.id, {
        mode,
        value: value.trim(),
        notes: notes.trim(),
      });
      const label = accessModeLabel(mode);
      toast.success(`Added ${article(label)} ${label} rule for ${created.value}.`);
      setValue('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: CloudflareAccessRule): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete the rule for ${rule.value}?`,
      description: 'Requests from it are treated like any other again.',
      confirmLabel: 'Delete rule',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.cloudflare.deleteAccessRule(zone.id, rule.id);
      toast.success(`Deleted the rule for ${rule.value}.`);
      void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    }
  }

  let list: React.ReactNode;
  if (rules.isPending) {
    list = (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    );
  } else if (rules.isError) {
    list = <Problem message={loadError ?? ''} onRetry={() => void rules.refetch()} />;
  } else if (rules.data.length === 0) {
    list = <p className="text-sm text-muted-foreground">No IP access rules yet.</p>;
  } else {
    list = (
      <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
        {rules.data.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-xs">
              {accessModeLabel(rule.mode)}
            </span>
            <span className="text-xs text-muted-foreground">{accessTargetLabel(rule.target)}</span>
            <span className="font-mono text-xs text-foreground">{rule.value}</span>
            {rule.notes && (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {rule.notes}
              </span>
            )}
            <SimpleTooltip label="Delete rule">
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-8 w-8 text-destructive hover:text-destructive"
                aria-label={`Delete the rule for ${rule.value}`}
                onClick={() => void remove(rule)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-primary" /> IP access rules
        </CardTitle>
        <CardDescription>
          Block, challenge or allow an address, a range, a country or a network for all of{' '}
          {zone.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(event) => void add(event)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field
              label="Address, range, country or network"
              htmlFor={`${id}-value`}
              hint={target?.ok ? `Read as: ${accessTargetLabel(target.target)}` : undefined}
            >
              <Input
                id={`${id}-value`}
                value={value}
                placeholder="203.0.113.0/24, DE or AS13335"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
            <Field label="Action" htmlFor={`${id}-mode`}>
              <NativeSelect
                id={`${id}-mode`}
                value={mode}
                onChange={(event) => setMode(event.target.value as CloudflareAccessMode)}
              >
                {ACCESS_MODES.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {accessModeLabel(candidate)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Notes" htmlFor={`${id}-notes`}>
            <Input
              id={`${id}-notes`}
              value={notes}
              maxLength={500}
              placeholder="Why this rule exists"
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          {target && !target.ok && (
            <p role="alert" className="text-sm text-destructive">
              {target.problem}
            </p>
          )}
          <Button type="submit" size="sm" disabled={!target?.ok || busy}>
            {busy ? (
              <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}{' '}
            Add access rule
          </Button>
        </form>
        {list}
      </CardContent>
    </Card>
  );
}
