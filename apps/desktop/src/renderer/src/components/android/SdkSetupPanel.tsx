import type { AndroidSdkStatus } from '@agentmat/core';
import {
  Android,
  CircleCheck,
  CircleX,
  ExternalLink,
  FolderOpen,
  RefreshCw,
} from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { Button } from '@/components/ui/button';

/**
 * What the page shows when it cannot talk to an SDK. The list of probed paths is the point: a
 * bare "not found" leaves the user guessing, while seeing that ANDROID_HOME was never checked
 * because it is unset, or that the folder they picked has no platform-tools, is a fix they can
 * make themselves.
 */

const INSTALL_URL = 'https://developer.android.com/studio';

interface SdkSetupPanelProps {
  sdk: AndroidSdkStatus;
  busy: boolean;
  onChooseFolder: () => void;
  onClearOverride: () => void;
  onRecheck: () => void;
}

function CheckedPaths({ sdk }: { sdk: AndroidSdkStatus }): React.JSX.Element {
  return (
    <div className="glass space-y-3 rounded-xl p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Where AgentMate looked
      </p>
      <ul className="space-y-1.5">
        {sdk.checked.map((path) => {
          const found = path === sdk.root && sdk.status === 'found';
          return (
            <li key={path} className="flex items-start gap-2 text-xs">
              {found ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              )}
              <span className="break-all font-mono text-muted-foreground">{path}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        An SDK folder holds at least one of platform-tools, emulator or cmdline-tools. Android
        Studio installs one for you, or you can install the command-line tools on their own.
      </p>
    </div>
  );
}

export function SdkSetupPanel({
  sdk,
  busy,
  onChooseFolder,
  onClearOverride,
  onRecheck,
}: SdkSetupPanelProps): React.JSX.Element {
  const overrideInvalid = sdk.status === 'override-invalid';

  return (
    <div className="space-y-4">
      <ProjectEmptyState
        icon={Android}
        title={overrideInvalid ? "That folder isn't an Android SDK" : 'Android SDK not found'}
        description={
          overrideInvalid
            ? 'The Android SDK path in Settings points somewhere that has no SDK in it. Pick the right folder, or clear the override and let AgentMate find one.'
            : 'AgentMate checked ANDROID_HOME, ANDROID_SDK_ROOT and the usual install folders for this system and came up empty. Point it at your SDK, or install one.'
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" disabled={busy} onClick={onChooseFolder}>
              <FolderOpen className="h-3.5 w-3.5" />
              Choose SDK folder
            </Button>
            {overrideInvalid && (
              <Button size="sm" variant="outline" disabled={busy} onClick={onClearOverride}>
                Clear override
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={onRecheck}>
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              Check again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void window.agentmat.shell.openExternal(INSTALL_URL)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              How to install
            </Button>
          </div>
        }
      />
      <CheckedPaths sdk={sdk} />
    </div>
  );
}
