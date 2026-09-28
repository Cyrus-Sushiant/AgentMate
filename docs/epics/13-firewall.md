# E13 Firewall

Milestone: M4 Security and operations. Depends on: E10.

## Goal

Manage the host firewall safely: rules, presets and exposure at a glance, with changes that undo
themselves if they cut the app off.

## Tasks

- [ ] T1 `IFirewallBackend` for ufw (with `IPV6=yes`) and firewalld: status, enable, disable,
  default policies, rules with validation (ports, ranges, protocols, source CIDRs, comments).
- [ ] T2 Presets (SSH, HTTP, HTTPS, common databases) and the current SSH port from `sshd -T` plus
  the live `SSH_CONNECTION`.
- [ ] T3 Lockout guard: a change set that would block the SSH port or the app's source is refused
  unless explicitly overridden with a typed confirmation.
- [ ] T4 Safe apply: snapshot, apply, arm a transient systemd timer that restores the snapshot in 60
  seconds, confirm only over a new SSH connection.
- [ ] T5 Exposure inventory: listening sockets and container port bindings, public versus local,
  with a "make private" redeploy for AgentMate stacks.
- [ ] T6 UI: status hero, rules table with add and edit, presets, exposure view, countdown banner.
- [ ] T7 Fixture: privileged ufw and firewalld test servers that check the live IPv4 and IPv6
  rulesets, plus a lockout test over a second SSH connection.

## Acceptance criteria

1. An unconfirmed change reverts even when the core process is killed right after applying it.
2. A rule set that would block SSH is refused without the override.
3. Rules land correctly in both families' live rulesets for IPv4 and IPv6.
