import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CloudDownload, ExternalLink, RefreshCw, TerminalSquare } from '@/components/icons';
import { CliLogo } from '@/components/cliLogos';
import { CLI_REGISTRY, type CliDefinition } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useTerminalStore } from '@/stores/terminalStore';

interface PendingUpdate {
  cli: CliDefinition;
  currentVersion: string | null;
  latestVersion: string;
  command: string;
}

export default function CliManagerPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const setDefaultCliId = useCliStore((s) => s.setDefaultCliId);
  const openSession = useTerminalStore((s) => s.openSession);
  const [showAll, setShowAll] = useState(false);
  const [checkingCliId, setCheckingCliId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [, setUpdateQueue] = useState<PendingUpdate[]>([]);

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
  });

  const visibleClis = showAll
    ? CLI_REGISTRY
    : CLI_REGISTRY.filter((cli) => cliQuery.data?.find((c) => c.id === cli.id)?.installed);
  const notInstalledCount = CLI_REGISTRY.length - (cliQuery.data?.filter((c) => c.installed).length ?? 0);

  async function handleInstall(cliId: string, cliName: string): Promise<void> {
    const command = await window.agentmat.cli.getInstallCommand(cliId);
    if (!command) {
      toast.error(`No install command available for ${cliName} on this OS.`);
      return;
    }
    openSession({ title: `Install ${cliName}`, initialInput: command });
    toast.info(`Press Enter in the terminal to install ${cliName}.`);
  }

  async function handleCheckForUpdate(cli: CliDefinition, currentVersion: string | null): Promise<void> {
    setCheckingCliId(cli.id);
    try {
      const result = await window.agentmat.cli.checkForUpdate(cli.id, currentVersion);
      if (!result.supported) {
        toast.info(`Can't check updates for ${cli.name} automatically.`);
        return;
      }
      if (!result.latestVersion) {
        toast.error(`Couldn't reach the update server for ${cli.name}.`);
        return;
      }
      if (!result.updateAvailable) {
        toast.success(`${cli.name} is up to date (v${result.latestVersion}).`);
        return;
      }

      const command = await window.agentmat.cli.getUpdateCommand(cli.id);
      if (!command) {
        toast.error(`No update command available for ${cli.name} on this OS.`);
        return;
      }
      setPendingUpdate({ cli, currentVersion, latestVersion: result.latestVersion, command });
    } finally {
      setCheckingCliId(null);
    }
  }

  function handleConfirmUpdate(): void {
    if (!pendingUpdate) return;
    openSession({ title: `Update ${pendingUpdate.cli.name}`, initialInput: pendingUpdate.command });
    toast.info(`Press Enter in the terminal to update ${pendingUpdate.cli.name}.`);
    dismissPendingUpdate();
  }

  function dismissPendingUpdate(): void {
    setUpdateQueue((queue) => {
      const [next, ...rest] = queue;
      setPendingUpdate(next ?? null);
      return rest;
    });
  }

  async function handleCheckAllForUpdates(): Promise<void> {
    const installedClis = CLI_REGISTRY.filter((cli) => cliQuery.data?.find((c) => c.id === cli.id)?.installed);
    if (installedClis.length === 0) {
      toast.info('No installed CLIs to check.');
      return;
    }

    setCheckingAll(true);
    try {
      const updates: PendingUpdate[] = [];
      let uncheckable = 0;

      for (const cli of installedClis) {
        const currentVersion = cliQuery.data?.find((c) => c.id === cli.id)?.version ?? null;
        const result = await window.agentmat.cli.checkForUpdate(cli.id, currentVersion);
        if (!result.supported || !result.latestVersion) {
          uncheckable += 1;
          continue;
        }
        if (result.updateAvailable) {
          const command = await window.agentmat.cli.getUpdateCommand(cli.id);
          if (command) {
            updates.push({ cli, currentVersion, latestVersion: result.latestVersion, command });
          }
        }
      }

      if (updates.length === 0) {
        toast.success(
          uncheckable > 0
            ? `All checkable CLIs are up to date (${uncheckable} could not be checked).`
            : 'All CLIs are up to date.'
        );
        return;
      }

      toast.info(`${updates.length} CLI update${updates.length > 1 ? 's' : ''} available.`);
      const [first, ...rest] = updates;
      setPendingUpdate(first);
      setUpdateQueue(rest);
    } finally {
      setCheckingAll(false);
    }
  }

  usePageHeader('AI CLI Manager', 'Detected AI coding CLIs on this machine. Install missing ones with one click.');

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-end">
        <div className="flex gap-2">
          {notInstalledCount > 0 && (
            <Button variant="outline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Hide not installed' : `Show all CLIs (${notInstalledCount} not installed)`}
            </Button>
          )}
          <Button variant="outline" disabled={checkingAll} onClick={() => void handleCheckAllForUpdates()}>
            <CloudDownload className={checkingAll ? 'animate-pulse' : undefined} />
            {checkingAll ? 'Checking updates…' : 'Check all for updates'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.cliStatus });
              toast.info('Re-scanning installed CLIs…');
            }}
          >
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      {visibleClis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No AI CLIs installed yet. Click "Show all CLIs" above to discover and install one.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleClis.map((cli) => {
          const status = cliQuery.data?.find((c) => c.id === cli.id);
          const isDefault = defaultCliId === cli.id;

          return (
            <Card key={cli.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CliLogo cliId={cli.id} className="h-4 w-4" />
                    <CardTitle>{cli.name}</CardTitle>
                  </div>
                  <Badge variant={status?.installed ? 'success' : 'outline'}>
                    {status?.installed ? (status.version ?? 'Installed') : 'Not installed'}
                  </Badge>
                </div>
                <CardDescription>{cli.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2">
                {status?.installed ? (
                  <>
                    <Button
                      variant={isDefault ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setDefaultCliId(isDefault ? null : cli.id)}
                    >
                      {isDefault ? 'Default CLI' : 'Set as default'}
                    </Button>
                    <SimpleTooltip label="Check for updates">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={checkingCliId === cli.id}
                        onClick={() => void handleCheckForUpdate(cli, status.version)}
                      >
                        <CloudDownload className={checkingCliId === cli.id ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
                      </Button>
                    </SimpleTooltip>
                  </>
                ) : (
                  <Button size="sm" onClick={() => void handleInstall(cli.id, cli.name)}>
                    <TerminalSquare /> Install
                  </Button>
                )}
                {cli.homepageUrl && (
                  <SimpleTooltip label="Open homepage">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void window.agentmat.shell.openExternal(cli.homepageUrl!)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={pendingUpdate !== null} onOpenChange={(open) => !open && dismissPendingUpdate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {pendingUpdate?.cli.name}?</DialogTitle>
            <DialogDescription>
              This opens a terminal session and runs the update command below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Current version:</span>{' '}
              {pendingUpdate?.currentVersion ?? 'unknown'}
            </p>
            <p>
              <span className="text-muted-foreground">Latest version:</span> {pendingUpdate?.latestVersion}
            </p>
            <code className="block overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {pendingUpdate?.command}
            </code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={dismissPendingUpdate}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
