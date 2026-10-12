import { Br as __toESM, Fr as require_jsx_runtime, I as cn, Lr as require_react } from "./tooltip-BbU-D7og.js";
import { i as Range, n as MarkerSeverity, o as editor } from "./editor.api-CbvhafvX.js";
import { t as resolveMonacoThemeKey } from "./monacoSetup-CdVLGY1Q.js";
//#region src/renderer/src/components/editor/MonacoEditor.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function currentMonacoTheme() {
	switch (resolveMonacoThemeKey()) {
		case "light": return "vs";
		case "dark":
		case "vscode-dark": return "vs-dark";
		case "vs2026": return "agentmate-vs2026";
	}
}
/** The owner name the editor's own markers go under, so other markers are left alone. */
var MARKER_OWNER = "agentmate";
function MonacoEditor({ value, onChange, language = "markdown", readOnly = false, className, reveal, onRevealed, markers }) {
	const containerRef = (0, import_react.useRef)(null);
	const editorRef = (0, import_react.useRef)(null);
	const onChangeRef = (0, import_react.useRef)(onChange);
	onChangeRef.current = onChange;
	const onRevealedRef = (0, import_react.useRef)(onRevealed);
	onRevealedRef.current = onRevealed;
	const revealedRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!containerRef.current) return;
		const editor$1 = editor.create(containerRef.current, {
			value,
			language,
			theme: currentMonacoTheme(),
			useShadowDOM: false,
			automaticLayout: true,
			minimap: { enabled: false },
			fontSize: 13,
			readOnly,
			wordWrap: "on",
			scrollBeyondLastLine: false
		});
		editorRef.current = editor$1;
		const contentDisposable = editor$1.onDidChangeModelContent(() => {
			onChangeRef.current?.(editor$1.getValue());
		});
		const themeObserver = new MutationObserver(() => {
			editor.setTheme(currentMonacoTheme());
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"]
		});
		return () => {
			contentDisposable.dispose();
			themeObserver.disconnect();
			editor$1.dispose();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const editor = editorRef.current;
		if (editor && editor.getValue() !== value) editor.setValue(value);
	}, [value]);
	(0, import_react.useEffect)(() => {
		editorRef.current?.updateOptions({ readOnly });
	}, [readOnly]);
	(0, import_react.useEffect)(() => {
		const editor = editorRef.current;
		if (!editor || !reveal || revealedRef.current === reveal.nonce) return;
		revealedRef.current = reveal.nonce;
		const range = new Range(reveal.line, reveal.column, reveal.line, reveal.column + (reveal.length ?? 0));
		editor.setSelection(range);
		editor.revealRangeInCenterIfOutsideViewport(range);
		editor.focus();
		onRevealedRef.current?.();
	}, [reveal]);
	(0, import_react.useEffect)(() => {
		const model = editorRef.current?.getModel();
		if (!model) return;
		editor.setModelMarkers(model, MARKER_OWNER, (markers ?? []).map((marker) => ({
			severity: MarkerSeverity.Error,
			message: marker.message,
			startLineNumber: marker.line,
			startColumn: 1,
			endLineNumber: marker.line,
			endColumn: model.getLineMaxColumn(Math.min(marker.line, model.getLineCount()))
		})));
	}, [markers, value]);
	(0, import_react.useEffect)(() => {
		const model = editorRef.current?.getModel();
		if (model) editor.setModelLanguage(model, language);
	}, [language]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: containerRef,
		className: cn("min-h-[240px] w-full overflow-hidden rounded-lg border border-border", className)
	});
}
//#endregion
export { currentMonacoTheme as n, MonacoEditor as t };
