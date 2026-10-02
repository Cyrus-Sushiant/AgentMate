import type { NginxStatus } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, Minus, Rocket, Spinner, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { relative } from '@/lib/deploy/sites/certificates';

/** nginx on the server: whether it is there, running and looked after by AgentMate. */

function Fact({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CircleCheck className="h-3.5 w-3.5 text-success" />
      ) : (
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground">{detail}</span>
    </li>
  );
}

export function NginxCard({
  status,
  loading,
  error,
  admin,
  installing,
  onInstall,
}: {
  status: NginxStatus | undefined;
  loading: boolean;
  error: string | null;
  admin: boolean;
  installing: boolean;
  onInstall: () => void;
}): React.JSX.Element {
  const action = status && !status.installed ? 'Install nginx' : 'Set up nginx for AgentMate';
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">nginx</CardTitle>
          <CardDescription>
            {status?.version
              ? `Version ${status.version}`
              : 'The web server in front of your apps.'}
            {status?.fromNginxOrg ? ', from nginx.org' : ''}
          </CardDescription>
        </div>
        {admin && status && !status.managed && (
          <Button type="button" size="sm" disabled={installing} onClick={onInstall}>
            {installing ? (
              <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {action}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> {error}
          </p>
        ) : status ? (
          <>
            <ul aria-label="nginx" className="grid gap-1.5 sm:grid-cols-3">
              <Fact
                ok={status.installed}
                label="Installed"
                detail={status.installed ? '' : 'not yet'}
              />
              <Fact
                ok={status.running}
                label={status.running ? 'Running' : 'Not running'}
                detail=""
              />
              <Fact
                ok={status.managed}
                label={status.managed ? 'Managed by AgentMate' : 'Not set up yet'}
                detail={status.currentRelease ? `release ${status.currentRelease}` : ''}
              />
            </ul>
            {!status.managed && (
              <p className="text-sm text-muted-foreground">
                {status.installed
                  ? 'AgentMate can take over the nginx that is already here: it backs up and turns off the stock default site, and adds its own sites next to what you have.'
                  : 'AgentMate installs nginx from the official nginx.org packages and sets it up for your sites.'}
                {admin ? '' : ' An Admin can do this.'}
              </p>
            )}
            {status.lastAppliedAtUnixMs && (
              <p className="text-xs text-muted-foreground">
                Last applied {relative(status.lastAppliedAtUnixMs, Date.now())}
                {status.lastAppliedBy ? ` by ${status.lastAppliedBy}` : ''}.
              </p>
            )}
            {!status.streamSupported && status.managed && (
              <p className="text-xs text-muted-foreground">
                This nginx was built without the stream module, so TCP and UDP proxies are not
                available.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
