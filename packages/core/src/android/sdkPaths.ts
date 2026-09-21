/**
 * Finding the Android SDK is most of the work of talking to it. Studio, the standalone
 * command-line tools and every package manager put it somewhere different, and the env vars that
 * are supposed to settle it are often unset or stale.
 *
 * Everything here takes an injected `exists` predicate and an explicit platform so it stays pure:
 * the Windows layout can be tested from Linux and the whole resolution order is unit-testable.
 */

export type SdkPlatform = 'win32' | 'darwin' | 'linux';

export type SdkExists = (path: string) => boolean;

export type SdkSource = 'override' | 'ANDROID_HOME' | 'ANDROID_SDK_ROOT' | 'default';

export interface SdkResolution {
  /** `override-invalid` means the user set a path in Settings that is not an SDK. */
  status: 'found' | 'missing' | 'override-invalid';
  root: string | null;
  source: SdkSource | null;
  /** Every path that was looked at, in order, so the UI can show why detection failed. */
  checked: string[];
}

export interface SdkBinaryPaths {
  adb: string | null;
  emulator: string | null;
  avdmanager: string | null;
  sdkmanager: string | null;
}

export interface ResolveSdkRootInput {
  /** The `androidSdkPath` setting, or null when the user has not overridden it. */
  override: string | null | undefined;
  env: Record<string, string | undefined>;
  platform: SdkPlatform;
  homeDir: string;
  exists: SdkExists;
}

/** Joined with the platform's own separator, since these paths are shown to the user as-is. */
function join(platform: SdkPlatform, ...parts: string[]): string {
  const sep = platform === 'win32' ? '\\' : '/';
  return parts.join(sep).replace(/[\\/]+/g, sep);
}

/** A folder only counts as an SDK when it holds at least one of the packages we know by name. */
const SDK_MARKERS = ['platform-tools', 'emulator', 'cmdline-tools', 'tools'];

export function isPlausibleSdkRoot(root: string, exists: SdkExists): boolean {
  if (!root || !exists(root)) return false;
  const sep = root.includes('\\') ? '\\' : '/';
  return SDK_MARKERS.some((marker) => exists(`${root}${sep}${marker}`));
}

function defaultRoots(
  platform: SdkPlatform,
  env: Record<string, string | undefined>,
  home: string,
): string[] {
  const j = (...parts: string[]): string => join(platform, ...parts);
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? j(home, 'AppData', 'Local');
    const programFiles = env.ProgramFiles ?? 'C:\\Program Files';
    return [
      j(localAppData, 'Android', 'Sdk'),
      j(localAppData, 'Android', 'sdk'),
      j(home, 'AppData', 'Local', 'Android', 'Sdk'),
      'C:\\Android\\Sdk',
      j(programFiles, 'Android', 'android-sdk'),
    ];
  }
  if (platform === 'darwin') {
    return [
      j(home, 'Library', 'Android', 'sdk'),
      j(home, 'Library', 'Android', 'Sdk'),
      '/usr/local/share/android-sdk',
      '/opt/homebrew/share/android-sdk',
      '/opt/homebrew/share/android-commandlinetools',
    ];
  }
  return [
    j(home, 'Android', 'Sdk'),
    j(home, 'Android', 'sdk'),
    j(home, '.local', 'share', 'Android', 'Sdk'),
    '/usr/lib/android-sdk',
    '/opt/android-sdk',
  ];
}

export function resolveSdkRoot(input: ResolveSdkRootInput): SdkResolution {
  const { override, env, platform, homeDir, exists } = input;
  const checked: string[] = [];

  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    checked.push(trimmedOverride);
    if (isPlausibleSdkRoot(trimmedOverride, exists)) {
      return { status: 'found', root: trimmedOverride, source: 'override', checked };
    }
    // Stop here rather than falling through. The user pointed somewhere on purpose and needs to
    // be told it is wrong, not quietly handed a different SDK.
    return { status: 'override-invalid', root: trimmedOverride, source: 'override', checked };
  }

  const fromEnv: [SdkSource, string | undefined][] = [
    ['ANDROID_HOME', env.ANDROID_HOME],
    ['ANDROID_SDK_ROOT', env.ANDROID_SDK_ROOT],
  ];
  for (const [source, value] of fromEnv) {
    const root = value?.trim();
    if (!root) continue;
    checked.push(root);
    if (isPlausibleSdkRoot(root, exists)) return { status: 'found', root, source, checked };
  }

  for (const root of defaultRoots(platform, env, homeDir)) {
    checked.push(root);
    if (isPlausibleSdkRoot(root, exists)) {
      return { status: 'found', root, source: 'default', checked };
    }
  }

  return { status: 'missing', root: null, source: null, checked };
}

function firstExisting(candidates: string[], exists: SdkExists): string | null {
  return candidates.find((candidate) => exists(candidate)) ?? null;
}

export function sdkBinaryPaths(
  root: string,
  platform: SdkPlatform,
  exists: SdkExists,
): SdkBinaryPaths {
  const j = (...parts: string[]): string => join(platform, root, ...parts);

  /**
   * The suffixes a tool can have, in preference order. On Windows adb and the emulator normally
   * ship as `.exe` and the command-line tools as `.bat`, but a wrapper script in place of either
   * is not unheard of, so every Windows form is probed. Off Windows there is no suffix at all.
   */
  const suffixes = platform === 'win32' ? ['.exe', '.bat', '.cmd'] : [''];

  /** Every folder a tool might live in, crossed with every suffix it might have. */
  const candidates = (folders: string[][], name: string): string[] =>
    folders.flatMap((folder) => suffixes.map((suffix) => j(...folder, `${name}${suffix}`)));

  // Only `latest` is probed by name. A versioned cmdline-tools folder would need a directory
  // listing, which this pure module deliberately does not have, so the caller adds those.
  const cmdlineFolders = [
    ['cmdline-tools', 'latest', 'bin'],
    ['tools', 'bin'],
  ];

  return {
    adb: firstExisting(candidates([['platform-tools']], 'adb'), exists),
    emulator: firstExisting(candidates([['emulator'], ['tools']], 'emulator'), exists),
    avdmanager: firstExisting(candidates(cmdlineFolders, 'avdmanager'), exists),
    sdkmanager: firstExisting(candidates(cmdlineFolders, 'sdkmanager'), exists),
  };
}

/**
 * Where AVD definitions live. ANDROID_AVD_HOME wins, then the legacy ANDROID_SDK_HOME layout, and
 * ~/.android/avd is always offered last because that is where avdmanager writes by default.
 */
export function avdHomeCandidates(
  env: Record<string, string | undefined>,
  homeDir: string,
): string[] {
  const candidates: string[] = [];
  if (env.ANDROID_AVD_HOME?.trim()) candidates.push(env.ANDROID_AVD_HOME.trim());
  if (env.ANDROID_SDK_HOME?.trim()) candidates.push(`${env.ANDROID_SDK_HOME.trim()}/.android/avd`);
  candidates.push(`${homeDir}/.android/avd`);
  return candidates;
}
