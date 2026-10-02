import type { FirewallRuleInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, CircleX, Lock, Pencil, Plus, Trash2, Undo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { ACTION_LABEL, PROTOCOL_LABEL, portsText, sourceText } from '@/lib/deploy/firewall/format';
import { cn } from '@/lib/utils';

/**
 * The rules as the backend has them, in order. Each action shows a mark and its word. Admins
 * edit and remove the rules the app can manage; others (added by hand, firewalld services the
 * app does not edit) say why they are read only. A rule staged for removal stays in the list,
 * struck through, until the change is applied or the removal is taken back.
 */

const FAMILY: Record<FirewallRuleInfo['families'], string> = {
  both: 'IPv4 and IPv6',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
};

function ActionMark({ action }: { action: FirewallRuleInfo['action'] }) {
  const allows = action === 'allow' || action === 'limit';
  const Icon = allows ? CircleCheck : CircleX;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', allows ? 'text-success' : 'text-destructive')} />
      {ACTION_LABEL[action]}
    </span>
  );
}

export function RulesCard({
  rules,
  loading,
  canEdit,
  removing,
  onAdd,
  onEdit,
  onRemove,
  onKeep,
}: {
  rules: FirewallRuleInfo[] | undefined;
  loading: boolean;
  /** Admins, while no change waits for its confirmation. */
  canEdit: boolean;
  /** Rule ids staged for removal (an edit removes the old rule too). */
  removing: ReadonlySet<string>;
  onAdd: () => void;
  onEdit: (rule: FirewallRuleInfo) => void;
  onRemove: (rule: FirewallRuleInfo) => void;
  onKeep: (rule: FirewallRuleInfo) => void;
}): React.JSX.Element {
  const incoming = (rules ?? []).filter((rule) => !rule.outgoing);
  const outgoing = (rules ?? []).filter((rule) => rule.outgoing);
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Rules</CardTitle>
          <CardDescription>The first rule that matches decides, top to bottom.</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add rule
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && !rules ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : incoming.length === 0 && outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules yet. Add one, or start from a preset below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Ports</th>
                  <th className="py-2 pr-3 font-medium">Protocol</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Comment</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Changes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...incoming, ...outgoing].map((rule) => {
                  const gone = removing.has(rule.id);
                  return (
                    <tr
                      key={rule.id}
                      aria-label={`Rule ${portsText(rule)} ${sourceText(rule)}`}
                      className={cn(
                        'border-b border-border/60 last:border-0',
                        gone && 'opacity-60',
                      )}
                    >
                      <td className={cn('py-2 pr-3', gone && 'line-through')}>
                        <ActionMark action={rule.action} />
                        {rule.outgoing && (
                          <span className="ml-1 text-xs text-muted-foreground">(outgoing)</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {rule.service ? `${rule.service} service` : portsText(rule)}
                      </td>
                      <td className="py-2 pr-3">{PROTOCOL_LABEL[rule.protocol]}</td>
                      <td className="py-2 pr-3">
                        <SimpleTooltip label={FAMILY[rule.families]}>
                          <span className="font-mono" tabIndex={0}>
                            {sourceText(rule)}
                          </span>
                        </SimpleTooltip>
                      </td>
                      <td className="max-w-48 truncate py-2 pr-3 text-muted-foreground">
                        {gone ? 'Will be removed' : (rule.comment ?? rule.description)}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">
                        {canEdit && gone && (
                          <Button size="sm" variant="ghost" onClick={() => onKeep(rule)}>
                            <Undo className="h-3.5 w-3.5" /> Keep
                          </Button>
                        )}
                        {canEdit && !gone && rule.editable && (
                          <>
                            <SimpleTooltip label="Edit this rule">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Edit the rule for ${portsText(rule)}`}
                                onClick={() => onEdit(rule)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </SimpleTooltip>
                            <SimpleTooltip label="Remove this rule">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove the rule for ${portsText(rule)}`}
                                onClick={() => onRemove(rule)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </SimpleTooltip>
                          </>
                        )}
                        {!rule.editable && (
                          <SimpleTooltip
                            label={rule.note ?? 'The app does not edit this rule.'}
                            className="max-w-64"
                          >
                            <span
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                              tabIndex={0}
                            >
                              <Lock className="h-3 w-3" /> Read only
                            </span>
                          </SimpleTooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
