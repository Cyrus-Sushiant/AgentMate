# E12 App Store

Milestone: M3 Web, SSL and app store. Depends on: E11.

## Goal

Install well-known apps in one screen: pick a version, get strong generated secrets, optionally put
it on a domain with SSL, and see how to connect to it afterwards.

## Tasks

- [x] T1 Catalog in `packages/core/src/deploy/catalog/`: MySQL, MariaDB, PostgreSQL, Redis,
  MongoDB, WordPress (with MySQL), Ghost, Ollama (optional Open WebUI and GPU), n8n, Uptime Kuma,
  Adminer, phpMyAdmin, Gitea, Grafana, Prometheus, Nextcloud, Meilisearch, RabbitMQ. Official
  or verified-publisher images only, pinned by tag and digest.
- [x] T2 Parameter schemas (zod) with UI hints, generated secrets, compose builder, post-install
  notes (connection strings), resource hints.
- [x] T3 Install sheet: official-image badge, version picker, secrets, expose on a domain (E10,
  E11), deploy through the stacks module.
- [x] T4 Post-install card with copyable connection details, and explicit updates (new digest
  shown before it is applied).
- [x] T5 A script that refreshes pinned digests, with a test that every entry has one.

## Acceptance criteria

1. Every template renders a compose file that passes `docker compose config` and the risk linter
   with no unacknowledged findings (system test).
2. Generated secrets meet the password rules and never appear in logs.
3. Installing WordPress with a domain yields a working HTTPS site on the Pebble harness.

## Implementation notes

Catalog (T1, T2):

- 18 templates. MinIO was planned but is left out: as of 2026-10-01 neither `docker.io/minio/minio` nor
  `quay.io/minio/minio` can be pulled anonymously, and the catalog only takes official or vendor
  images.
- Every rendered compose file carries a top-level `x-agentmate` block (template, version,
  parameters, domain; never a secret). Compose keeps `x-` keys and ignores them. It travels with
  each revision, so the post-install card, the update check and a rollback all read what an app is
  from its own files (`readCatalogInstall`). String parameters are `$`-escaped like any literal.

Install, card and updates (T3, T4):

- An App Store section per server (`view=store`): the apps it installed, the catalog by category
  with a filter, the install sheet (`&install=<template>`) and one installed app (`&app=<stack>`).
- The install sheet shows who publishes each image and the digest it is pinned to, the version,
  the app's settings, the passwords made on this computer (copy, make a new one, or type one that
  passes the rules) and "put it on a domain". The renderer checks the draft field by field; the
  main process renders the compose file and the .env again from the same choices (never a file
  from the renderer), refuses anything with an unacknowledged finding, then creates the app and
  its first revision through the E07 upload and starts the deploy job. The timeline follows.
- On a domain (Admins only, since sites, nginx and certificates are): a site in Websites pointing
  at the app's host port on 127.0.0.1 (E10 `deploySites.save`), nginx applied, then an optional
  Let's Encrypt certificate (E11, terms accepted by ticking it). Each is a step on screen with
  what failed. The site starts without the HTTPS redirect; turn it on in Websites once the
  certificate is there.
- The post-install card lists the template's facts (URLs, hosts, connection strings) with every
  secret masked. Right after the install the renderer still holds the passwords and can show
  them; later an Admin reveals them after a step-up through the new hub method `RevealStackEnv`
  (the revision's .env, only the count audited). Operators are told who can.
- Updates are never applied by themselves. The card compares what the live revision runs with
  what the catalog pins (`checkCatalogUpdate`): newer digests for the same line are offered as
  "Update", a newer line as "Move to ..." with a warning about data. Either one goes through the
  new hub method `ReviseStack`: the server copies the live revision (its .env and files) with the
  new compose file and deploys it, so no password leaves the server. The main process refuses a
  version whose compose file reads a secret the install does not have. Rolling back is offered on
  the card and works like any other revision.

T5: `pnpm catalog:refresh-digests` (`scripts/refresh-catalog-digests.mjs`) asks the registry for the
digest each pinned tag points at now (`docker buildx imagetools inspect`), checks the index still
carries linux/amd64 and linux/arm64, and rewrites `images.ts`; `--check` only reports. A run on
2026-10-02 found rebuilt digests for MariaDB and MongoDB; they were left for a reviewed refresh.
`catalog.test.ts` holds every entry to a tag and a digest.

Acceptance criteria:

1. `catalog.compose.test.ts` runs every template, version and toggle through `docker compose
   config` where Docker is installed, and `catalog.test.ts` through the risk linter. The system
   test `stacks.int.test.ts` also uploads every template to a real core and checks the server's
   own compose config and linter leave it Ready with nothing to acknowledge and every port on
   127.0.0.1.
2. Secrets come from Web Crypto and meet the rules (`secrets.test.ts`); they are only ever in the
   .env, which the core's redactor is seeded with. The compose file and the facts' masked text
   never hold one (tests in `catalog.test.ts` and `installed.test.ts`).
3. Not verified: WordPress on a domain over HTTPS on the Pebble harness. The site, apply and
   certificate calls are covered by component tests and the E10/E11 harnesses, not by one test
   that installs WordPress end to end.

Tests: catalog and install unit tests in `packages/core`; `main/deploy/appStore/service.test.ts`,
`main/ipc/deployAppStore.test.ts`, `main/deploy/stacks/service.revise.test.ts`; component tests for
the catalog, the sheet, the install with and without a domain, the card (masked, revealed, updates,
rollback); `e2e/deployAppStore.e2e.ts` installs Redis from the store against the DevHost and checks
the card. The DevHost's simulated compose now understands `${VAR:?message}`.
