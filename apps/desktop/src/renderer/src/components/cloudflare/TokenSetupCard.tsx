import { tokenProblem, tokenTemplateUrl } from '@shared/cloudflare/permissions';
import { cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Key, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';
import { queryKeys } from '@/lib/queryKeys';
import { CloudflareMark } from './CloudflareMark';
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
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
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
  onCancel,
  onSaved,
}: {
  /** When a token is already saved: go back to it without replacing it. */
  onCancel?: () => void;
  onSaved?: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [token, setToken] = useState('');
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
      const status = await window.agentmat.cloudflare.saveToken(pasted);
      setToken('');
      queryClient.setQueryData(queryKeys.cloudflareStatus, status);
      // A different token can see different zones.
      queryClient.removeQueries({ queryKey: queryKeys.cloudflareData });
      toast.success('Cloudflare is connected.');
      onSaved?.();
    } catch (error) {
      setProblem(cloudflareErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudflareMark className="h-4 w-4" /> Connect Cloudflare
        </CardTitle>
        <CardDescription>
          AgentMate manages your domains with an API token that can only do what is listed below.
          The token stays on this computer, sealed like your server passwords, and is never shown
          again.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              variant="outline"
              size="sm"
              onClick={() => void window.agentmat.shell.openExternal(tokenTemplateUrl())}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Cloudflare's token page
            </Button>
          </Step>
          <Step number={2} title="Paste the token here">
            <form onSubmit={(event) => void save(event)} className="space-y-3">
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
              <div className="flex flex-wrap items-center gap-2">
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
                  <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                    Keep the current token
                  </Button>
                )}
              </div>
            </form>
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}
