import { quoteForShell } from '@agentmat/core';

/**
 * The root commands that install, roll back and remove the server core, as data. The installer
 * runs them one by one through a root shell and reports each step; nothing here touches a server.
 *
 * Safety rules the order encodes:
 * - The download is copied into a folder only root can write to and checked against its
 *   published SHA-256 there, before anything unpacks it. Nothing is ever unpacked as root from a
 *   folder the login user could swap files in.
 * - Releases are unpacked beside the running one and switched to with an atomic symlink swap, so
 *   a failed start can go straight back to the previous release.
 */

export const CORE_ROOT = '/opt/agentmate-core';
const INCOMING = `${CORE_ROOT}/incoming`;
const RELEASES = `${CORE_ROOT}/releases`;
const CURRENT = `${CORE_ROOT}/current`;
const UNIT = '/etc/systemd/system/agentmate-core.service';

export type InstallStepId =
  | 'verify'
  | 'group'
  | 'extract'
  | 'selinux'
  | 'unit'
  | 'switch'
  | 'start'
  | 'cleanup'
  | 'rollback'
  | 'stop'
  | 'remove';

export interface PlanStep {
  id: InstallStepId;
  title: string;
  command: string;
}

export interface InstallPlanInput {
  version: string;
  sha256: string;
  /** The tarball's file name, from the release manifest. */
  file: string;
  /** Where the tarball was uploaded, in a folder the login user owns. */
  stagingFile: string;
  loginUser: string;
  rootLogin: boolean;
  selinux: boolean;
  /** The release `current` pointed at before this install, if any. */
  previousRelease: string | null;
}

/** The verify step's exit code when the download does not match its checksum. */
export const CHECKSUM_MISMATCH_EXIT = 97;

const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TARBALL = /^agentmate-core-[0-9A-Za-z.+-]+-linux-(x64|arm64)\.tar\.gz$/;
const RELEASE_PATH = /^\/opt\/agentmate-core\/releases\/[0-9A-Za-z][0-9A-Za-z.+-]{0,127}$/;

const q = (value: string): string => quoteForShell(value, 'posix');

/** Whether `path` is a release folder the installer made, and so safe to switch back to. */
export function isReleasePath(path: string): boolean {
  return RELEASE_PATH.test(path);
}

function assertReleasePath(path: string): void {
  if (!isReleasePath(path)) throw new Error(`${path} is not a server core release.`);
}

export function releaseDirectory(version: string, sha256: string): string {
  if (!VERSION.test(version)) throw new Error(`"${version}" is not a release version.`);
  if (!SHA256.test(sha256)) throw new Error('The release checksum is not a SHA-256.');
  return `${RELEASES}/${version}-${sha256.slice(0, 12)}`;
}

export function installSteps(input: InstallPlanInput): PlanStep[] {
  if (!TARBALL.test(input.file))
    throw new Error(`"${input.file}" is not a server core release file.`);
  if (input.previousRelease !== null) assertReleasePath(input.previousRelease);
  const release = releaseDirectory(input.version, input.sha256);
  const incomingFile = `${INCOMING}/${input.file}`;
  const unpack = `${release}.new`;

  const steps: PlanStep[] = [
    {
      id: 'verify',
      title: 'Check the download against its published checksum',
      command: [
        `install -d -m 0755 -o root -g root ${CORE_ROOT}`,
        `rm -rf ${INCOMING}`,
        `install -d -m 0700 ${INCOMING}`,
        `cp -- ${q(input.stagingFile)} ${incomingFile}`,
        `cd ${INCOMING}`,
        `{ printf '%s  %s\\n' ${input.sha256} ${input.file} | sha256sum -c --status || exit ${CHECKSUM_MISMATCH_EXIT}; }`,
      ].join(' && '),
    },
    {
      id: 'group',
      title: 'Create the agentmate group',
      command: [
        'getent group agentmate >/dev/null || groupadd --system agentmate',
        ...(input.rootLogin ? [] : [`usermod -aG agentmate ${q(input.loginUser)}`]),
      ].join(' && '),
    },
    {
      id: 'extract',
      title: `Unpack release ${input.version}`,
      command: [
        `install -d -m 0755 ${RELEASES}`,
        `rm -rf ${unpack}`,
        `install -d -m 0755 ${unpack}`,
        `tar -xzf ${incomingFile} -C ${unpack} --no-same-owner --no-same-permissions`,
        `test -f ${unpack}/agentmate-core`,
        `test -f ${unpack}/agentmate-core.service`,
        `chown -R root:root ${unpack}`,
        `chmod 0755 ${unpack}/agentmate-core`,
        `chmod 0644 ${unpack}/agentmate-core.service`,
        `rm -rf ${release}`,
        `mv -T ${unpack} ${release}`,
      ].join(' && '),
    },
  ];

  if (input.selinux) {
    steps.push({
      id: 'selinux',
      title: 'Label the files for SELinux',
      command: `restorecon -R ${CORE_ROOT}`,
    });
  }

  const keep = [release, input.previousRelease]
    .filter((value): value is string => Boolean(value))
    .map((path) => path.slice(RELEASES.length + 1));

  steps.push(
    {
      id: 'unit',
      title: 'Install the systemd service',
      command: `install -m 0644 -o root -g root ${release}/agentmate-core.service ${UNIT} && systemctl daemon-reload`,
    },
    {
      id: 'switch',
      title: `Switch to release ${input.version}`,
      command: `ln -sfn ${release} ${CORE_ROOT}/current.new && mv -Tf ${CORE_ROOT}/current.new ${CURRENT}`,
    },
    {
      id: 'start',
      title: 'Start the server core',
      // Type=notify: restart only returns once the core is listening, and fails otherwise.
      command: 'systemctl enable agentmate-core >/dev/null 2>&1; systemctl restart agentmate-core',
    },
    {
      id: 'cleanup',
      title: 'Remove the download and older releases',
      command: [
        `rm -rf ${INCOMING}`,
        `cd ${RELEASES}`,
        `for release in *; do case "$release" in ${keep.map(q).join('|')}) ;; *) rm -rf -- "$release" ;; esac; done`,
      ].join(' && '),
    },
  );
  return steps;
}

export function rollbackSteps(previousRelease: string): PlanStep[] {
  assertReleasePath(previousRelease);
  const previous = q(previousRelease);
  return [
    {
      id: 'rollback',
      title: 'Go back to the previous release',
      command: [
        `ln -sfn ${previous} ${CORE_ROOT}/current.new`,
        `mv -Tf ${CORE_ROOT}/current.new ${CURRENT}`,
        `install -m 0644 -o root -g root ${previous}/agentmate-core.service ${UNIT}`,
        'systemctl daemon-reload',
        'systemctl restart agentmate-core',
      ].join(' && '),
    },
  ];
}

export function uninstallSteps(options: { keepData: boolean }): PlanStep[] {
  return [
    {
      id: 'stop',
      title: 'Stop the server core',
      command: `systemctl disable --now agentmate-core >/dev/null 2>&1 || true; rm -f ${UNIT}; systemctl daemon-reload`,
    },
    {
      id: 'remove',
      title: options.keepData
        ? 'Remove the program and keep its data'
        : 'Remove the program and its data',
      command: options.keepData
        ? `rm -rf ${CORE_ROOT}`
        : [
            `rm -rf ${CORE_ROOT}`,
            'rm -rf /var/lib/agentmate-core /etc/agentmate-core',
            '{ ! getent group agentmate >/dev/null || groupdel agentmate; }',
          ].join(' && '),
    },
  ];
}
