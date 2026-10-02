# E06 Docker engine and containers

Milestone: M2 Docker, apps and AI. Depends on: E05.

## Goal

Install Docker Engine and Compose with one click, then see and manage every container: live CPU,
memory, network and block IO, start, stop, restart, remove, logs, a console, and images, volumes
and networks. Any log excerpt can be sent to the project's coding CLI.

## Tasks

- [ ] T1 Docker install job per family from `download.docker.com` with the pinned GPG fingerprint;
  on RHEL, detect podman, buildah and runc and remove them after confirmation; enable and start the
  service; report the engine and compose versions (compose must be at least 2.24.4).
- [ ] T2 Engine client (`Docker.DotNet.Enhanced` over the Unix socket, API version negotiation)
  behind `IDockerEngine`.
- [ ] T3 Containers: list with compose grouping, inspect (env keys only, values behind step-up),
  start, stop, restart, pause, kill, remove with an optional volume removal.
- [ ] T4 Stats stream with the `docker stats` math for cgroup v1 and v2, hub
  `StreamContainerStats`.
- [ ] T5 Log stream (tail, since, follow, timestamps, stdout and stderr), hub
  `StreamContainerLogs`.
- [x] T6 Console: docker exec with a TTY over a bidirectional hub stream, rendered with
  `TerminalPane` through a new adapter.
- [ ] T7 Images (list, pull with progress, remove, prune), volumes, networks, system df and prune,
  events stream feeding live UI updates.
- [x] T8 Containers UI: grouped, virtualized list with live sparklines and state chips, detail
  drawer (overview, stats, logs, inspect, mounts, ports, console), resources tabs.
- [x] T9 "Send logs to project CLI": build a redacted prompt (log tail, container and image facts,
  no env values) in `packages/core/src/deploy/prompts.ts` and hand it to `FixWithAiDialog`; pick a
  project when the container is not linked to one yet.
- [ ] T10 Fixture: fake Docker Engine (Kestrel on a Unix socket replaying recorded Docker 29
  payloads, including v1 and v2 stats) for integration tests; real Docker inside the systemd test
  servers for system tests.

## Acceptance criteria

1. Computed CPU and memory figures match `docker stats` for the recorded fixtures.
2. Removing a container with its volumes requires a typed confirmation.
3. A prompt built from logs never contains an env value of that container (tested with seeded
   secrets).
4. On the rocky-9 test server, the install job replaces podman and brings up Docker.
5. The Containers screen passes its component tests and an e2e flow against the DevHost.

## Implementation notes

Desktop side (T6, T8, T9), on the core from c5c0b68:

- Streams: the core allows each connection 8 streams in all (container stats 2, container logs 4,
  Docker events 2, consoles 2), and the Overview and the alert watcher already hold some. So the
  app runs one stats stream (every running container, every 2 seconds) and one events stream per
  server, shared by every window and kept a few seconds after the last listener
  (`main/deploy/live/dockerLinks.ts`). Logs stop at 4 and consoles at 2 per server. A stream the
  core turns away for being over its limit waits and tries again. A window that joins late gets
  the last two minutes of stats first.
- Resuming: a log carries on after its last line's timestamp and events after their cursor when
  the connection changes. A followed log ends when the container stops.
- Consoles: the shell lives on the connection, so when the link moves to a new one (a drop, or
  the token rotation every quarter of an hour) the console opens a new shell at the last size and
  the terminal says so. `TerminalPane` renders it through `lib/terminal/containerConsoleAdapter.ts`
  and ends it when the pane goes.
- Refusals: `main/deploy/coreCalls.ts` turns the core's "unauthorized" into a step-up request only
  for a role that could pass with one (Admins for revealing environment values), otherwise into
  "your role cannot". `DeploySystem` (E05) still has its own copy of that mapping; the two can be
  folded together later.
- Redaction for "Send logs to project CLI" (`packages/core/src/deploy/prompts.ts`): values an
  Admin revealed, `KEY=value` under the container's variable names, credentials in URLs and the
  known token shapes. The desktop cannot know a value nobody revealed, so the core's own
  redaction of the log (seeded with the container's environment) stays the main guard.
- Projects: a container is linked to a project by its compose project name (folder or project
  name, the way compose names it), or the user picks one once and it is remembered on this
  computer. A stopgap until stacks deployed from the app (E07) carry the link.
- Not covered: the console has no e2e test (component and adapter tests only), and the screen has
  had no visual pass in both themes yet; it uses the app's tokens and the dataviz palette.
- Acceptance: AC2 and AC3 have their own tests; AC5 passes with `deployContainers.e2e.ts` against
  the DevHost.
