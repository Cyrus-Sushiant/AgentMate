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
- [ ] T9 UI: Websites list (domains, target, SSL badge, cache and websocket toggles), site editor
  (Domains, Proxy, SSL placeholder, Performance, Security, Advanced with Monaco and inline errors,
  Logs), live route map on the app detail.
- [ ] T10 Fixture: `nginx -t` harness on nginx.org packages for Debian and Rocky with a whoami
  upstream and curl checks.

## Acceptance criteria

1. Every renderer variant passes a real `nginx -t` and serves the upstream through curl.
2. A broken snippet leaves the running configuration untouched and reports the line.
3. Upstream targets pointing at link-local, metadata or the core's own socket are refused.
4. Golden-file tests pin the rendered configuration for each option.
