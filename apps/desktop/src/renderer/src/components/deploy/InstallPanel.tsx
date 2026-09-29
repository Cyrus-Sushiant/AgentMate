import type { DeployServer } from '@shared/deployTypes';
import { sshErrorMessage } from '@shared/sshErrors';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw, Rocket } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { installPhases, timeline } from '@/lib/deploy/setup';
import { queryKeys } from '@/lib/queryKeys';
import { withHostKeyTrust } from '@/lib/ssh/hostKeyTrust';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { PreflightChecklist, PreflightSkeleton } from './PreflightChecklist';
import { SetupFailure } from './SetupFailure';
import { SetupTimeline } from './SetupTimeline';
import { SudoPasswordField } from './SudoPasswordField';

/**
 * Installing (or updating) the server core: a read-only check of the server first, then one
 * button. The sudo password is only asked for when the saved login cannot provide it.
 */
export function InstallPanel({
  server,
  onCancel,
}: {
  server: DeployServer;
  /** Backs out of an update, back to the health card. Absent for a first install. */
  onCancel?: () => void;
}): React.JSX.Element {
  const run = useDeploySetupStore((state) => state.runs[server.id]);
  const install = useDeploySetupStore((state) => state.install);
  const clear = useDeploySetupStore((state) => state.clear);
  const [password, setPassword] = useState('');
  const [askPassword, setAskPassword] = useState(false);
  const installRun = run?.kind === 'install' ? run : undefined;

  const preflightQuery = useQuery({
    queryKey: queryKeys.deployPreflight(server.id),
    queryFn: () => withHostKeyTrust(server.id, () => window.agentmat.deploy.preflight(server.id)),
    // Not while an install runs, but after one failed: "Try again" needs what the check found,
    // even when the page was left and opened again since.
    enabled: installRun?.status !== 'running',
    staleTime: 60_000,
  });
  const preflight = preflightQuery.data;

  const sudoError =
    installRun?.status === 'failed' &&
    (installRun.errorCode === 'sudo-password-rejected' ||
      installRun.errorCode === 'sudo-password-required');
  const needsPassword =
    preflight?.sudo === 'password' && (!preflight.hasSavedPassword || askPassword || sudoError);
  const updating = server.core !== null || preflight?.installed != null;

  function start(): void {
    if (!preflight) return;
    void install(server.id, installPhases(preflight), needsPassword ? password : null);
  }

  function backToChecks(): void {
    clear(server.id);
    void preflightQuery.refetch();
  }

  const passwordField = needsPassword && preflight && (
    <SudoPasswordField
      id={`sudo-${server.id}`}
      user={preflight.loginUser}
      value={password}
      onChange={setPassword}
      onSubmit={start}
      errorCode={sudoError ? (installRun?.errorCode ?? null) : null}
    />
  );

  let body: React.ReactNode;
  if (installRun) {
    body = (
      <>
        <SetupTimeline
          label="Install steps"
          steps={timeline(installRun.planned, installRun.events)}
        />
        {installRun.status === 'running' && (
          <p className="text-xs text-muted-foreground">
            You can leave this page. The install keeps going and shows up here again.
          </p>
        )}
        {installRun.status === 'failed' && (
          <>
            <SetupFailure message={installRun.error ?? 'The install stopped.'} />
            {passwordField}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={start}
                disabled={!preflight || (needsPassword && !password)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
              <Button size="sm" variant="outline" onClick={backToChecks}>
                Check the server again
              </Button>
            </div>
          </>
        )}
      </>
    );
  } else if (preflightQuery.isPending) {
    body = <PreflightSkeleton />;
  } else if (preflightQuery.isError) {
    body = (
      <>
        <SetupFailure message={sshErrorMessage(preflightQuery.error)} />
        <Button size="sm" variant="outline" onClick={() => void preflightQuery.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Check again
        </Button>
      </>
    );
  } else if (preflight) {
    const blocked = preflight.problems.length > 0;
    const available = preflight.available;
    const label = !available
      ? 'Install the server core'
      : preflight.installed?.version === available
        ? `Reinstall core ${available}`
        : preflight.installed
          ? `Update to core ${available}`
          : `Install core ${available}`;
    body = (
      <>
        <PreflightChecklist preflight={preflight} />
        {blocked && (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
          >
            <p className="text-sm font-medium text-foreground">
              This server cannot take the core yet
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {preflight.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {!blocked && passwordField}
        {!blocked && !needsPassword && preflight.sudo === 'password' && (
          <p className="text-xs text-muted-foreground">
            sudo will use the saved login password.{' '}
            <button
              type="button"
              className="cursor-pointer text-primary underline-offset-4 hover:underline"
              onClick={() => setAskPassword(true)}
            >
              Use a different password
            </button>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={start} disabled={blocked || (needsPassword && !password)}>
            <Rocket className="h-4 w-4" /> {label}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={preflightQuery.isFetching}
            onClick={() => void preflightQuery.refetch()}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${preflightQuery.isFetching ? 'motion-safe:animate-spin' : ''}`}
            />
            Check again
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          {updating ? 'Update or reinstall the server core' : 'Install the server core'}
        </CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">
          {updating
            ? 'The running core keeps working until the new one is ready. If the new one does not start, the server goes back to the one it has now.'
            : `A small service that runs on ${server.nickname} so AgentMate can show what happens there and act on it. It only listens on a private socket, so no port is opened: the app reaches it through your SSH login.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{body}</CardContent>
    </Card>
  );
}
