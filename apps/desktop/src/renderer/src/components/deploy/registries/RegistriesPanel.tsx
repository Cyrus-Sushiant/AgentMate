import { coreErrorMessage } from '@shared/coreErrors';
import type { DeployServer } from '@shared/deployTypes';
import { ArrowLeft, Key } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { AppsAccess } from '../apps/hooks';
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
    <section aria-labelledby="registries-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Apps
        </Button>
        <div className="min-w-0 flex-1">
          <h3
            id="registries-heading"
            className="flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <Key className="h-4 w-4 text-primary" /> Registries
          </h3>
          <p className="text-xs text-muted-foreground">
            Sign-ins for private images. A deploy never leaves a token on {server.nickname}'s disk:
            it lives in memory for that deploy and is wiped when it ends, even when it fails.
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
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
          <p className="text-sm text-muted-foreground">
            Credentials stored on the server are shown to Operators and above.
          </p>
        )}
      </div>
      {proof.dialog}
    </section>
  );
}
