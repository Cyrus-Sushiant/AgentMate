import { useId } from 'react';
import { Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';
import { Textarea } from '@/components/ui/textarea';
import { splitList } from '@/lib/deploy/sites/settings';
import { FieldError, Section, TextField, ToggleRow } from './fields';
import type { SiteTabProps } from './tabTypes';

/** Who may reach the site: addresses let in or kept out, and a password prompt. */

function NetworkList({
  label,
  hint,
  value,
  onChange,
  path,
  error,
  readOnly,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  path: string;
  error: SiteTabProps['error'];
  readOnly: boolean;
}): React.JSX.Element {
  const id = useId();
  const count = splitList(value).length;
  const problems = Array.from({ length: count }, (_, index) => error(`${path}[${index}]`)).filter(
    (message): message is string => message !== undefined,
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'203.0.113.4\n10.0.0.0/8'}
        rows={3}
        disabled={readOnly}
        spellCheck={false}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {problems.map((message) => (
        <FieldError key={message} message={message} />
      ))}
      <FieldError message={error(path) && problems.length === 0 ? error(path) : undefined} />
    </div>
  );
}

export function AccessFields({ draft, set, error, readOnly }: SiteTabProps): React.JSX.Element {
  function setUser(index: number, patch: Partial<SiteTabProps['draft']['users'][number]>): void {
    set({ users: draft.users.map((user, at) => (at === index ? { ...user, ...patch } : user)) });
  }

  return (
    <>
      <Section
        title="IP rules"
        description="One address or network per line. With an allow list, everyone else is turned away."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NetworkList
            label="Allow only"
            hint="Leave empty to let everyone in."
            value={draft.allow}
            onChange={(allow) => set({ allow })}
            path="ipRules.allow"
            error={error}
            readOnly={readOnly}
          />
          <NetworkList
            label="Block"
            hint="Checked before the allow list."
            value={draft.deny}
            onChange={(deny) => set({ deny })}
            path="ipRules.deny"
            error={error}
            readOnly={readOnly}
          />
        </div>
      </Section>
      <Section
        title="Password protection"
        description="The browser asks for a user name and password first."
      >
        <ToggleRow
          label="Basic auth"
          checked={draft.basicAuth}
          onChange={(basicAuth) => set({ basicAuth })}
          disabled={readOnly}
        />
        {draft.basicAuth && (
          <div className="space-y-3">
            <TextField
              label="Prompt"
              value={draft.realm}
              onChange={(realm) => set({ realm })}
              hint="Some browsers show it in the sign-in box."
              disabled={readOnly}
            />
            <ul aria-label="Users" className="space-y-2">
              {draft.users.map((user, index) => (
                <li key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`User ${index + 1} name`}
                      value={user.name}
                      onChange={(event) => setUser(index, { name: event.target.value })}
                      placeholder="name"
                      disabled={readOnly}
                      autoComplete="off"
                    />
                    <SecretInput
                      aria-label={`User ${index + 1} password`}
                      value={user.password}
                      onChange={(password) => setUser(index, { password })}
                      placeholder={user.saved ? 'Unchanged' : 'Password'}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove user ${user.name || index + 1}`}
                        onClick={() => set({ users: draft.users.filter((_, at) => at !== index) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <FieldError message={error(`basicAuth.users[${index}].name`)} />
                  <FieldError message={error(`basicAuth.users[${index}].password`)} />
                </li>
              ))}
            </ul>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set({ users: [...draft.users, { name: '', password: '', saved: false }] })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add a user
              </Button>
            )}
          </div>
        )}
        <FieldError message={error('basicAuth')} />
      </Section>
    </>
  );
}
