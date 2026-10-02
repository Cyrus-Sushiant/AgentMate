import { coreErrorMessage } from '@shared/coreErrors';
import type {
  DockerStatus,
  JobInfo,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useState } from 'react';
import { Docker, Lock, RefreshCw, Spinner, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Docker on a server that does not have it running (E06 T1): an Admin installs Docker Engine and
 * Compose from Docker's own repository as a job. When packages in the way are found (podman,
 * buildah and runc on the RHEL family), they are listed and the install waits for an explicit
 * yes to removing them. Installed but stopped, it offers a restart instead.
 */

export function DockerInstallCard({
  serverId,
  serverName,
  status,
  canInstall,
  canRestart,
  onStarted,
  onRestart,
}: {
  serverId: string;
  serverName: string;
  status: DockerStatus;
  canInstall: boolean;
  canRestart: boolean;
  onStarted: (job: JobInfo) => void;
  onRestart: () => void;
}): React.JSX.Element {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const conflicts = status.conflictingPackages;

  if (status.installed && !status.running) {
    return (
      <Card className="space-y-3 p-5" role="region" aria-label="Docker">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TriangleAlert className="h-4 w-4 text-warning" /> Docker is installed but not running
        </h3>
        <p className="text-sm text-muted-foreground">
          {status.message ??
            `The Docker service on ${serverName} is stopped, so no container runs.`}
        </p>
        {canRestart && (
          <Button size="sm" className="gap-1.5" onClick={onRestart}>
            <RefreshCw className="h-3.5 w-3.5" /> Start Docker
          </Button>
        )}
      </Card>
    );
  }

  async function install(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      onStarted(
        await window.agentmat.deployDocker.install({
          serverId,
          removeConflictingPackages: conflicts.length > 0 && agreed,
        }),
      );
    } catch (error) {
      setProblem(coreErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5" role="region" aria-label="Docker">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Docker className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Docker is not installed on {serverName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Installs Docker Engine and Compose from download.docker.com, with the repository key
            checked against Docker's published fingerprint, then starts it and turns it on at boot.
          </p>
        </div>
      </div>
      {conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <TriangleAlert className="h-4 w-4 shrink-0 text-warning" /> These packages are in
            Docker's way and have to go first:
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Packages in the way">
            {conflicts.map((name) => (
              <li
                key={name}
                className="rounded border border-border bg-background/70 px-2 py-0.5 font-mono text-xs"
              >
                {name}
              </li>
            ))}
          </ul>
          <label
            className="flex cursor-pointer items-start gap-2 text-sm"
            htmlFor="docker-remove-conflicts"
          >
            <Checkbox
              id="docker-remove-conflicts"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              disabled={!canInstall}
            />
            <span>
              Remove {conflicts.join(', ')} before installing
              <span className="block text-xs text-muted-foreground">
                Containers they run stop and are not moved over to Docker.
              </span>
            </span>
          </label>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {canInstall ? (
        <Button
          size="sm"
          className="gap-1.5"
          disabled={busy || (conflicts.length > 0 && !agreed)}
          onClick={() => void install()}
        >
          {busy ? (
            <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
          ) : (
            <Docker className="h-3.5 w-3.5" />
          )}
          Install Docker
        </Button>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Ask an Admin of this server to install Docker.
        </p>
      )}
    </Card>
  );
}
