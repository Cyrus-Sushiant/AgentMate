# E15 Security center and maintenance

Milestone: M4 Security and operations. Depends on: E13.

## Goal

One place to see how safe a server is and fix it, plus the maintenance a long-lived install needs:
users, devices, audit, core updates and backups.

## Tasks

- [ ] T1 Users and roles (Owner only), devices and sessions with revoke, enrollment codes.
- [ ] T2 Audit viewer with filters, export and chain status.
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
