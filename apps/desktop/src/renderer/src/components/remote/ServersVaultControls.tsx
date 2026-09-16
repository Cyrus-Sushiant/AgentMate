import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Key, Lock, LockOpen } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';

/**
 * The Servers passkey badge and buttons. SSH and Remote Desktop servers share one passkey,
 * so both tabs show the same controls; each tab owns its unlock dialog.
 */
export function ServersVaultControls({
  onRequestDialog,
}: {
  onRequestDialog: (mode: 'unlock' | 'set') => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const vaultQuery = useQuery({
    queryKey: queryKeys.sshVaultStatus,
    queryFn: () => window.agentmat.ssh.vaultStatus(),
  });
  const vault = vaultQuery.data ?? { hasPasskey: false, unlocked: false };

  async function removePasskey(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Remove the Servers passkey?',
      description:
        'Saved passwords and key passphrases for SSH and Remote Desktop go back to OS-keychain-only protection.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;
    const result = await window.agentmat.ssh.setPasskey(null);
    if (!result.ok) {
      toast.error(result.error ?? 'Could not remove the passkey.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
  }

  if (!vault.hasPasskey) {
    return (
      <SimpleTooltip label="Encrypt saved passwords and key passphrases with a passkey instead of just the OS keychain">
        <Button size="sm" variant="ghost" onClick={() => onRequestDialog('set')}>
          <Lock className="h-3.5 w-3.5" /> Protect with a passkey
        </Button>
      </SimpleTooltip>
    );
  }

  if (!vault.unlocked) {
    return (
      <Button size="sm" variant="outline" onClick={() => onRequestDialog('unlock')}>
        <Lock className="h-3.5 w-3.5" /> Unlock vault
      </Button>
    );
  }

  return (
    <>
      <Badge variant="success" className="gap-1.5">
        <LockOpen className="h-3 w-3" /> Vault unlocked
      </Badge>
      <SimpleTooltip label="Change the Servers passkey">
        <Button size="icon" variant="ghost" onClick={() => onRequestDialog('set')}>
          <Key className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip label="Remove the Servers passkey">
        <Button size="icon" variant="ghost" onClick={() => void removePasskey()}>
          <Lock className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    </>
  );
}
