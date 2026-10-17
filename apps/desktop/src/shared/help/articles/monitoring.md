---
title: Health checks
category: Ship
order: 20
summary: Health checks watch your projects' apps and sites on every environment and server. Each one calls a private, key-protected endpoint in your app on its own schedule, shows which services work and which fail with their errors, and hands a failure to AI to diagnose and fix.
keywords: health, healthcheck, health check, status, uptime, monitor, monitoring, incident, outage, down, service, endpoint, environment, server, interval, schedule, bearer, basic auth, key, token, rotate, sha-256, diagnose, fix with ai, setup prompt, health+json, agentmate health protocol
route: /health
---

Health checks tell you whether the apps and sites behind your projects are working right now. Each project can have any number of targets, one for each environment and server it runs on (for example Production on web-1 and web-2, and Staging on one server). AgentMate calls each target's healthcheck endpoint on the schedule you choose and shows every service the app reports (database, cache, queues, mail, external APIs and so on), whether it works, and the error of any that does not.

## Where to find it

Click **Health** in the menu, in the Ship group. The menu badge counts the targets that are down right now. Each project also has a **Health** tab that shows only its own targets.

## How it works

Your app answers health checks itself, through one small endpoint that follows the AgentMate Health Protocol. The protocol builds on the standard `application/health+json` format, so the report lists each check with a status of `pass`, `warn` or `fail`, and a failing check carries its error message, error code, details, stack trace and a hint about what usually fixes it.

The endpoint is private. It only answers a request that carries the target's key (a Bearer key) or its username and password (HTTP Basic). Anyone else gets an empty `401`, without even a hint of which checks exist. Your server never stores the key itself: it stores the key's SHA-256 hash and compares hashes in constant time, so a leaked config file does not leak the key.

## Connect a project

1. Click **Add target**. Choose the project, the environment (from the project's Environments tab), name the server, and enter the endpoint's URL, such as `https://api.example.com/_agentmate/health`.
2. Choose how often to check it, from every 30 seconds to once a day, or enter your own interval (at least 15 seconds). Each target has its own interval and you can change it at any time.
3. Choose **Bearer key** (recommended) or **HTTP Basic**. AgentMate generates the key or password and shows it once, together with its SHA-256 hash and the name of the variable your server reads the hash from. Copy them now, because the key is never shown again. AgentMate keeps it encrypted in your Vault.
4. Click **Connect the project** (right after the key, or later from the target's details) and copy the setup prompt, or click **Send to agent** to paste it into an agent tab for the project. The prompt carries the whole protocol and asks your AI to add the endpoint, check every service the project really uses, and follow the security rules. It never contains the key.
5. Set the hash variable on your server, deploy, and click **Test connection**.

You can also copy the protocol on its own from the same dialog and give it to any AI or developer.

## Reading a target

Each card shows the target's state in words and with a colored dot, how long the last check took, when it ran and when the next one is due, and a strip of the last 50 checks (point at a bar to see when it ran and what it found). Click a card to open its details: every service with its result, the full error of a failing one, the incident history, and the raw report.

The states are:

- **Healthy**: every check passed.
- **Degraded**: the app works but reports a warning, such as a slow dependency or low disk space.
- **Down**: the app reports a failing check.
- **Unreachable**: no answer came back before the timeout, or the connection failed.
- **Key rejected**: the endpoint refused the key or password. Check that the hash on the server matches the target.
- **Bad response**: something answered, but not with a health report (an HTML page, a redirect, or a missing endpoint).
- **Waiting**: the first check has not run yet.
- **Paused**: you paused the target.
- **Locked**: your Vault is locked, so the key cannot be read. Checks resume as soon as you unlock it.

A single failed check does not count as an outage. AgentMate checks again within about 15 seconds and opens an incident only when the problem repeats, and it closes the incident the same way. You get a desktop notification and an inbox entry when an incident opens and when it resolves.

## Fix it with AI

When an incident opens, AgentMate runs a read-only analysis with your project's AI CLI in the background: it reads the error and the project's code and writes down the likely cause, where it is, and what it would change. It never edits anything. The analysis appears in the target's details. You can run it again with **Run diagnosis**, or turn **Diagnose with AI** off in a target's settings.

To fix the problem, click **Fix with AI**. It opens the fix prompt (the failing services, their errors and the analysis) so you can edit it, then starts an agent tab for the project with it. **Copy for AI** puts the same prompt on the clipboard for any other tool.

## Security

- Keys and passwords are encrypted in the Vault and never leave the main part of the app, except the one time they are shown after you create or rotate them.
- AgentMate refuses to send a key over plain HTTP, except to your own machine (localhost). You can allow HTTP for a target on a private network, but the dialog warns you first.
- It never follows a redirect, so a key is never sent to another address.
- Reports are capped in size and scrubbed of anything that looks like a secret (passwords in connection strings, tokens, keys) before they are stored, shown or put into a prompt. The endpoint should not send secrets in the first place, and the protocol tells your AI so.
- **Rotate key** makes a new key and the old one stops working at once. Update the hash on the server afterwards.

## Related

- [Projects](projects.md)
- [Vault](vault.md)
- [Workspace](workspace.md)
