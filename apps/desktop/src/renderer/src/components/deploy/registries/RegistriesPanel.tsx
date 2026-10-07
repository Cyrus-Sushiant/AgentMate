import { coreErrorMessage } from '@shared/coreErrors';
import type { DeployServer } from '@shared/deployTypes';
import { ArrowLeft, Key, Lock } from '@/components/icons';
import { GLASS_CARD } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppsAccess } from '../apps/hooks';
import { Notice } from '../deployKit';
import { useProofStepUp } from '../overview/useProofStepUp';
import { useLocalRegistries, useRefreshRegistries, useServerRegistries } from './hooks';
import { LocalRegistriesCard } from './LocalRegistriesCard';
import { ServerRegistriesCard } from './ServerRegistriesCard';

/**
 * Private registries for a server's Apps (E08), at `&view=apps&registries=1`: the sign-ins on
 * this computer that go with each deploy, and the credentials the server stores for itself.
 */
export function RegistriesPanel({
  server,
  access,
  onBack,
}: {
  server: DeployServer;
  access: AppsAccess;
  onBack: () => void;
}): React.JSX.Element {
  const local = useLocalRegistries();
  const stored = useServerRegistries(server.id, access.signedIn && access.canOperate);
  const refresh = useRefreshRegistries();
  const proof = useProofStepUp(server);

  return (
    <section aria-labelledby="registries-heading" className="flex flex-col gap-2">
      <div className={cn(GLASS_CARD, 'flex flex-wrap items-start gap-3 p-4')}>
        <Button size="sm" variant="soft" onClick={onBack}>
          <ArrowLeft /> Apps
        </Button>
        <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Key className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-0.5 pt-0.5">
            <h3
              id="registries-heading"
              className="text-sm font-semibold leading-tight text-foreground"
            >
              Registries
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sign-ins for private images. A deploy never leaves a token on {server.nickname}'s
              disk: it lives in memory for that deploy and is wiped when it ends, even when it
              fails.
            </p>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-2 xl:grid-cols-2">
        <LocalRegistriesCard
          credentials={local.data}
          loading={local.isPending}
          error={local.error ? coreErrorMessage(local.error) : null}
          onChanged={() => void refresh()}
        />
        {access.canOperate ? (
          <ServerRegistriesCard
            server={server}
            credentials={stored.data}
            loading={stored.isPending}
            error={stored.error ? coreErrorMessage(stored.error) : null}
            canAdmin={access.canAdmin}
            local={local.data ?? []}
            proof={proof}
            onChanged={() => void refresh()}
          />
        ) : (
          <Notice icon={Lock}>
            Credentials stored on the server are shown to Operators and above.
          </Notice>
        )}
      </div>
      {proof.dialog}
    </section>
  );
}
