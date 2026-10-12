import { Br as __toESM, Fr as require_jsx_runtime, I as cn, Lr as require_react, hr as TriangleAlert, v as SECTION_WELL } from "./tooltip-BbU-D7og.js";
import { r as Input } from "./input-yQ7bc-An.js";
import { t as Label } from "./label-D49cSr88.js";
import "./pageKit-dgpHZ_9P.js";
import { t as Switch } from "./switch-DmfrphOr.js";
//#region src/renderer/src/lib/deploy/sites/problems.ts
var FIELD = /^(sites|streams)\[([^\]]*)\]\.?(.*)$/;
var TABS = [
	[/^(id|domains)\b/, "domains"],
	[/^(upstream|websocket)\b/, "proxy"],
	[/^(certificate|hsts|redirectToHttps|http2)\b/, "ssl"],
	[/^(gzip|proxyCache|clientMaxBodySizeMegabytes|timeouts)\b/, "performance"],
	[/^(responseHeaders|securityHeaders|ipRules|basicAuth|rateLimit)\b/, "security"],
	[/^(serverSnippet|locationSnippet)\b/, "advanced"]
];
function tabOf(path) {
	return TABS.find(([pattern]) => pattern.test(path))?.[1] ?? "domains";
}
function placeProblem(problem) {
	const match = FIELD.exec(problem.field);
	const line = problem.line === void 0 ? {} : { line: problem.line };
	if (!match) return {
		scope: problem.siteId ? "site" : "general",
		...problem.siteId ? { id: problem.siteId } : {},
		path: problem.field,
		tab: tabOf(problem.field),
		message: problem.message,
		...line
	};
	const [, kind, id, path] = match;
	return {
		scope: kind === "sites" ? "site" : "stream",
		id,
		path,
		tab: tabOf(path),
		message: problem.message,
		...line
	};
}
/** The problems of one site (or one stream proxy), by the field each is about. */
function problemsFor(problems, scope, id) {
	return problems.map(placeProblem).filter((placed) => placed.scope === scope && placed.id === id);
}
/** How many problems each tab has, to mark the tabs that need a look. */
function problemsByTab(problems) {
	const counts = {};
	for (const problem of problems) counts[problem.tab] = (counts[problem.tab] ?? 0) + 1;
	return counts;
}
/** Problems on snippet lines, for the editor's inline marks. */
function snippetMarks(problems, snippet) {
	return problems.filter((problem) => problem.path === snippet).map((problem) => ({
		line: problem.line ?? 1,
		message: problem.message
	}));
}
//#endregion
//#region src/renderer/src/components/deploy/sites/fields.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** The small form pieces every tab of the site editor is made of. */
/**
* A native select in the shared field look (see `.field-surface` in index.css), the same pill
* as ui/input and the Cloudflare page's NativeSelect. The `.dark .field-surface` rule sets the
* colour scheme, so the option popup follows the theme too.
*/
var SELECT_CLASS = "field-surface flex h-9 w-full cursor-pointer rounded-full pl-3 pr-2 text-sm text-foreground disabled:cursor-not-allowed";
/** A problem with a field, marked with an icon and announced, not only coloured. */
function FieldError({ id, message }) {
	if (!message) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		id,
		role: "alert",
		className: "flex items-start gap-1.5 text-xs text-destructive",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3 w-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: message })]
	});
}
function ToggleRow({ label, description, checked, onChange, disabled, disabledReason }) {
	const id = (0, import_react.useId)();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 space-y-0.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: id,
					className: cn(disabled && "text-muted-foreground"),
					children: label
				}),
				description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: description
				}),
				disabled && disabledReason && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: disabledReason
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			id,
			checked,
			onCheckedChange: onChange,
			disabled
		})]
	});
}
function TextField({ label, value, onChange, error, hint, placeholder, disabled, suffix, className, inputMode, mono }) {
	const id = (0, import_react.useId)();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("space-y-1.5", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: id,
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id,
					value,
					onChange: (event) => onChange(event.target.value),
					placeholder,
					disabled,
					inputMode,
					spellCheck: false,
					autoComplete: "off",
					"aria-invalid": error ? true : void 0,
					"aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : void 0,
					className: cn(mono && "font-mono")
				}), suffix && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-xs text-muted-foreground",
					children: suffix
				})]
			}),
			hint && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				id: `${id}-hint`,
				className: "text-xs text-muted-foreground",
				children: hint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, {
				id: `${id}-error`,
				message: error
			})
		]
	});
}
/** A titled group of fields inside a tab. */
function Section({ title, description, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn(SECTION_WELL, "space-y-3 p-4"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-0.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-[13px] font-semibold text-foreground",
				children: title
			}), description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: description
			})]
		}), children]
	});
}
//#endregion
export { ToggleRow as a, problemsFor as c, TextField as i, snippetMarks as l, SELECT_CLASS as n, placeProblem as o, Section as r, problemsByTab as s, FieldError as t, tabOf as u };
