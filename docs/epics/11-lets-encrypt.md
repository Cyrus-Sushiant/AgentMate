# E11 Let's Encrypt certificates

Milestone: M3 Web, SSL and app store. Depends on: E10.

## Goal

One click issues a certificate for every domain of a site, and a background job renews it on time
without the app being open.

## Tasks

- [ ] T1 ACME v2 client (RFC 8555) on BCL crypto: directory, nonces, ES256 account key (Data
  Protection encrypted), orders, authorizations, finalize with a P-256 CSR, download chain; ARI
  (RFC 9773) renewal info and `replaces`; staging and production directories.
- [ ] T2 HTTP-01 through the nginx webroot (SELinux labels on RHEL); DNS-01 hook used by E14.
- [ ] T3 Issuance job with clear step progress and errors (DNS not pointing here, port 80 blocked,
  rate limited).
- [ ] T4 Renewal service: every 6 hours with jitter, ARI window, fallback at two thirds of the
  lifetime, exponential backoff, alerts on failure, nginx reload on success.
- [ ] T5 Custom certificate upload (PEM validation, chain order, key match) and revoke.
- [ ] T6 SSL tab: issue, status, expiry countdown, auto-renew state, last attempt and its log; force
  HTTPS and HSTS toggles now enabled.
- [ ] T7 Fixture: Pebble plus challtestsrv containers wired to the E10 nginx harness.

## Acceptance criteria

1. Issue and renew succeed against Pebble, and renewal sends `replaces` (system test).
2. With a `FakeTimeProvider`, renewal happens inside the ARI window and backs off after failures.
3. A failed renewal raises an alert that reaches the desktop inbox.
4. Private keys are 0600 and the account key is stored encrypted.
