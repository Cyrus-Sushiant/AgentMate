import { missingPermissionLabels, TOKEN_PAGE } from '@shared/cloudflare/permissions';
import type { CloudflareStatus } from '@shared/cloudflareTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Key, RefreshCw, Trash2, TriangleAlert } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cloudflareFailureText } from '@/lib/cloudflare/feedback';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { confirmDialog } from '@/stores/confirmStore';
import { CloudflareMark } from './CloudflareMark';
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
    badge = <Badge variant="warning">{report.status === 'expired' ? 'Expired' : 'Disabled'}</Badge>;
  } else if (labels.length > 0) {
    badge = <Badge variant="warning">Missing permissions</Badge>;
  } else {
    badge = <Badge variant="success">Active</Badge>;
  }

  const checkButton = (
    <Button size="sm" variant="outline" disabled={checking} onClick={() => void checkAgain()}>
      <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'motion-safe:animate-spin' : ''}`} /> Check
      again
    </Button>
  );

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <CloudflareMark className="h-4 w-4" /> Cloudflare token
          </CardTitle>
          <CardDescription>
            {report
              ? `Checked ${timeAgo(new Date(report.checkedAt).toISOString())}. It can see ${zoneCount} ${zoneCount === 1 ? 'domain' : 'domains'}. ${
                  report.source === 'policies'
                    ? "Read from the token's own permissions."
                    : 'Checked by reading, which changes nothing, so edit access is confirmed the first time you make a change.'
                }`
              : 'Saved, but not checked yet.'}
          </CardDescription>
        </div>
        <div className="shrink-0">{badge}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFix && (
          <section
            aria-label="What to add to the token"
            className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3"
          >
            <p className="flex items-start gap-2 text-sm text-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                {labels.length > 0
                  ? 'On Cloudflare, open My Profile > API Tokens, edit this token and add these permissions, then check again:'
                  : 'On Cloudflare, open My Profile > API Tokens and edit this token.'}
              </span>
            </p>
            {labels.length > 0 && (
              <ul className="space-y-1 pl-6">
                {labels.map((label) => (
                  <li key={label} className="font-mono text-xs text-foreground">
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {zoneCount === 0 && (
              <p className="pl-6 text-sm text-muted-foreground">
                The token cannot see any domains. Under Zone Resources, include the domains
                AgentMate should manage.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pl-6">
              <Button size="sm" onClick={() => void window.agentmat.shell.openExternal(TOKEN_PAGE)}>
                <ExternalLink className="h-3.5 w-3.5" /> Edit the token on Cloudflare
              </Button>
              {checkButton}
            </div>
          </section>
        )}
        {report && <PermissionList checks={report.permissions} />}
        <div className="flex flex-wrap items-center gap-2">
          {!showFix && checkButton}
          <Button size="sm" variant="ghost" onClick={onReplace}>
            <Key className="h-3.5 w-3.5" /> Replace token
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => void remove()}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove token
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
