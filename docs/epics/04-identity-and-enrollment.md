# E04 Identity and device enrollment

Milestone: M1 Foundations. Depends on: E03.

## Goal

The core knows who is calling. Users and password hashes live in the core's SQLite through
ASP.NET Core Identity; each desktop proves itself with an enrolled device key; every endpoint and
hub method is covered by a policy; every sensitive action lands in a tamper-evident audit trail.

## Tasks

- [ ] T1 EF Core SQLite context with migrations applied at start-up, WAL mode, single writer queue
  (`BEGIN IMMEDIATE`, busy timeout), unix-millisecond timestamps.
- [ ] T2 Identity with Guid keys, password rules (12+ characters, common-password list), PBKDF2
  iteration count raised, lockout (5 failures, 15 minutes), TOTP authenticator and recovery codes.
- [ ] T3 Roles Owner, Admin, Operator, Viewer and named policies; deny-by-default fallback; the
  reflection test from E01 now also checks hub methods.
- [ ] T4 Devices: P-256 public keys, `admin create-owner --username --password-stdin` and
  `admin enroll-device --user --name` reading the public key from stdin.
- [ ] T5 Challenge login: `POST /auth/challenge` (single-use nonce, 60 s TTL),
  `POST /auth/login` (signature plus password, then TOTP step when enabled), `POST /auth/renew`
  (signature only, within the device session's idle and absolute limits), 15-minute access tokens,
  logout, device and session list and revoke.
- [ ] T6 Step-up: re-enter password or TOTP, valid 10 minutes, required by policy for sensitive
  actions.
- [ ] T7 Rate limits per user and global on auth endpoints.
- [ ] T8 Audit: append-only, hash-chained events (actor, device, peer uid, action, target, redacted
  parameters, result), query and chain verification endpoints, retention job.
- [ ] T9 Break-glass CLI: `admin revoke-all`, `admin reset-password --password-stdin`.
- [ ] T10 Desktop: device key generation and sealing (`SecretEnvelope`), enrollment during install
  (owner username and password collected in the wizard, piped over stdin), sign-in and 2FA screens,
  signed renewals in the connection layer, "needs sign-in" and "needs re-enroll" states.
- [ ] T11 Extra devices: Owner mints a single-use enrollment code; another device redeems it with its
  public key and the user's password.

## Acceptance criteria

1. Each auth path has integration tests: success, wrong password, wrong TOTP, lockout, replayed
   challenge, expired challenge, revoked device, expired session.
2. A Viewer is denied every mutating endpoint and hub method (table-driven test over the policy
   map).
3. Editing any audit row breaks chain verification (tested).
4. Owner password and device key never appear on a command line (asserted on the exec requests).
5. A revoked device cannot reconnect and the UI moves to "needs re-enroll".
