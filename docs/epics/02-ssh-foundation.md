# E02 SSH foundation

Milestone: M1 Foundations. Depends on: E00.

## Goal

The desktop main process can run commands, upload files and open tunnels over SSH to a saved
Remote server, and a changed host key is handled with an explicit, safe prompt instead of the
current broken "re-save to trust" advice.

## Tasks

- [ ] T1 Extract connect options, host key verification and friendly errors from
  `apps/desktop/src/main/ssh/sessionManager.ts` into `main/ssh/connectConfig.ts`; terminal sessions
  keep working unchanged (existing tests stay green, new tests cover the extracted module).
- [ ] T2 `main/ssh/connection.ts`: `SshConnection` with `exec(command, { stdin, env, timeoutMs,
  signal })` returning stdout, stderr and the exit code; streaming variant; keepalive settings.
- [ ] T3 sudo helper: runs `sudo -S -p ''` with the password written to stdin (never argv), and
  reports a clear error when sudo needs a password that is not saved.
- [ ] T4 SFTP: atomic upload (temp name, fsync, rename) with progress; mode bits.
- [ ] T5 Tunnels: `openStream({ socketPath })` through `openssh_forwardOutStreamLocal` and
  `openStream({ host, port })` through `forwardOut`, both returning Duplex streams.
- [ ] T6 `main/ssh/pool.ts`: one connection per saved server, reference counted, reconnect on drop,
  `reset(serverId)` to force a fresh login (needed after group changes).
- [ ] T7 Host key changed: the connection fails with a typed error carrying the old and new
  fingerprints; the Remote section shows a dialog to review and trust the new key (pattern:
  `RdpCertificatePrompt`); saving without changing the host no longer implies trust.
- [ ] T8 Fixture: an in-process fake SSH server built on `ssh2`'s `Server` class under
  `main/ssh/testing/`, supporting exec, SFTP, stream-local and TCP forwarding.

## Fixtures

- In-process fake SSH server (T8), used by unit tests here and by later epics.
- The existing Docker SSH server (`apps/desktop/e2e/ssh-server`) for `*.int.test.ts` coverage.

## Acceptance criteria

1. Exec returns the real exit code and separates stdout from stderr.
2. A sudo password only ever travels on stdin (a test inspects the exec request).
3. Uploads never leave a partial file at the destination path.
4. Bytes written into a tunnel stream arrive at the far end and back.
5. A changed host key blocks the connection until the user explicitly trusts the new key.
6. Existing SSH terminal and SSH AI tests stay green.
