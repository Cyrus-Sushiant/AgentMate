import { _n as CLI_REGISTRY } from "./dist-BskwpHU1.js";
import { X as findGroupOfTab, b as browserRuntime, g as useWorkspaceStore, y as useBrowserStore } from "./launch-OTu6P7aE.js";
//#region src/renderer/src/lib/browser/browserSync.ts
var shortcutListeners = /* @__PURE__ */ new Map();
/** Listens for browser shortcuts pressed while the tab's page has focus. */
function onBrowserShortcut(tabId, listener) {
	const set = shortcutListeners.get(tabId) ?? /* @__PURE__ */ new Set();
	set.add(listener);
	shortcutListeners.set(tabId, set);
	return () => {
		set.delete(listener);
		if (set.size === 0) shortcutListeners.delete(tabId);
	};
}
/** Hands a browser shortcut to a tab, as the app's own keyboard shortcuts do. */
function emitBrowserShortcut(tabId, shortcut) {
	for (const listener of shortcutListeners.get(tabId) ?? []) listener(shortcut);
}
/** The workspace holding a tab, as its key in the store. */
function workspaceOf(tabId) {
	const { workspaces } = useWorkspaceStore.getState();
	for (const [projectId, ws] of Object.entries(workspaces)) if (ws.tabs[tabId]) return projectId;
	return null;
}
function startBrowserSync() {
	const offPage = browserRuntime.onPageChange((tabId, page) => {
		const projectId = workspaceOf(tabId);
		if (!projectId) return;
		useWorkspaceStore.getState().setBrowserPage(projectId, tabId, page);
		useBrowserStore.getState().rememberUrl(projectId, page.url);
	});
	const offPopup = window.agentmat.browser.onOpenInNewTab(({ webContentsId, url }) => {
		const opener = browserRuntime.tabForWebContents(webContentsId);
		const projectId = opener ? workspaceOf(opener) : null;
		if (!opener || !projectId) return;
		const state = useWorkspaceStore.getState();
		const ws = state.workspaces[projectId];
		const groupId = ws ? findGroupOfTab(ws.root, opener)?.id : void 0;
		state.openBrowser(projectId, {
			url,
			groupId
		});
	});
	const offShortcut = window.agentmat.browser.onGuestShortcut(({ webContentsId, shortcut }) => {
		const tabId = browserRuntime.tabForWebContents(webContentsId);
		if (tabId) emitBrowserShortcut(tabId, shortcut);
	});
	return () => {
		offPage();
		offPopup();
		offShortcut();
	};
}
//#endregion
//#region src/renderer/src/lib/workspace/agentChoices.ts
/**
* Registry CLIs in the user's chosen order. Ids the order doesn't mention (a CLI added in a
* later release) keep their registry position after the ordered ones.
*/
function orderedClis(order) {
	const rank = new Map(order.map((id, index) => [id, index]));
	return CLI_REGISTRY.map((cli, index) => ({
		cli,
		index
	})).sort((a, b) => (rank.get(a.cli.id) ?? order.length + a.index) - (rank.get(b.cli.id) ?? order.length + b.index)).map(({ cli }) => cli);
}
/**
* The agents split by whether they are on this machine, in the order the "+" menu lists them.
* The keyboard launch (Ctrl+1 for the first) reads the same list, so the numbers always agree.
*/
function sortAgentChoices(statuses, cliOrder, defaultId) {
	const installedIds = new Set(statuses.filter((c) => c.installed).map((c) => c.id));
	const choices = orderedClis(cliOrder).map((cli) => ({
		cli,
		installed: installedIds.has(cli.id),
		isDefault: cli.id === defaultId
	}));
	const byDefault = (a, b) => cliOrder.length > 0 ? 0 : Number(b.isDefault) - Number(a.isDefault);
	return {
		installed: choices.filter((c) => c.installed).sort(byDefault),
		missing: choices.filter((c) => !c.installed).sort(byDefault)
	};
}
//#endregion
export { startBrowserSync as a, onBrowserShortcut as i, sortAgentChoices as n, emitBrowserShortcut as r, orderedClis as t };
