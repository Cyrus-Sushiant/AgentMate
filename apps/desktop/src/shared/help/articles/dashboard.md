---
title: Dashboard
category: Getting started
order: 40
summary: The Dashboard shows live CPU, memory, disk, GPU and network charts, GitHub activity, your installed AI CLIs and projects, and CLI update alerts, in a layout you can rearrange.
keywords: dashboard, home, overview, system stats, cpu, memory, disk, gpu, network, ping, github activity, github actions, cards, layout, edit layout, speed test, top apps, updates
route: /
---

The Dashboard is the first page most people see. It shows how your machine is doing right now (CPU, memory, disk, GPU and network), the state of your GitHub account and workflows, how many AI CLIs and projects you have, and a list of CLIs and tools that have updates waiting. Every card can be moved, hidden or brought back, so you can make it show only what you care about.

## Where to find it

Click **Dashboard** in the menu (the first entry), or open the command palette and type Dashboard. It is also the page AgentMate opens on the first launch, and it is the page opened by the **Startup page** setting if you choose it. The page header reads "Dashboard", with the line "Your AI CLIs, projects, and system health at a glance."

## Quick actions

Two buttons sit at the top left of the page:

- **New Project** opens the Projects page with the new project dialog already open. See [Projects](projects.md).
- **Open Prompt Builder** goes to the Prompt Builder. See [Prompt Builder](prompt-builder.md).

At the top right are the pencil button (**Edit layout**) and, while you are editing, **Add card**. See [Customize the layout](#customize-the-layout).

## The cards

Out of the box the Dashboard shows eight charts and four stat tiles. Cards sit in rows, two to a row at first. On a narrow window, rows of three or four columns step down to two and then one so nothing gets squeezed.

### System charts

The charts update live. They sample about every two seconds and keep roughly the last two minutes, and the history is kept while you visit other pages, so coming back does not start the chart from nothing. Hover a chart to see the value at that moment.

| Card | What it shows |
| --- | --- |
| **CPU Usage** | Total CPU use as a percentage, with the processor model and number of cores. When the machine has more than one core, **Total** and **Per core** buttons switch the chart between one line and a line for each core. |
| **Memory Usage** | The percentage of RAM in use, with used and total memory. |
| **Disk I/O** | Combined read and write speed, and a line for each disk. It says "No disk activity detected." when nothing is reported. |
| **GPU Usage** | GPU use as a percentage (the average when you have several GPUs), plus each GPU's memory. It shows N/A and "No supported GPU detected." when none can be read. |
| **Network Throughput** | Download speed as the headline number, with lines for download and upload. |
| **Network Status** | How many of your ping targets are online, a quality label, and each target's latency. |

Each of CPU, Memory, Disk I/O and GPU has a **Top apps** button (a list icon) in the card's header. It opens a dialog such as **Top CPU apps**, **Top memory apps**, **Top disk apps** or **Top GPU apps**, listing the apps using the most of that resource right now and refreshing every few seconds. Each row shows the app, how much it uses and its process ID. The button at the end of a row, **End** followed by the app name, ends that process after you confirm with **End process**. Be careful: unsaved work in that app can be lost. If your system cannot report per-app GPU or disk use, the dialog says so.

### Network Throughput and speed test

The Network Throughput card has a lightning bolt button, **Test network speed**. It opens a dialog called **Network Speed Test**. Click **Open speed.cloudflare.com** to run the test in your browser, which measures your connection more accurately than a test running inside the app.

### Network Status and ping targets

The Network Status card shows a count such as "3/3 targets online" and a quality badge (**Excellent**, **Good**, **Fair** or **Poor**). Hover the badge to see the percentage of pings answered over the time the chart covers. Under it, each target is listed with its latency and an **Online** or **Offline** badge.

- Click a host name (an IP address or host, not a web address) to open **Diagnose**. The dialog has two buttons, **Ping (ping -t)** and **Traceroute (tracert -d)**. Each opens a terminal with the command already typed. Press `Enter` there to start it.
- Targets that are web addresses are shown by the site name, with the full address in a tooltip. They have no diagnose dialog.
- The gear button, **Manage ping targets**, opens Settings so you can change the targets. The ping settings are in the **Network** tab of Settings, in the **Network ping targets** card. If you land on a different tab, click **Network**.

#### Change the ping targets

1. Open **Settings** and click the **Network** tab.
2. In the **Network ping targets** card, pick a **Method**:
   - **Ping command** uses the system ping. It fails where ICMP is blocked.
   - **URL request** times an HTTPS request, which works behind most firewalls.
   - **Auto** pings first and switches to URLs if nothing answers.
3. Under **Hosts to ping**, type a host and press `Enter` to add it. The default is `1.1.1.1`.
4. Under **URLs to request**, add web addresses. The default is `https://www.gstatic.com/generate_204`. **Reset to default** brings it back.
5. With URL requests, set **Request every** to a number of seconds from 1 to 300. The default is 5.
6. Click **Save changes**.

The same targets feed the network figure in the status bar, and the AI pet's internet alerts. See [Interface tour](interface-tour.md) and [Widgets and desktop pet](widgets-desktop-pet.md).

### GitHub Activity

The **GitHub Activity** card draws your GitHub contribution heatmap, with a number for the contributions this week (and your @username) and for the year, and a Less to More legend. It needs the GitHub CLI (`gh`) to be installed and signed in:

- If `gh` is missing, the card says to install the GitHub CLI. The link opens its download page.
- If it is not signed in, the card offers `gh auth login`. Clicking it opens a terminal with the command typed. Press `Enter` there to sign in.
- Before it is connected the card reads **Not connected**.

The medal button opens **GitHub notifications**: the unread items from the GitHub account signed in on this computer, with a badge showing how many are unread. Click an item to open it on GitHub, the check button to mark one as read, **Mark all as read** for all of them, or **Open on GitHub** for the notifications page. The refresh button re-reads the activity and the notifications. Activity is refreshed every ten minutes and notifications every two.

### GitHub Actions

The **GitHub Actions** card charts the workflow runs of your GitHub projects: how many passed this week, how many failed and how many are running, with a chart of passed and failed runs across the repositories of your projects. If no project has a GitHub remote, the card says to add one. The history button, **Actions history**, lists recent workflow runs across your projects, and its **All runs and filters** button goes to [Pipelines](pipelines.md). It uses the same `gh` sign-in as GitHub Activity.

### Stat tiles

| Tile | What it shows |
| --- | --- |
| **Installed CLIs** | How many AI CLIs are installed out of all the CLIs AgentMate knows about, shown as a fraction. See [AI CLI Manager](cli-manager.md). |
| **Active Projects** | The number of projects that are not archived. See [Projects](projects.md). |
| **Skill Repositories** | How many skill repositories you have added. See [Skills](skills.md). |
| **Your Location** | A flag and your public IP address. Click the address to copy it ("IP address copied."), and use the refresh button to look it up again. It says **Unavailable** if the lookup fails. |

### Token Usage cards

Three kinds of Token Usage cards can be added to the Dashboard. By default none of them are shown.

- **All agents**: a combined usage chart. Its **Open Token Usage** button goes to [Token Usage](token-usage.md).
- Summary tiles: **Tokens today**, **Tokens (7 days)**, **Cost today** and **Providers tracked**.
- A card for a single provider. You add these from the Token Usage page.

Add **All agents** and the summary tiles from the **Add card** menu while editing the layout.

### Update AI CLIs & tools

Below the cards, the **Update AI CLIs & tools** card lists installed AI CLIs and agent tools that have a newer version, with a count badge such as "2 updates". Each row shows the current version and the new one, with an **Update** button. Clicking it opens a terminal with the update command typed. Press `Enter` there to run it. The refresh button, **Re-check for updates**, checks again.

If nothing is installed the card links to the AI CLI Manager and Agent Tools. When everything is current it says all installed CLIs and tools are up to date, and it notes how many could not be checked automatically. Update checks wait until the page has finished loading, so they do not slow it down.

## Customize the layout

You can reorder, resize and hide almost everything on the Dashboard. Your layout is saved automatically and kept between launches.

### Turn on edit mode

1. Click the pencil button, **Edit layout**, at the top right. It turns into a check mark button, **Done editing**.
2. Rows get dashed outlines, cards get drag handles and remove buttons, and a short hint appears.
3. Click **Done editing** when you finish.

### Move cards and rows

- Drag a card by its handle (the grip icon in its header, tooltip **Drag to move between rows**) and drop it on another card to place it before that card, or onto the **Drop a card here** tile at the end of a row.
- Drag a row by the handle at its left (tooltip **Drag to reorder rows**) to change the order of rows. While you drag a row, a **Drop here to move row to the end** area appears at the bottom.
- Only the handles are draggable, so clicking buttons on a card never starts a drag.

### Change how many cards a row holds

Each row has its own **Columns** buttons, 1, 2, 3 and 4. A row of four small tiles can sit above a row of two big charts.

### Add and remove rows

- Click **Add row** at the bottom to add an empty row. Empty rows are only visible while editing.
- Click the trash button on a row (**Remove row; its cards move to the row above**) to delete it. Its cards move to the row above, or below for the first row, so none are lost. The last remaining row cannot be removed.

### Hide and bring back cards

- Click the **X** on a card (**Remove from dashboard**) to hide it. A message confirms which card was removed.
- Click **Add card** to open the menu of everything you can show. It has three groups: **Charts** (CPU Usage, Memory Usage, Disk I/O, GPU Usage, Network Throughput, Network Status, GitHub Activity, GitHub Actions), **Dashboard stats** (Installed CLIs, Active Projects, Skill Repositories, Your Location) and **Token Usage** (All agents, Tokens today, Tokens (7 days), Cost today, Providers tracked). Cards that are showing are ticked. Click one to add or remove it. New cards go into the last row that has a free space.

A built-in chart added by a later version of AgentMate shows up on its own once. If you hide it, it stays hidden.

## Tips

- Use **Top apps** on the CPU or Memory card when the machine feels slow, to see which program is responsible.
- If the Network Status card shows **Offline** targets but the internet works, switch the **Method** to **URL request** in Settings, Network. Some networks block ping.
- The status bar at the bottom shows live CPU, memory and network figures on every page, so you do not need to keep the Dashboard open.

## Related

- [Getting started](getting-started.md)
- [Interface tour](interface-tour.md)
- [Projects](projects.md)
- [AI CLI Manager](cli-manager.md)
- [Token Usage](token-usage.md)
- [Pipelines](pipelines.md)
- [Settings](settings.md)
