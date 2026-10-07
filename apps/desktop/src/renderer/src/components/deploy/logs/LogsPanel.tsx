import type { DeployServer } from '@shared/deployTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { GLASS_CARD } from '@/components/pageKit';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useDeployAssistantStore } from '@/stores/deployAssistantStore';
import { LogViewer } from './LogViewer';
import { ProblemsFeed } from './ProblemsFeed';
import type { LogSource } from './useLogSource';

/** The tab strip as a pill track whose selection is the main menu's tinted pill. */
const TAB_LIST = 'search-pill mb-0 h-auto w-auto gap-0.5 rounded-full p-0.5';
const TAB = cn(
  'h-7 rounded-full border-none px-3 text-xs text-muted-foreground hover:bg-foreground/[0.06] focus-visible:ring-inset',
  'data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-primary/20 data-[state=active]:hover:bg-primary/12',
);

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
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as 'problems' | 'logs')}
      className="flex flex-col gap-2"
    >
      <TabsList containerClassName="self-start border-b-0" className={TAB_LIST}>
        <TabsTrigger value="problems" className={TAB}>
          Problems
        </TabsTrigger>
        <TabsTrigger value="logs" className={TAB}>
          Log viewer
        </TabsTrigger>
      </TabsList>
      <TabsContent value="problems" className="mt-0">
        <ProblemsFeed server={server} />
      </TabsContent>
      <TabsContent value="logs" className={cn(GLASS_CARD, 'mt-0 flex min-h-[32rem] flex-col p-3')}>
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
