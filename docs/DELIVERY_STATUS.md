# Delivery Status

Updated: 2026-09-30
Run branch: master (direct, per the user's instruction)
Plan: docs/ROADMAP.md

## Commands

| Gate | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Format and lint | `pnpm biome:ci` |
| Deprecated code | `pnpm check:deprecated-code` |
| Deprecated dependencies | `pnpm check:deprecated-deps` |
| Build packages | `pnpm build:packages` |
| Type check | `pnpm -r typecheck` |
| Unit and integration tests | `pnpm test:unit` (core, protocol, desktop) |
| Desktop build | `pnpm --filter @agentmat/desktop build` |
| Server core format | `pnpm server-core:format:check` |
| Server core tests | `pnpm server-core:test` (Linux-only socket tests run in the .NET SDK container or CI) |
| Contracts | `pnpm server-core:contracts`, then no diff under `apps/desktop/src/shared/deploy/protocol/generated` |
| System tests | `pnpm server-core:publish linux-x64`, then `AGENTMATE_SYSTEM_TESTS=1 pnpm --filter @agentmat/desktop exec vitest run src/main/deploy/deploy.int.test.ts` (Docker with Linux containers; CI job "Server core on test servers" with `[e2e]`) |
| e2e | `pnpm test:e2e`, in CI when the commit message carries `[e2e]` |

## Epics

| Epic | Title | Status | Commit | Notes |
|---|---|---|---|---|
| E00 | Delivery docs | Complete | 4e412e3 | Written by hand |
| E01 | Server core scaffold | Complete | 3353dba | Contracts via Tapper and TypedSignalR (TS 7 has no compiler API for openapi-typescript); API is WebSocket-first |
| E02 | SSH foundation | Complete | dc698a8 | Host-key trust dialog shared by terminals and Deploy; sudo password validated alone before payloads |
| E03 | Walking skeleton: install and see the server | Complete | 88403fa, 42aabeb | Tunnel or bridge settled by trying after the install (OpenSSH hides the reason); exec exit-status race fixed; DevHost e2e on every OS |
| E04 | Identity and device enrollment | Complete | 73663f6, see git log | Authenticator codes work once (RFC 6238 5.2); two-factor changes end the other sessions only; access tokens sealed with Data Protection rather than JWTs; enrollment-code screens come with E15 T1; SignalR kept out of the main bundle |
| E05 | Realtime, jobs and server overview | Not started | | |
| E06 | Docker engine and containers | Not started | | |
| E07 | Compose stacks | Not started | | |
| E08 | Private registries | Not started | | |
| E09 | Logs center, problems feed and Deploy AI | Not started | | |
| E10 | nginx websites | Not started | | |
| E11 | Let's Encrypt certificates | Not started | | |
| E12 | App Store | Not started | | |
| E13 | Firewall | Not started | | |
| E14 | Cloudflare | Not started | | |
| E15 | Security center and maintenance | Not started | | |
| E16 | Direct TLS mode | Not started | | |
| E17 | Polish and full OS matrix | Not started | | |

Status values: Not started, In progress, Blocked, Complete.

## Unverified criteria

- E01 has no end-to-end evidence of its own: its `[e2e]` run was cancelled by the next push. The
  E02 commit carries `[e2e]` and covers both. E01 AC1 is verified: the Server core job passed in
  CI runs 36490352987 and 36491482619.
- E03, SELinux labels: `restorecon` only runs where SELinux is on, and the Rocky 9 container runs
  without it, so that step is covered by unit tests only. A Rocky VM with SELinux enforcing (the
  planned nightly job) would verify it.
- E03, release path: a packaged build downloading its core from a GitHub release, and the CD job
  that publishes both architectures, attests them and embeds the manifest, first run on the next
  `v*` tag. Until then the download source is covered with a fake downloader, and the publish
  script was run by hand for linux-x64 and linux-arm64.
- E03, arm64: the linux-arm64 build cross-compiles, but no arm64 test server runs an install.
- E03 AC5 and E04: the DevHost, navigation and sign-in with two-factor specs passed on Ubuntu,
  Windows and macOS in CI run 36647129514 (E04).
- E04 T11: minting and redeeming enrollment codes is tested in the core only. No screen uses it
  until E15 T1, which the plan gives the users and devices UI.
- E03 and E04 system tests on GitHub runners: they pass here (Docker Desktop, all 8, about 80
  seconds) but have not passed in CI. E03's dispatched run 36542574176 had three installs run into
  the 10-minute limit and both Rocky logins refused; E04's run 36647129514 was stopped by the
  45-minute job limit. One local run showed the same hang once. Three waits in the SSH layer had
  no time limit (opening a channel before a command's timer started, opening a tunnel, and HTTP
  over a tunnel, whose socket timeout never fires); they are bounded now, the test servers are
  built before the tests, and a failing test prints its timed steps and the server's journal, so
  the next CI run shows where it stops.

## Known failures outside the Deploy work

The `[e2e]` run for dc698a8 (CI run 36501786157) is red because of end-to-end specs that predate
the Deploy epics and touch none of their code. The matrix had not run since those features
landed, so nothing caught them earlier:

- `apiClient.e2e.ts:40` (all OSes): expects the response header `x-echo`; the table now shows
  `X-Echo`, as the server sent it.
- `settingsPersistence.e2e.ts:77` (all OSes): two buttons are named "Remove Ctrl+P", so the
  locator is ambiguous.
- macOS: the local-terminal specs (autoContinue, launchFlags, terminal, Fix with AI) never see
  "Fake Claude ready".
- Windows: a few more visibility and count assertions in the same run.

The Deploy-related specs pass: `sshAiTask.e2e.ts` on Ubuntu (the only runner with Docker) and
`navigation.e2e.ts` everywhere. Left for the owner of those features.

## Open blockers

None.
