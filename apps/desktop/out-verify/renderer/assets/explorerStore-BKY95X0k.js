import { S as create } from "./tooltip-BbU-D7og.js";
import "./dist-BskwpHU1.js";
import { o as remapPath, r as isSameOrInside } from "./editorRevealStore-DlPbqWPZ.js";
//#region src/renderer/src/stores/explorerStore.ts
var EMPTY = {
	open: {},
	selected: [],
	focused: null,
	anchor: null,
	editing: null,
	pendingFocus: null,
	dropTarget: null,
	search: null
};
var useExplorerStore = create(() => ({
	projects: {},
	clipboard: null,
	dirtyFiles: {}
}));
function explorerProject(projectId) {
	return useExplorerStore.getState().projects[projectId] ?? EMPTY;
}
function patchExplorer(projectId, patch) {
	useExplorerStore.setState((state) => {
		const current = state.projects[projectId] ?? EMPTY;
		const next = typeof patch === "function" ? patch(current) : patch;
		return { projects: {
			...state.projects,
			[projectId]: {
				...current,
				...next
			}
		} };
	});
}
/** Opens the search box, or closes it and drops what was typed. */
function toggleExplorerSearch(projectId, open) {
	patchExplorer(projectId, (current) => ({ search: open ?? current.search === null ? current.search ?? "" : null }));
}
function setFolderOpen(projectId, path, open) {
	patchExplorer(projectId, (current) => ({ open: {
		...current.open,
		[path]: open
	} }));
}
/** Selects rows. The last one becomes the focused row unless `focused` says otherwise. */
function selectRows(projectId, paths, options = {}) {
	const focused = options.focused !== void 0 ? options.focused : paths.at(-1) ?? null;
	patchExplorer(projectId, (current) => ({
		selected: paths,
		focused,
		anchor: options.anchor !== void 0 ? options.anchor : focused,
		pendingFocus: options.focus ? focused : current.pendingFocus
	}));
}
/** Rewrites every remembered path after a rename or move, so rows stay open and selected. */
function remapExplorerPaths(projectId, from, to) {
	const remap = (path) => remapPath(path, from, to) ?? path;
	patchExplorer(projectId, (current) => ({
		open: Object.fromEntries(Object.entries(current.open).map(([path, v]) => [remap(path), v])),
		selected: current.selected.map(remap),
		focused: current.focused ? remap(current.focused) : null,
		anchor: current.anchor ? remap(current.anchor) : null
	}));
	useExplorerStore.setState((state) => {
		const clipboard = state.clipboard;
		if (!clipboard || clipboard.projectId !== projectId) return state;
		return { clipboard: {
			...clipboard,
			paths: clipboard.paths.map(remap)
		} };
	});
}
/** Forgets deleted paths wherever the explorer remembered them. */
function forgetExplorerPaths(projectId, removed) {
	const gone = (path) => removed.some((r) => isSameOrInside(path, r));
	patchExplorer(projectId, (current) => ({
		open: Object.fromEntries(Object.entries(current.open).filter(([path]) => !gone(path))),
		selected: current.selected.filter((path) => !gone(path)),
		focused: current.focused && gone(current.focused) ? null : current.focused,
		anchor: current.anchor && gone(current.anchor) ? null : current.anchor
	}));
	useExplorerStore.setState((state) => {
		const clipboard = state.clipboard;
		if (!clipboard || clipboard.projectId !== projectId) return state;
		const paths = clipboard.paths.filter((path) => !gone(path));
		return { clipboard: paths.length > 0 ? {
			...clipboard,
			paths
		} : null };
	});
}
function setFileDirty(path, dirty) {
	useExplorerStore.setState((state) => {
		if (Boolean(state.dirtyFiles[path]) === dirty) return state;
		const dirtyFiles = { ...state.dirtyFiles };
		if (dirty) dirtyFiles[path] = true;
		else delete dirtyFiles[path];
		return { dirtyFiles };
	});
}
//#endregion
export { selectRows as a, toggleExplorerSearch as c, remapExplorerPaths as i, useExplorerStore as l, forgetExplorerPaths as n, setFileDirty as o, patchExplorer as r, setFolderOpen as s, explorerProject as t };
