# E10 nginx websites

Milestone: M3 Web, SSL and app store. Depends on: E07.

## Goal

Put any app on one or more domains without touching a config file: pick the service and port, toggle
websocket, proxy cache and compression, add custom settings when needed, and never break the
running nginx.

## Tasks

- [ ] T1 Install from the nginx.org stable repo (pinned GPG key) on both families, or adopt an
  existing nginx with the stock default site backed up and disabled.
- [ ] T2 Managed layout: one include wired into `nginx.conf` once, `/etc/nginx/agentmate/current`
  symlinked to numbered release directories, default server returning 444, ACME challenge location.
- [ ] T3 Typed site model and deterministic renderer: domains (IDNA), upstream from a stack service
  port picker, websocket upgrade map, proxy cache zone per site (TTL, bypass, purge), gzip,
  `client_max_body_size`, timeouts, custom headers, security headers, HSTS, HTTP/2, IP allow and
  deny, basic auth, rate limits; HTTP-only rendering until a certificate exists.
- [ ] T4 Custom snippet: directive allowlist parser (no `include`, `load_module`, `*_log` paths,
  `alias` or `root` outside the site directory, `lua`, `perl`), Owner-only, shown as a diff.
- [ ] T5 Apply: render a new release, swap the symlink, `nginx -t`, reload, or swap back and return
  the parsed error with the line mapped to the user's snippet; crash-safe (a marker file lets the
  core finish or undo an interrupted apply on start).
- [ ] T6 `stream` proxies for public TCP and UDP ports with optional IP allowlists.
- [ ] T7 SELinux: `httpd_can_network_connect`, `http_port_t` for custom ports.
- [ ] T8 Per-site access and error logs in the log viewer.
- [x] T9 UI: Websites list (domains, target, SSL badge, cache and websocket toggles), site editor
  (Domains, Proxy, SSL placeholder, Performance, Security, Advanced with Monaco and inline errors,
  Logs), live route map on the app detail.
- [ ] T10 Fixture: `nginx -t` harness on nginx.org packages for Debian and Rocky with a whoami
  upstream and curl checks.

## Acceptance criteria

1. Every renderer variant passes a real `nginx -t` and serves the upstream through curl.
2. A broken snippet leaves the running configuration untouched and reports the line.
3. Upstream targets pointing at link-local, metadata or the core's own socket are refused.
4. Golden-file tests pin the rendered configuration for each option.

## Implementation notes

Desktop and UI (T9, plus the SSL tab of E11 T6):

- Main process: `main/deploy/sites/` (calls on the lasting core link, site log feeds) and the IPC
  groups `deploySites` and `deployCerts` (`main/ipc/deploySites.ts`), main window only, with every
  argument checked for shape and size before the core sees it. The core judges what values mean
  and answers with problems tied to fields, which the editor shows next to the field and on its tab.
- Renderer: `components/deploy/sites/`, a Websites section per server: nginx setup or adoption,
  sites as route maps (domain with lock and days left, nginx chips, upstream; each stop opens its
  tab), a tabbed site editor, stream proxies, and an Apply bar whose problems link to their field.
  Saving only stores a site; Apply puts every saved change live, with a busy state while nginx -t
  and the reload run. Custom snippets are Owner only, edited in Monaco with refused lines marked,
  and shown as a diff before saving; Monaco loads only when the Advanced tab opens.
- Deviation: the preload method for applying is `deploySites.applyChanges`, not `apply` (the
  channel is still `deploySites:apply`). The renderer tests' bridge is a callable Proxy, so a
  method named `apply` resolves to `Function.prototype.apply`; the same goes for `call` and `bind`.
- Site logs have their own subscription registry (`SiteLogSubscriptions`) and a second
  `subscriptionOwners` instance in `main/deploy/index.ts`, so each window's logs end with it
  without widening `DeploySubscriptions`.
- Site logs have no cursor in the contract, so a stream opened again after a drop starts with the
  last lines once more and is marked `reset`: the window replaces what it shows instead of showing
  lines twice. A rotated file arrives marked the same way, and the view says it was rotated.
- The fake core (`shared/deploy/testing/fakeNginx.ts`) answers every nginx and certificate call
  with the core's role rules, for main and renderer tests.
- No visual pass in both themes yet: states are asserted through the DOM, and the e2e spec
  `deploySites.e2e.ts` covers the DevHost flow (set up nginx, add a site, apply, issue a
  certificate and see it live) against the simulated nginx.

Acceptance criteria from the desktop side: none of AC1 to AC4 is exercised by the desktop work;
they belong to the core and its harness. The DevHost run uses simulated nginx, not a real
`nginx -t`.
