# E05 Realtime, jobs and server overview

Milestone: M1 Foundations. Depends on: E04.

## Goal

A live Overview for each server: identity, health score, CPU, memory, disk and network charts with
history, services, pending package updates with a one-click upgrade, and a reboot that reconnects
by itself. Underneath: the SignalR hub, the job engine, the process runner and the redactor that
every later epic uses.

## Tasks

- [x] T1 Hub `/hubs/core`: authentication, per-method policies, `CloseOnAuthenticationExpiration`,
  maximum message sizes, per-connection stream limits, bounded channels.
- [x] T2 SignalR client in the desktop main process over the E03 transport (custom WebSocket
  constructor, skip negotiation, bearer header), automatic reconnect with backoff, transparent
  stream resumption after reconnects and token renewals.
- [x] T3 `IProcessRunner` (argument lists, explicit environment, timeouts, output caps) and a
  `systemd-run` runner for privileged work (transient units, cgroup kill on cancel).
- [x] T4 Jobs: persisted state and log files, per-resource locks, cancellation, hub `StreamJob`.
- [x] T5 Redactor service: secret-like keys, known token shapes, seeded values; applied to job logs,
  audit parameters, alerts.
- [x] T6 Platform layer: os-release parsing and support status, `IPackageManager` for apt and dnf
  (noninteractive flags, lock timeouts), service status through systemctl.
- [x] T7 System info (CPU model and cores, memory, swap, disks, NICs, public addresses, kernel,
  uptime, reboot-required, time sync) and metrics sampler (/proc parsers, ring buffers, 1-minute and
  15-minute downsampled history), hub `StreamMetrics`.
- [x] T8 Updates: list upgradable packages, upgrade all or security only as a job, automatic
  security updates toggle; reboot as a job; restart Docker or nginx.
- [x] T9 Alerts: model, list and acknowledge, hub `StreamAlerts`; desktop watcher turns them into
  `deploy-*` in-app notifications and OS toasts with persisted "last seen" marks.
- [x] T10 Overview UI: pulse header, stat tiles, hand-drawn SVG charts (dataviz rules,
  `lib/chartColors.ts`), system facts, services, updates panel with preview and live log, reboot
  with typed confirmation and a reconnecting state.
- [x] T11 Fixture: TS fake core implementing the generated `ICoreHub` interface, for main and
  renderer tests.

## Acceptance criteria

1. Live metrics reach the chart through the real tunnel in an integration test.
2. Cancelling a job stops every process of its transient unit.
3. After a reboot the app reconnects without user action and the Overview recovers.
4. A stream keeps flowing across a token expiry (the connection cycles, the UI does not notice).
5. Parsers are covered by fixtures from both OS families.

## Implementation notes

Delivered in three commits (see git log): the server core, the desktop main process, and the
Overview UI with this wrap-up.

Server core (T1, T3 to T9, part of T11):

- The hub keeps per-connection stream limits (metrics 2, jobs 4, alerts 2, 8 in all), bounded
  channels per subscriber, clamped metric intervals and a pinned 64 KB message limit.
- `IProcessRunner` takes argument lists only, an explicit environment, time limits and output
  caps, and kills the whole process group. Privileged work runs in collected transient units;
  cancel and timeouts stop the unit. A reboot is scheduled from a transient timer 5 seconds out,
  so the job can report success first.
- Jobs live in SQLite with redacted 0600 log files, resource locks, recovery after a restart and
  `StreamJob` resuming after the last line seen. The redactor covers job logs, audit parameters
  and alerts.
- apt and dnf run noninteractive with a lock timeout and a security-only mode. Metrics keep 15
  minutes live in memory, 1-minute rows for 48 hours and 15-minute rows for 30 days.
- Deviation: the DevHost reports on a pretend machine (moving metrics, 7 updates, Docker and nginx,
  a reboot that drops every connection and answers 503 for 8 seconds). It is never published.

Desktop main process (T2, T9, T11):

- One lasting hub connection per server, opened when something needs it and closed a minute after
  nothing does. It moves to a fresh connection before the token runs out (AC4), retries quietly
  after a healthy connection drops, backs off through reboots (AC3) and resumes every stream from
  its cursor. It waits instead of retrying on an ended session, a revoked device or a locked
  vault, and reports its state to the renderer.
- Deviation: the core refuses a missing step-up and a missing role with the same SignalR words,
  so `main/deploy/system.ts` tells them apart by the signed-in roles and re-encodes them as
  `[core:stepUpRequired]` or `[core:forbidden]`. Upgrading everything and rebooting take the
  password (or a code) in the call itself.
- The alert watcher turns alerts into `deploy-*` notifications with persisted marks, and OS
  toasts while the app is in the background. The fake core (`shared/deploy/testing`) implements
  the generated `ICoreHub` for main and renderer tests.

Overview UI (T10):

- `components/deploy/overview/`: the pulse header (processor, memory and network ribbons over the
  last two minutes, and a health score), stat tiles, a history card with hand-drawn SVG charts
  (Live 15 minutes, 6 hours and 2 days at 1-minute points, 30 days at 15-minute points) with a
  crosshair readout that also follows the arrow keys and a table view, system facts, services with
  a restart for Docker and nginx, open alerts with acknowledge, and updates with a preview of every
  package that changes, a live job log with cancel, and the automatic security updates switch
  (Admin). Viewers see everything and change nothing.
- The health score starts at 100 and takes points off for processor or memory above 75% or 90%
  (averaged over the last minute), a disk above 80% or 90%, load above one or two per core, swap
  over half used, open critical alerts and warnings, failed services, waiting security updates,
  a reboot waiting and a clock out of sync. Its tooltip lists what cost what (`lib/deploy/overview/health.ts`).
- The connection shows as a pill in the server header on every section of a server (Connected,
  Reconnecting, Not connected, Sign-in needed and so on, each with its own mark). While it is
  reconnecting, the cards keep what they show, dimmed, and read everything again once it is back.
- A reboot asks for the server's name typed out, then a step-up if the last one has run out, and
  shows a banner that follows the connection down and back up. Deviation: the renderer retries a
  refused call with the password in it rather than reusing E15's `useStepUp`, which listens for
  SignalR's words that the main process now re-encodes.
- Loose ends from the integration: redeeming an enrollment code now resets the live connection and
  tells the alert watcher, as every other sign-in does; and unread notices that open a page in the
  app (a Deploy alert's `/deploy?server=<id>`) get rows of their own on the Pipelines page, since
  they have no run row to mark there.

Acceptance criteria:

1. Covered by the system test that streams live metrics through the real tunnel (E05 desktop
   commit), and by the Overview e2e test against the DevHost.
2. Covered by the system test that cancels an upgrade and finds no unit or apt process left.
3. Covered by fake-core unit tests of the link (reconnect with backoff, streams resumed) and by
   the e2e test that reboots the DevHost and sees the Overview go to "Reconnecting" and back to
   "Connected" by itself. A real server's reboot is not part of any automated run.
4. Covered by fake-core unit tests of the token rotation; not exercised against a real server.
5. Covered by the core's parser fixtures from both OS families (Debian and RHEL).
