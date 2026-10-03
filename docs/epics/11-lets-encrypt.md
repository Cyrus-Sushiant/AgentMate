# E11 Let's Encrypt certificates

Milestone: M3 Web, SSL and app store. Depends on: E10.

## Goal

One click issues a certificate for every domain of a site, and a background job renews it on time
without the app being open.

## Tasks

- [x] T1 ACME v2 client (RFC 8555) on BCL crypto: directory, nonces, ES256 account key (Data
  Protection encrypted), orders, authorizations, finalize with a P-256 CSR, download chain; ARI
  (RFC 9773) renewal info and `replaces`; staging and production directories.
- [x] T2 HTTP-01 through the nginx webroot (SELinux labels on RHEL); DNS-01 hook used by E14
  (the Cloudflare hook is in, see E14).
- [x] T3 Issuance job with clear step progress and errors (DNS not pointing here, port 80 blocked,
  rate limited).
- [x] T4 Renewal service: every 6 hours with jitter, ARI window, fallback at two thirds of the
  lifetime, exponential backoff, alerts on failure, nginx reload on success.
- [x] T5 Custom certificate upload (PEM validation, chain order, key match) and revoke.
- [x] T6 SSL tab: issue, status, expiry countdown, auto-renew state, last attempt and its log; force
  HTTPS and HSTS toggles now enabled.
- [x] T7 Fixture: Pebble plus challtestsrv containers wired to the E10 nginx harness.

## Acceptance criteria

1. Issue and renew succeed against Pebble, and renewal sends `replaces` (system test).
2. With a `FakeTimeProvider`, renewal happens inside the ARI window and backs off after failures.
3. A failed renewal raises an alert that reaches the desktop inbox.
4. Private keys are 0600 and the account key is stored encrypted.

## Implementation notes

Desktop and UI (T6), built with the E10 Websites section (see its notes):

- The SSL tab shows the certificate's state in words and with a mark (not colour alone), the days
  left, issuer and dates, what renewal will do next (or how many attempts failed and when the next
  one is), and the last attempt with a link to its job log. Admins issue, renew now, upload a
  certificate with its key, and remove one (with an optional revoke) after a confirm and a step-up.
  Force HTTPS and HSTS stay off until the site has a certificate.
- Issuing always asks for the CA's terms: the contract does not say whether this server already
  accepted them, and the first order per CA needs them. A staging switch picks Let's Encrypt's
  test CA.
- DNS-01 (with E14): the SSL tab's "Validate over DNS" switch sends `preferDns01` once the server
  holds a Cloudflare DNS token for the zone of every domain; a wildcard always uses DNS-01. The
  hook is `CloudflareDns01Hook` on the core, and `ICertificateAuthorities.CanAnswerDns01Async`
  refuses an order it cannot answer before it starts. See E14's notes.
- No visual pass in both themes yet. The e2e spec `deploySites.e2e.ts` issues a certificate from
  the DevHost's pretend CA and sees the site live with its lock.

Acceptance criteria from the desktop side: AC3 (a failed renewal's alert reaching the desktop
inbox) is not verified by this work; the alert watcher from E05 handles `certificateRenewalFailed`
like any other alert, but no test raises one. AC1, AC2 and AC4 belong to the core.

E17 review (2026-10-03):

- T1 to T5 and T7 were built in 7110a67 (ACME client, Pebble harness) and 07db580 (HTTP-01,
  issuance, renewal service, upload and revoke); their boxes are ticked now.
- AC3: the core raises `certificateRenewalFailed` after failed renewals (CertificateServiceTests),
  and a new watcher test puts that alert in the desktop inbox. The test found that the inbox
  called it "Alert on <server>"; it now says "A certificate did not renew on <server>", and the
  firewall and Cloudflare alerts got their own titles too.
- AC1 is the Pebble system test, which had never run in CI; it now runs in the nightly workflow.
