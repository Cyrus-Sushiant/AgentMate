---
title: Agent Tools
category: Agents
order: 40
summary: A curated list of third-party tools that cut agent token spend, add code intelligence or scan your code for security problems, which you can install, configure and update from one page.
keywords: agent tools, tools, install, uninstall, update, docker, security scanners, semgrep, trivy, codeql, bearer, sonarqube, strix, rtk, 9router, codegraph, diffray, openclaw, hermes, ponytail, languagetool, token saving
route: /tools
---

Agent Tools is a catalog of outside tools that make AI coding agents cheaper, smarter or safer. They are not MCP servers or skills (those have their own pages). Each tool has a card where you can install it, configure it, update it, run its Docker container and open its website or GitHub page. The security scanners you install here are the ones a project's **Security** tab runs.

## Where to find it

Click **Agent Tools** in the sidebar under **Agents**, or open the command palette and type "Agent Tools". A project's **Security** tab also links here with a **Browse security tools** button, which opens this page on the **Security** tab.

## The page layout

### Target project

The **Target project** picker at the top chooses a project for actions that work inside a codebase, such as initializing a tool in a project or writing its config file. Docker and global setup actions do not need one. If an action needs a project and none is chosen, AgentMate says "Choose a target project first."

### Category tabs

Tabs under the picker filter the cards by category, each with a count: **All**, **Security**, **Agent Behavior**, **Agent Runtimes**, **Code Intelligence**, **Token & Cost** and **Writing**. **Security** comes first after **All**. You can also jump straight to a tab by opening the page with `?tab=security`.

### Refresh and update checks

- **Refresh** re-checks which tools are installed.
- **Check all for updates** checks every installed tool that has an update source, one at a time. Tools that cannot be checked are counted and reported ("All checkable tools are up to date (N could not be checked)").

### A tool card

Each card shows the tool name, its category, a description, a status badge, tags and the author. The status badge is **Not detected** or the version number when found. Some tools have special wording (**Not in tools folder** for LanguageTool, **Not downloaded** for CodeQL). Tools with a Docker option also show a Docker badge with one of these states: unavailable (Docker is not installed), not created, running or stopped. A **Server running** badge shows when the LanguageTool server is up.

## Install a tool

The main button on a card depends on how the tool installs.

- **Install (npm)**, **Install (pip)**, **Install (winget)**, **Install (brew)**, **Install (script)** or **Install (cargo)**: the button names whatever runs. Click it and a terminal opens with the install command typed in. Press `Enter` in that terminal to run it.
- **Install** (interactive): used by Ponytail. It opens a terminal running Claude Code and copies the setup commands to your clipboard. Press `Enter` to launch Claude Code, paste the commands (`Ctrl+Shift+V`, or `Cmd+V` on macOS, not plain `Ctrl+V`) and press `Enter` again.
- **Setup instructions** or **Copy setup commands**: for tools with no install command for your operating system, or that must be set up by hand. It copies the written steps to your clipboard.
- **Uninstall**: replaces the install button once a tool is detected. It opens a terminal with the uninstall command for you to run. Tools that are uninstalled by hand (such as Ponytail) have a trash icon instead (**Copy uninstall commands**) that copies the steps to your clipboard.

Nothing runs until you press `Enter` in the terminal, so you can read the command first. If a tool has no command for your operating system, you see a message instead of a terminal.

After installing, click **Refresh**. Tools installed with pip on Windows can land in a folder that is not on `PATH`. AgentMate looks there itself, so the card picks them up on Refresh.

## Update a tool

- Click the cloud icon (**Check for updates**) on an installed tool's card. AgentMate asks npm, PyPI or GitHub Releases for the latest version.
- If there is a newer version, an **Update <name>?** dialog shows the current version, the latest version and the command. Click **Update** to open a terminal with the command typed in (press `Enter` to run it) or **Cancel**. With **Check all for updates**, the dialog steps through each tool that has an update.

Once a day AgentMate can also check in the background and ring the notification bell when a CLI or tool has a new version. That is the **Check for CLI and tool updates** switch in **Settings** under **General**. See [AI CLI Manager](cli-manager.md#cli-and-tool-update-notifications).

## Configure a tool

A wrench icon (**Configure**) appears on tools that have settings. It opens a **Configure <name>** dialog with a few fields, a live preview of what will be done, and a button.

- Tools whose setting applies to a project say "This applies to the target project selected above." Tools that apply machine-wide say "This applies machine-wide, not to a specific project."
- The preview shows the command to run, the file that will be written or the text that will be copied.
- The button changes with the action: **Run in terminal** (opens a terminal with the command typed in), **Write to project** (writes a file into the target project) or **Copy to clipboard**.
- If the action needs a project and none is chosen, the button is disabled with a note to pick one.

Some cards also have quick action buttons for common setup commands, listed below.

## Docker

For tools that can run as a container, the card has Docker buttons:

- **Install with Docker** creates the container (disabled with a tooltip when Docker is not installed on this machine).
- Once it exists: **Start container**, **Stop container**, **Reset container (recreate from image)** and **Delete container**.
- **Open dashboard** (globe icon) opens the tool's local dashboard when the container is running.

Each Docker action opens a terminal with the Docker command typed in. Press `Enter` to run it. See [Docker](docker.md) for managing containers in general.

## The tools

AgentMate currently lists 14 tools.

| Tool | Category | What it does |
| --- | --- | --- |
| **9Router** | Token & Cost | Proxy that routes agent requests across many model providers with fallbacks and output compression. Has a Docker option and a local dashboard on port 20128. **Configure** sets the dashboard port and initial password (change the default password after first login). |
| **RTK (Rust Token Killer)** | Token & Cost | CLI proxy that compresses command output before it reaches the model. **Configure** builds an `rtk init` command for your target agent (Claude Code, GitHub Copilot, Gemini CLI, Codex, OpenCode, Cursor, Windsurf, Cline, Kilo Code, Antigravity, Pi, Hermes or Factory Droid), with options for global install, non-interactive and hook only. |
| **Ponytail** | Agent Behavior | Claude Code plugin that pushes agents toward minimal code. Installed through Claude Code's plugin commands. **Configure** sets the intensity (Lite, Full, Ultra or Off) and copies a config file to save at `~/.config/ponytail/config.json`. |
| **CodeGraph** | Code Intelligence | Indexes a codebase into a local knowledge graph so agents search it cheaply. Quick action **Initialize in project**. **Configure** writes a `codegraph.json` with extra exclude and force-include globs. |
| **diffray** | Code Intelligence | Free multi-agent code review CLI that reviews git diffs locally. Quick actions **Initialize in project** and **Install /diffray slash command**. **Configure** picks the review executor and whether to skip tests and build output. |
| **OpenClaw** | Agent Runtimes | Self-hosted personal AI assistant gateway with a local web UI on port 18789. Docker option, quick action **Start gateway (foreground)**, and **Configure** for the port, gateway token and sandboxing. |
| **Hermes Agent** | Agent Runtimes | Self-improving agent from Nous Research with an OpenAI-compatible gateway and optional dashboard. Docker option, quick actions **Run setup wizard** and **Diagnose and fix**, and **Configure** for gateway port and dashboard. |
| **LanguageTool** | Writing | The grammar checker behind the writing checks. See the section below. |
| **Semgrep** | Security | Pattern-based static analysis for 30+ languages. **Configure** picks a ruleset. |
| **Trivy** | Security | Finds known CVEs in dependencies, hardcoded secrets and infrastructure misconfigurations. Quick action **Update vulnerability DB**. |
| **Bearer** | Security | Data-flow analysis for sensitive data. No Windows build, so on Windows it runs through Docker (quick action **Pull Docker image**). |
| **SonarQube Community Build** | Security | Self-hosted analysis server with a dashboard on port 9000, run as a Docker container. |
| **CodeQL CLI** | Security | GitHub's semantic code analysis engine. Downloaded by AgentMate itself. |
| **Strix** | Security | Autonomous AI agent that runs your code in a sandbox and proves vulnerabilities. Needs Docker and your own LLM API key, and a run costs tokens. **Configure** copies the model and API key as environment variables. |

> [!WARNING]
> 9Router's published default dashboard password is `123456`. Change it after your first login.

## Security scanners

The **Security** tab on this page holds six scanners: Semgrep, Trivy, Bearer, SonarQube, CodeQL and Strix. Installing a scanner here is only the first step. You run scans from a project's **Security** tab, which merges every scanner's findings into one report with a score out of 100, a **History** menu of previous scans and a **Copy report** menu (an AI fix prompt, a Markdown report or raw JSON). See [Projects](projects.md) for the project side.

Setup notes for each scanner:

- **Semgrep** and **Trivy** are the quick ones. Semgrep's **Auto** ruleset downloads rules from semgrep.dev on every scan, so pick one of the `p/` packs (Security audit, OWASP Top 10 or Default) to stay offline.
- **Bearer** installs with Homebrew on macOS and an install script on Linux. On Windows, press **Pull Docker image** and AgentMate starts a container per scan with your project mounted read-only.
- **SonarQube** needs these steps: click **Install with Docker** to create the server, wait for `http://localhost:9000` (the first start takes a couple of minutes), log in with `admin` / `admin`, change the password, create a token under My Account, Security, and paste it into the SonarQube setup in a project's **Security** tab. The card's **Copy setup commands** button copies these steps.
- **CodeQL CLI** has a **Download CodeQL** button. AgentMate fetches the official release (about 420 MB to download and 700 MB unpacked), verifies its SHA-256 checksum and unpacks it into its own tools folder, with nothing on your `PATH` and no admin rights needed. A progress bar appears with a **Cancel** button. Afterwards you get **Open folder**, **Reinstall** and **Remove**. A `codeql` already on your `PATH` is used in preference, and the card says so.
- **Strix** costs money. A project's Security tab asks you to confirm before it starts, because it can run for up to an hour and spends tokens on your own API key.

## LanguageTool

LanguageTool is the grammar, spelling and style checker behind AgentMate's writing checks. Installing it here lets every check run offline on your machine instead of sending text to LanguageTool's public service. It needs Java 17 or newer on your `PATH`.

1. Click **Download zip** to get `LanguageTool-stable.zip`.
2. Click **Open tools folder** and extract the zip there.
3. Click **Start server** (enabled once it is detected). The first start loads its rules. **Stop server** appears while it runs.
4. Click **Writing settings** to jump to **Settings** (the **AI** group), then choose **Local server** as the source in the **Writing check** card.

See [Writing, voice and translation](writing-voice-translation.md) for the writing checks themselves.

## Tips

- Install **Semgrep** first for security scans. It is the fastest and works on almost any project.
- Click **Refresh** whenever you install or uninstall a tool in a terminal of your own.
- Use the **Target project** picker once at the top, then run several project-level actions without choosing again.
- For tools you do not use any more, **Uninstall** is one click and a terminal confirmation away.

## Related

- [AI CLI Manager](cli-manager.md)
- [Skills](skills.md)
- [MCP Servers](mcp-servers.md)
- [Projects](projects.md)
- [Docker](docker.md)
- [Token Usage](token-usage.md)
