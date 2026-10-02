import type { DeployServer } from '@shared/deployTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { useDeployAssistantStore } from '@/stores/deployAssistantStore';
import { LogViewer } from './LogViewer';
import { ProblemsFeed } from './ProblemsFeed';
import type { LogSource } from './useLogSource';

/**
 * A server's Logs section (E09): what is broken right now (the problems feed), and every log in
 * one viewer. "Ask the AI" from the viewer opens the Deploy AI on what is shown.
 */

export function LogsPanel({ server }: { server: DeployServer }): React.JSX.Element {
  const [tab, setTab] = useState<'problems' | 'logs'>('problems');
  const open = useDeployAssistantStore((state) => state.open);
  const containers = useQuery({
    queryKey: queryKeys.deployContainers(server.id),
    queryFn: () => window.agentmat.deployDocker.listContainers(server.id),
    enabled: tab === 'logs',
    retry: false,
    meta: { silentLoading: true },
  });
  const sites = useQuery({
    queryKey: queryKeys.deploySites(server.id),
    queryFn: async () => (await window.agentmat.deploySites.list(server.id)) ?? [],
    enabled: tab === 'logs',
    retry: false,
    meta: { silentLoading: true },
  });

  const askAi = (source: LogSource) =>
    open(server.id, {
      prompt: 'Read this log and tell me what is going wrong.',
      context: {
        title: `Logs: ${source.label}`,
        ...(source.kind === 'container' ? { containerId: source.containerId } : {}),
        facts:
          source.kind === 'journal'
            ? [`The systemd unit ${source.unit}. journalctl -u ${source.unit} reads its journal.`]
            : source.kind === 'stack'
              ? [
                  `The compose project ${source.project}, services ${source.containers.map((c) => c.service).join(', ')}.`,
                ]
              : [],
      },
    });

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as 'problems' | 'logs')}>
      <TabsList>
        <TabsTrigger value="problems">Problems</TabsTrigger>
        <TabsTrigger value="logs">Log viewer</TabsTrigger>
      </TabsList>
      <TabsContent value="problems" className="pt-3">
        <ProblemsFeed server={server} />
      </TabsContent>
      <TabsContent value="logs" className="flex min-h-[32rem] flex-col pt-3">
        <LogViewer
          serverId={server.id}
          containers={containers.data}
          sites={sites.data}
          onAskAi={askAi}
        />
      </TabsContent>
    </Tabs>
  );
}
