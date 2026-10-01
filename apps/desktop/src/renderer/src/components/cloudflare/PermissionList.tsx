import { CLOUDFLARE_PERMISSIONS } from '@shared/cloudflare/permissions';
import type { CloudflarePermissionCheck, CloudflarePermissionState } from '@shared/cloudflareTypes';
import { CircleCheck, CircleQuestion, CircleX } from '@/components/icons';
import { cn } from '@/lib/utils';

const STATE_TEXT: Record<CloudflarePermissionState, string> = {
  granted: 'Granted',
  missing: 'Missing',
  unverified: 'Checked when first used',
};

function StateMark({ state }: { state: CloudflarePermissionState }): React.JSX.Element {
  const Icon = state === 'granted' ? CircleCheck : state === 'missing' ? CircleX : CircleQuestion;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-xs font-medium',
        state === 'granted' && 'text-success',
        state === 'missing' && 'text-destructive',
        state === 'unverified' && 'text-muted-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {STATE_TEXT[state]}
    </span>
  );
}

/**
 * The permissions AgentMate asks for, as the token page names them, with what each one is for.
 * Given a check, each row also says (in words, with an icon) whether the token has it.
 */
export function PermissionList({
  checks,
}: {
  checks?: CloudflarePermissionCheck[];
}): React.JSX.Element {
  const stateOf = new Map(checks?.map((check) => [check.id, check.state]));
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/70 bg-secondary/20">
      {CLOUDFLARE_PERMISSIONS.map((permission) => {
        const state = stateOf.get(permission.id);
        return (
          <li key={permission.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-foreground">{permission.label}</p>
              <p className="text-xs text-muted-foreground">{permission.purpose}</p>
            </div>
            {state && <StateMark state={state} />}
          </li>
        );
      })}
    </ul>
  );
}
