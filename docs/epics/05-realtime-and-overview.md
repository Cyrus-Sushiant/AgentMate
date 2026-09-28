# E05 Realtime, jobs and server overview

Milestone: M1 Foundations. Depends on: E04.

## Goal

A live Overview for each server: identity, health score, CPU, memory, disk and network charts with
history, services, pending package updates with a one-click upgrade, and a reboot that reconnects
by itself. Underneath: the SignalR hub, the job engine, the process runner and the redactor that
every later epic uses.

## Tasks

- [ ] T1 Hub `/hubs/core`: authentication, per-method policies, `CloseOnAuthenticationExpiration`,
  maximum message sizes, per-connection stream limits, bounded channels.
- [ ] T2 SignalR client in the desktop main process over the E03 transport (custom WebSocket
  constructor, skip negotiation, bearer header), automatic reconnect with backoff, transparent
  stream resumption after reconnects and token renewals.
- [ ] T3 `IProcessRunner` (argument lists, explicit environment, timeouts, output caps) and a
  `systemd-run` runner for privileged work (transient units, cgroup kill on cancel).
- [ ] T4 Jobs: persisted state and log files, per-resource locks, cancellation, hub `StreamJob`.
- [ ] T5 Redactor service: secret-like keys, known token shapes, seeded values; applied to job logs,
  audit parameters, alerts.
- [ ] T6 Platform layer: os-release parsing and support status, `IPackageManager` for apt and dnf
  (noninteractive flags, lock timeouts), service status through systemctl.
- [ ] T7 System info (CPU model and cores, memory, swap, disks, NICs, public addresses, kernel,
  uptime, reboot-required, time sync) and metrics sampler (/proc parsers, ring buffers, 1-minute and
  15-minute downsampled history), hub `StreamMetrics`.
- [ ] T8 Updates: list upgradable packages, upgrade all or security only as a job, automatic
  security updates toggle; reboot as a job; restart Docker or nginx.
- [ ] T9 Alerts: model, list and acknowledge, hub `StreamAlerts`; desktop watcher turns them into
  `deploy-*` in-app notifications and OS toasts with persisted "last seen" marks.
- [ ] T10 Overview UI: pulse header, stat tiles, hand-drawn SVG charts (dataviz rules,
  `lib/chartColors.ts`), system facts, services, updates panel with preview and live log, reboot
  with typed confirmation and a reconnecting state.
- [ ] T11 Fixture: TS fake core typed from the OpenAPI types and the hub contract, for main and
  renderer tests.

## Acceptance criteria

1. Live metrics reach the chart through the real tunnel in an integration test.
2. Cancelling a job stops every process of its transient unit.
3. After a reboot the app reconnects without user action and the Overview recovers.
4. A stream keeps flowing across a token expiry (the connection cycles, the UI does not notice).
5. Parsers are covered by fixtures from both OS families.
