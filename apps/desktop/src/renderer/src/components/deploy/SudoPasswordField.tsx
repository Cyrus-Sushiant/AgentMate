import type { SshErrorCode } from '@shared/sshErrors';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';

/** The sudo password, asked for only when the server needs one and the saved login has none. */
export function SudoPasswordField({
  id,
  user,
  value,
  onChange,
  onSubmit,
  errorCode,
}: {
  id: string;
  user: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  errorCode: SshErrorCode | null;
}): React.JSX.Element {
  const problem =
    errorCode === 'sudo-password-rejected'
      ? 'The server did not accept that password.'
      : errorCode === 'sudo-password-required'
        ? 'This server needs the sudo password to go on.'
        : null;
  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor={id}>Sudo password for {user}</Label>
      <SecretInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder="Password"
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-hint`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value) onSubmit();
        }}
      />
      {problem && <p className="text-xs text-destructive">{problem}</p>}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Used for this step only and never saved.
      </p>
    </div>
  );
}
