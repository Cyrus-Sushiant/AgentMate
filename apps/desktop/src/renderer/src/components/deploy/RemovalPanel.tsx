import type { DeployServer } from '@shared/deployTypes';
import { useState } from 'react';
import { RefreshCw, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { timeline } from '@/lib/deploy/setup';
import type { SetupRun } from '@/stores/deploySetupStore';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { SetupFailure } from './SetupFailure';
import { SetupTimeline } from './SetupTimeline';
import { SudoPasswordField } from './SudoPasswordField';

/** A removal of the core in progress, or the reason one stopped and a way to try again. */
export function RemovalPanel({
  server,
  run,
}: {
  server: DeployServer;
  run: SetupRun;
}): React.JSX.Element {
  const keepData = run.keepData ?? true;
  const uninstall = useDeploySetupStore((state) => state.uninstall);
  const clear = useDeploySetupStore((state) => state.clear);
  const [password, setPassword] = useState('');
  const sudoError =
    run.status === 'failed' &&
    (run.errorCode === 'sudo-password-rejected' || run.errorCode === 'sudo-password-required');

  function retry(): void {
    void uninstall(server.id, keepData, sudoError ? password : null);
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" /> Removing the server core
        </CardTitle>
        <CardDescription>
          {keepData
            ? 'The service and program go; the data folder and settings stay for a later install.'
            : 'The service, the program, its data folder and its settings all go.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SetupTimeline label="Removal steps" steps={timeline(run.planned, run.events)} />
        {run.status === 'failed' && (
          <>
            <SetupFailure message={run.error ?? 'The removal stopped.'} />
            {sudoError && (
              <SudoPasswordField
                id={`sudo-remove-${server.id}`}
                user={server.username}
                value={password}
                onChange={setPassword}
                onSubmit={retry}
                errorCode={run.errorCode}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={retry} disabled={sudoError && !password}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
              <Button size="sm" variant="outline" onClick={() => clear(server.id)}>
                Dismiss
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
