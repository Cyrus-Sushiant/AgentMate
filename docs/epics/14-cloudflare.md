# E14 Cloudflare

Milestone: M4 Security and operations. Depends on: E11, E13.

## Goal

Manage Cloudflare from the app: DNS, development mode, under attack mode, security rules and SSL
settings, and wire domains to servers without visiting the dashboard.

## Tasks

- [ ] T1 Token setup in the desktop main process (official `cloudflare` SDK): guided creation of a
  minimally scoped token, permission check and display, `SecretEnvelope` storage.
- [ ] T2 Zones and DNS records (A, AAAA, CNAME, TXT, MX, CAA, SRV) with proxied toggle and TTL.
- [ ] T3 Zone settings: development mode, security level including "I'm Under Attack", SSL/TLS
  mode, Always Use HTTPS; cache purge (all or URLs).
- [ ] T4 Security rules: WAF custom rules through the Rulesets API with a friendly builder (block a
  country, challenge a path, allow an IP) and IP access rules.
- [ ] T5 Site integrations: "point domain to this server" (records from the server's public
  addresses), SSL method suggestion for proxied domains, Origin CA certificate install through the
  core.
- [ ] T6 Cloudflare-only origin lock: firewall allows 80 and 443 only from Cloudflare's ranges
  (refreshed daily on the core), nginx restores the real client IP, optional Authenticated Origin
  Pulls.
- [ ] T7 DNS-01: provision a separate zone-scoped `DNS:Edit` token to a server (Data Protection
  encrypted) for wildcard certificates.
- [ ] T8 UI at `/deploy/cloudflare` plus entry points from the site editor.
- [ ] T9 Fixture: recorded Cloudflare API responses for the SDK's fetch.

## Acceptance criteria

1. Missing token permissions produce a guided fix listing exactly what to add.
2. "Point domain to this server" creates or updates the right records idempotently.
3. With the origin lock on, the firewall rules match the fetched ranges for IPv4 and IPv6.
