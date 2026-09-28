# E09 Logs center, problems feed and Deploy AI

Milestone: M2 Docker, apps and AI. Depends on: E07.

## Goal

Every error is one click away from a fix: a unified log viewer, a problems feed that surfaces what
is broken, and a Deploy AI that diagnoses and repairs over the core's WebSocket with the same
approval experience as the SSH AI, but safer.

## Tasks

- [ ] T1 Unified log viewer: sources (container, whole stack with a color per service, journald
  units, core audit; nginx is added in E10), follow, search and highlight, level detection, time
  range, download; untrusted text is rendered as text only.
- [ ] T2 Problems feed: crash loops, unhealthy containers, failed deploys, disk pressure, exposed
  ports; each card offers "Diagnose with AI" and "Fix in project".
- [ ] T3 Characterization tests for `apps/desktop/src/main/agents/sshTaskRunner.ts` before any
  change, so the SSH AI keeps behaving exactly as today.
- [ ] T4 Refactor the loop so it takes a command executor; the SSH and local targets keep the marker
  based executor.
- [ ] T5 Core executor over hub `StreamExec`; modes "approve every command" (default) and "auto-run
  diagnostics" (strict read-only allowlist parser, step-up to enable); approvals signed by the
  device key over the command text and a nonce.
- [ ] T6 Core side: `StreamExec` refuses any AI-tagged command that is neither allowlisted nor
  carrying a valid approval; audit tags every AI step; output redacted with the stack's env values
  before it is returned.
- [ ] T7 Prompt builder: server facts, stack and container context, log excerpt wrapped as
  delimited untrusted data; no env values.
- [ ] T8 Assistant drawer on every Deploy screen: context chips, step timeline, approve and skip,
  streamed output, stop, follow-up questions.

## Acceptance criteria

1. The SSH AI characterization suite passes unchanged after the refactor.
2. A non-allowlisted command without a valid approval is refused by the core itself (integration
   test calling the hub directly).
3. Log text containing instructions cannot cause any command to run without approval (test with an
   injected log line and a fake model that obeys it).
4. No env value of the stack reaches the model (test with seeded secrets).
