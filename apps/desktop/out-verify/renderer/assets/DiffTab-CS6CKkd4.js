import { Br as __toESM, Cn as Minus, F as Button, Fr as require_jsx_runtime, Ft as File, I as cn, In as Plus, It as FileCode, K as ArrowDown, Lr as require_react, Nn as Pin, Pr as toast, Y as ArrowUp, _ as SECTION_HEADING, an as ImageIcon, gr as Undo, ir as SplitView, qn as Save, rr as Spinner, t as SimpleTooltip, tr as Sparkles } from "./tooltip-BbU-D7og.js";
import { n as useQuery, p as useQueryClient, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { S as splitGitPath, f as HAIRLINE_BELOW, i as useGitActions, n as useAiResolving, t as openChangedFile, u as StatusLetter, w as DIFF_CHANGE_EVENT } from "./useWorkspaceGit-AK9ikqIx.js";
import { o as useShortcutLabel } from "./cliStore-BEVHhLcE.js";
import { g as useWorkspaceStore } from "./launch-OTu6P7aE.js";
import { C as Skeleton, g as Chip, m as EmptyState } from "./pageKit-dgpHZ_9P.js";
import { t as formatBytes } from "./format-CFqq7Rgx.js";
import { t as MonacoDiffEditor } from "./MonacoDiffEditor-B83KNjHv.js";
import { n as formatImageSize, r as isImagePath, t as ImageView } from "./ImageView-DlvJOhY-.js";
//#region src/renderer/src/components/workspace/git/ImageDiffView.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Notice({ title, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		size: "sm",
		icon: ImageIcon,
		title,
		description: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs",
			children: detail
		}),
		className: "h-full"
	});
}
/** One version of the picture, under a label saying which side of the change it is. */
function Side({ label, image, alt, missing }) {
	const [size, setSize] = (0, import_react.useState)(null);
	const caption = [formatImageSize(size), image ? formatBytes(image.bytes) : null].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 min-w-0 flex-1 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex h-8 shrink-0 items-center gap-2 px-3", HAIRLINE_BELOW),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: SECTION_HEADING,
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "flex-1" }),
				caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate text-[11px] tabular-nums text-muted-foreground",
					children: caption
				}) : null
			]
		}), image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageView, {
			src: image.dataUrl,
			alt,
			onSize: setSize
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex min-h-0 flex-1 items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: missing
			})
		})]
	});
}
/**
* A changed image, side by side, where the text diff would be. Git only reports "binary" for a
* picture, so this is the only way to see what actually changed without leaving the app.
*/
function ImageDiffView({ project, tab }) {
	const image = useQuery({
		queryKey: tab.commit ? queryKeys.gitFileImage(project.id, `commit:${tab.commit}`, tab.path) : queryKeys.gitFileImage(project.id, tab.side, tab.path),
		queryFn: () => tab.commit ? window.agentmat.git.commitFileImage(project.id, tab.commit, tab.path, tab.origPath) : window.agentmat.git.fileImage(project.id, tab.path, tab.side, tab.origPath),
		staleTime: tab.commit ? Number.POSITIVE_INFINITY : void 0,
		meta: { silentLoading: true },
		placeholderData: (previous, previousQuery) => previousQuery?.queryKey[3] === tab.path ? previous : void 0
	});
	const name = tab.path.split("/").pop() ?? tab.path;
	if (image.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full items-center justify-center p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-full w-full max-w-2xl rounded-lg" })
	});
	if (image.isError || !image.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
		title: "This image could not be read",
		detail: image.error instanceof Error ? image.error.message : "Git could not hand over one of the two versions."
	});
	if (image.data.tooLarge) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
		title: "This image is too large to show here",
		detail: "Open it in your image editor to see what changed."
	});
	const { original, modified } = image.data;
	if (!original && !modified) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
		title: "There is nothing to show",
		detail: "Neither side of this change holds a picture any more."
	});
	if (!original || !modified) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full min-h-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Side, {
			label: original ? "Deleted" : "Added",
			image: original ?? modified,
			alt: name,
			missing: ""
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 divide-x divide-border/60",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Side, {
			label: "Before",
			image: original,
			alt: `${name} before the change`,
			missing: "No file"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Side, {
			label: "After",
			image: modified,
			alt: `${name} after the change`,
			missing: "No file"
		})]
	});
}
//#endregion
//#region src/renderer/src/components/workspace/git/DiffTab.tsx
function ToolbarButton({ label, onClick, active, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: "ghost",
			size: "xs",
			"aria-label": label,
			"aria-pressed": active,
			onClick,
			className: cn("min-w-6 px-1 font-normal text-muted-foreground hover:bg-foreground/[0.06]", active && "bg-primary/12 text-primary hover:bg-primary/20 hover:text-primary"),
			children
		})
	});
}
function entryFor(state, tab) {
	if (!state) return null;
	return (tab.side === "staged" ? state.staged : tab.side === "unstaged" ? state.unstaged : tab.side === "untracked" ? state.untracked : state.conflicts).find((entry) => entry.path === tab.path) ?? null;
}
var SIDE_LABEL = {
	staged: "Staged",
	unstaged: "Working tree",
	untracked: "New file",
	conflict: "Conflict"
};
/** A file's changes, shown in a pane next to the terminals. */
function DiffTab({ project, tab, focused }) {
	const queryClient = useQueryClient();
	const editorRef = (0, import_react.useRef)(null);
	const containerRef = (0, import_react.useRef)(null);
	const nextChangeLabel = useShortcutLabel("workspace.nextChange");
	const prevChangeLabel = useShortcutLabel("workspace.prevChange");
	(0, import_react.useEffect)(() => {
		if (!focused) return;
		const onChange = (event) => {
			const direction = event.detail;
			editorRef.current?.goToChange(direction);
		};
		window.addEventListener(DIFF_CHANGE_EVENT, onChange);
		return () => window.removeEventListener(DIFF_CHANGE_EVENT, onChange);
	}, [focused]);
	const sideBySide = useWorkspaceStore((s) => s.gitPanel.diffSideBySide);
	const ignoreWhitespace = useWorkspaceStore((s) => s.gitPanel.diffIgnoreWhitespace);
	const setGitPanel = useWorkspaceStore((s) => s.setGitPanel);
	const openDiff = useWorkspaceStore((s) => s.openDiff);
	const actions = useGitActions(project.id);
	const { data: state } = useQuery({
		queryKey: queryKeys.gitWorkspaceState(project.id),
		queryFn: () => window.agentmat.git.workspaceState(project.id),
		staleTime: Number.POSITIVE_INFINITY,
		meta: { silentLoading: true }
	});
	const diff = useQuery({
		queryKey: tab.commit ? queryKeys.gitFileDiff(project.id, `commit:${tab.commit}`, tab.path) : queryKeys.gitFileDiff(project.id, tab.side, tab.path),
		queryFn: () => tab.commit ? window.agentmat.git.commitFileDiff(project.id, tab.commit, tab.path, tab.origPath) : window.agentmat.git.fileDiff(project.id, tab.path, tab.side, tab.origPath),
		staleTime: tab.commit ? Number.POSITIVE_INFINITY : void 0,
		meta: { silentLoading: true },
		placeholderData: (previous, previousQuery) => previousQuery?.queryKey[3] === tab.path ? previous : void 0
	});
	const entry = tab.commit ? null : entryFor(state, tab);
	const stagedToo = state?.staged.some((e) => e.path === tab.path) ?? false;
	const unstagedToo = state?.unstaged.some((e) => e.path === tab.path) ?? false;
	const { dir, name } = splitGitPath(tab.path);
	const gone = !tab.commit && state !== void 0 && entry === null;
	const aiResolving = useAiResolving(project.id, tab.path) && tab.side === "conflict";
	const editable = !!entry && tab.side !== "staged" && entry.status !== "D" && !!diff.data && !diff.data.binary && !diff.data.tooLarge;
	const [draft, setDraft] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const dirty = editable && draft !== null && draft !== diff.data?.modified;
	const originalId = diff.data?.originalId;
	const modifiedId = diff.data?.modifiedId;
	const lineSide = tab.side === "conflict" ? null : tab.side;
	let lineActions;
	if (entry && !tab.commit && lineSide && originalId && modifiedId) {
		const run = (action) => (ranges) => void actions.applyLines({
			path: tab.path,
			origPath: tab.origPath,
			side: lineSide,
			action,
			ranges,
			originalId,
			modifiedId
		});
		lineActions = lineSide === "staged" ? [{
			id: "unstage",
			label: "Unstage",
			menuLabel: "Unstage Selected Lines",
			icon: Minus,
			run: run("unstage")
		}] : [{
			id: "discard",
			label: "Discard",
			menuLabel: "Discard Selected Lines",
			icon: Undo,
			tone: "danger",
			run: run("discard")
		}, {
			id: "stage",
			label: "Stage",
			menuLabel: "Stage Selected Lines",
			icon: Plus,
			run: run("stage")
		}];
	}
	(0, import_react.useEffect)(() => {
		setDraft(null);
	}, [
		tab.path,
		tab.side,
		tab.commit
	]);
	function handleEdit(value) {
		setDraft(value);
		if (tab.preview) openDiff(project.id, tab, { pin: true });
	}
	async function save() {
		if (!dirty || draft === null || saving) return;
		setSaving(true);
		try {
			await window.agentmat.git.writeWorkingFile(project.id, tab.path, draft);
			queryClient.setQueryData(queryKeys.gitFileDiff(project.id, tab.side, tab.path), {
				...diff.data,
				modified: draft
			});
			setDraft(null);
			queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiff(project.id, tab.side, tab.path) });
			queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(project.id) });
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
		diff.data,
		saving,
		editable
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: containerRef,
		className: "@container flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex h-9 shrink-0 items-center gap-2 pl-3 pr-2", HAIRLINE_BELOW),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(File, { className: "h-3 w-3 shrink-0 text-muted-foreground" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-1 items-baseline gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-[3rem] shrink truncate text-xs font-medium",
								children: name
							}),
							dir ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden min-w-0 truncate text-[11px] text-muted-foreground [direction:rtl] @2xl:inline",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("bdi", { children: dir.replace(/\/$/, "") })
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: tab.side === "conflict" ? "destructive" : "neutral",
								className: "hidden h-[18px] px-2 text-[10px] @lg:inline-flex",
								children: tab.commit ? `Commit ${tab.commit.slice(0, 7)}` : SIDE_LABEL[tab.side]
							}),
							entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusLetter, {
								status: entry.status,
								className: "self-center"
							}) : null,
							entry && !entry.binary && (entry.additions || entry.deletions) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "hidden shrink-0 font-mono text-[10px] tabular-nums @md:inline",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-success",
										children: ["+", entry.additions ?? 0]
									}),
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-destructive",
										children: ["−", entry.deletions ?? 0]
									})
								]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 items-center gap-0.5",
						children: [
							dirty ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mr-1 flex shrink-0 items-center gap-1 text-[11px] text-warning",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden @md:inline",
									children: "Unsaved"
								})]
							}) : null,
							editable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								size: "xs",
								onClick: () => void save(),
								disabled: !dirty || saving,
								className: "mr-1",
								children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {}), "Save"]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
								label: prevChangeLabel ? `Previous change (${prevChangeLabel})` : "Previous change",
								onClick: () => editorRef.current?.goToChange("previous"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-2.5 w-2.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
								label: nextChangeLabel ? `Next change (${nextChangeLabel})` : "Next change",
								onClick: () => editorRef.current?.goToChange("next"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-2.5 w-2.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "hidden items-center gap-0.5 @lg:flex",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-4 w-px bg-foreground/10" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
										label: sideBySide ? "Show inline" : "Show side by side",
										active: sideBySide,
										onClick: () => setGitPanel({ diffSideBySide: !sideBySide }),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SplitView, { className: "h-3 w-3" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
										label: ignoreWhitespace ? "Show whitespace changes" : "Hide whitespace changes",
										active: ignoreWhitespace,
										onClick: () => setGitPanel({ diffIgnoreWhitespace: !ignoreWhitespace }),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-[10px] font-semibold",
											children: "¶"
										})
									}),
									tab.preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
										label: "Keep this tab open",
										onClick: () => openDiff(project.id, tab, { pin: true }),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "h-2.5 w-2.5" })
									}) : null,
									entry && tab.side !== "staged" && entry.status !== "D" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
										label: "Open file",
										onClick: () => openChangedFile(project, state?.projectPrefix ?? "", tab.path, entry.binary),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, { className: "h-2.5 w-2.5" })
									}) : null
								]
							}),
							entry && (tab.side === "unstaged" || tab.side === "untracked") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-4 w-px bg-foreground/10" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
								label: tab.side === "untracked" ? "Delete file" : "Discard changes",
								onClick: () => void actions.discard([tab.path], tab.side),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo, { className: "h-2.5 w-2.5" })
							})] }) : null,
							entry && tab.side === "conflict" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
								label: aiResolving ? "Stop the AI and put the file back" : "Have your AI CLI merge both sides. Nothing is staged.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: "soft",
									size: "xs",
									onClick: () => void actions.resolveWithAi(tab.path),
									"aria-label": aiResolving ? "Stop resolving with AI" : "Resolve with AI",
									className: "ml-1 hover:text-primary",
									children: [aiResolving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "animate-spin text-primary motion-reduce:animate-none" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden @md:inline",
										children: aiResolving ? "Stop" : "Resolve with AI"
									})]
								})
							}) : null,
							entry ? tab.side === "staged" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "soft",
								size: "xs",
								onClick: () => void actions.unstage([tab.path]),
								className: "ml-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {}), " Unstage"]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								size: "xs",
								onClick: () => void actions.stage([tab.path]),
								disabled: aiResolving,
								className: "ml-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}),
									" ",
									tab.side === "conflict" ? "Mark resolved" : "Stage"
								]
							}) : null
						]
					})
				]
			}),
			gone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex shrink-0 items-center gap-2 bg-foreground/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground", HAIRLINE_BELOW),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex-1",
						children: tab.side === "staged" ? "Nothing about this file is staged anymore." : "This file has no unstaged changes anymore."
					}),
					tab.side !== "staged" && stagedToo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => openDiff(project.id, {
							path: tab.path,
							side: "staged"
						}),
						className: "font-medium text-primary hover:underline",
						children: "Show staged"
					}) : null,
					tab.side === "staged" && unstagedToo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => openDiff(project.id, {
							path: tab.path,
							side: "unstaged"
						}),
						className: "font-medium text-primary hover:underline",
						children: "Show working tree"
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative min-h-0 flex-1",
				children: !diff.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2 p-4",
					children: Array.from({ length: 10 }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
						className: "h-3.5 rounded-full",
						style: { width: `${40 + i * 37 % 55}%` }
					}, i))
				}) : (diff.data.binary || diff.data.tooLarge) && isImagePath(tab.path) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageDiffView, {
					project,
					tab
				}) : diff.data.binary || diff.data.tooLarge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					size: "sm",
					icon: File,
					title: diff.data.binary ? "Binary file" : "This file is too large to diff here",
					description: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-xs",
						children: "Open it in your editor to see what changed."
					}),
					className: "h-full"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoDiffEditor, {
					ref: editorRef,
					path: tab.path,
					original: diff.data.original,
					modified: dirty && draft !== null ? draft : diff.data.modified,
					sideBySide,
					ignoreWhitespace,
					editable,
					onModifiedChange: handleEdit,
					lineActions,
					lineActionsBlocked: dirty ? "Save your edits first" : void 0
				})
			})
		]
	});
}
//#endregion
export { DiffTab as default };
