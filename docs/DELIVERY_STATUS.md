# Delivery Status

Updated: 2026-10-01
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
| E06 | Docker engine and containers | Not started | | |
| E07 | Compose stacks | In progress | ea106b3 | Libraries only: validation, env, compose lint and override, dockerignore, build context, safe tar extraction |
| E08 | Private registries | Not started | | |
| E09 | Logs center, problems feed and Deploy AI | Not started | | |
| E10 | nginx websites | In progress | 77b262a, see git log | Renderer, snippet allowlist and the nginx -t harness; desktop T9 done (Websites section, site editor, Apply bar, route maps, stream proxies, live site logs) |
| E11 | Let's Encrypt certificates | In progress | 7110a67, see git log | ACME client (RFC 8555 and ARI) tested against Pebble; desktop T6 done (SSL tab); DNS-01 in the UI waits on E14 |
| E12 | App Store | In progress | | Catalog of 18 apps pinned by digest (MinIO left out: no public official image), pending integration |
| E13 | Firewall | In progress | 2a87c89, see git log | Core (ufw and firewalld, lockout guard, safe apply) and the Firewall screen (T6): status hero, rules, presets, staged changes, typed SSH override, countdown to keep or revert, history, exposure view. Confirm goes over a brand-new SSH connection. Left: "Make private" for containers (part of T5) waits on app deploys, so the button is disabled with a hint |
| E14 | Cloudflare | In progress | df848e5 | Desktop side: T1 to T4, T8, T9 and pointing a domain (part of T5); Origin CA (rest of T5), T6 and T7 wait on server work |
| E15 | Security center and maintenance | In progress | c87918a | T1 (users, devices, enrollment codes) and T2 (audit viewer) done |
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
