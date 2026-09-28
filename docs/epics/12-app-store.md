# E12 App Store

Milestone: M3 Web, SSL and app store. Depends on: E11.

## Goal

Install well-known apps in one screen: pick a version, get strong generated secrets, optionally put
it on a domain with SSL, and see how to connect to it afterwards.

## Tasks

- [ ] T1 Catalog in `packages/core/src/deploy/catalog/`: MySQL, MariaDB, PostgreSQL, Redis,
  MongoDB, WordPress (with MySQL), Ghost, Ollama (optional Open WebUI and GPU), n8n, Uptime Kuma,
  MinIO, Adminer, phpMyAdmin, Gitea, Grafana, Prometheus, Nextcloud, Meilisearch, RabbitMQ. Official
  or verified-publisher images only, pinned by tag and digest.
- [ ] T2 Parameter schemas (zod) with UI hints, generated secrets, compose builder, post-install
  notes (connection strings), resource hints.
- [ ] T3 Install sheet: official-image badge, version picker, secrets, expose on a domain (E10,
  E11), deploy through the stacks module.
- [ ] T4 Post-install card with copyable connection details, and explicit updates (new digest
  shown before it is applied).
- [ ] T5 A script that refreshes pinned digests, with a test that every entry has one.

## Acceptance criteria

1. Every template renders a compose file that passes `docker compose config` and the risk linter
   with no unacknowledged findings (system test).
2. Generated secrets meet the password rules and never appear in logs.
3. Installing WordPress with a domain yields a working HTTPS site on the Pebble harness.
