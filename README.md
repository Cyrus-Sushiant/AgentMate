<div align="center">
  <img src=".github/assets/logo.png" alt="AgentMate logo" width="120" />

  # AgentMate

  **A control center for your AI coding agents.**

  Manage every AI coding CLI on your machine (Claude Code, Codex, Cursor, Gemini, Grok, and more) from one desktop app: track token usage and cost, bootstrap and launch projects, build and translate prompts, install skills and MCP servers, and remote-control another AgentMate over your local network.

  ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)
  ![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F)
  ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
  [![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
</div>

---

## Screenshots

<table>
  <tr>
    <td width="50%"><img src=".github/assets/screenshot-dashboard.png" alt="Dashboard" /></td>
    <td width="50%"><img src=".github/assets/screenshot-usage.png" alt="Token Usage" /></td>
  </tr>
  <tr>
    <td align="center"><em>Dashboard: CLIs, projects, and system health at a glance</em></td>
    <td align="center"><em>Token Usage: tokens, cost, and quota across every provider</em></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/screenshot-projects.png" alt="Projects" /></td>
    <td width="50%"><img src=".github/assets/screenshot-cli-manager.png" alt="AI CLI Manager" /></td>
  </tr>
  <tr>
    <td align="center"><em>Projects: bootstrap and launch the repos you work on</em></td>
    <td align="center"><em>AI CLI Manager: detect, install, and update coding CLIs</em></td>
  </tr>
</table>

## Features

- **Dashboard**: your AI CLIs, projects, and system health (CPU/GPU/memory/network) at a glance.
- **Token Usage**: track tokens, cost, and rate-limit quotas across 60+ AI providers, with local-log scanning for Claude Code and Codex (no API key needed) and floating glass desktop widgets that stay on top.
- **Projects**: manage the projects AgentMate bootstraps and works with; launch each one's run command straight from its card.
- **AI CLI Manager**: detects every AI coding CLI installed on the machine and installs missing ones with one click.
- **Prompt Builder**: describe what you want, and AgentMate structures it into a professional prompt for the agent of your choice.
- **Prompt History**: every prompt you've generated or translated, searchable.
- **Skill Marketplace**: install agent skills from configurable repositories or skills.sh.
- **MCP Marketplace**: install MCP servers into a project from configurable repositories.
- **Agent Tools**: curated third-party tools that cut agent token spend or improve code quality.
- **Ask AI**: a persistent assistant conversation, one keystroke away.
- **Remote**: control another AgentMate over your local network, AnyDesk-style, over WebSockets, including from the companion mobile app.
- **Settings**: configure defaults for AgentMate.

## Tech stack

| Layer | Stack |
|---|---|
| Desktop app | Electron, React 19, TypeScript, Vite (`electron-vite`), Tailwind CSS, Radix UI, TanStack Query |
| Mobile companion | Expo / React Native, WebRTC |
| Shared packages | `@agentmat/core` (business logic), `@agentmat/protocol` (shared types/wire protocol) |
| Local storage | better-sqlite3 |
| Terminal | node-pty + xterm.js |
| Tooling | pnpm workspaces, ESLint, Prettier |

## Project structure

```
AgentMate/
├── apps/
│   ├── desktop/     Electron app (main, preload, renderer), the primary product
│   └── mobile/      Expo/React Native companion app for the Remote feature
├── packages/
│   ├── core/        Shared business logic (@agentmat/core)
│   └── protocol/    Shared types and wire protocol (@agentmat/protocol)
└── patches/         pnpm patches for third-party packages
```

## Getting started

**Prerequisites:** Node.js ≥ 20, [pnpm](https://pnpm.io) ≥ 11.

```bash
pnpm install

# Build the shared packages and launch the desktop app in dev mode
pnpm dev
```

On Windows you can also just run `run.bat`, which installs dependencies, verifies the Electron binary, and starts the app.

### Common scripts (from the repo root)

| Command | What it does |
|---|---|
| `pnpm dev` | Build `core`/`protocol`, then launch the desktop app in dev mode with hot reload |
| `pnpm build` | Build `core`, `protocol`, and the desktop app's production bundle |
| `pnpm package` | Package the desktop app into installers via `electron-builder` |
| `pnpm mobile` | Build `protocol`, then launch the Expo dev server for the mobile companion app |
| `pnpm typecheck` | Type-check every workspace package |
| `pnpm lint` | Lint every workspace package |

## License

[MIT](LICENSE) © SmartClouds
