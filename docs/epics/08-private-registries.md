# E08 Private registries

Milestone: M2 Docker, apps and AI. Depends on: E07.

## Goal

Private images (GitHub Container Registry first, then Docker Hub and custom registries) pull during
a deploy without the user typing anything on the server, and without leaving a token behind.

## Tasks

- [ ] T1 GitHub packages token flow: open GitHub's new-token page pre-filled with `read:packages`,
  paste, verify scopes through `X-OAuth-Scopes`, store as a `SecretEnvelope`.
- [ ] T2 Optional use of the `gh` sign-in token (`gh auth token`) behind an explicit warning about
  its repo and workflow scopes, with a scope check and a `gh auth refresh -s read:packages` helper.
- [ ] T3 Per-deploy registry auth: the token travels with the deploy request, lands in a tmpfs
  `DOCKER_CONFIG` for that job only, and is wiped in a `finally`; job logs and audit are redacted.
- [ ] T4 Stored credentials on the core (Data Protection encrypted, write-only through the API) for
  unattended pulls, with a clear "stored on this server" label.
- [ ] T5 Docker Hub and custom registry credentials (username and token).
- [ ] T6 UI: registry settings, per-app registry choice, scope problems shown with the fix.

## Acceptance criteria

1. After a deploy, successful or failed, no registry token remains on the server's disk (system
   test searches the filesystem and the job directory).
2. A token without `read:packages` is refused with a guided fix.
3. Stored credentials are unreadable without the Data Protection keys (test reads the raw row).
