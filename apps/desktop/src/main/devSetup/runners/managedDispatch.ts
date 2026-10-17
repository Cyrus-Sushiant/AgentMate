import type { DevItemId, DevRecipe } from '@agentmat/core';
import type { RunHooks, RunResult } from './packageManagerRunner';

/**
 * Which of the app's own installers a `managed` recipe means. The Android package ids come from
 * the catalog (through `androidPackages`), so nothing that reaches sdkmanager was ever typed by
 * the renderer.
 */

export interface ManagedRunners {
  flutter: { run: (hooks: RunHooks) => Promise<RunResult> };
  android: {
    runCmdlineTools: (hooks: RunHooks) => Promise<RunResult>;
    runLicenses: (hooks: RunHooks) => Promise<RunResult>;
    runPackage: (sdkPackage: string, hooks: RunHooks) => Promise<RunResult>;
  };
  dockerLaunch: { run: (hooks: RunHooks) => Promise<RunResult> };
  /** The sdkmanager package for each Android item, for this CPU. */
  androidPackages: Readonly<Record<DevItemId, string>>;
}

export function runManagedRecipe(
  itemId: DevItemId,
  recipe: Extract<DevRecipe, { kind: 'managed' }>,
  hooks: RunHooks,
  runners: ManagedRunners,
): Promise<RunResult> {
  switch (recipe.installer) {
    case 'flutter-archive':
      return runners.flutter.run(hooks);
    case 'android-cmdline-tools':
      return runners.android.runCmdlineTools(hooks);
    case 'android-licenses':
      return runners.android.runLicenses(hooks);
    case 'android-package': {
      const sdkPackage = runners.androidPackages[itemId];
      if (!sdkPackage) {
        return Promise.resolve({
          ok: false,
          code: null,
          cancelled: false,
          message: 'There is no Android package set for that item.',
        });
      }
      return runners.android.runPackage(sdkPackage, hooks);
    }
    case 'docker-launch':
      return runners.dockerLaunch.run(hooks);
  }
}
