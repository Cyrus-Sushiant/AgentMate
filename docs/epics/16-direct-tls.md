# E16 Direct TLS mode

Milestone: M4 Security and operations. Depends on: E15.

## Goal

Reach the core without SSH when a server does not allow it, without weakening security: mutual TLS
with the enrolled device keys and a certificate pinned at install time.

## Tasks

- [ ] T1 Optional HTTPS listener with a self-signed ECDSA certificate generated at install; its
  public key pin is read over SSH and stored with the server.
- [ ] T2 mTLS: client certificates derived from the E04 device keys; unknown certificates are
  rejected during the handshake.
- [ ] T3 Firewall rule for the port with an optional source restriction.
- [ ] T4 Desktop connection option and fallback order (direct, then tunnel, or the reverse).

## Acceptance criteria

1. Connections without a client certificate or with an unknown one fail during the handshake.
2. A certificate that does not match the pin is refused.
3. Turning the mode off removes the listener and the firewall rule.
