import { coreErrorMessage } from '@shared/coreErrors';
import { registryLabel } from '@shared/deploy/registries';
import type { DeployRegistryCredential } from '@shared/deployRegistryTypes';
import { useState } from 'react';
import { toast } from 'sonner';
import { Github, Lock, Monitor, Package, Plus, Trash2, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { confirmDialog } from '@/stores/confirmStore';
import { GhCliDialog } from './GhCliDialog';
import { GithubTokenDialog } from './GithubTokenDialog';
import { RegistryCredentialDialog } from './RegistryCredentialDialog';

/** How a sign-in was made, in words, with the broad ones marked as such (never by colour alone). */
function sourceText(credential: DeployRegistryCredential): string {
  if (credential.source === 'packagesToken') {
    return credential.broaderScopes.length === 0 ? 'Packages-only token' : 'GitHub token';
  }
  if (credential.source === 'ghCli') return 'GitHub CLI sign-in';
  return 'User name and token';
}

function CredentialRow({
  credential,
  onRemove,
}: {
  credential: DeployRegistryCredential;
  onRemove: () => void;
}): React.JSX.Element {
  const broad = credential.broaderScopes.length > 0;
  return (
    <li
      aria-label={registryLabel(credential.registry)}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {credential.kind === 'github' ? (
          <Github className="h-4 w-4" />
        ) : (
          <Package className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {registryLabel(credential.registry)}{' '}
          <span className="font-mono text-xs text-muted-foreground">{credential.registry}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {credential.username} · {sourceText(credential)}
        </span>
      </span>
      {broad && (
        <SimpleTooltip label={`Also allows: ${credential.broaderScopes.join(', ')}`}>
          <span
            tabIndex={0}
            className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Broad scopes
          </span>
        </SimpleTooltip>
      )}
      {credential.locked && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" /> Locked by the passkey
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Remove the sign-in for ${credential.registry}`}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

/**
 * Sign-ins kept on this computer (E08). They go with each deploy that pulls from their registry
 * and leave the server when the deploy ends. Adding one is open to anyone using this computer;
 * the server still checks the deploy's role.
 */
export function LocalRegistriesCard({
  credentials,
  loading,
  error,
  onChanged,
}: {
  credentials: DeployRegistryCredential[] | undefined;
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}): React.JSX.Element {
  const [dialog, setDialog] = useState<'github' | 'gh' | 'dockerhub' | 'custom' | null>(null);

  async function remove(credential: DeployRegistryCredential): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove the sign-in for ${credential.registry}?`,
      description:
        'Deploys from this computer stop sending it. Images that need it will not pull unless the server stores a credential of its own.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.deployRegistry.remove(credential.id);
      toast.success(`Removed the sign-in for ${credential.registry}.`);
      onChanged();
    } catch (failure) {
      toast.error(coreErrorMessage(failure));
    }
  }

  const close = () => setDialog(null);
  const saved = () => {
    setDialog(null);
    onChanged();
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4 text-primary" /> On this computer
        </CardTitle>
        <CardDescription>
          Sent with each deploy that pulls from the registry, kept in the server's memory for that
          deploy only, then wiped. Sealed here like your server passwords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !credentials ? (
          <p role="alert" className="text-sm text-destructive">
            The sign-ins did not load{error ? `: ${error}` : '.'}
          </p>
        ) : credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sign-ins yet. Public images pull without one.
          </p>
        ) : (
          <ul aria-label="Sign-ins on this computer" className="space-y-2">
            {credentials.map((credential) => (
              <CredentialRow
                key={credential.id}
                credential={credential}
                onRemove={() => void remove(credential)}
              />
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDialog('github')}>
            <Github className="h-3.5 w-3.5" /> GitHub packages token
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('gh')}>
            Use the gh sign-in
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('dockerhub')}>
            <Plus className="h-3.5 w-3.5" /> Docker Hub
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('custom')}>
            <Plus className="h-3.5 w-3.5" /> Custom registry
          </Button>
        </div>
      </CardContent>
      <GithubTokenDialog open={dialog === 'github'} onClose={close} onSaved={saved} />
      <GhCliDialog open={dialog === 'gh'} onClose={close} onSaved={saved} />
      <RegistryCredentialDialog
        kind={dialog === 'dockerhub' || dialog === 'custom' ? dialog : null}
        onClose={close}
        onSaved={saved}
      />
    </Card>
  );
}
