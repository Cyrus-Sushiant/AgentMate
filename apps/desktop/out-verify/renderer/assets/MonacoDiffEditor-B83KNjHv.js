import { Br as __toESM, Fr as require_jsx_runtime, I as cn, Lr as require_react, t as SimpleTooltip } from "./tooltip-BbU-D7og.js";
import { o as editor, s as languages } from "./editor.api-CbvhafvX.js";
import { t as resolveMonacoThemeKey } from "./monacoSetup-CdVLGY1Q.js";
//#region src/renderer/src/components/editor/MonacoDiffEditor.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function currentTheme() {
	switch (resolveMonacoThemeKey()) {
		case "light": return "agentmate-light";
		case "dark": return "agentmate-dark";
		case "vscode-dark": return "vs-dark";
		case "vs2026": return "agentmate-vs2026";
	}
}
/** Monaco's language id for a file, from its extension or exact name. */
function languageFor(path) {
	const name = path.split("/").pop()?.toLowerCase() ?? "";
	const dot = name.lastIndexOf(".");
	const ext = dot >= 0 ? name.slice(dot) : "";
	for (const language of languages.getLanguages()) {
		if (language.filenames?.some((f) => f.toLowerCase() === name)) return language.id;
		if (ext && language.extensions?.includes(ext)) return language.id;
	}
	return "plaintext";
}
/** The lines a change block covers on one side, or null when it has none there. */
function blockLines(change, side) {
	const start = side === "original" ? change.originalStartLineNumber : change.modifiedStartLineNumber;
	const end = side === "original" ? change.originalEndLineNumber : change.modifiedEndLineNumber;
	return end > 0 ? [start, end] : null;
}
/**
* The lines a set of selections touches. A selection that ends at the very start of a line
* doesn't take that line, and an empty selection means the cursor's line when `cursorLine`.
*/
function selectedLines(editor, cursorLine) {
	const lines = [];
	for (const selection of editor.getSelections() ?? []) {
		if (selection.isEmpty()) {
			if (cursorLine) lines.push([selection.startLineNumber, selection.startLineNumber]);
			continue;
		}
		const end = selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber ? selection.endLineNumber - 1 : selection.endLineNumber;
		lines.push([selection.startLineNumber, end]);
	}
	return lines;
}
function intersect(ranges, block) {
	if (!block) return [];
	return ranges.map(([from, to]) => [Math.max(from, block[0]), Math.min(to, block[1])]).filter(([from, to]) => from <= to);
}
/** Every line a block covers, on both sides. */
function wholeBlock(change) {
	const original = blockLines(change, "original");
	const modified = blockLines(change, "modified");
	return {
		original: original ? [original] : [],
		modified: modified ? [modified] : []
	};
}
function sameBlock(a, b) {
	return a.originalStartLineNumber === b.originalStartLineNumber && a.originalEndLineNumber === b.originalEndLineNumber && a.modifiedStartLineNumber === b.modifiedStartLineNumber && a.modifiedEndLineNumber === b.modifiedEndLineNumber;
}
function lineCount(ranges) {
	return [...ranges.original, ...ranges.modified].reduce((sum, [from, to]) => sum + to - from + 1, 0);
}
/** A side-by-side (or inline) diff of two versions of a file, optionally editable on the right. */
var MonacoDiffEditor = (0, import_react.forwardRef)(function MonacoDiffEditor({ path, original, modified, sideBySide, ignoreWhitespace, editable = false, onModifiedChange, lineActions, lineActionsBlocked, className }, ref) {
	const wrapperRef = (0, import_react.useRef)(null);
	const containerRef = (0, import_react.useRef)(null);
	const onModifiedChangeRef = (0, import_react.useRef)(onModifiedChange);
	onModifiedChangeRef.current = onModifiedChange;
	const applyingRef = (0, import_react.useRef)(false);
	const editorRef = (0, import_react.useRef)(null);
	const modelsRef = (0, import_react.useRef)(null);
	const [hovered, setHovered] = (0, import_react.useState)(null);
	const hoveredRef = (0, import_react.useRef)(null);
	hoveredRef.current = hovered;
	const hideTimer = (0, import_react.useRef)(null);
	const [, setSelectionTick] = (0, import_react.useState)(0);
	(0, import_react.useImperativeHandle)(ref, () => ({ goToChange: (direction) => editorRef.current?.goToDiff(direction) }));
	(0, import_react.useEffect)(() => {
		const container = containerRef.current;
		if (!container) return;
		const editor$1 = editor.createDiffEditor(container, {
			theme: currentTheme(),
			useShadowDOM: false,
			readOnly: !editable,
			originalEditable: false,
			automaticLayout: true,
			renderSideBySide: sideBySide,
			useInlineViewWhenSpaceIsLimited: true,
			renderSideBySideInlineBreakpoint: 700,
			ignoreTrimWhitespace: ignoreWhitespace,
			hideUnchangedRegions: {
				enabled: true,
				contextLineCount: 4,
				minimumLineCount: 6
			},
			renderOverviewRuler: true,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			fontSize: 12.5,
			lineHeight: 19,
			fontFamily: "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
			renderLineHighlight: "none",
			stickyScroll: { enabled: false },
			padding: { top: 8 },
			diffAlgorithm: "advanced"
		});
		editorRef.current = editor$1;
		const modifiedEditor = editor$1.getModifiedEditor();
		const contentListener = modifiedEditor.onDidChangeModelContent(() => {
			if (applyingRef.current) return;
			onModifiedChangeRef.current?.(modifiedEditor.getValue());
		});
		const themeObserver = new MutationObserver(() => editor.setTheme(currentTheme()));
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"]
		});
		return () => {
			themeObserver.disconnect();
			contentListener.dispose();
			editor$1.dispose();
			modelsRef.current?.original.dispose();
			modelsRef.current?.modified.dispose();
			modelsRef.current = null;
			editorRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const editor$4 = editorRef.current;
		if (!editor$4) return;
		const current = modelsRef.current;
		if (current && current.path === path) {
			applyingRef.current = true;
			try {
				if (current.original.getValue() !== original) current.original.setValue(original);
				if (current.modified.getValue() !== modified) current.modified.setValue(modified);
			} finally {
				applyingRef.current = false;
			}
			return;
		}
		const language = languageFor(path);
		const next = {
			path,
			original: editor.createModel(original, language),
			modified: editor.createModel(modified, language)
		};
		applyingRef.current = true;
		try {
			editor$4.setModel({
				original: next.original,
				modified: next.modified
			});
		} finally {
			applyingRef.current = false;
		}
		current?.original.dispose();
		current?.modified.dispose();
		modelsRef.current = next;
	}, [
		path,
		original,
		modified
	]);
	(0, import_react.useEffect)(() => {
		editorRef.current?.updateOptions({
			renderSideBySide: sideBySide,
			ignoreTrimWhitespace: ignoreWhitespace,
			readOnly: !editable
		});
	}, [
		sideBySide,
		ignoreWhitespace,
		editable
	]);
	const hasLineActions = (lineActions?.length ?? 0) > 0;
	/**
	* Where a block's buttons go: level with its first line, at the right edge of that side. A
	* block that starts above the view keeps them pinned to the top while any of it shows.
	*/
	function placeBlock(change, side) {
		const diff = editorRef.current;
		const wrapper = wrapperRef.current;
		if (!diff || !wrapper) return null;
		const editor$2 = side === "original" ? diff.getOriginalEditor() : diff.getModifiedEditor();
		const dom = editor$2.getDomNode();
		if (!dom) return null;
		const lines = blockLines(change, side);
		const start = Math.max(1, lines?.[0] ?? (side === "original" ? change.originalStartLineNumber : change.modifiedStartLineNumber));
		const end = lines?.[1] ?? start;
		const outer = wrapper.getBoundingClientRect();
		const box = dom.getBoundingClientRect();
		const viewTop = box.top - outer.top;
		const scrollTop = editor$2.getScrollTop();
		const blockTop = viewTop + editor$2.getTopForLineNumber(start) - scrollTop;
		if (viewTop + editor$2.getTopForLineNumber(end) + editor$2.getOption(editor.EditorOption.lineHeight) - scrollTop <= viewTop || blockTop > box.bottom - outer.top - 16) return null;
		const top = Math.max(blockTop, viewTop);
		const scrollbar = editor$2.getLayoutInfo().verticalScrollbarWidth;
		return {
			change,
			side,
			top,
			right: outer.right - box.right + scrollbar + 8
		};
	}
	(0, import_react.useEffect)(() => {
		const diff = editorRef.current;
		if (!diff || !hasLineActions) {
			setHovered(null);
			return;
		}
		const cancelHide = () => {
			if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
			hideTimer.current = null;
		};
		const scheduleHide = () => {
			cancelHide();
			hideTimer.current = window.setTimeout(() => setHovered(null), 250);
		};
		const listen = (editor$3, side) => [
			editor$3.onMouseMove((event) => {
				const changes = diff.getLineChanges() ?? [];
				const target = event.target;
				let change;
				if (target.position) {
					const line = target.position.lineNumber;
					change = changes.find((c) => {
						const lines = blockLines(c, side);
						return lines !== null && line >= lines[0] && line <= lines[1];
					});
				}
				if (!change && side === "modified" && (target.type === editor.MouseTargetType.CONTENT_VIEW_ZONE || target.type === editor.MouseTargetType.GUTTER_VIEW_ZONE)) {
					const after = target.detail.afterLineNumber;
					change = changes.find((c) => c.modifiedEndLineNumber === 0 ? c.modifiedStartLineNumber === after : c.modifiedStartLineNumber - 1 === after);
				}
				if (!change) {
					if (hoveredRef.current) scheduleHide();
					return;
				}
				cancelHide();
				const current = hoveredRef.current;
				if (current && current.side === side && sameBlock(current.change, change)) return;
				setHovered(placeBlock(change, side));
			}),
			editor$3.onMouseLeave(scheduleHide),
			editor$3.onDidScrollChange(() => {
				const current = hoveredRef.current;
				if (current?.side === side) setHovered(placeBlock(current.change, side));
			}),
			editor$3.onDidChangeCursorSelection(() => setSelectionTick((tick) => tick + 1))
		];
		const disposables = [
			...listen(diff.getOriginalEditor(), "original"),
			...listen(diff.getModifiedEditor(), "modified"),
			diff.onDidUpdateDiff(() => setHovered(null))
		];
		return () => {
			cancelHide();
			for (const disposable of disposables) disposable.dispose();
		};
	}, [hasLineActions]);
	const lineActionsRef = (0, import_react.useRef)(lineActions);
	lineActionsRef.current = lineActions;
	const actionKey = lineActionsBlocked ? "" : (lineActions ?? []).map((action) => `${action.id}:${action.menuLabel}`).join("|");
	(0, import_react.useEffect)(() => {
		const diff = editorRef.current;
		if (!diff || !actionKey) return;
		const disposables = [];
		for (const [side, editor] of [["original", diff.getOriginalEditor()], ["modified", diff.getModifiedEditor()]]) (lineActionsRef.current ?? []).forEach((action, index) => {
			disposables.push(editor.addAction({
				id: `agentmate.diff.lines.${action.id}`,
				label: action.menuLabel,
				contextMenuGroupId: "0_agentmate_lines",
				contextMenuOrder: index,
				run: (ed) => {
					const lines = selectedLines(ed, true);
					(lineActionsRef.current?.find((a) => a.id === action.id))?.run({
						original: side === "original" ? lines : [],
						modified: side === "modified" ? lines : []
					});
				}
			}));
		});
		return () => {
			for (const disposable of disposables) disposable.dispose();
		};
	}, [actionKey]);
	/** The lines a block's buttons act on: the selected part of the block, or all of it. */
	function blockRanges(change) {
		const diff = editorRef.current;
		const whole = wholeBlock(change);
		if (!diff) return whole;
		const picked = {
			original: intersect(selectedLines(diff.getOriginalEditor(), false), whole.original[0] ?? null),
			modified: intersect(selectedLines(diff.getModifiedEditor(), false), whole.modified[0] ?? null)
		};
		return lineCount(picked) > 0 ? picked : whole;
	}
	const blockToolbar = hasLineActions && hovered ? (() => {
		const ranges = blockRanges(hovered.change);
		const count = lineCount(ranges);
		const whole = count === lineCount(wholeBlock(hovered.change));
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "toolbar",
			"aria-label": "Change block actions",
			onMouseEnter: () => {
				if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
				hideTimer.current = null;
			},
			onMouseLeave: () => {
				hideTimer.current = window.setTimeout(() => setHovered(null), 250);
			},
			style: {
				top: hovered.top,
				right: hovered.right
			},
			className: "absolute z-10 flex h-[19px] items-center gap-px overflow-hidden rounded-md border border-border bg-popover/95 shadow-sm backdrop-blur-sm",
			children: lineActions?.map((action) => {
				const Icon = action.icon;
				const hint = lineActionsBlocked ? lineActionsBlocked : whole ? `${action.label} this block` : `${action.label} the ${count} selected line${count === 1 ? "" : "s"}`;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: hint,
					wrapTrigger: !!lineActionsBlocked,
					delayDuration: 400,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": hint,
						disabled: !!lineActionsBlocked,
						onClick: () => {
							action.run(ranges);
							setHovered(null);
						},
						className: cn("flex h-full items-center gap-1 px-1.5 text-[10.5px] font-medium text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-50", action.tone === "danger" ? "hover:bg-destructive/15 hover:text-destructive" : "hover:bg-primary/15 hover:text-primary"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-2.5 w-2.5" }), whole ? action.label : `${action.label} ${count}`]
					})
				}, action.id);
			})
		});
	})() : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapperRef,
		className: cn("relative h-full w-full overflow-hidden", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: containerRef,
			className: "h-full w-full"
		}), blockToolbar]
	});
});
//#endregion
export { languageFor as n, MonacoDiffEditor as t };
