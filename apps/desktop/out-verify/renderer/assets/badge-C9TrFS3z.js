import { Fr as require_jsx_runtime, I as cn, L as cva, Lr as require_react } from "./tooltip-BbU-D7og.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors", {
	variants: { variant: {
		default: "bg-primary text-primary-foreground shadow-[0_0_12px_-4px_hsl(var(--primary)/0.55)]",
		secondary: "bg-foreground/[0.06] text-foreground/80",
		outline: "text-muted-foreground ring-1 ring-inset ring-foreground/[0.12]",
		success: "bg-success/12 text-success",
		warning: "bg-warning/12 text-warning",
		destructive: "bg-destructive/12 text-destructive"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
export { Badge as t };
