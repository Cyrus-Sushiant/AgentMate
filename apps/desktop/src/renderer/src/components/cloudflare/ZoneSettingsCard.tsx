import { sslAdvice } from '@shared/cloudflare/zone';
import type {
  CloudflareSecurityLevel,
  CloudflareSettingChange,
  CloudflareSslMode,
  CloudflareZone,
} from '@shared/cloudflareTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { CircleCheck, CircleInfo, SettingsIcon, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cloudflareFailureText, useCloudflareError } from '@/lib/cloudflare/feedback';
import { formatRemaining, SECURITY_LEVEL_LABELS, SSL_MODE_LABELS } from '@/lib/cloudflare/labels';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { NativeSelect, Problem } from './fields';

const SECURITY_LEVELS = Object.keys(SECURITY_LEVEL_LABELS) as CloudflareSecurityLevel[];
const SETTABLE_SSL_MODES: Exclude<CloudflareSslMode, 'origin_pull'>[] = [
  'off',
  'flexible',
  'full',
  'strict',
];

function Row({
  title,
  titleId,
  htmlFor,
  description,
  children,
  below,
}: {
  title: string;
  titleId?: string;
  htmlFor?: string;
  description: string;
  children: React.ReactNode;
  below?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
              {title}
            </label>
          ) : (
            <p id={titleId} className="text-sm font-medium text-foreground">
              {title}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
      {below}
    </div>
  );
}

function SettingsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * The zone settings an operator reaches for most (T3): development mode, the security level up to
 * "I'm Under Attack", the SSL/TLS mode with the suggestion for proxied domains, and Always Use
 * HTTPS. Every state is written out, not only shown by a switch's colour.
 */
export function ZoneSettingsCard({ zone }: { zone: CloudflareZone }): React.JSX.Element {
  const queryClient = useQueryClient();
  const id = useId();
  const key = queryKeys.cloudflareSettings(zone.id);
  const settings = useQuery({
    queryKey: key,
    queryFn: () => window.agentmat.cloudflare.zoneSettings(zone.id),
  });
  const loadError = useCloudflareError(settings.error);
  const [saving, setSaving] = useState<CloudflareSettingChange['setting'] | null>(null);

  async function change(next: CloudflareSettingChange, done: string): Promise<void> {
    setSaving(next.setting);
    try {
      queryClient.setQueryData(key, await window.agentmat.cloudflare.changeSetting(zone.id, next));
      toast.success(done);
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    } finally {
      setSaving(null);
    }
  }

  let body: React.ReactNode;
  if (settings.isPending) {
    body = <SettingsSkeleton />;
  } else if (settings.isError) {
    body = <Problem message={loadError ?? ''} onRetry={() => void settings.refetch()} />;
  } else {
    const { developmentMode, securityLevel, ssl, alwaysUseHttps } = settings.data;
    const advice = sslAdvice(ssl.value);
    const AdviceIcon =
      advice.level === 'ok' ? CircleCheck : advice.level === 'improve' ? CircleInfo : TriangleAlert;
    const developmentOn = developmentMode.value === 'on';
    const httpsOn = alwaysUseHttps.value === 'on';
    body = (
      <div className="divide-y divide-border/60">
        <Row
          title="Development mode"
          titleId={`${id}-development`}
          description="Skips the cache for three hours, so changes to the site show at once."
        >
          <span className="text-xs text-muted-foreground">
            {developmentOn ? `On, ${formatRemaining(developmentMode.secondsRemaining)}` : 'Off'}
          </span>
          <Switch
            checked={developmentOn}
            disabled={!developmentMode.editable || saving === 'developmentMode'}
            aria-labelledby={`${id}-development`}
            onCheckedChange={(checked) =>
              void change(
                { setting: 'developmentMode', value: checked ? 'on' : 'off' },
                checked ? 'Development mode is on for three hours.' : 'Development mode is off.',
              )
            }
          />
        </Row>
        <Row
          title="Security level"
          htmlFor={`${id}-security`}
          description="How suspicious a visitor has to look before Cloudflare checks them."
          below={
            securityLevel.value === 'under_attack' && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-foreground">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                I'm Under Attack is on: every visitor sees a short check before the site loads. Turn
                it back down once the attack is over.
              </p>
            )
          }
        >
          <NativeSelect
            id={`${id}-security`}
            className="w-48"
            value={securityLevel.value}
            disabled={!securityLevel.editable || saving === 'securityLevel'}
            onChange={(event) => {
              const value = event.target.value as CloudflareSecurityLevel;
              void change(
                { setting: 'securityLevel', value },
                `Security level is ${SECURITY_LEVEL_LABELS[value]} now.`,
              );
            }}
          >
            {SECURITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {SECURITY_LEVEL_LABELS[level]}
              </option>
            ))}
          </NativeSelect>
        </Row>
        <Row
          title="SSL/TLS mode"
          htmlFor={`${id}-ssl`}
          description="How Cloudflare connects to your server for proxied records."
          below={
            <div
              className={cn(
                'flex flex-wrap items-start gap-2 rounded-lg border p-2.5 text-xs text-foreground',
                advice.level === 'ok' && 'border-success/40 bg-success/10',
                advice.level === 'improve' && 'border-border/70 bg-secondary/30',
                advice.level === 'warning' && 'border-warning/40 bg-warning/10',
              )}
            >
              <AdviceIcon
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  advice.level === 'ok' && 'text-success',
                  advice.level === 'warning' && 'text-warning',
                )}
              />
              <span className="min-w-0 flex-1">{advice.message}</span>
              {advice.recommended !== ssl.value && ssl.editable && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={saving === 'ssl'}
                  onClick={() =>
                    void change(
                      { setting: 'ssl', value: 'strict' },
                      'SSL/TLS mode is Full (strict) now.',
                    )
                  }
                >
                  Use Full (strict)
                </Button>
              )}
            </div>
          }
        >
          <NativeSelect
            id={`${id}-ssl`}
            className="w-48"
            value={ssl.value}
            disabled={!ssl.editable || saving === 'ssl'}
            onChange={(event) => {
              const value = event.target.value as Exclude<CloudflareSslMode, 'origin_pull'>;
              void change(
                { setting: 'ssl', value },
                `SSL/TLS mode is ${SSL_MODE_LABELS[value]} now.`,
              );
            }}
          >
            {ssl.value === 'origin_pull' && (
              <option value="origin_pull">{SSL_MODE_LABELS.origin_pull}</option>
            )}
            {SETTABLE_SSL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {SSL_MODE_LABELS[mode]}
              </option>
            ))}
          </NativeSelect>
        </Row>
        <Row
          title="Always Use HTTPS"
          titleId={`${id}-https`}
          description="Sends visitors who ask for http:// to the https:// address."
        >
          <span className="text-xs text-muted-foreground">{httpsOn ? 'On' : 'Off'}</span>
          <Switch
            checked={httpsOn}
            disabled={!alwaysUseHttps.editable || saving === 'alwaysUseHttps'}
            aria-labelledby={`${id}-https`}
            onCheckedChange={(checked) =>
              void change(
                { setting: 'alwaysUseHttps', value: checked ? 'on' : 'off' },
                checked ? 'Always Use HTTPS is on.' : 'Always Use HTTPS is off.',
              )
            }
          />
        </Row>
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" /> Settings
        </CardTitle>
        <CardDescription>
          For everything in {zone.name}. Changes apply within seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
