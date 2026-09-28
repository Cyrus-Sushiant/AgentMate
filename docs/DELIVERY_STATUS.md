# Delivery Status

Updated: 2026-09-29
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
| System tests | Linux with Docker, `[e2e]` in the commit message (from E03) |
| e2e | `pnpm test:e2e`, in CI when the commit message carries `[e2e]` |

## Epics

| Epic | Title | Status | Commit | Notes |
|---|---|---|---|---|
| E00 | Delivery docs | Complete | 4e412e3 | Written by hand |
| E01 | Server core scaffold | Complete | see git log | Contracts via Tapper and TypedSignalR (TS 7 has no compiler API for openapi-typescript); API is WebSocket-first |
| E02 | SSH foundation | Not started | | |
| E03 | Walking skeleton: install and see the server | Not started | | |
| E04 | Identity and device enrollment | Not started | | |
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

- E01 AC1 "passes in CI": verified locally on Windows and in the Linux .NET SDK container; the first CI run after the push confirms it.

## Open blockers

None.
