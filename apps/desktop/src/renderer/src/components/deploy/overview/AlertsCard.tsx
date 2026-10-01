import type {
  AlertInfo,
  AlertSeverity,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { Bell, Check, CircleInfo, CircleX, TriangleAlert } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { shortAge } from '@/lib/time';

/** Open alerts from the core: disk pressure, failed jobs, a reboot waiting. */

const SEVERITY: Record<
  AlertSeverity,
  {
    label: string;
    icon: typeof Bell;
    tone: string;
    variant: 'destructive' | 'warning' | 'secondary';
  }
> = {
  critical: { label: 'Critical', icon: CircleX, tone: 'text-destructive', variant: 'destructive' },
  warning: { label: 'Warning', icon: TriangleAlert, tone: 'text-warning', variant: 'warning' },
  info: { label: 'Info', icon: CircleInfo, tone: 'text-muted-foreground', variant: 'secondary' },
};

export function AlertsCard({
  alerts,
  ready,
  error,
  now,
  acknowledging,
  onAcknowledge,
}: {
  alerts: AlertInfo[];
  ready: boolean;
  error: string | null;
  now: number;
  acknowledging: number | null;
  /** Shown to Operators and above. */
  onAcknowledge?: (alert: AlertInfo) => void;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Alerts
        </CardTitle>
        {ready && alerts.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{alerts.length} open</span>
        )}
      </CardHeader>
      <CardContent>
        {!ready ? (
          <Skeleton className="h-10 w-full" aria-busy="true" />
        ) : error && alerts.length === 0 ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The alerts did not load: {error}
          </p>
        ) : alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" /> No open alerts.
          </p>
        ) : (
          <ul aria-label="Open alerts" className="space-y-2">
            {alerts.map((alert) => {
              const severity = SEVERITY[alert.severity];
              const Icon = severity.icon;
              return (
                <li
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5"
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${severity.tone}`} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-foreground">{alert.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={severity.variant} className="h-5 px-1.5 text-[10px]">
                        {severity.label}
                      </Badge>
                      <span>
                        {alert.occurrences > 1 ? `${alert.occurrences} times, last ` : ''}
                        {shortAge(alert.lastSeenAtUnixMs, now)} ago
                      </span>
                      {alert.acknowledgedAtUnixMs !== undefined && (
                        <span>
                          Acknowledged{alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {onAcknowledge && alert.acknowledgedAtUnixMs === undefined && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acknowledging === alert.id}
                      onClick={() => onAcknowledge(alert)}
                    >
                      <Check className="h-3.5 w-3.5" /> Acknowledge
                    </Button>
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
