# Delivery Status

Updated: 2026-10-03
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
| Full server matrix | `.github/workflows/nightly.yml` (nightly and `gh workflow run nightly.yml`): every Deploy system test once per test server (`AGENTMATE_TEST_SERVER_IMAGES`), plus the server core's nginx and Pebble system tests |

## Epics

| Epic | Title | Status | Commit | Notes |
|---|---|---|---|---|
| E00 | Delivery docs | Complete | 4e412e3 | Written by hand |
| E01 | Server core scaffold | Complete | 3353dba | Contracts via Tapper and TypedSignalR (TS 7 has no compiler API for openapi-typescript); API is WebSocket-first |
| E02 | SSH foundation | Complete | dc698a8 | Host-key trust dialog shared by terminals and Deploy; sudo password validated alone before payloads |
| E03 | Walking skeleton: install and see the server | Complete | 88403fa, 42aabeb | Tunnel or bridge settled by trying after the install (OpenSSH hides the reason); exec exit-status race fixed; DevHost e2e on every OS |
| E04 | Identity and device enrollment | Complete | 73663f6, see git log | Authenticator codes work once (RFC 6238 5.2); two-factor changes end the other sessions only; access tokens sealed with Data Protection rather than JWTs; enrollment-code screens come with E15 T1; SignalR kept out of the main bundle |
| E05 | Realtime, jobs and server overview | Complete | see git log | Live link with token rotation and reboot recovery; Overview with health score, charts, updates and reboot; AC3 and AC4 covered by fake-core tests and the DevHost reboot, not a real server |
| E06 | Docker engine and containers | Complete | c5c0b68, 5bfa76e, see git log | Core (install with podman removal, engine client, stats math, redacted logs, console, resources) and the Containers screen; the Rocky 9 system test passed locally in E17 and runs nightly |
| E07 | Compose stacks | Complete | ea106b3, see git log | Files over REST, revisions on disk with their own project folder, compose config linted in the core with the app's finding ids; DevHost runs a simulated compose |
| E08 | Private registries | Complete | see git log | Sign-ins sealed on this computer and sent per deploy into a tmpfs DOCKER_CONFIG wiped in a `finally` (the core refuses a non-tmpfs folder); GitHub scopes read from `X-OAuth-Scopes`, anything beyond read:packages behind a warning; write-only stored credentials (Data Protection, Admin with step-up); Containers pulls sign in through X-Registry-Auth |
| E09 | Logs center, problems feed and Deploy AI | Complete | see git log | StreamExec with the read-only allowlist and device-signed approvals; the SSH AI loop takes a pluggable executor (characterization suite before and after); problems feed and log viewer in a Logs section; Deploy AI drawer on every server screen |
| E10 | nginx websites | Complete | 77b262a, 07db580, aca88a8 | Renderer, snippet allowlist, apply with rollback, stream proxies, SELinux labels; the `nginx -t` harness on Debian 13 and Rocky 9 never ran in CI before E17 and now runs nightly |
| E11 | Let's Encrypt certificates | Complete | 7110a67, 07db580, aca88a8 | ACME client (RFC 8555 and ARI) against Pebble, renewal service, SSL tab; AC3 tested in E17 (a failed renewal now has its own inbox title); DNS-01 through E14 |
| E12 | App Store | In progress | see git log | Catalog of 18 apps pinned by digest (MinIO left out: no public official image); App Store section, one-screen install sheet, post-install card with masked secrets (step-up reveal), explicit updates as server-side revisions, digest refresh script. Left: AC3 (WordPress over HTTPS on Pebble) not verified |
| E13 | Firewall | Complete | 2a87c89, 271820e, see git log | Core (ufw and firewalld, lockout guard, safe apply), the Firewall screen (T6) and "make private" (T5): an AgentMate app is redeployed with the service on 127.0.0.1 as a revision the server copies; anything else is shown the compose or run change. AC1 to AC3 by the firewall system tests, in CI since run 37084799281 |
| E14 | Cloudflare | Complete | df848e5, see git log | Desktop T1 to T4, T8, T9; core and desktop T5 to T7: Origin CA (key made on the server), origin lock through firewall change sets with a daily unattended refresh and nginx real IP, DNS-01 with a zone-scoped token (migration CloudflareOriginAndDns) |
| E15 | Security center and maintenance | Complete | c87918a, see git log | Checklist with a score and previewed fixes; SSH password login off only over a proven key login (two guards, timer rollback, kept over a new key login); a failed core update reconnects; backups encrypted on the core (PBKDF2 600,000, AES-256-GCM chunks) and restored over SSH as root |
| E16 | Direct TLS mode | Complete | see git log | Opt-in HTTPS listener bound and closed at runtime (Kestrel endpoint reload), P-256 certificate made on first start and pinned over SSH; desktop self-signs a client certificate with its device key, checked against the enrolled keys on every handshake and request; firewall rule through E13 change sets; direct TLS first, SSH after, a pin mismatch stops the link |
| E17 | Polish and full OS matrix | In progress | see git log | Nightly full matrix, system tests parameterized by image, visual and keyboard pass of every Deploy screen, README; AC1 (one full-stack run on Ubuntu and Rocky) is not met, see its notes |
| E18 | Ask AI for Remote Desktop | Complete | | Input through the IronRDP session, screenshots from its canvas; verified against xrdp and XFCE; Codex image answer unverified locally |

Status values: Not started, In progress, Blocked, Complete.

## Unverified criteria

Reviewed in E17 (2026-10-03). What follows is what no test has shown yet, or has shown only on
this machine.

**Never proven in CI (until the nightly workflow runs green)**

- The full server matrix: Debian 13 for every Deploy system test, Rocky 9 for stacks, registries,
  exec and the Security center, and the Rocky 9 podman case (`docker.int.test.ts`, E06 AC4). All
  of these passed locally on Docker Desktop on 2026-10-03. Before that, Rocky and Debian relied on
  fixtures of their sshd output (E15) and stacks and security had never run outside a laptop
  (E12 AC1, E15).
- The server core's own system tests (`AgentMate.ServerCore.SystemTests`): every nginx renderer
  variant through `nginx -t` on Debian 13 and Rocky 9 (E10 AC1, AC2) and issue and renew against
  Pebble (E11 AC1). No workflow ran that project before E17; they passed when they were written.

**Not covered by any test**

- E17 AC1: a single full-stack run on Ubuntu and Rocky (install, 2FA, Docker, a stack, a private
  pull, a site with a Pebble certificate, a firewall revert, an AI fix). Every step is covered on
  its own, against the DevHost on every OS and on real test servers; see the E17 notes for the
  map.
- E12 AC3: WordPress on a domain over HTTPS on the Pebble harness. The install, the site, nginx
  apply and the certificate order are each tested, not together.
- E03, SELinux labels: `restorecon` only runs where SELinux is on, and the Rocky 9 container runs
  without it, so that step (and E10 T7's SELinux booleans) is covered by unit tests only. It needs
  a Rocky VM with SELinux enforcing, which a GitHub runner without KVM cannot host.
- E03, release path: a packaged build downloading its core from a GitHub release, and the CD job
  that publishes both architectures, attests them and embeds the manifest, first run on the next
  `v*` tag. Until then the download source is covered with a fake downloader, and the publish
  script was run by hand for linux-x64 and linux-arm64.
- E03, arm64: the linux-arm64 build cross-compiles, but no arm64 test server runs an install.
- E05 AC3 and AC4: recovery after a real reboot and a stream across a real token expiry are tested
  with the fake core and the DevHost's pretend reboot, not a rebooting machine.
- E14: the origin lock runs against the pretend firewalls in the e2e run and through a real
  `nginx -t` in the system tests, but not against Cloudflare's live API; DNS-01 waits a fixed 20
  seconds and was not run against Cloudflare. Origin CA is covered with a test-signed certificate.
- E16: direct TLS over a real network (not a Docker port mapping on loopback) and on a firewalld
  server have no automated run; firewalld rule matching is unit-tested only. `directTls.e2e.ts`
  is skipped on macOS (the DevHost's TLS 1.3 listener does not serve there).
- E10 and E11, desktop: the Websites e2e spec runs against the DevHost's simulated nginx and
  pretend CA.
- E06: the container console has no e2e test (component and adapter tests only).
- E15: the restore screen has no e2e test (the DevHost has no SSH).
- E18: the Codex image answer for Remote Desktop was not verified locally.

**Proven since the last review**

- In CI run 37084799281 (E09), "Server core on test servers" passed: installs on Ubuntu and Rocky
  as root and with sudo, the firewall on ufw and firewalld (E13), private registries (E08), direct
  TLS behind ufw (E16) and exec and journal on Ubuntu (E09).
- E11 AC3 now has a test from alert to inbox entry. It found that the inbox titled a failed
  renewal "Alert on <server>"; the renewal, firewall rollback and Cloudflare lock alerts now have
  their own titles.
- Every Deploy screen had its visual and keyboard pass in both themes (E17 T2), with
  `deployKeyboard.e2e.ts` as the lasting check.
- E04 T11: enrollment codes have their screen since E15 (Security, Devices).
- E01, E03 AC5 and E04 were proven earlier: the Server core job in CI runs 36490352987 and
  36491482619 (E01 AC1); the DevHost, navigation and sign-in specs on Ubuntu, Windows and macOS in
  run 36647129514; all E03 and E04 system tests in run 36677124032, after time limits on every SSH
  wait, a private cgroup namespace for the test servers, and unloading the runner's AppArmor
  profile for unix_chkpwd.

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

The same set was still failing in the E09 run (37084799281), and nothing else: Ubuntu only
`apiClient.e2e.ts:40` and `settingsPersistence.e2e.ts:77`; Windows those two plus
`browser.e2e.ts:115`, `windowState.e2e.ts:81` and `worktrees.e2e.ts:44`; macOS those two plus
the local-terminal specs (autoContinue, launchFlags, terminal, testsPanel Fix with AI),
`windowState.e2e.ts:99` and `worktrees.e2e.ts:44`. No Deploy spec failed on any OS there (the
Docker and macOS TLS ones skip where they cannot run).

The Deploy-related specs pass: `deploy.e2e.ts` (DevHost health, sign-in with two-factor) and
`navigation.e2e.ts` on every OS, and `sshAiTask.e2e.ts` on Ubuntu (the only runner with Docker).
Left for the owner of those features.

## Open blockers

None.
