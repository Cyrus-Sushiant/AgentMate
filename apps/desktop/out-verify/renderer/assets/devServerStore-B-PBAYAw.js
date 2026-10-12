import { Br as __toESM, Fr as require_jsx_runtime, I as cn, Lr as require_react, Pr as toast, S as create } from "./tooltip-BbU-D7og.js";
import { n as useQuery, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { nr as OVERLAY_MOTION, rr as OVERLAY_SURFACE, xn as getCliDefinition } from "./dist-BskwpHU1.js";
import { n as useCliStore } from "./cliStore-BEVHhLcE.js";
import { C as terminalRuntime, Y as findGroup, g as useWorkspaceStore, l as projectCliId, q as allGroups, r as launchPromptTab, w as useTerminalSessionStore } from "./launch-OTu6P7aE.js";
import { a as Root2, i as Portal, o as Trigger, r as Content2, t as Anchor2 } from "./dist-DNJYiH1d.js";
import { n as sortAgentChoices } from "./agentChoices-Dc9UzfdM.js";
//#region src/renderer/src/components/ui/popover.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Popover = Root2;
var PopoverTrigger = Trigger;
var PopoverAnchor = Anchor2;
/** The frosted panel every popover in the app opens as, menus and status bar panels alike. */
var PopoverContent = import_react.forwardRef(({ className, align = "end", sideOffset = 6, collisionPadding = 8, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	align,
	sideOffset,
	collisionPadding,
	className: cn(OVERLAY_SURFACE, OVERLAY_MOTION, "z-50 p-3 origin-[var(--radix-popover-content-transform-origin)]", className),
	...props
}) }));
PopoverContent.displayName = Content2.displayName;
//#endregion
//#region src/renderer/src/components/workspace/useAgentChoices.ts
/** The agent CLIs a workspace can launch, split by whether they are installed. */
function useAgentChoices(project) {
	useCliStore((s) => s.defaultCliId);
	const cliOrder = useCliStore((s) => s.cliOrder);
	const status = useQuery({
		queryKey: queryKeys.cliStatus,
		queryFn: () => window.agentmat.cli.detectAll(),
		staleTime: 3e5
	});
	const defaultId = project ? projectCliId(project) : null;
	const loading = status.isPending;
	return (0, import_react.useMemo)(() => ({
		...sortAgentChoices(status.data ?? [], cliOrder, defaultId),
		loading
	}), [
		status.data,
		defaultId,
		loading,
		cliOrder
	]);
}
//#endregion
//#region src/renderer/src/lib/workspace/agentTarget.ts
/** The agent tab the user last typed in, per workspace. Only needed while the app is open. */
var lastAgentTab = /* @__PURE__ */ new Map();
/** Remembers an agent tab the user focused, so it wins over other agents in the workspace. */
function rememberAgentTab(projectId, tabId) {
	lastAgentTab.set(projectId, tabId);
}
/**
* The agent CLI in a workspace that files handed over from the explorer should go to. Opening a
* file from the explorer puts a file tab in front, so the focused pane alone is not enough:
* after it come the agent the user last focused, one on screen in another pane, and finally the
* newest one. Tabs whose shell has ended are skipped. Null when no agent is running.
*/
function findAgentTerminal(projectId) {
	const ws = useWorkspaceStore.getState().workspaces[projectId];
	if (!ws) return null;
	const ended = useTerminalSessionStore.getState().ended;
	const agentTab = (id) => {
		const tab = id ? ws.tabs[id] : void 0;
		return tab?.kind === "terminal" && tab.cliId && !ended[tab.id] ? tab : null;
	};
	const focused = agentTab(findGroup(ws.root, ws.focusedGroupId)?.activeTabId);
	if (focused) return focused;
	const last = agentTab(lastAgentTab.get(projectId));
	if (last) return last;
	for (const group of allGroups(ws.root)) {
		const visible = agentTab(group.activeTabId);
		if (visible) return visible;
	}
	let newest = null;
	for (const id of Object.keys(ws.tabs)) {
		const tab = agentTab(id);
		if (tab && (!newest || tab.createdAt > newest.createdAt)) newest = tab;
	}
	return newest;
}
/**
* Every running agent tab in a workspace, the one `findAgentTerminal` picks first and the rest
* oldest first, so a menu can offer them all as places to send something.
*/
function listAgentTerminals(projectId) {
	const ws = useWorkspaceStore.getState().workspaces[projectId];
	if (!ws) return [];
	const ended = useTerminalSessionStore.getState().ended;
	const preferred = findAgentTerminal(projectId);
	const rest = Object.values(ws.tabs).filter((tab) => tab.kind === "terminal" && !!tab.cliId && !ended[tab.id] && tab.id !== preferred?.id).sort((a, b) => a.createdAt - b.createdAt);
	return preferred ? [preferred, ...rest] : rest;
}
//#endregion
//#region src/renderer/src/lib/workspace/agentSend.ts
function targetTab(projectId, tabId) {
	const tab = useWorkspaceStore.getState().workspaces[projectId]?.tabs[tabId];
	if (tab?.kind !== "terminal" || !tab.cliId) return null;
	return useTerminalSessionStore.getState().ended[tab.id] ? null : tab;
}
function launch(project, cliId, build) {
	if (!cliId) {
		toast.error("No agent CLI to ask", { description: "Pick a default CLI in Settings, or start one in this workspace." });
		return null;
	}
	const tabId = launchPromptTab(project, {
		cliId,
		prompt: build(cliId)
	});
	if (!tabId) return null;
	terminalRuntime.focus(tabId);
	return {
		outcome: "launched",
		tabId,
		cliId
	};
}
/**
* Sends the text and says how it went, or null when there was nowhere to send it. The paste into
* a ready CLI happens before this returns its promise, so callers that don't wait still see it.
*/
async function deliverToAgent(project, { build, what, target }) {
	if (target && "newCliId" in target) return launch(project, target.newCliId, build);
	const tab = (target && "tabId" in target ? targetTab(project.id, target.tabId) : null) ?? findAgentTerminal(project.id);
	if (!tab?.cliId) return launch(project, projectCliId(project), build);
	const cliId = tab.cliId;
	const text = build(cliId);
	useWorkspaceStore.getState().activateTab(project.id, tab.id);
	terminalRuntime.focus(tab.id);
	if (terminalRuntime.insertText(tab.id, text)) return {
		outcome: "pasted",
		tabId: tab.id,
		cliId
	};
	if (await terminalRuntime.deliverPrompt(tab.id, text)) return {
		outcome: "pasted",
		tabId: tab.id,
		cliId
	};
	navigator.clipboard.writeText(text);
	toast.warning(`${getCliDefinition(cliId)?.name ?? "The CLI"} is not taking input`, { description: `${what} ${/s$/.test(what) ? "are" : "is"} on your clipboard, ready to paste.` });
	return {
		outcome: "clipboard",
		tabId: tab.id,
		cliId
	};
}
//#endregion
//#region src/renderer/src/lib/browser/devServers.ts
/**
* Spotting dev server addresses (`http://localhost:5173/`) in terminal output, so a new browser
* tab can offer the servers running in the workspace.
*/
var OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
var CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
var LOCAL_URL = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost):(\d{2,5})(?:\/[^\s'"<>`│|)\]]*)?/gi;
function stripAnsi(text) {
	return text.replace(OSC, "").replace(CSI, "");
}
/** The local URLs in a chunk of terminal output, normalized and listed once each, in order. */
function extractLocalUrls(chunk) {
	const urls = [];
	for (const match of stripAnsi(chunk).matchAll(LOCAL_URL)) {
		if (Number(match[1]) > 65535) continue;
		const raw = match[0].replace(/[.,;:!?]+$/, "");
		let url;
		try {
			url = new URL(raw);
		} catch {
			continue;
		}
		if (url.hostname === "0.0.0.0") url.hostname = "localhost";
		const href = url.pathname === "/" ? `${url.origin}/` : `${url.origin}${url.pathname.replace(/\/$/, "")}`;
		if (!urls.includes(href)) urls.push(href);
	}
	return urls;
}
//#endregion
//#region src/renderer/src/stores/devServerStore.ts
var MAX_PER_TERMINAL = 6;
var tails = /* @__PURE__ */ new Map();
var useDevServerStore = create()((set) => ({
	servers: {},
	noteOutput: (sessionId, data) => {
		const text = (tails.get(sessionId) ?? "") + data;
		const plain = stripAnsi(text);
		tails.set(sessionId, plain.slice(plain.lastIndexOf("\n") + 1).slice(-120));
		if (!/:\/\/|host|:\d/.test(text)) return;
		const found = extractLocalUrls(text);
		if (found.length === 0) return;
		set((state) => {
			const current = state.servers[sessionId] ?? [];
			const next = [...found.reverse(), ...current.filter((url) => !found.includes(url))].slice(0, MAX_PER_TERMINAL);
			if (next.length === current.length && next.every((url, i) => url === current[i])) return state;
			return { servers: {
				...state.servers,
				[sessionId]: next
			} };
		});
	},
	forget: (sessionId) => {
		tails.delete(sessionId);
		set((state) => {
			if (!state.servers[sessionId]) return state;
			const { [sessionId]: _gone, ...servers } = state.servers;
			return { servers };
		});
	},
	reset: () => {
		tails.clear();
		set({ servers: {} });
	}
}));
/** The servers the given terminals printed, each address once, newest per terminal first. */
function detectedServersFor(servers, terminals) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const terminal of terminals) for (const url of servers[terminal.id] ?? []) {
		if (seen.has(url)) continue;
		seen.add(url);
		out.push({
			url,
			terminalId: terminal.id,
			terminalTitle: terminal.title
		});
	}
	return out;
}
//#endregion
export { deliverToAgent as a, rememberAgentTab as c, PopoverAnchor as d, PopoverContent as f, stripAnsi as i, useAgentChoices as l, useDevServerStore as n, findAgentTerminal as o, PopoverTrigger as p, extractLocalUrls as r, listAgentTerminals as s, detectedServersFor as t, Popover as u };
