import type { DeployServer } from '@shared/deployTypes';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { CoreAccessCard } from '../CoreAccessCard';
import { AuditCard } from './AuditCard';
import { DevicesCard } from './DevicesCard';
import { hasRole } from './format';
import { SessionsCard } from './SessionsCard';
import { UsersCard } from './UsersCard';

/**
 * A server's Security area: who can sign in (Owners), the computers enrolled and the sessions
 * signed in (everyone's own; Admins see every computer), and the audit trail (Admins and Owners).
 * It shows only what the signed-in role may use, and the core checks every call again.
 */
export function SecurityPanel({ server }: { server: DeployServer }): React.JSX.Element {
  const access = useQuery({
    queryKey: queryKeys.deployAccess(server.id),
    queryFn: () => window.agentmat.deploy.access(server.id),
    retry: false,
    staleTime: 30_000,
  });

  if (access.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (access.data?.state !== 'signed-in') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in to see who can reach {server.nickname}, and from which computers.
        </p>
        <CoreAccessCard server={server} />
      </div>
    );
  }

  const roles = access.data.user?.roles;
  const owner = hasRole(roles, 'owner');
  const admin = hasRole(roles, 'admin');
  return (
    // Keyed by role: an Owner who steps down must not be left on a Users tab that is gone.
    <Tabs
      key={owner ? 'owner' : admin ? 'admin' : 'member'}
      defaultValue={owner ? 'users' : 'devices'}
      className="space-y-4"
    >
      <TabsList aria-label="Security">
        {owner && <TabsTrigger value="users">Users</TabsTrigger>}
        <TabsTrigger value="devices">Devices and sessions</TabsTrigger>
        {admin && <TabsTrigger value="audit">Audit trail</TabsTrigger>}
      </TabsList>
      {owner && (
        <TabsContent value="users">
          <UsersCard server={server} />
        </TabsContent>
      )}
      <TabsContent value="devices" className="space-y-4">
        <DevicesCard server={server} everyone={admin} />
        <SessionsCard server={server} />
      </TabsContent>
      {admin && (
        <TabsContent value="audit">
          <AuditCard server={server} />
        </TabsContent>
      )}
    </Tabs>
  );
}
