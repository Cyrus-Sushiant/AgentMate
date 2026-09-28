# E03 Walking skeleton: install and see the server

Milestone: M1 Foundations. Depends on: E01, E02.

## Goal

From the new Deploy section a user picks a saved server, installs the core over SSH, and sees a
live health card. Every layer exists end to end: UI, IPC, installer, release artifact, systemd
service, Unix socket, tunnel and REST.

## Tasks

- [ ] T1 Deploy nav item (new `Rocket` icon via `makeIcon`) after Pipelines, lazy route `/deploy`,
  added to `e2e/navigation.e2e.ts`.
- [ ] T2 Server rail: servers from the Remote section with a status per server (not installed,
  connecting, online, offline) and an "Install core" call to action.
- [ ] T3 Pure install plan (`main/deploy/bootstrap/installPlan.ts`): ordered steps with commands per
  OS family and architecture, fully unit tested.
- [ ] T4 Preflight over SSH: os-release (supported matrix), architecture, systemd, free disk,
  sudo mode (root, passwordless, password), `AllowStreamLocalForwarding`/`AllowTcpForwarding` via
  `sshd -T`, existing install detection.
- [ ] T5 Installer: create group `agentmate`, add the SSH user to it, place the verified binary under
  `/opt/agentmate-core/releases/<version>`, `current` symlink, directories with modes, systemd unit
  with the hardening options, `restorecon` on SELinux systems, start, wait for health. After the
  group change the pooled SSH connection is reset because membership only applies to new logins.
- [ ] T6 Binary source: packaged builds download the release asset for their own version and check
  it against the embedded `server-core-manifest.json` hash before anything runs; dev builds upload a
  local `dotnet publish` through SFTP.
- [ ] T7 `agentmate-core bridge`: stdio to the Unix socket, used when stream-local forwarding is
  disabled.
- [ ] T8 Transport: one socket-shim Duplex (adds the no-op socket methods `ws` and `http` expect)
  behind a custom `http.Agent#createConnection`; typed REST client (`openapi-fetch` over a
  `node:http` fetch adapter) using it.
- [ ] T9 Upgrade keeps the previous release; if the new one fails its health check the symlink goes
  back and the service restarts on the old release. Uninstall (keep or delete data).
- [ ] T10 Install wizard UI: preflight results, step timeline with live progress, errors with a
  plain explanation and a retry.
- [ ] T11 Health card: core version, OS, architecture, uptime of the core.
- [ ] T12 CD: `build-server-core` job (linux-x64 and linux-arm64 self-contained single-file,
  ReadyToRun, tar.gz and `.sha256`, `server-core-manifest.json`), desktop builds embed the manifest,
  the release job attaches the assets.
- [ ] T13 DevHost (`apps/server-core/src/AgentMate.ServerCore.DevHost`) with fake platform state and
  a dev-only loopback transport that packaged builds refuse, so e2e runs on Windows and macOS.
- [ ] T14 Fixtures: systemd plus sshd test-server images in `apps/server-core/test-servers/`
  (ubuntu-24.04, debian-13, rocky-9), a root login and a non-root user whose sudo asks for a
  password.

## Fixtures

- systemd plus sshd test servers (T14): used by installer integration tests now and by system and
  e2e tests in later epics. The full OS matrix runs nightly.

## Acceptance criteria

1. On a fresh ubuntu-24.04 and rocky-9 test server, the app goes from "not installed" to a live
   health card, both as root and as a non-root sudo user whose sudo prompts for a password.
2. A binary whose hash does not match the manifest is rejected before it is executed.
3. With stream-local forwarding disabled on the server, the bridge fallback connects.
4. An upgrade to a broken release rolls back to the previous one automatically.
5. The Deploy page and install wizard pass their component tests in every state (loading shimmer,
   empty, error, success), and the navigation e2e reaches Deploy.
