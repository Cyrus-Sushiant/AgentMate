# E02 SSH foundation

Milestone: M1 Foundations. Depends on: E00.

## Goal

The desktop main process can run commands, upload files and open tunnels over SSH to a saved
Remote server, and a changed host key is handled with an explicit, safe prompt instead of the
current broken "re-save to trust" advice.

## Tasks

- [x] T1 Extract connect options, host key verification and friendly errors from
  `apps/desktop/src/main/ssh/sessionManager.ts` into `main/ssh/connectConfig.ts`; terminal sessions
  keep working unchanged (existing tests stay green, new tests cover the extracted module).
- [x] T2 `main/ssh/connection.ts`: `SshConnection` with `exec(command, { stdin, env, timeoutMs,
  signal })` returning stdout, stderr and the exit code; streaming variant; keepalive settings.
- [x] T3 sudo helper: runs `sudo -S -p ''` with the password written to stdin (never argv), and
  reports a clear error when sudo needs a password that is not saved.
- [x] T4 SFTP: atomic upload (temp name, fsync, rename) with progress; mode bits.
- [x] T5 Tunnels: `openStream({ socketPath })` through `openssh_forwardOutStreamLocal` and
  `openStream({ host, port })` through `forwardOut`, both returning Duplex streams.
- [x] T6 `main/ssh/pool.ts`: one connection per saved server, reference counted, reconnect on drop,
  `reset(serverId)` to force a fresh login (needed after group changes).
- [x] T7 Host key changed: the connection fails with a typed error carrying the old and new
  fingerprints; the Remote section shows a dialog to review and trust the new key (pattern:
  `RdpCertificatePrompt`); saving without changing the host no longer implies trust.
- [x] T8 Fixture: an in-process fake SSH server built on `ssh2`'s `Server` class under
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

## Implementation notes

- **Modules.** `main/ssh/connectConfig.ts` (shared connect options, trust on first use, friendly
  errors, handshake-only `probeHostKey`), `connection.ts` (`SshConnection`: exec, uploads, tunnels,
  keepalive), `sudo.ts` (`openRootShell`), `pool.ts` (`SshConnectionPool`), `savedServers.ts`
  (endpoints from the Remote list, and the single write queue for `ssh-servers.json`, moved out of
  `ipc/ssh.ts`). `SshSessionManager` now uses `connectConfig`; characterization tests written
  before the refactor pin its behavior.
- **Host key re-trust.** A mismatch is a coded `[ssh:host-key-changed]` error. The renderer's
  `withHostKeyTrust(serverId, attempt)` fetches both fingerprints (`ssh:hostKeyStatus`), asks in
  `HostKeyChangedDialogHost` (mounted in `App.tsx`, "Don't connect" focused), and only then calls
  `ssh:trustHostKey`, which re-reads the key and refuses if it changed again. Terminal tabs use it
  through `sshTerminalAdapter`; Deploy will use the same helper. The old "edit and save to trust"
  advice is gone. New shared types live in `shared/sshHostKey.ts` rather than `apiTypes.ts`.
- **sudo.** Detection uses `sudo -k -n true` so cached credentials cannot make a
  password-protected account look passwordless. The password is checked on its own
  (`sudo -S -k -p '' true`) before any command that carries a payload, because with `-S` a wrong
  password makes sudo read the following stdin lines as retries. Passwords with line breaks are
  refused.
- **Uploads.** SFTP runs as the login user, so uploads go to a staging folder that user owns
  (`createStagingDirectory`), under a temporary name, fsync, then `posix-rename`. ssh2 never calls
  back SFTP requests that were in flight when a connection drops, so every step races against a
  "connection closed" signal; the real-OpenSSH test drops the connection mid-upload.
- **Fixtures.** `main/ssh/testing/fakeSshServer.ts` (ssh2 `Server`: password and key auth, host
  key rotation, shell, recorded exec, TCP and stream-local forwarding) uses ECDSA keys because
  ssh2's ed25519 generator emits a malformed key about once in 250 tries. SFTP is only tested
  against real OpenSSH (`sshRemote.int.test.ts`, the Docker SSH server; `e2e/sshServer.ts` and
  `e2e/paths.ts` joined `tsconfig.node.json` for that). The Unix-socket tunnel test uses
  `ssh-agent -a` as the listener, so the test image needed no new packages.
- **`exec` options.** It takes stdin, a timeout, an output cap and streaming callbacks. The `env`
  and `signal` options T2 named were left out: OpenSSH drops environment requests unless the
  server's `AcceptEnv` allows them, and nothing needs cancellation beyond the timeout yet.
