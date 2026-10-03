# E17 Polish and full OS matrix

Milestone: M4 Security and operations. Depends on: all earlier epics.

## Goal

Prove the whole flow on every supported OS, finish the accessibility and visual pass, and document
the feature.

## Tasks

- [ ] T1 Full-stack e2e on ubuntu-24.04 and rocky-9 (the other distros nightly): install, sign in
  with 2FA, install Docker, deploy a fixture project stack with an environment, pull a private image
  from a local registry, add a site with a test domain, issue a Pebble certificate, apply a firewall
  change and watch it revert, break a container and fix it through the Deploy AI with a fake CLI,
  see the problem clear.
- [x] T2 Accessibility and keyboard pass on every Deploy screen, both themes.
- [x] T3 README: a Deploy section in the features, the project structure, scripts and testing
  updates.
- [x] T4 Delivery status complete with any unverified criteria listed.

## Acceptance criteria

1. The full-stack e2e passes on ubuntu-24.04 and rocky-9.
2. Every Deploy screen is reachable and operable by keyboard alone.
3. README documents the feature and its security model.

## Implementation notes

### The full OS matrix (T1, partly)

- `testing/testServers.ts` has `testServerImages(supported, defaults)`: each system test keeps its
  defaults on every `[e2e]` push, and `AGENTMATE_TEST_SERVER_IMAGES` (comma separated) runs it on
  the asked-for images it supports instead. Unknown names fail the run, so a typo cannot skip
  everything. `skipWhenNoServers` leaves a skipped test behind when none apply (vitest fails an
  empty suite).
- Parameterized over Ubuntu 24.04, Debian 13 and Rocky 9: the install (`deploy.int.test.ts`,
  Debian added), `stacks`, `registries`, `deployExec` and `security`. The firewall tests run per
  backend (ufw, firewalld), direct TLS on ufw, the podman case on Rocky.
- `.github/workflows/nightly.yml` (schedule and `workflow_dispatch`, never a push) runs every Deploy
  system test once per test server (5 jobs, `fail-fast: false`), and a job for the server core's own
  xUnit system tests (the nginx `-t` harness and Pebble), which no workflow ran before.
- Run locally on 2026-10-03 (Docker Desktop): Debian 13 install as root and as deployer, exec,
  security, stacks and registries; Rocky 9 exec, security, stacks, registries and the podman case.
  All passed.

### The end-to-end story

There is no single spec that walks the whole story against one machine: the DevHost cannot run an
install, and a real test server cannot run the Electron e2e on macOS or Windows. Each step has its
own coverage instead:

| Step | Against the DevHost (e2e, every OS) | On real servers (system tests) |
|---|---|---|
| Install the core | `deploy.e2e.ts` (the core online) | `deploy.int.test.ts` (Ubuntu, Rocky; Debian nightly) |
| Sign in with 2FA | `deploy.e2e.ts` | `deploy.int.test.ts` (owner, enrollment, hub) |
| Install Docker | Component tests only (the DevHost has Docker) | `docker.int.test.ts` (Rocky 9, podman replaced) |
| Deploy a stack with an environment | `deployApps.e2e.ts` | `stacks.int.test.ts` |
| Pull a private image | `deployRegistries.e2e.ts` | `registries.int.test.ts` (registry:2 with htpasswd) |
| Site with a domain and a certificate | `deploySites.e2e.ts` (pretend CA) | Server core system tests (nginx `-t`, Pebble) |
| Firewall change that reverts | `firewall.e2e.ts` | `firewall.int.test.ts` (ufw, firewalld) |
| AI fixes a broken container | `deployLogsAi.e2e.ts` | `deployExec.int.test.ts` (signed exec, journal) |

`deployLogsAi.e2e.ts` now ends the way the story does: the approved fix is
`docker restart newsletter-sender-1`, the DevHost's pretend exec restarts that container
(`FakeExecRunner`, with a core test), and the crash loop leaves the problems feed. Before, the
step ran a command the DevHost only echoed, and nothing cleared.

AC1 asks for one full-stack run on Ubuntu and Rocky, which this does not give: the steps are
proven on both, but separately. That is why T1 stays open.

### Visual and keyboard pass (T2)

Every section (Overview, Apps, Containers, App Store, Websites, Firewall, Logs, the six Security
tabs) and the Cloudflare page, in light and dark, at 1440 and 960 pixels wide, with the out-e2e
build against the DevHost. A throwaway Playwright script measured text contrast against the
composited background, looked for unnamed controls, `title` attributes, em dashes and content
past the right edge, and tabbed through each screen checking for a focus ring. Found and fixed:

- Light theme contrast: white text on primary buttons was 3.7:1, and the status words in the
  success, warning and destructive colours were 2.8 to 3.9:1 on cards. The light tokens are
  deeper now (primary and ring 23%, success 22%, warning 27%, destructive 41% lightness), and
  the success and warning badges use a lighter tint in light mode. In dark, white on the
  destructive colour was 3.8:1; it now carries dark text like the other dark-theme accents.
  `themeContrast.test.ts` holds every token pair at 4.5:1 or better in both themes.
- Tabs (`components/ui/tabs.tsx`, app-wide) had no focus ring at all, on the tab or its panel.
- Five link-style buttons (sign in, step-up, install, the Deploy AI drawer) used the browser's
  default outline; they now use the ring like everything else.
- Two header buttons on every page (sidebar toggle, Ask AI) had no accessible name.
- Firewall: the facts row cut its values off ("Deny by c", "Filtered t...") and clipped the
  incoming select even at 1440 wide; the facts now wrap.
- The section strip squeezed "App Store" onto two lines and cut Security off at 960 wide; it
  scrolls sideways now.
- The floating Deploy AI button covered the last controls of a long section; the page leaves room
  for it.

No `title` attributes or em dashes were found in the Deploy screens. Shimmer, empty and error
states were already covered by each panel's component tests against the fake core.

`e2e/deployKeyboard.e2e.ts` is the lasting check for AC2: it opens every section from the strip
with Tab and Enter, tabs into it, and expects a control there with a visible focus ring; the
Security tabs are switched with the arrow keys; and no button on any of those screens is
unnamed. Fixes are asserted through the DOM in component tests (`tabs.test.tsx`,
`cards.test.tsx`, `DeployPage.test.tsx`).

### Docs (T3, T4)

README: a Deploy section (what it is, the security model in short, supported servers, trying it
with the DevHost), a Deploy line in the feature list, the Deploy layout in the project structure,
the Deploy system tests in Testing, and the nightly workflow in CI. `DELIVERY_STATUS.md` and
`RISKS.md` updated.

### What is left

- AC1 as written (see above).
- E12 AC3 (WordPress over HTTPS on Pebble) is still not one test.
- The nightly matrix's first run is its first proof in CI; see `DELIVERY_STATUS.md` for its result.
