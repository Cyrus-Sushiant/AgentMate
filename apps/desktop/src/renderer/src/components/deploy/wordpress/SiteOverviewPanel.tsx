import { WP_CONNECTOR_VERSION, WP_PROTOCOL_VERSION } from '@agentmat/core';
import type { DeployWordPressSite, DeployWordPressSiteInfo } from '@shared/deployWordPressTypes';
import { wordPressErrorCode } from '@shared/wordpressErrors';
import {
  CircleCheck,
  CircleInfo,
  Clock,
  Plug,
  RefreshCw,
  Shield,
  Spinner,
  TriangleAlert,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WordPressMark } from '@/components/wordpress/WordPressMark';
import { cn } from '@/lib/utils';
import { SetupFailure } from '../SetupFailure';
import { ConnectorDownloadCard } from './ConnectorDownloadCard';
import { useSaveConnectorZip, useSiteInfo } from './hooks';
import {
  compareVersions,
  DEPLOY_STATE_LABEL,
  dateTimeText,
  fileChangesStatus,
  siteClockText,
  TRANSPORT_LABEL,
  wpProblem,
} from './messages';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-t border-border/60 py-2 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}

/** A short line with a mark that says good, bad or not known, in words as well as colour. */
function Status({
  tone,
  children,
}: {
  tone: 'good' | 'bad' | 'neutral';
  children: React.ReactNode;
}): React.JSX.Element {
  const Icon = tone === 'good' ? CircleCheck : tone === 'bad' ? TriangleAlert : CircleInfo;
  return (
    <span className="flex items-start gap-1.5">
      <Icon
        className={cn(
          'mt-0.5 h-3.5 w-3.5 shrink-0',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-warning',
          tone === 'neutral' && 'text-muted-foreground',
        )}
      />
      <span>{children}</span>
    </span>
  );
}

/** A newer connector of the same protocol: worth having, not needed. */
function NewerConnector(): React.JSX.Element {
  const { save, saving } = useSaveConnectorZip();
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      Version {WP_CONNECTOR_VERSION} comes with this app. This one still works; upload the new one
      in wp-admin when it suits you.{' '}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        disabled={saving}
        onClick={() => void save()}
      >
        Download version {WP_CONNECTOR_VERSION}
      </Button>
    </span>
  );
}

function ConnectorNotice({ info }: { info: DeployWordPressSiteInfo }): React.JSX.Element | null {
  if (info.protocol < WP_PROTOCOL_VERSION) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            The connector on this site ({info.pluginVersion}) is older than this version of
            AgentMate expects, so pulls and deploys may fail. Download the latest plugin below and
            upload it in the site's admin. Uploading it over the old one keeps the connection.
          </span>
        </div>
        <ConnectorDownloadCard title="Update the connector" />
      </div>
    );
  }
  if (info.protocol > WP_PROTOCOL_VERSION) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          The connector on this site is newer than this version of AgentMate. Update AgentMate so
          the two speak the same language.
        </span>
      </div>
    );
  }
  return null;
}

/**
 * What the site runs and whether it is in shape for a deploy: WordPress and PHP versions, the
 * active theme, HTTPS, the connector, whether file changes are allowed and why not, the rescue
 * guard, loopback health and any deploy still waiting for its confirmation.
 */
export function SiteOverviewPanel({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const infoQuery = useSiteInfo(site.id);
  const info = infoQuery.data;
  const loading = infoQuery.isPending;
  const errorCode = infoQuery.isError ? wordPressErrorCode(infoQuery.error) : null;
  const newerConnector = info
    ? compareVersions(info.pluginVersion, WP_CONNECTOR_VERSION) < 0
    : false;

  return (
    <div className="space-y-4">
      {infoQuery.isError && (
        <div className="space-y-3">
          <SetupFailure message={wpProblem(infoQuery.error)} />
          <Button
            size="sm"
            variant="outline"
            disabled={infoQuery.isFetching}
            onClick={() => void infoQuery.refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
          {errorCode === 'connectorOutdated' && (
            <ConnectorDownloadCard title="Update the connector" />
          )}
        </div>
      )}
      {info && <ConnectorNotice info={info} />}
      {info?.pendingDeploy && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-foreground"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            A deploy is waiting for confirmation ({DEPLOY_STATE_LABEL[info.pendingDeploy.state]}).
            If it isn't confirmed by {siteClockText(info.pendingDeploy.deadline)}, the site puts the
            old files back on its own.
          </span>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <WordPressMark className="h-4 w-4" /> Site
              </CardTitle>
              <CardDescription className="break-words">
                {info ? info.siteName : 'What the site runs.'}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={infoQuery.isFetching}
              onClick={() => void infoQuery.refetch()}
            >
              {infoQuery.isFetching ? (
                <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Check again
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CardSkeleton rows={6} />
            ) : !info ? (
              <p className="text-sm text-muted-foreground">The site's details did not load.</p>
            ) : (
              <dl>
                <Row label="WordPress">
                  {info.wpVersion}
                  {info.multisite && (
                    <span className="text-muted-foreground">, a multisite network</span>
                  )}
                </Row>
                <Row label="PHP">{info.phpVersion}</Row>
                <Row label="Active theme">
                  <span className="font-mono">{info.activeTheme.stylesheet}</span>
                  {info.activeTheme.template !== info.activeTheme.stylesheet && (
                    <span className="block text-xs text-muted-foreground">
                      A child theme of{' '}
                      <span className="font-mono">{info.activeTheme.template}</span>
                    </span>
                  )}
                </Row>
                <Row label="HTTPS">
                  {info.https ? (
                    <Status tone="good">Yes</Status>
                  ) : (
                    <Status tone="bad">No, the site is served over plain HTTP</Status>
                  )}
                </Row>
                <Row label="Connection">{TRANSPORT_LABEL[site.transport]}</Row>
                <Row label="Checked">{dateTimeText(info.checkedAt)}</Row>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" /> Connector
            </CardTitle>
            <CardDescription>The AgentMate Connector plugin on the site.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CardSkeleton rows={4} />
            ) : !info ? (
              <p className="text-sm text-muted-foreground">The connector's details did not load.</p>
            ) : (
              <dl>
                <Row label="Version">
                  {info.pluginVersion}
                  <span className="text-muted-foreground">, protocol {info.protocol}</span>
                  {newerConnector && info.protocol === WP_PROTOCOL_VERSION && <NewerConnector />}
                </Row>
                <Row label="Signing">
                  {info.sodium === 'native'
                    ? 'PHP sodium extension'
                    : "WordPress's built-in sodium library (slower, works the same)"}
                </Row>
                <Row label="Rescue guard">
                  {info.guard.installed ? (
                    <Status tone="good">
                      Installed. If a deploy breaks the site, the guard puts the old files back,
                      even when WordPress itself can't load.
                    </Status>
                  ) : (
                    <Status tone="bad">
                      Not installed, so a deploy that breaks the site can't be rolled back on its
                      own. Deactivate and activate the connector in wp-admin to put it back.
                    </Status>
                  )}
                </Row>
                <Row label="Health check">
                  {info.loopback === 'ok' ? (
                    <Status tone="good">
                      The site can reach itself, so every deploy is health-checked.
                    </Status>
                  ) : info.loopback === 'failed' ? (
                    <Status tone="bad">
                      The site can't reach itself (loopback requests fail), so it can't check a
                      deploy from the inside. AgentMate still checks the home page from here.
                    </Status>
                  ) : (
                    <Status tone="neutral">Not checked yet.</Status>
                  )}
                </Row>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="glass xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> File changes
            </CardTitle>
            <CardDescription>
              Deploys only ever write theme, plugin and mu-plugin files. They never activate a
              plugin or switch the theme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CardSkeleton rows={2} />
            ) : !info ? (
              <p className="text-sm text-muted-foreground">Not known until the site answers.</p>
            ) : (
              <FileChanges info={info} site={site} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FileChanges({
  info,
  site,
}: {
  info: DeployWordPressSiteInfo;
  site: DeployWordPressSite;
}): React.JSX.Element {
  const status = fileChangesStatus(info, site);
  return (
    <dl>
      <Row label="Deploys">
        <Status tone={status.allowed ? 'good' : 'bad'}>{status.text}</Status>
      </Row>
      {info.fileEditDisabled && (
        <Row label="Built-in editors">
          Off (DISALLOW_FILE_EDIT). That only hides the theme and plugin editors in wp-admin;
          deploys still work.
        </Row>
      )}
      {!status.allowed && info.filesystemMethod !== 'direct' && (
        <Row label="Filesystem">
          <span className="font-mono">{info.filesystemMethod}</span>
        </Row>
      )}
    </dl>
  );
}
