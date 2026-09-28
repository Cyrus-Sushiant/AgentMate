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
- [ ] T6 Console: docker exec with a TTY over a bidirectional hub stream, rendered with
  `TerminalPane` through a new adapter.
- [ ] T7 Images (list, pull with progress, remove, prune), volumes, networks, system df and prune,
  events stream feeding live UI updates.
- [ ] T8 Containers UI: grouped, virtualized list with live sparklines and state chips, detail
  drawer (overview, stats, logs, inspect, mounts, ports, console), resources tabs.
- [ ] T9 "Send logs to project CLI": build a redacted prompt (log tail, container and image facts,
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
