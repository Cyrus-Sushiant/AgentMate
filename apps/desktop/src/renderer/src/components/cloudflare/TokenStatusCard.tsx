import { missingPermissionLabels, TOKEN_PAGE } from '@shared/cloudflare/permissions';
import type { CloudflareStatus } from '@shared/cloudflareTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Key, RefreshCw, Trash2 } from '@/components/icons';
import { Chip } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { cloudflareFailureText } from '@/lib/cloudflare/feedback';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { CloudflareMark } from './CloudflareMark';
import { CardBody, CloudflareCard, Notice } from './fields';
import { PermissionList } from './PermissionList';

const NOT_CONFIGURED: CloudflareStatus = { configured: false, locked: false, report: null };

/**
 * The saved token: whether Cloudflare still takes it, what it may do, and when something is
 * missing, the exact permissions to add on Cloudflare (AC1) with a way to check again after.
 * Editing a token's permissions keeps its value, so nothing needs pasting again.
 */
export function TokenStatusCard({
  status,
  onReplace,
}: {
  status: CloudflareStatus;
  onReplace: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const report = status.report;
  const missing = (report?.permissions ?? [])
    .filter((check) => check.state === 'missing')
    .map((check) => check.id);
  const labels = missingPermissionLabels(missing);
  const zoneCount = report?.zoneCount ?? 0;
  const showFix = report !== null && (labels.length > 0 || zoneCount === 0);

  async function checkAgain(): Promise<void> {
    setChecking(true);
    try {
      const next = await window.agentmat.cloudflare.checkToken();
      queryClient.setQueryData(queryKeys.cloudflareStatus, next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareData });
      toast.success('Checked the token again.');
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    } finally {
      setChecking(false);
    }
  }

  async function remove(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Remove the Cloudflare token?',
      description:
        'AgentMate forgets the token and stops managing your domains. The token keeps working on Cloudflare until you delete it there.',
      confirmLabel: 'Remove the token',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.cloudflare.removeToken();
      queryClient.setQueryData(queryKeys.cloudflareStatus, NOT_CONFIGURED);
      queryClient.removeQueries({ queryKey: queryKeys.cloudflareData });
      toast.success('Removed the Cloudflare token.');
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    }
  }

  let badge: React.ReactNode;
  if (report && report.status !== 'active') {
    badge = (
      <Chip tone="warning" dot>
        {report.status === 'expired' ? 'Expired' : 'Disabled'}
      </Chip>
    );
  } else if (labels.length > 0) {
    badge = (
      <Chip tone="warning" dot>
        Missing permissions
      </Chip>
    );
  } else {
    badge = (
      <Chip tone="success" dot>
        Active
      </Chip>
    );
  }

  const checkButton = (
    <Button size="sm" variant="soft" disabled={checking} onClick={() => void checkAgain()}>
      <RefreshCw className={cn('h-3.5 w-3.5', checking && 'motion-safe:animate-spin')} /> Check
      again
    </Button>
  );

  return (
    <CloudflareCard
      icon={<CloudflareMark />}
      title="Cloudflare token"
      extra={badge}
      description={
        report
          ? `Checked ${timeAgo(new Date(report.checkedAt).toISOString())}. It can see ${zoneCount} ${zoneCount === 1 ? 'domain' : 'domains'}. ${
              report.source === 'policies'
                ? "Read from the token's own permissions."
                : 'Checked by reading, which changes nothing, so edit access is confirmed the first time you make a change.'
            }`
          : 'Saved, but not checked yet.'
      }
      actions={
        <>
          {!showFix && checkButton}
          <Button size="sm" variant="soft" onClick={onReplace}>
            <Key className="h-3.5 w-3.5" /> Replace token
          </Button>
          <Button size="sm" variant="danger" onClick={() => void remove()}>
            <Trash2 className="h-3.5 w-3.5" /> Remove token
          </Button>
        </>
      }
    >
      <CardBody className="space-y-3">
        {showFix && (
          <section aria-label="What to add to the token">
            <Notice tone="warning">
              <div className="space-y-2.5">
                <p>
                  {labels.length > 0
                    ? 'On Cloudflare, open My Profile > API Tokens, edit this token and add these permissions, then check again:'
                    : 'On Cloudflare, open My Profile > API Tokens and edit this token.'}
                </p>
                {labels.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                      <li
                        key={label}
                        className="rounded-md bg-background/60 px-2 py-0.5 font-mono text-xs text-foreground ring-1 ring-inset ring-foreground/[0.08]"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
                {zoneCount === 0 && (
                  <p className="text-muted-foreground">
                    The token cannot see any domains. Under Zone Resources, include the domains
                    AgentMate should manage.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void window.agentmat.shell.openExternal(TOKEN_PAGE)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Edit the token on Cloudflare
                  </Button>
                  {checkButton}
                </div>
              </div>
            </Notice>
          </section>
        )}
        {report && <PermissionList checks={report.permissions} />}
      </CardBody>
    </CloudflareCard>
  );
}
