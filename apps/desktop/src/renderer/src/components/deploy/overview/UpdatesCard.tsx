import type {
  UpdatesInfo,
  UpgradablePackage,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useState } from 'react';
import {
  CircleCheck,
  CloudDownload,
  Package,
  RefreshCw,
  Shield,
  Spinner,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { shortAge } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * Package updates waiting on the server, security ones marked, with a check and an upgrade
 * (security only, or everything) that first lists exactly what will change. Automatic security
 * updates can be switched by an Admin.
 */

export type UpgradeKind = 'security' | 'all';

function PackageRow({ item }: { item: UpgradablePackage }) {
  return (
    <li
      aria-label={item.name}
      className="flex items-center gap-3 border-t border-border/60 py-1.5 first:border-t-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs text-foreground">{item.name}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {item.currentVersion ? `${item.currentVersion} → ` : ''}
          {item.newVersion}
        </span>
      </span>
      {item.security && (
        <Badge variant="warning" className="h-5 gap-1 px-1.5 text-[10px]">
          <Shield className="h-2.5 w-2.5" /> Security
        </Badge>
      )}
    </li>
  );
}

function PreviewDialog({
  kind,
  updates,
  onCancel,
  onConfirm,
}: {
  kind: UpgradeKind | null;
  updates: UpdatesInfo | undefined;
  onCancel: () => void;
  onConfirm: (kind: UpgradeKind) => void;
}): React.JSX.Element {
  const packages = (updates?.packages ?? []).filter((item) => kind === 'all' || item.security);
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === 'all' ? 'Install every update?' : 'Install the security updates?'}
          </DialogTitle>
          <DialogDescription>
            {packages.length} {packages.length === 1 ? 'package changes' : 'packages change'}{' '}
            through {updates?.packageManager ?? 'the package manager'}. Services that use them may
            restart.
            {kind === 'all' ? ' This takes your password.' : ''}
          </DialogDescription>
        </DialogHeader>
        <ul
          aria-label="Packages to install"
          className="max-h-72 overflow-auto rounded-lg border border-border px-3 py-1"
        >
          {packages.map((item) => (
            <PackageRow key={`${item.name}-${item.architecture ?? ''}`} item={item} />
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => kind && onConfirm(kind)} disabled={packages.length === 0}>
            <CloudDownload className="h-3.5 w-3.5" /> Install {packages.length}{' '}
            {packages.length === 1 ? 'update' : 'updates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UpdatesCard({
  updates,
  loading,
  error,
  stale,
  now,
  checking,
  busy,
  canOperate,
  canAdmin,
  onCheck,
  onUpgrade,
  onAutomatic,
}: {
  updates: UpdatesInfo | undefined;
  loading: boolean;
  error: string | null;
  stale: boolean;
  now: number;
  checking: boolean;
  /** A package job is running, so the buttons wait. */
  busy: boolean;
  canOperate: boolean;
  canAdmin: boolean;
  onCheck: () => void;
  onUpgrade: (kind: UpgradeKind) => void;
  onAutomatic: (enabled: boolean) => void;
}): React.JSX.Element {
  const [preview, setPreview] = useState<UpgradeKind | null>(null);
  const packages = [...(updates?.packages ?? [])].sort(
    (a, b) => Number(b.security) - Number(a.security) || a.name.localeCompare(b.name),
  );
  const security = updates?.securityCount ?? 0;
  const auto = updates?.automaticSecurityUpdates;

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Updates
          </CardTitle>
          <CardDescription>
            {updates?.checkedAtUnixMs
              ? `Checked ${shortAge(updates.checkedAtUnixMs, now)} ago.`
              : 'Not checked yet.'}
          </CardDescription>
        </div>
        {canOperate && (
          <SimpleTooltip label="Ask the package manager for new versions now">
            <Button size="sm" variant="ghost" disabled={checking || busy} onClick={onCheck}>
              {checking ? (
                <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {checking ? 'Checking…' : 'Check for updates'}
            </Button>
          </SimpleTooltip>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-full" />
            ))}
          </div>
        ) : !updates ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The updates did not load{error ? `: ${error}` : '.'}
          </p>
        ) : (
          <div className={cn('space-y-4 transition-opacity', stale && 'opacity-50')}>
            {updates.error && (
              <p role="alert" className="text-sm text-destructive">
                The last check failed: {updates.error}
              </p>
            )}
            {packages.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheck className="h-3.5 w-3.5 text-success" /> Everything is up to date.
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  {packages.length} {packages.length === 1 ? 'update' : 'updates'} waiting
                  {security > 0 ? `, ${security} for security` : ''}.
                </p>
                <ul aria-label="Updates" className="max-h-64 overflow-auto">
                  {packages.map((item) => (
                    <PackageRow key={`${item.name}-${item.architecture ?? ''}`} item={item} />
                  ))}
                </ul>
                {canOperate && (
                  <div className="flex flex-wrap gap-2">
                    {security > 0 && (
                      <Button size="sm" disabled={busy} onClick={() => setPreview('security')}>
                        <Shield className="h-3.5 w-3.5" /> Install security updates
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={security > 0 ? 'outline' : 'default'}
                      disabled={busy}
                      onClick={() => setPreview('all')}
                    >
                      <CloudDownload className="h-3.5 w-3.5" /> Install all
                    </Button>
                  </div>
                )}
              </>
            )}
            {auto?.supported && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="automatic-security-updates" className="text-sm">
                    Automatic security updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {auto.enabled ? 'On' : 'Off'}, with {auto.mechanism}
                    {canAdmin ? '.' : '. Admins can change this.'}
                  </p>
                </div>
                <Switch
                  id="automatic-security-updates"
                  checked={auto.enabled}
                  disabled={!canAdmin || busy}
                  onCheckedChange={onAutomatic}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
      <PreviewDialog
        kind={preview}
        updates={updates}
        onCancel={() => setPreview(null)}
        onConfirm={(kind) => {
          setPreview(null);
          onUpgrade(kind);
        }}
      />
    </Card>
  );
}
