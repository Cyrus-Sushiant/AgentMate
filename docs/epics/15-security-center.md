# E15 Security center and maintenance

Milestone: M4 Security and operations. Depends on: E13.

## Goal

One place to see how safe a server is and fix it, plus the maintenance a long-lived install needs:
users, devices, audit, core updates and backups.

## Tasks

- [x] T1 Users and roles (Owner only), devices and sessions with revoke, enrollment codes.
- [x] T2 Audit viewer with filters, export and chain status.
- [ ] T3 Security checklist with a score and previewed one-click fixes: firewall on, SSH password
  login off (only when key login for this app is proven), root login policy, automatic security
  updates, pending reboot, exposed ports, certificate health, core up to date.
- [ ] T4 Core update from the app over SSH (verified binary, previous release kept, automatic
  rollback on a failed health check).
- [ ] T5 Passphrase-encrypted backup and restore of the core database and settings.

## Acceptance criteria

1. No checklist fix can lock the app out of the server (tested per fix against the test servers).
2. A failed core update rolls back and the app reconnects.
3. A backup cannot be restored without its passphrase, and a restored core keeps working.

## Implementation notes

- **Where it lives.** Server core: `Hubs/CoreHub.Users.cs` and `Contracts/UserContracts.cs`, with
  the audit filters in `CoreHub.cs`. Desktop main process: `main/deploy/security.ts` (users,
  devices, sessions, codes, audit, export), `main/deploy/auditExport.ts`,
  `main/deploy/auth/enrollmentCode.ts`, `main/deploy/bootstrap/coreGroup.ts`, the
  `redeemEnrollmentCode` method of `service.ts`, and the `deploySecurity` IPC group in
  `main/ipc/deploySecurity.ts`. Renderer: `components/deploy/security/`, mounted as the Security
  section of a server (`?view=security`, `ServerSections.tsx`), and `RedeemCodeDialog`.
- **T1, users.** Hub methods for Owners: `ListUsers`, `CreateUser`, `SetUserRole`,
  `SetUserDisabled`, `ResetUserPassword` and `DeleteUser`; every change needs a step-up. Each
  change runs in one BEGIN IMMEDIATE transaction that checks again that the caller is still an
  Owner and that the core keeps one, so two Owners demoting each other at the same moment cannot
  leave it with none. An Owner cannot disable, remove or reset their own account. Disabling is
  Identity's lockout until the end of time plus a new security stamp, so no migration was needed;
  sign-in tells a disabled account from a locked one. Role changes, disables, resets and removals
  close the user's open hub connections, since a connection keeps the roles it was opened with.
  The transaction is handed to EF from outside, so a refusal rolls it back explicitly: disposing
  EF's wrapper would keep the write lock until the connection closed, and the audit append that
  follows waited out the 30 second busy timeout (the first test run found it).
- **T1, devices, sessions and codes.** The existing device and session methods, plus
  `RevokeOtherSessions` (account self-service, added to the Viewer pin on purpose). Ending all
  other sessions and removing a user take typed confirmation, which the shared confirm dialog
  now offers (`typeToConfirm`). An Owner mints a code from a user's row; it is shown once with
  its expiry. Redeeming one needs no sudo: the app makes a device key, sends the public half with
  the code and the password to `POST /api/v1/auth/enroll` over the tunnel, seals the private
  half like an SSH enrollment and signs in. On a server whose core another computer installed,
  the app first reads the preflight as the login user and settles the transport with a health
  check. The core's socket is open to root and the agentmate group only, so a login outside the
  group is told the `usermod` an admin has to run; one added since it logged in gets a fresh
  login. The join offer shows on the install panel when a core already runs there.
- **T2, audit.** `AuditQuery` gained actor (user name or id), result, time range and action
  groups (a prefix ending in a dot); events now carry the actor's and device's current names.
  The viewer pages with `nextBeforeId`, exports every match (newest 50,000 at most) as JSON or
  CSV to a file the user picks, with CSV cells that a spreadsheet would read as formulas
  escaped, and shows the chain check in words, broken or intact.
- **Evidence.** Server core: `HubUserTests` (21 cases: roles, last Owner, disable, reset,
  removal with its devices, sessions and codes, other sessions, audit filters). Desktop: tests for
  the security service, export, redemption, group check and IPC validation, and every new screen
  through its loading, empty, error and success states; `deploy.e2e.ts` signs in to the DevHost
  and finds its user, this computer, this session and an intact audit chain in the Security area.
