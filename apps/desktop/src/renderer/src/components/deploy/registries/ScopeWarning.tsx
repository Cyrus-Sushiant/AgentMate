import { useId } from 'react';
import { TriangleAlert } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/** What GitHub's broader scopes let someone do with the token, in a few words each. */
const SCOPE_MEANING: Record<string, string> = {
  repo: 'read and change every repository you can reach, private ones included',
  workflow: 'change GitHub Actions workflows',
  'write:packages': 'publish and overwrite packages',
  'delete:packages': 'delete packages',
  'admin:org': 'manage your organizations',
  gist: 'read and write your gists',
  'read:org': 'read your organizations and teams',
  user: 'change your profile',
};

/**
 * The warning a token with more than read:packages gets before it is saved. The token reaches a
 * server for the length of each deploy, so a server that is broken into would hold all of it.
 */
export function ScopeWarning({
  scopes,
  accepted,
  onAccept,
}: {
  scopes: readonly string[];
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
}): React.JSX.Element {
  const id = useId();
  return (
    <div
      role="group"
      aria-label="Broader scopes"
      className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <p className="flex items-start gap-2 font-medium text-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        This token can do much more than pull images
      </p>
      <ul aria-label="Scopes beyond read:packages" className="space-y-1 pl-6 text-xs">
        {scopes.map((scope) => (
          <li key={scope}>
            <span className="font-mono text-foreground">{scope}</span>
            {SCOPE_MEANING[scope] ? (
              <span className="text-muted-foreground">: {SCOPE_MEANING[scope]}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        It goes to the server for each deploy. If that server were broken into while a deploy runs,
        whoever did it could use your GitHub account with these scopes. A token with just
        read:packages is the safer choice.
      </p>
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={accepted}
          onCheckedChange={(value) => onAccept(value === true)}
        />
        <Label htmlFor={id} className="text-xs leading-snug">
          I understand, and I want to use this token anyway
        </Label>
      </div>
    </div>
  );
}
