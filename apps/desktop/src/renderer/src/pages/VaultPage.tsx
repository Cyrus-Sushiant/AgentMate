import { vaultErrorMessage } from '@shared/vaultErrors';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VaultLockedScreen } from '@/components/vault/VaultLockedScreen';
import { VaultSetupScreen } from '@/components/vault/VaultSetupScreen';
import { VaultUnlockedView } from '@/components/vault/VaultUnlockedView';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';

function VaultPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 p-8">
        <Skeleton className="mx-auto h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

export default function VaultPage(): React.JSX.Element {
  usePageHeader('Vault', 'Passwords, API keys and private notes, encrypted on this computer.');
  const statusQuery = useQuery({
    queryKey: queryKeys.vaultStatus,
    queryFn: () => window.agentmat.vault.status(),
    meta: { silentLoading: true },
  });

  if (statusQuery.isLoading) return <VaultPageSkeleton />;

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="p-6">
        <ProjectEmptyState
          icon={TriangleAlert}
          title="The vault could not be opened"
          description={vaultErrorMessage(statusQuery.error)}
          action={
            <Button size="sm" variant="outline" onClick={() => void statusQuery.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  switch (statusQuery.data.state) {
    case 'uninitialized':
      return <VaultSetupScreen />;
    case 'locked':
      return <VaultLockedScreen status={statusQuery.data} />;
    case 'unlocked':
      return <VaultUnlockedView />;
  }
}
