# Delivery Status

Updated: 2026-10-02
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
| E05 | Realtime, jobs and server overview | Complete | see git log | Live link with token rotation and reboot recovery; Overview with health score, charts, updates and reboot; AC3 and AC4 covered by fake-core tests and the DevHost reboot, not a real server |
| E06 | Docker engine and containers | In progress | c5c0b68, see git log | Core and the desktop Containers screen (T6, T8, T9): shared stats and events streams, consoles that reopen after a connection change, redacted prompts for the project CLI; AC2, AC3 and AC5 tested |
| E07 | Compose stacks | Complete | ea106b3, see git log | Files over REST, revisions on disk with their own project folder, compose config linted in the core with the app's finding ids; DevHost runs a simulated compose |
| E08 | Private registries | Complete | see git log | Sign-ins sealed on this computer and sent per deploy into a tmpfs DOCKER_CONFIG wiped in a `finally` (the core refuses a non-tmpfs folder); GitHub scopes read from `X-OAuth-Scopes`, anything beyond read:packages behind a warning; write-only stored credentials (Data Protection, Admin with step-up); Containers pulls sign in through X-Registry-Auth |
| E09 | Logs center, problems feed and Deploy AI | Not started | | |
| E10 | nginx websites | In progress | 77b262a, see git log | Renderer, snippet allowlist and the nginx -t harness; desktop T9 done (Websites section, site editor, Apply bar, route maps, stream proxies, live site logs) |
| E11 | Let's Encrypt certificates | In progress | 7110a67, see git log | ACME client (RFC 8555 and ARI) tested against Pebble; desktop T6 done (SSL tab); DNS-01 in the UI waits on E14 |
| E12 | App Store | In progress | see git log | Catalog of 18 apps pinned by digest (MinIO left out: no public official image); App Store section, one-screen install sheet, post-install card with masked secrets (step-up reveal), explicit updates as server-side revisions, digest refresh script. Left: AC3 (WordPress over HTTPS on Pebble) not verified |
| E13 | Firewall | Complete | 2a87c89, 271820e, see git log | Core (ufw and firewalld, lockout guard, safe apply), the Firewall screen (T6) and "make private" (T5): an AgentMate app is redeployed with the service on 127.0.0.1 as a revision the server copies; anything else is shown the compose or run change. AC1 to AC3 by the firewall system tests, passed locally |
| E14 | Cloudflare | In progress | df848e5 | Desktop side: T1 to T4, T8, T9 and pointing a domain (part of T5); Origin CA (rest of T5), T6 and T7 wait on server work |
| E15 | Security center and maintenance | In progress | c87918a | T1 (users, devices, enrollment codes) and T2 (audit viewer) done |
| E16 | Direct TLS mode | Not started | | |
| E17 | Polish and full OS matrix | Not started | | |
| E18 | Ask AI for Remote Desktop | Complete | | Input through the IronRDP session, screenshots from its canvas; verified against xrdp and XFCE; Codex image answer unverified locally |

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
- E10 and E11, desktop: the Websites e2e spec runs against the DevHost's simulated nginx and
  pretend CA, not a real `nginx -t` or Let's Encrypt. E11 AC3 (a failed renewal's alert in the
  desktop inbox) has no test yet. Neither screen has had a visual pass in both themes.
- E03 and E04 system tests: all 8 now pass in CI too (run 36677124032, e3c7b94), after three
  fixes. Three SSH waits had no time limit (a command's channel opening before its timer started,
  opening a tunnel, and HTTP over a tunnel, whose socket timeout never fires). The systemd test
  servers shared the runner's cgroup namespace, which collides with a host that runs systemd, so
  Ubuntu servers never finished starting; they now get a private one. On Rocky, the runner's
  AppArmor profile for unix_chkpwd confined the container's own helper, so every password login
  failed; CI unloads that profile first. Before that, E03's dispatched run 36542574176 and E04's
  run 36647129514 never finished these tests. They take about 80 seconds each in CI against
  about 10 locally; the timed steps a failing test prints would show where, if it matters.

- E06 AC1 and AC4: the stats math fixtures and the Rocky 9 install system test
  (`docker.int.test.ts`) were not run with the desktop work; they need the core's test suite and
  Docker. The Containers console has no e2e test, and the screen has not had a visual pass in
  both themes.

- E12 AC3: installing WordPress on a domain over HTTPS has no end-to-end test on the Pebble
  harness. The install, the site, nginx apply and the certificate order are each covered (component
  tests, the E10 `nginx -t` and E11 Pebble harnesses), not together. The App Store screens have not
  had a visual pass in both themes.
- E12 and E13 system tests (`stacks.int.test.ts`: every template through the server's compose
  config and linter, and make private on a real Docker; `firewall.int.test.ts`) ran locally only,
  not yet in CI.
- E08: the registry screens have not had a visual pass in both themes. AC1's system test
  (`registries.int.test.ts`) passed locally against Ubuntu 24.04 with registry:2; its CI step
  runs with the next `[e2e]` commit.

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

Still failing in the E04 runs (36647129514 through 36677124032), none of them Deploy code:

- All OSes: `apiClient.e2e.ts:40` and `settingsPersistence.e2e.ts:77`, as above.
- macOS: the local-terminal specs above, plus `windowState.e2e.ts:99` and `worktrees.e2e.ts:44`
  (`workspaceSearch.e2e.ts:33` failed once too).
- Windows: `browser.e2e.ts:115`, `lastPage.e2e.ts:85`, `windowState.e2e.ts:81` and
  `worktrees.e2e.ts:44`.

The Deploy-related specs pass: `deploy.e2e.ts` (DevHost health, sign-in with two-factor) and
`navigation.e2e.ts` on every OS, and `sshAiTask.e2e.ts` on Ubuntu (the only runner with Docker).
Left for the owner of those features.

## Open blockers

None.
