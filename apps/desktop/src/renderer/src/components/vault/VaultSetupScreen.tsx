import { MASTER_PASSWORD_MIN_LENGTH, masterPasswordProblem } from '@agentmat/core';
import { vaultErrorMessage } from '@shared/vaultErrors';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Shield, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/ui/secret-input';
import { queryKeys } from '@/lib/queryKeys';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { VaultAccessCard } from './VaultAccessCard';

export function VaultSetupScreen(): React.JSX.Element {
  const queryClient = useQueryClient();
  const passwordId = useId();
  const confirmId = useId();
  const ackId = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = password ? masterPasswordProblem(password) : null;
  const mismatch = confirm !== '' && confirm !== password;
  const ready = password !== '' && !problem && confirm === password && acknowledged && !busy;

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await window.agentmat.vault.create(password);
      await queryClient.invalidateQueries({ queryKey: queryKeys.vaultStatus });
    } catch (err) {
      setError(vaultErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <VaultAccessCard
      icon={Shield}
      title="Create your vault"
      description="Keep logins, API keys and private notes in one place, encrypted on this computer with a master password only you know."
    >
      <form className="space-y-4" onSubmit={create}>
        <div className="space-y-1.5">
          <Label htmlFor={passwordId}>Master password</Label>
          <SecretInput
            id={passwordId}
            value={password}
            onChange={setPassword}
            placeholder={`At least ${MASTER_PASSWORD_MIN_LENGTH} characters`}
            autoFocus
            aria-invalid={problem ? true : undefined}
          />
          <PasswordStrengthMeter password={password} showWarning={!problem} />
          {problem && <p className="text-xs text-destructive">{problem}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={confirmId}>Type it again</Label>
          <SecretInput
            id={confirmId}
            value={confirm}
            onChange={setConfirm}
            aria-invalid={mismatch ? true : undefined}
          />
          {mismatch && <p className="text-xs text-destructive">The passwords don't match.</p>}
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <Checkbox
            id={ackId}
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor={ackId} className="text-xs font-normal leading-relaxed">
            I understand AgentMate can't recover this password. If I forget it, the vault can only
            be reset, and everything in it is lost.
          </Label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={!ready}>
          {busy && <Spinner className="h-3.5 w-3.5 animate-spin" />}
          Create vault
        </Button>
      </form>
    </VaultAccessCard>
  );
}
