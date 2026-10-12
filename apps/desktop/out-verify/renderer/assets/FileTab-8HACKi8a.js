import { Bn as RefreshCw, Br as __toESM, F as Button, Fr as require_jsx_runtime, Ft as File, I as cn, Lr as require_react, Mt as ExternalLink, Pr as toast, an as ImageIcon, qn as Save, rr as Spinner, t as SimpleTooltip, zt as FileText } from "./tooltip-BbU-D7og.js";
import { n as useQuery, p as useQueryClient, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { t as useEditorRevealStore } from "./editorRevealStore-DlPbqWPZ.js";
import { C as Skeleton, g as Chip, m as EmptyState } from "./pageKit-dgpHZ_9P.js";
import { t as formatBytes } from "./format-CFqq7Rgx.js";
import { t as MonacoEditor } from "./MonacoEditor-6KQEKFS9.js";
import { n as languageFor } from "./MonacoDiffEditor-B83KNjHv.js";
import { o as setFileDirty } from "./explorerStore-BKY95X0k.js";
import { i as isTextImagePath, n as formatImageSize, r as isImagePath, t as ImageView } from "./ImageView-DlvJOhY-.js";
//#region src/renderer/src/components/workspace/ImageFileTab.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** An image file opened from the explorer or the changes panel, shown instead of its bytes. */
function ImageFileTab({ project, tab, onEditSource }) {
	const image = useQuery({
		queryKey: queryKeys.workspaceImage(tab.path),
		queryFn: () => window.agentmat.fs.readImage(tab.path),
		meta: { silentLoading: true },
		staleTime: Number.POSITIVE_INFINITY
	});
	const [size, setSize] = (0, import_react.useState)(null);
	const relative = tab.path.startsWith(project.folderPath) ? tab.path.slice(project.folderPath.length).replace(/^[\\/]/, "") : tab.path;
	const parts = relative.split(/[\\/]/);
	const name = parts.pop() ?? relative;
	const dir = parts.join("/");
	const caption = [formatImageSize(size), image.data ? formatBytes(image.data.bytes) : null].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-9 shrink-0 items-center gap-2 px-3 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageIcon, { className: "h-3 w-3 shrink-0 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-[3rem] shrink truncate text-xs font-medium",
					children: name
				}),
				dir ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 shrink truncate text-[11px] text-muted-foreground [direction:rtl]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("bdi", { children: dir })
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "min-w-0 flex-1" }),
				caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[11px] tabular-nums text-muted-foreground",
					children: caption
				}) : null,
				onEditSource ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Edit the source",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Edit the source",
						onClick: onEditSource,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {})
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Reload from disk",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Reload from disk",
						onClick: () => {
							setSize(null);
							image.refetch();
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("h-2.5 w-2.5", image.isFetching && "animate-spin") })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Open in its default app",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Open in its default app",
						onClick: () => void window.agentmat.shell.openPath(tab.path),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {})
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative flex min-h-0 flex-1 flex-col",
			children: image.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full items-center justify-center p-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-full w-full max-w-2xl rounded-xl" })
			}) : image.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				size: "sm",
				icon: ImageIcon,
				title: "This image could not be opened",
				description: image.error instanceof Error ? image.error.message : "It may have been moved or deleted.",
				className: "h-full"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageView, {
				src: image.data.dataUrl,
				alt: name,
				onSize: setSize
			})
		})]
	});
}
//#endregion
//#region src/renderer/src/components/workspace/FileTab.tsx
/** Files past this open read-only: Monaco copes, but editing a multi-megabyte file here is a trap. */
var MAX_EDITABLE_CHARS = 2e6;
function fileQueryKey(path) {
	return queryKeys.workspaceFile(path);
}
/**
* A project file in a tab. A picture opens in the viewer; everything else, including an SVG
* the viewer was asked to hand over, opens in the editor.
*/
function FileTab({ project, tab }) {
	const [asText, setAsText] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setAsText(false);
	}, [tab.path]);
	if (isImagePath(tab.path) && !asText) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFileTab, {
		project,
		tab,
		onEditSource: isTextImagePath(tab.path) ? () => setAsText(true) : void 0
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextFileTab, {
		project,
		tab,
		onShowImage: isImagePath(tab.path) ? () => setAsText(false) : void 0
	});
}
/** A file in an editor: Ctrl+S saves, and a clean file follows changes on disk. */
function TextFileTab({ project, tab, onShowImage }) {
	const queryClient = useQueryClient();
	const file = useQuery({
		queryKey: fileQueryKey(tab.path),
		queryFn: () => window.agentmat.fs.readFile(tab.path),
		meta: { silentLoading: true },
		staleTime: Number.POSITIVE_INFINITY
	});
	const [draft, setDraft] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const containerRef = (0, import_react.useRef)(null);
	const dirty = draft !== null && draft !== file.data;
	const tooLarge = (file.data?.length ?? 0) > MAX_EDITABLE_CHARS;
	const reveal = useEditorRevealStore((s) => s.pending[tab.path] ?? null);
	const takeReveal = (0, import_react.useCallback)(() => void useEditorRevealStore.getState().takeReveal(tab.path), [tab.path]);
	(0, import_react.useEffect)(() => {
		setFileDirty(tab.path, dirty);
		return () => setFileDirty(tab.path, false);
	}, [tab.path, dirty]);
	const relative = tab.path.startsWith(project.folderPath) ? tab.path.slice(project.folderPath.length).replace(/^[\\/]/, "") : tab.path;
	const parts = relative.split(/[\\/]/);
	const name = parts.pop() ?? relative;
	const dir = parts.join("/");
	async function save() {
		if (!dirty || draft === null || saving) return;
		setSaving(true);
		try {
			await window.agentmat.fs.writeFile(tab.path, draft);
			queryClient.setQueryData(fileQueryKey(tab.path), draft);
			setDraft(null);
		} catch (error) {
			toast.error("Could not save the file", { description: error instanceof Error ? error.message : void 0 });
		} finally {
			setSaving(false);
		}
	}
	(0, import_react.useEffect)(() => {
		const el = containerRef.current;
		if (!el) return;
		const onKeyDown = (event) => {
			if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === "KeyS") {
				event.preventDefault();
				event.stopPropagation();
				save();
			}
		};
		el.addEventListener("keydown", onKeyDown, true);
		return () => el.removeEventListener("keydown", onKeyDown, true);
	}, [
		draft,
		file.data,
		saving
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: containerRef,
		className: "flex h-full min-h-0 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-9 shrink-0 items-center gap-2 px-3 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(File, { className: "h-3 w-3 shrink-0 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-[3rem] shrink truncate text-xs font-medium",
					children: name
				}),
				dir ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate text-[11px] text-muted-foreground [direction:rtl]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("bdi", { children: dir })
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "flex-1" }),
				dirty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					tone: "warning",
					dot: true,
					children: "Unsaved"
				}) : null,
				onShowImage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Show the picture",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Show the picture",
						onClick: onShowImage,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageIcon, {})
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Reload from disk",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Reload from disk",
						onClick: () => {
							setDraft(null);
							file.refetch();
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("h-2.5 w-2.5", file.isFetching && "animate-spin") })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Open in its default app",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-xs",
						type: "button",
						"aria-label": "Open in its default app",
						onClick: () => void window.agentmat.shell.openPath(tab.path),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "xs",
					onClick: () => void save(),
					disabled: !dirty || saving,
					children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {}), "Save"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative min-h-0 flex-1",
			children: file.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2 p-4",
				children: Array.from({ length: 12 }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
					className: "h-3.5 rounded",
					style: { width: `${35 + i * 41 % 60}%` }
				}, i))
			}) : file.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				size: "sm",
				icon: File,
				title: "This file could not be opened",
				description: file.error instanceof Error ? file.error.message : "It may have been moved or deleted.",
				className: "h-full"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoEditor, {
				value: draft ?? file.data ?? "",
				onChange: (value) => setDraft(value),
				language: languageFor(tab.path.replaceAll("\\", "/")),
				readOnly: tooLarge,
				reveal,
				onRevealed: takeReveal,
				className: "absolute inset-0 min-h-0 rounded-none border-0"
			})
		})]
	});
}
//#endregion
export { FileTab as default, fileQueryKey };
