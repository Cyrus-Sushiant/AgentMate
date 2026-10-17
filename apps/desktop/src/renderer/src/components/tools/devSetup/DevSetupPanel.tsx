import { type ChecklistRow, DEV_STACKS, getDevItem } from '@agentmat/core';
import { GLASS_CARD, LoadFailure, Notice } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { describeRow, type RowAction, type RowView } from './devSetupView';
import { SetupSummary } from './SetupSummary';
import { StackChecklist } from './StackChecklist';
import { StackChips } from './StackChips';
import { useDevSetup } from './useDevSetup';

/** The Microsoft Store page for App Installer, which is what provides winget. */
const APP_INSTALLER_URL = 'https://apps.microsoft.com/detail/9nblggh4nns1';

/** Stand-in rows while the machine is being looked at, so the page keeps its shape. */
function ChecklistSkeleton(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Looking at this computer"
      className={cn(
        GLASS_CARD,
        'flex flex-col [&>div+div]:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]',
      )}
    >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Agent Tools > Dev Setup: pick what you build, see what this machine has and lacks, and get the
 * rest in place. Everything is laid out here; what each row says and offers comes from
 * `describeRow`, and the data and actions come from `useDevSetup`.
 */
export function DevSetupPanel(): React.JSX.Element {
  const devSetup = useDevSetup();
  const { checklist, environment } = devSetup;

  const nameOf = (id: string): string =>
    checklist?.rows.find((row) => row.item.id === id)?.name ?? getDevItem(id)?.name ?? id;

  const viewOf = (row: ChecklistRow): RowView =>
    describeRow(row, {
      os: environment?.os ?? 'win32',
      // Installs are handed to a terminal for now; the app runs them itself once they can be.
      inAppInstall: false,
      nameOf,
    });

  function handleAction(row: ChecklistRow, view: RowView, action: RowAction): void {
    switch (action.kind) {
      case 'terminal-install':
        if (view.terminalCommand) {
          devSetup.openInTerminal({
            id: row.item.id,
            name: row.name,
            command: view.terminalCommand,
          });
        }
        break;
      case 'open-link':
        if (action.url) void window.agentmat.shell.openExternal(action.url);
        break;
      case 'retry':
      case 'recheck':
        devSetup.recheck(row.item.id);
        break;
      default:
        break;
    }
  }

  const wingetMissing =
    environment?.os === 'win32' && !environment.packageManagers.includes('winget');
  const noLinuxManager = environment?.os === 'linux' && environment.packageManagers.length === 0;

  return (
    <div className="@container/devsetup flex flex-col gap-2">
      <StackChips stacks={DEV_STACKS} selected={devSetup.stacks} onToggle={devSetup.toggleStack} />

      {devSetup.environmentFailed ? (
        <LoadFailure message="Could not look at this computer." retry={devSetup.retryEnvironment} />
      ) : !checklist ? (
        <ChecklistSkeleton />
      ) : (
        <>
          <SetupSummary summary={checklist.summary} onRecheckAll={devSetup.recheckAll} />

          {wingetMissing && (
            <Notice
              tone="warning"
              action={
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void window.agentmat.shell.openExternal(APP_INSTALLER_URL)}
                >
                  Open the Microsoft Store page
                </Button>
              }
            >
              winget was not found, so installs open a download page instead of running here.
              Install App Installer from the Microsoft Store to get one-click installs.
            </Notice>
          )}
          {noLinuxManager && (
            <Notice tone="warning">
              No supported package manager was found (apt, dnf or pacman), so installs open a
              download page instead.
            </Notice>
          )}

          {checklist.groups.map((group) => (
            <StackChecklist
              key={group.stack.id}
              group={group}
              viewOf={viewOf}
              onAction={handleAction}
              onTerminal={(row, view) => {
                if (view.terminalCommand) {
                  devSetup.openInTerminal({
                    id: row.item.id,
                    name: row.name,
                    command: view.terminalCommand,
                  });
                }
              }}
              onCopy={(row, view) => {
                if (view.terminalCommand) {
                  void devSetup.copyCommand({ name: row.name, command: view.terminalCommand });
                }
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
