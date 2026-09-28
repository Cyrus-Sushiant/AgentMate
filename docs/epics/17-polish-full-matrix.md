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
- [ ] T2 Accessibility and keyboard pass on every Deploy screen, both themes.
- [ ] T3 README: a Deploy section in the features, the project structure, scripts and testing
  updates.
- [ ] T4 Delivery status complete with any unverified criteria listed.

## Acceptance criteria

1. The full-stack e2e passes on ubuntu-24.04 and rocky-9.
2. Every Deploy screen is reachable and operable by keyboard alone.
3. README documents the feature and its security model.
