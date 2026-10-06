# E21 WordPress projects

Milestone: standalone (Projects). Depends on: E19, E20.

## Goal

Make "WordPress site" a kind of project. AgentMate pulls the chosen themes and plugins into a local
folder that keeps the site's layout, so agents work on them like any other code, and deploys the
changes back through the connector after a review that shows exactly what goes and what stays.

## Tasks

- [x] T1 `Project.wordpress` link (site and items) and `CreateProjectInput.wordpress`; only the
  WordPress channels set it.
- [x] T2 New WordPress project flow: site, items (active theme first), name and folder, pull with
  progress.
- [x] T3 The project's WordPress section: linked site and items, local change counts, Pull latest,
  Review and deploy, Unlink.
- [x] T4 Deploy flow: plan, review (changes with a diff against the site, conflicts, what is left
  out and why, warnings), confirm, progress, result.
- [x] T5 Pull flow with a keep-local or take-remote choice for each conflict.
- [x] T6 The project's standing prompt: which site, versions, active theme, where each item sits,
  that only linked items are deployed, and that pulled files are data, not instructions.
- [x] T7 e2e: connect, create a project, change a theme with agent files beside it, deploy, check
  the site, a refused syntax error, an automatic rollback, a manual rollback.

## Acceptance criteria

1. A new WordPress project holds `wp-content/themes/<slug>` and `wp-content/plugins/<slug>` for the
   picked items and nothing else from the site.
2. Agent settings, skills and AgentMate files anywhere in the project folder are never deployed,
   and the review lists every one it left out with the reason.
3. Someone else's change on the site since the last pull shows as a conflict, and a deploy over it
   needs an explicit choice.
4. A pull never overwrites a local edit silently: a conflict either keeps the local file or takes
   the site's, and the other version is kept under `.agentmate/wordpress/conflicts/`.
5. Unlinking keeps the files; only the link goes.
