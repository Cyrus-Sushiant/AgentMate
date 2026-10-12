import { S as create } from "./tooltip-BbU-D7og.js";
//#region ../../packages/core/dist/workspace/fileOps.js
/**
* Path and name rules for the workspace explorer's file operations. Kept free of `node:path`
* so the renderer and the main process agree on them, whatever the path style.
*/
var WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
var WINDOWS_INVALID_CHARS = /[<>:"|?*\p{Cc}]/u;
function isSeparator(char) {
	return char === "/" || char === "\\";
}
/**
* Why a name typed into the explorer can't be used, or null when it can. A name may hold
* `/` to create nested folders in one go (`src/utils/date.ts`), like VS Code allows, but
* only when `allowNested` is set.
*/
function validateEntryName(name, platform, options = {}) {
	if (!name.trim()) return "A file or folder name must be provided.";
	if (name.includes("\0")) return "The name contains a character that is not allowed.";
	const segments = name.split(/[\\/]/);
	if (segments.length > 1 && !options.allowNested) return "The name cannot contain slashes.";
	if (isSeparator(name[0])) return "The name cannot start with a slash.";
	for (const [index, segment] of segments.entries()) {
		const last = index === segments.length - 1;
		if (!segment) {
			if (last) continue;
			return "The name contains an empty folder name.";
		}
		if (segment === "." || segment === "..") return `"${segment}" is not a valid name.`;
		if (segment.trim() !== segment) return "Names cannot start or end with a space.";
		if (platform === "win32") {
			if (WINDOWS_INVALID_CHARS.test(segment)) return "Names cannot contain any of these characters: < > : \" | ? *";
			if (segment.endsWith(".")) return "Names cannot end with a period on Windows.";
			if (WINDOWS_RESERVED.test(segment)) return `"${segment}" is a reserved name on Windows.`;
		}
	}
	return null;
}
/** Splits `archive.tar.gz` style names at the last dot, leaving dotfiles (`.env`) whole. */
function splitExtension(name) {
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return {
		base: name,
		ext: ""
	};
	return {
		base: name.slice(0, dot),
		ext: name.slice(dot)
	};
}
/** True when `child` is `parent` itself or somewhere inside it. */
function isSameOrInside(child, parent) {
	const trimmed = parent.replace(/[\\/]+$/, "");
	if (child === trimmed) return true;
	return child.startsWith(trimmed) && isSeparator(child[trimmed.length]);
}
/** `path` with `from` swapped for `to`, when it is `from` or inside it. Otherwise null. */
function remapPath(path, from, to) {
	if (!isSameOrInside(path, from)) return null;
	const trimmed = from.replace(/[\\/]+$/, "");
	return to.replace(/[\\/]+$/, "") + path.slice(trimmed.length);
}
/** The folder holding `path`, or null for a root. */
function parentPath(path) {
	const trimmed = path.replace(/[\\/]+$/, "");
	const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (index <= 0) return null;
	return /^[A-Za-z]:$/.test(trimmed.slice(0, index)) ? trimmed.slice(0, index + 1) : trimmed.slice(0, index);
}
/** The last segment of a path. */
function baseName(path) {
	const trimmed = path.replace(/[\\/]+$/, "");
	const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return trimmed.slice(index + 1);
}
/** `path` relative to `root`, with forward slashes. Empty for the root itself. */
function relativeTo(root, path) {
	if (!isSameOrInside(path, root)) return null;
	return path.slice(root.replace(/[\\/]+$/, "").length).replace(/^[\\/]+/, "").replaceAll("\\", "/");
}
/** Drops paths that sit inside another path in the list, so a folder and its file act once. */
function topLevelPaths(paths) {
	const unique = Array.from(new Set(paths));
	return unique.filter((path) => !unique.some((other) => other !== path && isSameOrInside(path, other)));
}
//#endregion
//#region src/renderer/src/stores/editorRevealStore.ts
var nonce = 0;
var useEditorRevealStore = create((set, get) => ({
	pending: {},
	requestReveal: (path, target) => {
		nonce += 1;
		set((state) => ({ pending: {
			...state.pending,
			[path]: {
				...target,
				nonce
			}
		} }));
	},
	takeReveal: (path) => {
		const reveal = get().pending[path];
		if (!reveal) return null;
		set((state) => {
			const { [path]: _taken, ...rest } = state.pending;
			return { pending: rest };
		});
		return reveal;
	}
}));
//#endregion
export { relativeTo as a, topLevelPaths as c, parentPath as i, validateEntryName as l, baseName as n, remapPath as o, isSameOrInside as r, splitExtension as s, useEditorRevealStore as t };
