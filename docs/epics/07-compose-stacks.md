# E07 Compose stacks

Milestone: M2 Docker, apps and AI. Depends on: E06.

## Goal

A user names an app, picks a compose file from a project and an environment from that project's
Environments tab, and deploys it. Each deploy is a timeline with live logs; older revisions can be
restored in one click. Services that will be proxied publish on loopback only.

## Tasks

- [ ] T1 `resolveProjectEnvironment(projectId, environmentId)` next to the `mutate()` queue in
  `main/ipc/environments.ts`, returning decrypted entries to main-process callers only.
- [ ] T2 Compose discovery in a project through the file index (`compose.y*ml`,
  `docker-compose*.y*ml`), YAML parsing with `yaml`, service and port summary.
- [ ] T3 `.env` rendering that compose parses back to exactly the same values (quoting, `$`
  escaping, multiline), key validation.
- [ ] T4 In-house `.dockerignore` matcher (Docker's pattern rules, `**`, `!` exceptions) and a
  build-context tarball builder that honors it.
- [ ] T5 Risk linter (privileged, host network or PID, docker.sock or `/` mounts, dangerous
  capabilities, public port bindings, `latest` tags, missing restart policy or healthcheck, SELinux
  bind mounts without `:z`) with per-risk acknowledgment recorded in the audit.
- [ ] T6 Core stacks module: stack and revision model, upload endpoint (compose, `.env`, optional
  tarball with safe extraction and caps), `docker compose config` validation in memory, override file
  with `ports: !override` loopback bindings for proxied services, deploy job (validate, pull,
  build, `up --wait`, health), start, stop, restart, down, delete with optional volumes, rollback.
- [ ] T7 New App wizard (source, configure, expose, review with lint findings, deploy) and app
  detail (services, containers, revisions, env keys, compose viewer, route map stub, actions).
- [ ] T8 Deploy timeline UI with per-step live logs, durations and a rollback on older revisions.

## Acceptance criteria

1. Tarballs with absolute paths, `..`, escaping symlinks, device files or too many entries are
   rejected before anything is written outside the stack directory.
2. Rendered `.env` files round-trip through compose's own parser (system test).
3. A proxied service ends up bound to `127.0.0.1` only, even when the user's compose file publishes
   it on all interfaces (system test inspects the running container).
4. Rolling back restores the previous revision's files and running state.
5. The wizard passes component tests for every step and an e2e flow against the DevHost.
