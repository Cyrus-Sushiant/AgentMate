import { Br as __toESM, F as Button, Fr as require_jsx_runtime, I as cn, Lr as require_react, Pr as toast, _ as SECTION_HEADING, bt as Code, gn as Lock, qn as Save, rr as Spinner } from "./tooltip-BbU-D7og.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle } from "./label-D49cSr88.js";
import "./pageKit-dgpHZ_9P.js";
import { n as coreErrorMessage } from "./coreErrors-C93UH5Hm.js";
import { t as MonacoEditor } from "./MonacoEditor-6KQEKFS9.js";
import { t as MonacoDiffEditor } from "./MonacoDiffEditor-B83KNjHv.js";
import { c as problemsFor, l as snippetMarks, r as Section, t as FieldError } from "./fields-CHMyk-6w.js";
//#region src/renderer/src/components/deploy/sites/AdvancedTab.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SNIPPETS = [{
	key: "serverSnippet",
	title: "Server block",
	description: "Added inside the site's server { } block, after the settings above."
}, {
	key: "locationSnippet",
	title: "Location block",
	description: "Added inside location / { }, next to the proxy settings."
}];
function AdvancedTab({ serverId, site, owner, applyProblems, onSaved }) {
	const saved = {
		serverSnippet: site?.serverSnippet ?? "",
		locationSnippet: site?.locationSnippet ?? ""
	};
	const [text, setText] = (0, import_react.useState)(saved);
	const [problems, setProblems] = (0, import_react.useState)([]);
	const [reviewing, setReviewing] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [failure, setFailure] = (0, import_react.useState)(null);
	const changed = text.serverSnippet !== saved.serverSnippet || text.locationSnippet !== saved.locationSnippet;
	if (!site) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Save the site first, then add custom directives here."
	});
	const placed = problemsFor([...problems, ...applyProblems], "site", site.settings.id);
	async function save() {
		if (!site) return;
		setBusy(true);
		setFailure(null);
		try {
			const result = await window.agentmat.deploySites.setSnippets(serverId, {
				siteId: site.settings.id,
				...text.serverSnippet ? { serverSnippet: text.serverSnippet } : {},
				...text.locationSnippet ? { locationSnippet: text.locationSnippet } : {}
			});
			setReviewing(false);
			setProblems(result.problems);
			if (result.problems.length === 0 && result.site) {
				toast.success("Custom directives saved. Apply to put them live.");
				onSaved(result.site);
			}
		} catch (error) {
			setFailure(coreErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [
			!owner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: cn("rounded-xl bg-foreground/[0.03] p-3 ring-1 ring-inset ring-foreground/[0.07]", "flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-3.5 w-3.5 shrink-0" }), "Only an Owner can change custom directives, since they reach nginx most directly."]
			}),
			SNIPPETS.map((snippet) => {
				const marks = snippetMarks(placed, snippet.key);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
					title: snippet.title,
					description: snippet.description,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoEditor, {
						value: text[snippet.key],
						onChange: (value) => setText((current) => ({
							...current,
							[snippet.key]: value
						})),
						language: "plaintext",
						readOnly: !owner,
						markers: marks,
						className: "min-h-[160px]"
					}), marks.map((mark) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, { message: `Line ${mark.line}: ${mark.message}` }, `${mark.line}:${mark.message}`))]
				}, snippet.key);
			}),
			placed.filter((problem) => problem.path !== "serverSnippet" && problem.path !== "locationSnippet").map((problem) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, { message: problem.message }, problem.path + problem.message)),
			owner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					disabled: !changed,
					onClick: () => setReviewing(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Code, { className: "h-3.5 w-3.5" }), " Review the change"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: reviewing,
				onOpenChange: (open) => !busy && setReviewing(open),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "max-w-4xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Save these directives?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Saved directives go live with the next apply. nginx keeps running what it has if they fail its check." })] }),
						SNIPPETS.filter((snippet) => text[snippet.key] !== saved[snippet.key]).map((snippet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: SECTION_HEADING,
								children: snippet.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoDiffEditor, {
								path: `${snippet.key}.conf`,
								original: saved[snippet.key],
								modified: text[snippet.key],
								sideBySide: true,
								ignoreWhitespace: false,
								className: "h-48"
							})]
						}, snippet.key)),
						failure && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "text-sm text-destructive",
							children: failure
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "soft",
							disabled: busy,
							onClick: () => setReviewing(false),
							children: "Keep editing"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							disabled: busy,
							onClick: () => void save(),
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "h-3.5 w-3.5" }), "Save directives"]
						})] })
					]
				})
			})
		]
	});
}
//#endregion
export { AdvancedTab };
