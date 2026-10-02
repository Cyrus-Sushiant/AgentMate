import type { DeployServer } from '@shared/deployTypes';
import { useState } from 'react';
import { Archive, ArchiveRestore } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useStepUp } from '../useStepUp';
import { CreateBackupDialog } from './CreateBackupDialog';
import { RestoreDialog } from './RestoreDialog';

/**
 * Backups of the core (Owners): what goes in, how it is protected, and the two ways in, making
 * one and restoring one. Restoring needs SSH as root, which the DevHost does not have.
 */
export function BackupCard({
  server,
  userName,
}: {
  server: DeployServer;
  userName?: string;
}): React.JSX.Element {
  const stepUp = useStepUp(server);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-primary" /> Backups
        </CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">
          A backup holds the core's database (users, computers, sites, certificates, settings), the
          keys that open what it keeps encrypted, and the apps' files. It is encrypted on the server
          with a passphrase you choose (AES-256-GCM, the key stretched with PBKDF2), saved on this
          computer, and deleted from the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)}>
          <Archive className="h-4 w-4" /> Back up now
        </Button>
        <SimpleTooltip
          label={server.dev ? 'The DevHost has no SSH to restore over.' : undefined}
          wrapTrigger
        >
          <Button variant="outline" disabled={server.dev} onClick={() => setRestoring(true)}>
            <ArchiveRestore className="h-4 w-4" /> Restore a backup
          </Button>
        </SimpleTooltip>
      </CardContent>
      <CreateBackupDialog
        server={server}
        open={creating}
        stepUp={stepUp}
        onOpenChange={setCreating}
      />
      <RestoreDialog
        server={server}
        open={restoring}
        defaultUserName={userName}
        onOpenChange={setRestoring}
      />
      {stepUp.dialog}
    </Card>
  );
}
