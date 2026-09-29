# Deploy: risk register

| Risk | Impact | Likelihood | Mitigation | Status |
|---|---|---|---|---|
| The program is large (18 epics) and spans several sessions | High | High | Vertical slices, one commit per epic, resumable `DELIVERY_STATUS.md`, epic-runner stop rules | Open |
| Distro drift: package names, repo layouts and defaults differ across Ubuntu, Debian and the RHEL family | Medium | High | Platform abstraction (`IPackageManager`, `IFirewallBackend`, `ISecurityModule`), test-server containers per distro, nightly full matrix | Open |
| SELinux behavior cannot be exercised inside containers | Medium | Medium | Nightly Rocky VM with SELinux enforcing when the runner has KVM; otherwise record the criteria as unverified | Open |
| Docker-published ports bypass the host firewall | High | High | Loopback bindings through `!override`, public exposure only through nginx, exposure inventory with "make private" | Open |
| A firewall change locks the user out | High | Medium | Lockout guard from `sshd -T` and `SSH_CONNECTION`, confirm over a new connection, rollback armed as a systemd timer | Open |
| Prompt injection through container or nginx logs steers the Deploy AI | High | Medium | Read-only allowlist for unattended runs, device-signed approvals enforced by the core, logs wrapped as untrusted data, redaction | Open |
| Secrets leak into logs, audit, prompts or crash dumps | High | Medium | Central redactor seeded with stack env values, env values stripped from DTOs, `LimitCORE=0`, compose config output never stored | Open |
| A compromised server captures a broad GitHub token | High | Low | Packages-only token by default, `gh` token only behind a warning, tmpfs `DOCKER_CONFIG` wiped after each deploy | Open |
| Let's Encrypt rate limits during development | Medium | Medium | Pebble in CI, staging directory toggle, ARI `replaces` on renewals | Open |
| sshd forbids forwarding on some servers | Medium | Medium | `agentmate-core bridge` stdio fallback. Occurred in E03: OpenSSH refuses a forbidden stream-local tunnel with the same "open failed" as a missing socket, so preflight cannot tell; the install tries the real socket and falls back to the bridge, and health checks do the same later | Mitigated (E03, proven against sshd with `AllowStreamLocalForwarding no`) |
| A fast command's exit status is lost when ssh2 parses it in the same burst as the exec reply | High | Medium | Found in E03 under full-suite load (an install step would read as failed): the exit status is taken from `close` as well, which cannot fire before the listeners exist | Mitigated (E03, reproduced in a unit test) |
| Supply chain: a tampered core binary or dependency | High | Low | Hash pinned in the desktop build, locked NuGet restore with source mapping, NuGet audit, pinned GPG keys for Docker and nginx | Open |
| SQLite writer contention breaks the audit chain or causes busy errors | Medium | Medium | Single writer queue, `BEGIN IMMEDIATE`, busy timeout, metrics in memory | Open |
| Pre-existing: AI provider API keys are stored in plaintext in `settings.json` and the Deploy AI reuses them | Medium | Medium | Out of scope for this plan; recommend moving them into a `SecretEnvelope` as a follow-up | Open |
