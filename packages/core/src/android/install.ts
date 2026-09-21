/**
 * `adb install` reports failure as an `INSTALL_FAILED_*` code buried in a Failure line, usually on
 * stderr. The codes are precise but unreadable, so the four people actually hit get a sentence.
 */

export interface InstallResult {
  ok: boolean;
  code: string | null;
  message: string;
}

const FAILURE_LINE = /Failure\s*\[([A-Z_]+)(?::\s*([^\]]*))?\]/;

export function parseAdbInstallResult(stdout: string, stderr: string): InstallResult {
  const combined = `${stdout}\n${stderr}`;
  const failure = FAILURE_LINE.exec(combined);
  if (failure) {
    return { ok: false, code: failure[1], message: (failure[2] ?? failure[1]).trim() };
  }
  // adb prints a bare "Success" on its own line. Anything else, including no output at all, is
  // not a success: a silent adb usually means the device went away mid-install.
  if (/^Success$/m.test(combined)) return { ok: true, code: null, message: '' };

  const adbError = /^adb:\s*(.*)$/m.exec(combined);
  return {
    ok: false,
    code: null,
    message: adbError ? adbError[1].trim() : 'The install did not report success.',
  };
}

const EXPLANATIONS: Record<string, string> = {
  INSTALL_FAILED_UPDATE_INCOMPATIBLE:
    'A version of this app is already installed and was signed with a different key. Uninstall it first, then install again.',
  INSTALL_FAILED_VERSION_DOWNGRADE:
    'The device already has a newer version of this app. Uninstall it first, or build a higher version code.',
  INSTALL_FAILED_NO_MATCHING_ABIS:
    'This APK has no native code for the device processor. Build one that includes this ABI, or use a device that matches.',
  INSTALL_FAILED_INSUFFICIENT_STORAGE:
    'The device is out of space. Free some storage and try again.',
  INSTALL_FAILED_ALREADY_EXISTS: 'This app is already installed. Reinstall with replace turned on.',
  INSTALL_FAILED_INVALID_APK: 'The file is not a valid APK, or it did not finish downloading.',
  INSTALL_FAILED_OLDER_SDK: 'The app needs a newer version of Android than this device runs.',
  INSTALL_FAILED_USER_RESTRICTED: 'The device refused the install. Check for a prompt on screen.',
};

export function explainInstallFailure(code: string | null): string {
  if (!code) return 'The install failed.';
  return EXPLANATIONS[code] ?? `The install failed with ${code}.`;
}
