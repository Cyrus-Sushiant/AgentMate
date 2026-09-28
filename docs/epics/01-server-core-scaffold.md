# E01 Server core scaffold

Milestone: M1 Foundations. Depends on: E00.

## Goal

A .NET 10 solution for the server core lives in `apps/server-core`, builds and tests in CI, serves
an anonymous health endpoint, and publishes its API contract to TypeScript with a drift check. From
this epic on, nothing in the core is reachable without an explicit authorization decision.

## Tasks

- [ ] T1 Solution layout: `AgentMate.ServerCore.slnx`, `global.json` (SDK 10.0.4xx, roll forward
  latest feature, Microsoft.Testing.Platform runner), `Directory.Build.props` (nullable, implicit
  usings, warnings as errors, latest analyzers), `Directory.Packages.props` (central versions),
  `packages.lock.json` per project with locked restore in CI, `nuget.config` with package source
  mapping to nuget.org only, `.editorconfig` for C#.
- [ ] T2 Projects: `src/AgentMate.ServerCore` (web host, `serve` and `admin` commands),
  `tests/AgentMate.ServerCore.Tests` (xUnit v3), `tests/AgentMate.ServerCore.SystemTests`
  (placeholder that skips outside Linux with Docker).
- [ ] T3 Host: minimal APIs, `AddAuthorization` with a deny-by-default fallback policy,
  `GET /api/v1/health` marked anonymous (status, version, API version), Host header allowlist,
  rejection of any request with an `Origin` header, Kestrel limits, listening on a Unix socket in
  production and on TCP in tests.
- [ ] T4 `agentmate-core admin version` prints the version as JSON (used by the installer later).
- [ ] T5 OpenAPI generated at build time (`Microsoft.AspNetCore.OpenApi` plus
  `Microsoft.Extensions.ApiDescription.Server`) into `apps/server-core/openapi/core.v1.json`.
- [ ] T6 `openapi-typescript` turns it into `packages/core/src/deploy/protocol/openapi.ts`; a
  script regenerates it; a vitest test fails when the committed file does not match the spec.
- [ ] T7 Hub contract: a .NET test reflects over the hub and client interfaces and writes
  `apps/server-core/contracts/hub-contract.json`; `packages/core/src/deploy/protocol/hub.ts` lists
  the same methods, and a vitest test compares them.
- [ ] T8 A reflection test fails if any endpoint lacks an explicit authorization decision.
- [ ] T9 Root scripts `server-core:build`, `server-core:test`, `server-core:format`,
  `server-core:openapi`; `.gitignore` gains `bin/`, `obj/`, `artifacts/`; `.gitattributes` pins
  `*.cs`, `*.csproj`, `*.sh` and systemd units to LF.
- [ ] T10 CI: a `server-core` job in `test.yml` (setup-dotnet from `global.json`, locked restore,
  `dotnet format --verify-no-changes`, build, tests, `dotnet list package --vulnerable` failing on
  high or critical) that joins the `all-green` gate in `ci.yml`.
- [ ] T11 README: project structure and scripts mention `apps/server-core`.

## Acceptance criteria

1. `dotnet test` passes locally and in CI; the new job is part of the green gate.
2. The health endpoint answers anonymously; any other route returns 401 by default (tested).
3. A request with an `Origin` header or an unknown Host gets 400/403 (tested).
4. The generated TypeScript compiles under `tsc` 7 inside `packages/core`.
5. Changing an endpoint without regenerating the TypeScript fails the drift test.
6. The hub-contract test fails when the TypeScript hub list and the .NET interfaces differ.
