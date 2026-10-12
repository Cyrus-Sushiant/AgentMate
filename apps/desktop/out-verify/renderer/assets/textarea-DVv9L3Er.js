import { Br as __toESM, Fr as require_jsx_runtime, I as cn, Lr as require_react } from "./tooltip-BbU-D7og.js";
import { i as containsPersian, n as FIELD_SURFACE } from "./input-yQ7bc-An.js";
//#region src/renderer/src/components/ui/textarea.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* The corner every multi-line field uses. At the single-line height (h-9) it is exactly a pill,
* so a box that grows from one line keeps the search pills' shape until it wraps.
*/
var MULTILINE_FIELD_RADIUS = "rounded-[calc(var(--radius)+6px)]";
var Textarea = import_react.forwardRef(({ className, value, variant = "default", ...props }, ref) => {
	const isPersian = typeof value === "string" && containsPersian(value);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		value,
		dir: isPersian ? "rtl" : void 0,
		ref,
		spellCheck: true,
		className: cn("flex min-h-20 w-full px-3.5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50", variant === "bare" ? "bg-transparent outline-none placeholder:text-muted-foreground/70" : cn(FIELD_SURFACE, MULTILINE_FIELD_RADIUS), isPersian && "font-vazirmatn", className),
		...props
	});
});
Textarea.displayName = "Textarea";
//#endregion
export { Textarea as n, MULTILINE_FIELD_RADIUS as t };
