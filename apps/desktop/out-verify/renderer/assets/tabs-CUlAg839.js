import { A as useControllableState, Br as __toESM, C as Presence, Fr as require_jsx_runtime, I as cn, J as ArrowRight, Lr as require_react, N as createContextScope, O as Primitive, P as composeEventHandlers, j as useId, q as ArrowLeft } from "./tooltip-BbU-D7og.js";
import { i as useDirection, n as Root, r as createRovingFocusGroupScope, t as Item } from "./dist-DlV3lLiT.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-tabs@1.1.21_ed28580769b7e80737d078724056bb75/node_modules/@radix-ui/react-tabs/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});
var TABS_NAME = "Tabs";
var [createTabsContext, createTabsScope] = createContextScope(TABS_NAME, [createRovingFocusGroupScope]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [TabsProvider, useTabsContext] = createTabsContext(TABS_NAME);
var Tabs$1 = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function Tabs2(props, forwardedRef) {
	const { __scopeTabs, value: valueProp, onValueChange, defaultValue, orientation = "horizontal", dir, activationMode = "automatic", ...tabsProps } = props;
	const direction = useDirection(dir);
	const [value, setValue] = useControllableState({
		prop: valueProp,
		onChange: onValueChange,
		defaultProp: defaultValue ?? "",
		caller: TABS_NAME
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsProvider, {
		scope: __scopeTabs,
		baseId: useId(),
		value,
		onValueChange: setValue,
		orientation,
		dir: direction,
		activationMode,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
			dir: direction,
			"data-orientation": orientation,
			...tabsProps,
			ref: forwardedRef
		})
	});
}, "Tabs"));
var TAB_LIST_NAME = "TabsList";
var TabsList$1 = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TabsList2(props, forwardedRef) {
	const { __scopeTabs, loop = true, ...listProps } = props;
	const context = useTabsContext(TAB_LIST_NAME, __scopeTabs);
	const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		asChild: true,
		...rovingFocusGroupScope,
		orientation: context.orientation,
		dir: context.dir,
		loop,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
			role: "tablist",
			"aria-orientation": context.orientation,
			...listProps,
			ref: forwardedRef
		})
	});
}, "TabsList"));
var TRIGGER_NAME = "TabsTrigger";
var TabsTrigger$1 = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TabsTrigger2(props, forwardedRef) {
	const { __scopeTabs, value, disabled = false, ...triggerProps } = props;
	const context = useTabsContext(TRIGGER_NAME, __scopeTabs);
	const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
	const triggerId = makeTriggerId(context.baseId, value);
	const contentId = makeContentId(context.baseId, value);
	const isSelected = value === context.value;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
		asChild: true,
		...rovingFocusGroupScope,
		focusable: !disabled,
		active: isSelected,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.button, {
			type: "button",
			role: "tab",
			"aria-selected": isSelected,
			"aria-controls": contentId,
			"data-state": isSelected ? "active" : "inactive",
			"data-disabled": disabled ? "" : void 0,
			disabled,
			id: triggerId,
			...triggerProps,
			ref: forwardedRef,
			onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
				if (!disabled && event.button === 0 && event.ctrlKey === false) context.onValueChange(value);
				else event.preventDefault();
			}),
			onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
				if (disabled || event.target !== event.currentTarget) return;
				if ([" ", "Enter"].includes(event.key)) context.onValueChange(value);
			}),
			onFocus: composeEventHandlers(props.onFocus, () => {
				const isAutomaticActivation = context.activationMode !== "manual";
				if (!isSelected && !disabled && isAutomaticActivation) context.onValueChange(value);
			})
		})
	});
}, "TabsTrigger"));
var CONTENT_NAME = "TabsContent";
var TabsContent$1 = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function TabsContent2(props, forwardedRef) {
	const { __scopeTabs, value, forceMount, children, ...contentProps } = props;
	const context = useTabsContext(CONTENT_NAME, __scopeTabs);
	const triggerId = makeTriggerId(context.baseId, value);
	const contentId = makeContentId(context.baseId, value);
	const isSelected = value === context.value;
	const isMountAnimationPreventedRef = import_react.useRef(isSelected);
	import_react.useEffect(() => {
		const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
		return () => cancelAnimationFrame(rAF);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
		present: forceMount || isSelected,
		children: ({ present }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
			"data-state": isSelected ? "active" : "inactive",
			"data-orientation": context.orientation,
			role: "tabpanel",
			"aria-labelledby": triggerId,
			hidden: !present,
			id: contentId,
			tabIndex: 0,
			...contentProps,
			ref: forwardedRef,
			style: {
				...props.style,
				animationDuration: isMountAnimationPreventedRef.current ? "0s" : void 0
			},
			children: present && children
		})
	});
}, "TabsContent"));
function makeTriggerId(baseId, value) {
	return `${baseId}-trigger-${value}`;
}
__name(makeTriggerId, "makeTriggerId");
function makeContentId(baseId, value) {
	return `${baseId}-content-${value}`;
}
__name(makeContentId, "makeContentId");
var Root2 = Tabs$1;
var List = TabsList$1;
var Trigger = TabsTrigger$1;
var Content = TabsContent$1;
//#endregion
//#region src/renderer/src/components/ui/tabs.tsx
var Tabs = Root2;
/** Width of the fade drawn over an end of the strip that has more tabs past it. */
var EDGE_FADE = "20px";
/** How far a click on an edge arrow scrolls the strip. */
var EDGE_SCROLL = 120;
/**
* The trigger strip scrolls sideways rather than squeezing or clipping its tabs
* when the window is too narrow to fit them all (Project details has ten). The
* overflowing end fades out so it reads as "there is more this way", and the
* underline lives on the wrapper so the scroll container never clips the active
* tab's indicator.
*/
var TabsList = import_react.forwardRef(({ className, containerClassName, onScroll, ...props }, ref) => {
	const listRef = import_react.useRef(null);
	const [overflow, setOverflow] = import_react.useState({
		start: false,
		end: false
	});
	const setRefs = import_react.useCallback((node) => {
		listRef.current = node;
		if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	}, [ref]);
	const syncOverflow = import_react.useCallback(() => {
		const el = listRef.current;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		setOverflow((prev) => {
			const next = {
				start: el.scrollLeft > 1,
				end: el.scrollLeft < max - 1
			};
			return prev.start === next.start && prev.end === next.end ? prev : next;
		});
	}, []);
	import_react.useLayoutEffect(() => {
		const el = listRef.current;
		if (!el) return;
		el.querySelector("[data-state=\"active\"]")?.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
		syncOverflow();
		const observer = new ResizeObserver(syncOverflow);
		observer.observe(el);
		for (const child of Array.from(el.children)) observer.observe(child);
		return () => observer.disconnect();
	}, [syncOverflow]);
	import_react.useEffect(() => {
		const el = listRef.current;
		if (!el) return;
		const onWheel = (event) => {
			if (el.scrollWidth <= el.clientWidth) return;
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
			el.scrollLeft += event.deltaY;
			event.preventDefault();
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, []);
	const scrollBy = import_react.useCallback((delta) => {
		listRef.current?.scrollBy({
			left: delta,
			behavior: "smooth"
		});
	}, []);
	const mask = overflow.start || overflow.end ? `linear-gradient(to right, ${[overflow.start ? `transparent 0px, black ${EDGE_FADE}` : "black 0px", overflow.end ? `black calc(100% - ${EDGE_FADE}), transparent 100%` : "black 100%"].join(", ")})` : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative border-b border-border", containerClassName),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
				ref: setRefs,
				onScroll: (event) => {
					syncOverflow();
					onScroll?.(event);
				},
				style: {
					maskImage: mask,
					WebkitMaskImage: mask
				},
				className: cn("-mb-px inline-flex h-9 w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className),
				...props
			}),
			overflow.start && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				tabIndex: -1,
				"aria-label": "Scroll tabs left",
				onClick: () => scrollBy(-120),
				className: "absolute inset-y-0 left-0 flex w-5 items-center justify-start text-muted-foreground hover:text-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-3" })
			}),
			overflow.end && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				tabIndex: -1,
				"aria-label": "Scroll tabs right",
				onClick: () => scrollBy(EDGE_SCROLL),
				className: "absolute inset-y-0 right-0 flex w-5 items-center justify-end text-muted-foreground hover:text-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3" })
			})
		]
	});
});
TabsList.displayName = List.displayName;
var TabsTrigger = import_react.forwardRef(({ className, onClick, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
	ref,
	onClick: (event) => {
		event.currentTarget.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
		onClick?.(event);
	},
	className: cn("inline-flex h-9 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-t-md disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground", className),
	...props
}));
TabsTrigger.displayName = Trigger.displayName;
var TabsContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
	ref,
	className: cn("mt-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background", className),
	...props
}));
TabsContent.displayName = Content.displayName;
//#endregion
export { TabsTrigger as i, TabsContent as n, TabsList as r, Tabs as t };
