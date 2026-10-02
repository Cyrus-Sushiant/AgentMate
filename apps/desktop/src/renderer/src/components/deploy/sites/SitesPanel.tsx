import { coreErrorMessage } from '@shared/coreErrors';
import type {
  JobInfo,
  NginxApplyResult,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { DeployServer } from '@shared/deployTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import type { SiteTab } from '@/lib/deploy/sites/problems';
import { queryKeys } from '@/lib/queryKeys';
import { CoreAccessCard } from '../CoreAccessCard';
import { JobLogDialog } from '../overview/JobLogDialog';
import { hasRole } from '../security/format';
import { ApplyBar } from './ApplyBar';
import { useNginxStatus, useRefreshWeb, useSites, useStreams } from './hooks';
import { NginxCard } from './NginxCard';
import { SiteEditor } from './SiteEditor';
import { SitesCard } from './SitesCard';
import { StreamProxiesCard } from './StreamProxiesCard';

/**
 * A server's Websites section: nginx, the sites with their routes, TCP and UDP proxies, and the
 * Apply bar that puts saved changes live. Everyone signed in sees it; Admins change sites and
 * certificates, Owners also write custom directives, and the core checks every call again.
 */

interface Editing {
  /** Null for a new site. */
  siteId: string | null;
  tab: SiteTab;
}

export function SitesPanel({ server }: { server: DeployServer }): React.JSX.Element {
  const access = useQuery({
    queryKey: queryKeys.deployAccess(server.id),
    queryFn: () => window.agentmat.deploy.access(server.id),
    retry: false,
    staleTime: 30_000,
  });
  const signedIn = access.data?.state === 'signed-in';
  const status = useNginxStatus(server.id, signedIn);
  const sites = useSites(server.id, signedIn);
  const streams = useStreams(server.id, signedIn);
  const refresh = useRefreshWeb(server.id);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<NginxApplyResult | null>(null);
  const [installJob, setInstallJob] = useState<JobInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  if (access.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }
  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in to see the websites on {server.nickname}.
        </p>
        <CoreAccessCard server={server} />
      </div>
    );
  }

  const roles = access.data?.user?.roles;
  const admin = hasRole(roles, 'admin');
  const owner = hasRole(roles, 'owner');
  const nginx = status.data;
  const managed = nginx?.managed ?? false;
  const applyProblems = applied && !applied.applied ? applied.problems : [];

  async function install(): Promise<void> {
    setInstalling(true);
    try {
      setInstallJob(await window.agentmat.deploySites.install(server.id));
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      setInstalling(false);
    }
  }

  async function apply(): Promise<void> {
    setApplying(true);
    try {
      const result = await window.agentmat.deploySites.applyChanges(server.id);
      setApplied(result);
      if (result.applied) {
        toast.success(
          result.release ? `Applied. nginx runs release ${result.release}.` : 'Applied.',
        );
      }
    } catch (error) {
      setApplied({ applied: false, problems: [], warnings: [], error: coreErrorMessage(error) });
    } finally {
      setApplying(false);
      void refresh();
    }
  }

  const editedSite = editing?.siteId
    ? sites.data?.find((site) => site.settings.id === editing.siteId)
    : undefined;

  return (
    <div className="space-y-4">
      <ApplyBar
        pending={nginx?.pendingChanges ?? false}
        applying={applying}
        admin={admin}
        result={applied}
        onApply={() => void apply()}
        onShowProblem={(problem) => {
          if (problem.scope === 'site' && problem.id)
            setEditing({ siteId: problem.id, tab: problem.tab });
        }}
      />
      {editing && (editing.siteId === null || editedSite) ? (
        <SiteEditor
          key={editing.siteId ?? 'new'}
          server={server}
          site={editedSite}
          admin={admin}
          owner={owner}
          applyProblems={applyProblems}
          initialTab={editing.tab}
          onClose={() => setEditing(null)}
          onSaved={(site) => {
            void refresh();
            if (editing.siteId === null) setEditing({ siteId: site.settings.id, tab: 'ssl' });
          }}
          onChanged={() => void refresh()}
        />
      ) : (
        <>
          <NginxCard
            status={nginx}
            loading={status.isPending}
            error={status.error ? coreErrorMessage(status.error) : null}
            admin={admin}
            installing={installing}
            onInstall={() => void install()}
          />
          <SitesCard
            sites={sites.data}
            loading={sites.isPending}
            error={sites.error ? coreErrorMessage(sites.error) : null}
            admin={admin}
            managed={managed}
            onOpen={(siteId, tab) => setEditing({ siteId, tab })}
            onAdd={() => setEditing({ siteId: null, tab: 'domains' })}
          />
          <StreamProxiesCard
            serverId={server.id}
            proxies={streams.data}
            loading={streams.isPending}
            error={streams.error ? coreErrorMessage(streams.error) : null}
            admin={admin}
            available={managed && (nginx?.streamSupported ?? false)}
            onChanged={() => void refresh()}
          />
        </>
      )}
      <JobLogDialog
        serverId={server.id}
        job={installJob}
        canCancel={admin}
        onClose={() => setInstallJob(null)}
        onFinished={() => void refresh()}
      />
    </div>
  );
}
