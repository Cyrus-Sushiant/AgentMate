import { tokenProblem, tokenTemplateUrl } from '@shared/cloudflare/permissions';
import { cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Key, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';
import { queryKeys } from '@/lib/queryKeys';
import { CloudflareMark } from './CloudflareMark';
import { CardBody, CloudflareCard } from './fields';
import { PermissionList } from './PermissionList';

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Connecting Cloudflare with a token limited to what AgentMate uses. The token page opens with
 * those permissions chosen; the token pasted back goes to the main process once, to be checked
 * and sealed, and the field is emptied right after.
 */
export function TokenSetupCard({
  account,
  additional = false,
  onCancel,
  onSaved,
}: {
  /** Replacing this account's token, rather than connecting an account. */
  account?: { id: string; label: string };
  /** Connecting one more account while others are already connected. */
  additional?: boolean;
  /** When an account is already connected: go back to it without saving anything. */
  onCancel?: () => void;
  onSaved?: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const nameId = useId();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const pasted = token.trim();
    const local = tokenProblem(pasted);
    if (local) {
      setProblem(local);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const typedName = name.trim();
      const status = await window.agentmat.cloudflare.saveToken({
        token: pasted,
        ...(account ? { accountId: account.id } : {}),
        ...(!account && typedName !== '' ? { label: typedName } : {}),
      });
      setToken('');
      setName('');
      queryClient.setQueryData(queryKeys.cloudflareStatus, status);
      // A different token can see different zones.
      queryClient.removeQueries({ queryKey: queryKeys.cloudflareData });
      toast.success(
        account ? `Replaced the token for ${account.label}.` : 'Cloudflare account connected.',
      );
      onSaved?.();
    } catch (error) {
      setProblem(cloudflareErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CloudflareCard
      icon={<CloudflareMark />}
      title={
        account
          ? `Replace the token for ${account.label}`
          : additional
            ? 'Connect another Cloudflare account'
            : 'Connect Cloudflare'
      }
      description={
        additional
          ? 'Each Cloudflare account gets its own API token, made on that account. Its domains then show up beside the others. The token stays on this computer, sealed like your server passwords, and is never shown again.'
          : 'AgentMate manages your domains with an API token that can only do what is listed below. The token stays on this computer, sealed like your server passwords, and is never shown again.'
      }
    >
      <CardBody>
        <ol className="space-y-6">
          <Step number={1} title="Create a token on Cloudflare">
            <p className="text-sm text-muted-foreground">
              The page opens with these permissions already chosen. Under Zone Resources, include
              all zones or just the domains AgentMate should manage, then create the token and copy
              it.
            </p>
            <PermissionList />
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => void window.agentmat.shell.openExternal(tokenTemplateUrl())}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Cloudflare's token page
            </Button>
          </Step>
          <Step number={2} title="Paste the token here">
            <form onSubmit={(event) => void save(event)} className="space-y-3">
              {!account && (
                <div className="space-y-1.5">
                  <Label htmlFor={nameId}>Name (optional)</Label>
                  <Input
                    id={nameId}
                    value={name}
                    maxLength={60}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="For example Work, or the client's name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={fieldId}>API token</Label>
                <SecretInput
                  id={fieldId}
                  value={token}
                  onChange={(value) => {
                    setToken(value);
                    setProblem(null);
                  }}
                  placeholder="The token Cloudflare showed you"
                />
              </div>
              {problem && (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button type="submit" size="sm" disabled={busy || token.trim() === ''}>
                  {busy ? (
                    <>
                      <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" /> Checking with
                      Cloudflare…
                    </>
                  ) : (
                    <>
                      <Key className="h-3.5 w-3.5" /> Save and check
                    </>
                  )}
                </Button>
                {onCancel && (
                  <Button type="button" variant="soft" size="sm" onClick={onCancel}>
                    {account ? 'Keep the current token' : 'Cancel'}
                  </Button>
                )}
              </div>
            </form>
          </Step>
        </ol>
      </CardBody>
    </CloudflareCard>
  );
}
