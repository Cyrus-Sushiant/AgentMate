import type { DeployWordPressSite } from '@shared/deployWordPressTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Key, LinkOff, Lock, Pencil, Spinner } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';
import { Switch } from '@/components/ui/switch';
import { queryKeys } from '@/lib/queryKeys';
import { AuditLogList } from './AuditLogList';
import { siteProjects, useProjects, useSiteInfo, useSiteSettings } from './hooks';
import {
  dateTimeText,
  lastSeenText,
  SCOPE_LABEL,
  SCOPE_SUMMARY,
  siteTimeText,
  TRANSPORT_LABEL,
  wpProblem,
} from './messages';
import { PlainHttpNotice } from './PlainHttpNotice';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-t border-border/60 py-2 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ConnectionCard({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const info = useSiteInfo(site.id).data;
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" /> Connection
          <Badge variant={site.scope === 'read' ? 'secondary' : 'outline'}>
            {SCOPE_LABEL[site.scope]}
          </Badge>
        </CardTitle>
        <CardDescription className="max-w-2xl">
          {SCOPE_SUMMARY[site.scope]}
          {site.scope === 'read' &&
            ' To deploy, make a read and write key in Tools > AgentMate Connector and connect the site again.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          <Row label="Site address">
            <span className="font-mono text-xs">{site.siteUrl}</span>
          </Row>
          {site.siteName && site.siteName !== site.label && (
            <Row label="Site name">{site.siteName}</Row>
          )}
          <Row label="Travels over">{TRANSPORT_LABEL[site.transport]}</Row>
          <Row label="Connected">{dateTimeText(site.connectedAt)}</Row>
          <Row label="Last reached">{lastSeenText(site)}</Row>
          <Row label="Connector">
            {site.pluginVersion}
            <span className="text-muted-foreground">, protocol {site.protocol}</span>
          </Row>
          {info && (
            <>
              <Row label="Name on the site">{info.connection.label || 'Not named'}</Row>
              <Row label="Key expires">
                {info.connection.expiresAt === null
                  ? 'Never'
                  : siteTimeText(info.connection.expiresAt)}
              </Row>
            </>
          )}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          This computer holds its own private key for the site, sealed with your other Servers
          secrets. Every request and every reply is signed, and the key you pasted to connect worked
          only once.
        </p>
      </CardContent>
    </Card>
  );
}

function RenameCard({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const id = useId();
  const save = useSiteSettings(site.id);
  const [draft, setDraft] = useState(site.label);
  const [busy, setBusy] = useState(false);
  const trimmed = draft.trim();

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!trimmed || trimmed === site.label) return;
    setBusy(true);
    try {
      await save({ label: trimmed });
      toast.success('Renamed the site.');
    } catch (error) {
      toast.error(wpProblem(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" /> Name
        </CardTitle>
        <CardDescription>
          What AgentMate calls this site. The site itself isn't changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void submit(event)}>
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <Label htmlFor={`${id}-label`}>Name in AgentMate</Label>
            <Input
              id={`${id}-label`}
              value={draft}
              maxLength={100}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || !trimmed || trimmed === site.label}>
            {busy && <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlainHttpCard({ site }: { site: DeployWordPressSite }): React.JSX.Element | null {
  const id = useId();
  const save = useSiteSettings(site.id);
  const [busy, setBusy] = useState(false);
  if (site.transport !== 'plain-http') return null;

  async function toggle(allowPlainHttp: boolean): Promise<void> {
    setBusy(true);
    try {
      await save({ allowPlainHttp });
      toast.success(
        allowPlainHttp
          ? 'Plain HTTP is allowed for this site.'
          : "Plain HTTP is off. AgentMate won't reach this site until it has HTTPS or you allow it again.",
      );
    } catch (error) {
      toast.error(wpProblem(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainHttpNotice>
      <div className="flex items-center gap-3 pl-6">
        <Switch
          id={`${id}-plain`}
          checked={site.allowPlainHttp}
          disabled={busy}
          onCheckedChange={(checked) => void toggle(checked)}
        />
        <Label htmlFor={`${id}-plain`} className="cursor-pointer">
          Allow plain HTTP for this site
        </Label>
      </div>
      {!site.allowPlainHttp && (
        <p className="pl-6 text-xs text-muted-foreground">
          Off, so AgentMate won't talk to this site until you allow it.
        </p>
      )}
    </PlainHttpNotice>
  );
}

/** HTTP Basic sign-in for a staging site. The password goes in and is never shown again. */
function HttpAuthCard({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const id = useId();
  const save = useSiteSettings(site.id);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const showForm = editing || !site.hasHttpAuth;

  function reset(): void {
    setUsername('');
    setPassword('');
    setEditing(false);
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      await save({ httpAuth: { username: username.trim(), password } });
      reset();
      toast.success('Saved the HTTP sign-in.');
    } catch (error) {
      setPassword('');
      toast.error(wpProblem(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    try {
      await save({ httpAuth: null });
      reset();
      toast.success('Removed the HTTP sign-in.');
    } catch (error) {
      toast.error(wpProblem(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> HTTP sign-in
        </CardTitle>
        <CardDescription className="max-w-2xl">
          For staging sites that ask for a user name and password before WordPress even loads. Most
          sites don't need this.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {site.hasHttpAuth && !editing && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-foreground">
              A sign-in is saved. The password is sealed on this computer and is never shown again.
            </p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              Change
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
              Remove
            </Button>
          </div>
        )}
        {showForm && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-user`}>User name</Label>
              <Input
                id={`${id}-user`}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <SecretInput id={`${id}-password`} value={password} onChange={setPassword} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={busy || !username.trim() || !password}>
                {busy && <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />}
                Save sign-in
              </Button>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DisconnectDialog({
  site,
  open,
  onOpenChange,
  onDisconnected,
}: {
  site: DeployWordPressSite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnected: () => void;
}): React.JSX.Element {
  const id = useId();
  const queryClient = useQueryClient();
  const linked = siteProjects(useProjects().data, site.id);
  const [revokeOnSite, setRevokeOnSite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function disconnect(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      await window.agentmat.deployWordPress.disconnect({ siteId: site.id, revokeOnSite });
      queryClient.setQueryData<DeployWordPressSite[]>(queryKeys.deployWordPressSites, (sites) =>
        sites?.filter((one) => one.id !== site.id),
      );
      queryClient.removeQueries({ queryKey: queryKeys.deployWordPressSite(site.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployWordPressSites });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      toast.success(`Disconnected ${site.label}.`);
      onOpenChange(false);
      onDisconnected();
    } catch (error) {
      setProblem(wpProblem(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setProblem(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect {site.label}?</DialogTitle>
          <DialogDescription>
            AgentMate forgets this site and its key on this computer. Nothing on the site changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {linked.length > 0 && (
            <p className="text-sm text-foreground">
              {linked.length === 1
                ? '1 project is linked to this site. It keeps its files'
                : `${linked.length} projects are linked to this site. They keep their files`}
              , but can't pull or deploy until you connect the site again and link{' '}
              {linked.length === 1 ? 'it' : 'them'}.
            </p>
          )}
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={`${id}-revoke`}
              checked={revokeOnSite}
              onCheckedChange={(checked) => setRevokeOnSite(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor={`${id}-revoke`} className="cursor-pointer space-y-1 leading-snug">
              <span className="block">Also revoke this computer's key on the site</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Recommended. The site stops accepting this computer's requests. If the site can't be
                reached, AgentMate still forgets it here; revoke the connection in wp-admin later.
              </span>
            </Label>
          </div>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void disconnect()}>
            {busy && <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />}
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who this computer is to the site and how it gets there: the key's scope, the plain-HTTP
 * opt-in, an HTTP sign-in for staging sites, the name, disconnecting, and the site's audit log.
 */
export function SiteAccessPanel({
  site,
  onDisconnected,
}: {
  site: DeployWordPressSite;
  onDisconnected: () => void;
}): React.JSX.Element {
  const [disconnecting, setDisconnecting] = useState(false);
  return (
    <div className="space-y-4">
      <PlainHttpCard site={site} />
      <ConnectionCard site={site} />
      <div className="grid gap-4 xl:grid-cols-2">
        <RenameCard site={site} />
        <HttpAuthCard site={site} />
      </div>
      <AuditLogList site={site} />
      <Card className="glass border-destructive/30">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <LinkOff className="h-4 w-4 text-destructive" /> Disconnect
            </CardTitle>
            <CardDescription>Forget this site on this computer.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDisconnecting(true)}>
            Disconnect
          </Button>
        </CardHeader>
      </Card>
      <DisconnectDialog
        site={site}
        open={disconnecting}
        onOpenChange={setDisconnecting}
        onDisconnected={onDisconnected}
      />
    </div>
  );
}
