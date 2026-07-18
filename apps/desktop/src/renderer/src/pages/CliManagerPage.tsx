import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, RefreshCw, TerminalSquare } from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useTerminalStore } from '@/stores/terminalStore';

export default function CliManagerPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const setDefaultCliId = useCliStore((s) => s.setDefaultCliId);
  const openSession = useTerminalStore((s) => s.openSession);
  const [showAll, setShowAll] = useState(false);

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

  usePageHeader('AI CLI Manager', 'Detected AI coding CLIs on this machine. Install missing ones with one click.');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex justify-end">
        <div className="flex gap-2">
          {notInstalledCount > 0 && (
            <Button variant="outline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Hide not installed' : `Show all CLIs (${notInstalledCount} not installed)`}
            </Button>
          )}
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
                  <CardTitle>{cli.name}</CardTitle>
                  <Badge variant={status?.installed ? 'success' : 'outline'}>
                    {status?.installed ? (status.version ?? 'Installed') : 'Not installed'}
                  </Badge>
                </div>
                <CardDescription>{cli.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2">
                {status?.installed ? (
                  <Button
                    variant={isDefault ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setDefaultCliId(isDefault ? null : cli.id)}
                  >
                    {isDefault ? 'Default CLI' : 'Set as default'}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void handleInstall(cli.id, cli.name)}>
                    <TerminalSquare /> Install
                  </Button>
                )}
                {cli.homepageUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Open homepage"
                    onClick={() => void window.agentmat.shell.openExternal(cli.homepageUrl!)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
