# E20 WordPress sites in Deploy

Milestone: standalone (Deploy). Depends on: E19.

## Goal

Show connected WordPress sites in Deploy next to the servers, with what the site is running, its
themes and plugins, its deploy history with rollback, and who can reach it.

## Tasks

- [x] T1 Deploy page and rail: a "WordPress sites" group, selection by `?site=`, an empty state
  that offers connecting a site as well as adding a server.
- [x] T2 Connect dialog: paste the key, see the site, scope and expiry before connecting, optional
  label and HTTP sign-in, the plain-HTTP opt-in only when it is needed, and the plugin download.
- [x] T3 Overview: WordPress and PHP versions, active theme, connector version, whether file changes
  are allowed and why not, rescue guard, loopback health, a pending deploy.
- [x] T4 Items: themes, plugins and mu-plugins with the projects that link them, and pull or deploy
  from there.
- [x] T5 Deploys: history in plain words with rollback.
- [x] T6 Access: scope, plain HTTP, HTTP sign-in, rename, disconnect with or without revoking on
  the site, the site's audit log.

## Acceptance criteria

1. With no servers and one connected site, Deploy opens on the site.
2. A read-only key disables every deploy action, with the reason on hover.
3. Plain HTTP is refused unless the user allows it for that site, and the warning stays visible
   while it is allowed.
4. The connection key never reaches React Query, zustand, logs or toasts, and the field is empty
   after connecting or closing.
5. A rollback from the Deploys section puts the snapshot back and the history says so.
