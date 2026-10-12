import { Ar as X, At as EllipsisVertical, Br as __toESM, Et as Crosshair, F as Button, Fr as require_jsx_runtime, I as cn, Ir as require_react_dom, J as ArrowRight, Lr as require_react, Mn as Pencil, Mt as ExternalLink, Pr as toast, Qt as Globe, Un as RotateCw, Xn as Server, Yn as Send, _ as SECTION_HEADING, _t as Clock, bn as MessageSquare, dr as Tablet, er as Smartphone, gn as Lock, h as GLASS_CARD, hr as TriangleAlert, jt as Expand, lt as ChevronDown, m as FOOTER_HAIRLINE, mr as Trash2, q as ArrowLeft, rt as Bug, t as SimpleTooltip, wn as Monitor, wt as Copy, x as segmentClass, xn as MessageSquarePlus, y as SEGMENT_TRACK } from "./tooltip-BbU-D7og.js";
import { t as confirmDialog } from "./confirmStore-BkKLridc.js";
import { rr as OVERLAY_SURFACE, xn as getCliDefinition } from "./dist-BskwpHU1.js";
import { o as useShortcutLabel } from "./cliStore-BEVHhLcE.js";
import { S as viewportPreset, b as browserRuntime, g as useWorkspaceStore, h as terminalTabLabel, l as projectCliId, v as markersFor, w as useTerminalSessionStore, x as VIEWPORT_PRESETS, y as useBrowserStore } from "./launch-OTu6P7aE.js";
import { C as Skeleton, g as Chip, l as Notice } from "./pageKit-dgpHZ_9P.js";
import { n as Textarea } from "./textarea-DVv9L3Er.js";
import { a as DropdownMenuLabel, c as DropdownMenuSeparator, i as DropdownMenuItem, l as DropdownMenuShortcut, o as DropdownMenuRadioGroup, r as DropdownMenuContent, s as DropdownMenuRadioItem, t as DropdownMenu, u as DropdownMenuTrigger } from "./dropdown-menu-qNy198IJ.js";
import { t as CliLogo } from "./cliLogos-CoKhMURb.js";
import { i as onBrowserShortcut } from "./agentChoices-Dc9UzfdM.js";
import { a as deliverToAgent, d as PopoverAnchor, f as PopoverContent, l as useAgentChoices, n as useDevServerStore, s as listAgentTerminals, t as detectedServersFor, u as Popover } from "./devServerStore-B-PBAYAw.js";
//#region src/renderer/src/lib/browser/annotationPrompt.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
/**
* The text an agent CLI gets for the comments left on page elements in a browser tab. It is
* markdown the agent reads as a prompt, so it names each element in every way the agent might
* search for it in the source: component, selector, text and the JSX source when React gives it.
*/
var SECRET_PARAM = /token|secret|password|passwd|api[-_]?key|auth|session|code|sig|signature|credential/i;
var MAX_LABEL = 60;
var INTENT_TEXT = {
	change: "Change",
	fix: "Fix (something is broken here)",
	question: "Question (answer it, don’t change code)"
};
function clip(text, max) {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
/** `Button button "Buy now"`: the innermost component, the tag and what the element says. */
function elementLabel(element) {
	const component = element.react?.components.at(-1);
	const name = element.name || element.text;
	return [
		component,
		element.tagName,
		name ? `"${clip(name, MAX_LABEL)}"` : null
	].filter(Boolean).join(" ");
}
/**
* A page URL safe to hand to an agent: values of parameters that look like credentials are
* replaced, and a fragment is dropped unless it is a hash route (`#/settings`).
*/
function sanitizePageUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		return raw;
	}
	if (!/^https?:$/.test(url.protocol)) return raw;
	for (const key of [...url.searchParams.keys()]) if (SECRET_PARAM.test(key)) url.searchParams.set(key, "redacted");
	if (!url.hash.startsWith("#/")) url.hash = "";
	return url.href;
}
function pathOf(url) {
	try {
		const parsed = new URL(url);
		return parsed.pathname + (parsed.hash.startsWith("#/") ? parsed.hash : "");
	} catch {
		return url;
	}
}
function quotePath(path) {
	return /\s/.test(path) ? `"${path}"` : path;
}
/** A fenced block whose fence is longer than any backtick run in the content. */
function fence(lang, body) {
	const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
	const marks = "`".repeat(Math.max(3, longest + 1));
	return `${marks}${lang}\n${body}\n${marks}`;
}
function elementLines(element) {
	const lines = [`**Selector:** \`${element.selector}\``];
	if (element.react?.components.length) lines.push(`**Components:** ${element.react.components.join(" > ")}`);
	if (element.react?.source) lines.push(`**Source:** ${element.react.source}`);
	if (element.text) lines.push(`**Text:** "${clip(element.text, 200)}"`);
	const styles = Object.entries(element.styles);
	if (styles.length) lines.push(`**Styles:** ${styles.map(([name, value]) => `${name}: ${value}`).join("; ")}`);
	return lines;
}
function pageLines(page, preset) {
	const size = `${page.viewport.width}×${page.viewport.height}`;
	return [`**URL:** ${sanitizePageUrl(page.url)}`, `**Viewport:** ${preset ? `${size} (${preset})` : size}`];
}
function formatAnnotationsPrompt(annotations) {
	const groups = /* @__PURE__ */ new Map();
	for (const annotation of annotations) {
		const key = sanitizePageUrl(annotation.page.url);
		groups.set(key, [...groups.get(key) ?? [], annotation]);
	}
	const count = annotations.length;
	const out = [`I left ${count === 1 ? "a comment" : `${count} comments`} on elements of the page open in my browser. Each one says which element it is about and how to find it in the code.`];
	let n = 0;
	for (const group of groups.values()) {
		const first = group[0];
		out.push("", `## Page feedback: ${pathOf(first.page.url)}`, "", ...pageLines(first.page, first.preset));
		for (const annotation of group) {
			n += 1;
			out.push("", `### ${n}. ${elementLabel(annotation.element)}`, `**Intent:** ${INTENT_TEXT[annotation.intent]}`, `**Comment:** ${annotation.comment.trim().replace(/\n/g, "\n  ")}`, ...elementLines(annotation.element));
			if (annotation.screenshotPath) out.push(`**Screenshot:** ${quotePath(annotation.screenshotPath)}`);
			if (annotation.element.html) out.push("**HTML:**", fence("html", annotation.element.html));
		}
	}
	return `${out.join("\n")}\n`;
}
/** One element's details without a comment, for the clipboard ("copy element"). */
function formatElementContext({ page, element }) {
	const out = [
		`Element on ${sanitizePageUrl(page.url)}: ${elementLabel(element)}`,
		"",
		...elementLines(element)
	];
	if (element.html) out.push("**HTML:**", fence("html", element.html));
	return `${out.join("\n")}\n`;
}
//#endregion
//#region src/renderer/src/lib/browser/sendAnnotations.ts
/** Getting the comments left in a browser tab to an agent, or onto the clipboard. */
function plural$1(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
/**
* Types every comment of the tab into an agent CLI as one prompt. The comments are cleared once
* the CLI has them (or a new tab is starting with them); if they only made it to the clipboard
* they stay, so nothing is lost. Returns whether they were sent.
*/
async function sendAnnotations(project, tabId, target) {
	const annotations = useBrowserStore.getState().annotations[tabId] ?? [];
	if (annotations.length === 0) return false;
	const result = await deliverToAgent(project, {
		build: () => formatAnnotationsPrompt(annotations),
		what: "Your comments",
		target
	});
	if (!result || result.outcome === "clipboard") return false;
	useBrowserStore.getState().removeAnnotations(tabId, annotations.map((one) => one.id));
	const cli = getCliDefinition(result.cliId)?.name ?? "the agent";
	const them = annotations.length === 1 ? "it" : "them";
	toast.success(`Sent ${plural$1(annotations.length, "comment")} to ${cli}`, { description: result.outcome === "launched" ? `They go in as soon as ${cli} is ready. Press Enter there to send ${them}.` : `Press Enter in the terminal to send ${them}.` });
	return true;
}
async function copyAnnotations(tabId) {
	const annotations = useBrowserStore.getState().annotations[tabId] ?? [];
	if (annotations.length === 0) return;
	await navigator.clipboard.writeText(formatAnnotationsPrompt(annotations));
	toast.success(`Copied ${plural$1(annotations.length, "comment")}`);
}
/** Puts one element's details on the clipboard, for pasting into any chat. */
async function copyElementContext(payload) {
	await navigator.clipboard.writeText(formatElementContext(payload));
	toast.success(`Copied ${elementLabel(payload.element)}`, { description: "Paste it into your agent to ask about it." });
}
//#endregion
//#region src/renderer/src/lib/browser/address.ts
/**
* Turning what the user typed in the browser tab's address bar into a URL to load.
*/
var SEARCH_URL = "https://duckduckgo.com/?q=";
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
var SCHEME = /^[a-z][a-z\d+.-]*:/i;
var LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost)$/i;
var PRIVATE_IP = /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(\.\d+)?$/;
/** The host part of `host[:port][/path]`, which is what a scheme-less address starts with. */
function hostOf(address) {
	const end = address.search(/[/?#]/);
	const authority = end === -1 ? address : address.slice(0, end);
	if (authority.startsWith("[")) return authority.slice(0, authority.indexOf("]") + 1);
	return authority.split(":")[0] ?? "";
}
/**
* The URL for an address bar entry, or null when there is nothing to load or the scheme isn't
* one a page may be loaded from. Local addresses go over http, other hosts over https, and
* anything that doesn't look like a host becomes a search.
*/
function normalizeAddress(input) {
	const text = input.trim();
	if (!text) return null;
	if (text === "about:blank") return text;
	if (SCHEME.test(text) && /^[a-z][a-z\d+.-]*:\/\//i.test(text)) try {
		const url = new URL(text);
		return ALLOWED_PROTOCOLS.has(url.protocol) ? localize(url).href : null;
	} catch {
		return null;
	}
	if (SCHEME.test(text) && !/^[\w.-]+:\d/.test(text) && !text.startsWith("[")) return null;
	if (/\s/.test(text)) return SEARCH_URL + encodeURIComponent(text);
	const host = hostOf(text);
	const local = LOCAL_HOST.test(host) || PRIVATE_IP.test(host);
	if (!local && !host.includes(".")) return SEARCH_URL + encodeURIComponent(text);
	try {
		return localize(new URL(`${local ? "http" : "https"}://${text}`)).href;
	} catch {
		return SEARCH_URL + encodeURIComponent(text);
	}
}
/** 0.0.0.0 is what dev servers bind to, but it isn't an address a browser should load. */
function localize(url) {
	if (url.hostname === "0.0.0.0") url.hostname = "localhost";
	return url;
}
/** Whether a URL points at this machine, which is where dev servers live. */
function isLocalUrl(url) {
	try {
		return LOCAL_HOST.test(new URL(url).hostname);
	} catch {
		return false;
	}
}
/** A URL as the address bar shows it when not being edited: no scheme, no lone trailing slash. */
function displayUrl(url) {
	const match = /^https?:\/\/(.*)$/i.exec(url);
	if (!match) return url;
	const rest = match[1] ?? "";
	return /^[^/]+\/$/.test(rest) ? rest.slice(0, -1) : rest;
}
//#endregion
//#region src/renderer/src/components/workspace/browser/BrowserStartPage.tsx
var import_jsx_runtime = require_jsx_runtime();
/**
* What a new browser tab shows before it has a page: an address field, the dev servers the
* workspace's terminals printed, and the addresses opened lately.
*/
function ServerButton({ server, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => onOpen(server.url),
		className: cn(GLASS_CARD, "group flex w-full items-center gap-3 px-3 py-2.5 text-left ring-1 ring-inset ring-transparent transition-shadow hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "relative flex h-2 w-2 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-primary" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate font-mono text-xs text-foreground",
					children: displayUrl(server.url)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-[11px] text-muted-foreground",
					children: server.terminalTitle
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
				tone: "primary",
				className: "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
				children: "Open"
			})
		]
	});
}
function BrowserStartPage({ servers, recent, onOpen }) {
	const offered = new Set(servers.map((server) => server.url));
	const pickKey = useShortcutLabel("workspace.pickElement");
	const others = recent.filter((url) => !offered.has(url)).slice(0, 5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full w-full justify-center overflow-y-auto px-6 py-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex w-full max-w-md flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center gap-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "h-5 w-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold tracking-tight text-foreground",
							children: "Open a page"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-muted-foreground",
							children: "Then pick any element on it to leave a comment for your agent."
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
					onSubmit: (event) => {
						event.preventDefault();
						const url = normalizeAddress(event.currentTarget.elements.namedItem("address").value);
						if (url) onOpen(url);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "address",
						"aria-label": "Open a page",
						autoFocus: true,
						spellCheck: false,
						autoComplete: "off",
						placeholder: "localhost:3000, a site, or a search",
						className: "field-surface h-10 w-full rounded-full px-4 text-sm outline-none"
					})
				}),
				servers.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: cn(SECTION_HEADING, "flex items-center gap-1.5 px-1"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Server, { className: "h-3 w-3" }), "Running in this workspace"]
					}), servers.map((server) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerButton, {
						server,
						onOpen
					}, server.url))]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
					size: "sm",
					icon: Server,
					className: "text-muted-foreground",
					children: "Start your dev server in a terminal of this workspace and its address shows up here."
				}),
				others.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: cn(SECTION_HEADING, "flex items-center gap-1.5 px-1 pb-0.5"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "h-3 w-3" }), "Recent"]
					}), others.map((url) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => onOpen(url),
						className: "truncate rounded-lg px-2.5 py-1.5 text-left font-mono text-xs text-foreground/80 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: displayUrl(url)
					}, url))]
				}) : null,
				pickKey ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquarePlus, { className: "h-3 w-3" }),
						"Comment on an element with",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
							className: "rounded-full bg-foreground/[0.07] px-2 py-0.5 font-sans text-[10px] font-medium",
							children: pickKey
						})
					]
				}) : null
			]
		})
	});
}
//#endregion
//#region src/renderer/src/components/workspace/browser/BrowserError.tsx
/** Shown over a browser tab whose page failed to load, in place of Chromium's own error page. */
/** net::ERR_CONNECTION_REFUSED: nothing is listening on that port. */
var CONNECTION_REFUSED = -102;
function portOf(url) {
	try {
		return new URL(url).port || null;
	} catch {
		return null;
	}
}
function BrowserError({ error, servers, onRetry, onOpen }) {
	const port = portOf(error.url);
	const devServerDown = error.code === CONNECTION_REFUSED && isLocalUrl(error.url) && port;
	const others = servers.filter((server) => server.url !== error.url);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-auto absolute inset-0 flex items-center justify-center overflow-y-auto bg-background px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex w-full max-w-sm flex-col items-center gap-4 text-center animate-in fade-in-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12 text-warning shadow-[0_0_40px_-12px_hsl(var(--warning)/0.7)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-5 w-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: devServerDown ? `Nothing is listening on port ${port}` : "This page could not be loaded"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-muted-foreground",
						children: devServerDown ? "Is the dev server running? Start it in a terminal, then try again." : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: error.description
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 truncate font-mono text-[10px] text-muted-foreground/70",
						children: error.url
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					onClick: onRetry,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, {}), "Try again"]
				}),
				devServerDown && others.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex w-full flex-col gap-2 pt-2 text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn(SECTION_HEADING, "px-1"),
						children: "Running in this workspace"
					}), others.map((server) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerButton, {
						server,
						onOpen
					}, server.url))]
				}) : null
			]
		})
	});
}
//#endregion
//#region src/renderer/src/components/workspace/browser/BrowserToolbar.tsx
var PRESET_ICON = {
	responsive: Expand,
	mobile: Smartphone,
	tablet: Tablet,
	desktop: Monitor
};
function ToolButton({ label, onClick, disabled, pressed, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "ghost",
			size: "icon-sm",
			"aria-label": label,
			"aria-pressed": pressed,
			disabled,
			onClick,
			className: cn("relative shrink-0", pressed && "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] hover:bg-primary/20 hover:text-primary", className),
			children
		})
	});
}
function AddressBar({ url, focusToken, onNavigate }) {
	const inputRef = (0, import_react.useRef)(null);
	const [draft, setDraft] = (0, import_react.useState)(null);
	const editing = draft !== null;
	(0, import_react.useEffect)(() => {
		if (focusToken === 0) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [focusToken]);
	let secure = null;
	if (url.startsWith("https:")) secure = "https";
	else if (url.startsWith("http:")) secure = isLocalUrl(url) ? "local" : "insecure";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "search-pill flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full px-3 transition-colors",
		children: [
			secure === "https" && !editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: "Secure connection",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-2.5 w-2.5 shrink-0 text-muted-foreground" })
			}) : null,
			secure === "insecure" && !editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
				tone: "warning",
				className: "h-[1.125rem] px-1.5 text-[10px]",
				children: "Not secure"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: inputRef,
				"aria-label": "Address",
				spellCheck: false,
				autoComplete: "off",
				placeholder: "Search or type an address",
				value: editing ? draft : displayUrl(url),
				onFocus: (event) => {
					setDraft(url);
					const input = event.currentTarget;
					requestAnimationFrame(() => input.select());
				},
				onBlur: () => setDraft(null),
				onChange: (event) => setDraft(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						setDraft(null);
						event.currentTarget.blur();
						return;
					}
					if (event.key !== "Enter") return;
					event.preventDefault();
					const next = normalizeAddress(event.currentTarget.value);
					if (!next) return;
					onNavigate(next);
					setDraft(null);
					event.currentTarget.blur();
				},
				className: cn("h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70", editing ? "text-foreground" : "text-foreground/85")
			})
		]
	});
}
function BrowserToolbar({ nav, viewport, picking, commentCount, focusAddressToken, onNavigate, onBack, onForward, onReload, onStop, onPick, onViewport, onDevTools, onOpenExternal, onCopyUrl }) {
	const hasPage = nav.url !== "";
	const preset = viewportPreset(viewport);
	const PresetIcon = PRESET_ICON[preset.id];
	const pickKey = useShortcutLabel("workspace.pickElement");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex h-10 shrink-0 items-center gap-1 px-1.5 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolButton, {
				label: "Back",
				onClick: onBack,
				disabled: !nav.canGoBack,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-3 w-3" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolButton, {
				label: "Forward",
				onClick: onForward,
				disabled: !nav.canGoForward,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "h-3 w-3" })
			}),
			nav.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolButton, {
				label: "Stop loading",
				onClick: onStop,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolButton, {
				label: "Reload",
				onClick: () => onReload(false),
				disabled: !hasPage,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "h-3 w-3" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddressBar, {
				url: nav.url,
				focusToken: focusAddressToken,
				onNavigate
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-0.5 pl-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolButton, {
					label: "Pick an element to copy its details",
					onClick: () => onPick("copy"),
					disabled: !hasPage,
					pressed: picking === "copy",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "h-3.5 w-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ToolButton, {
					label: `Comment on an element for your agent${pickKey ? ` (${pickKey})` : ""}`,
					onClick: () => onPick("comment"),
					disabled: !hasPage,
					pressed: picking === "comment",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquarePlus, { className: "h-3.5 w-3.5" }), commentCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-primary-foreground",
						children: commentCount
					}) : null]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-hidden": true,
				className: "mx-0.5 h-4 w-px bg-foreground/10"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: `Device size: ${preset.label}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-sm",
						"aria-label": `Device size: ${preset.label}`,
						className: cn("data-[state=open]:bg-foreground/10", preset.id !== "responsive" && "text-primary"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresetIcon, { className: "h-3 w-3" })
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
				align: "end",
				className: "w-52",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Device size" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuRadioGroup, {
					value: preset.id,
					onValueChange: (value) => onViewport(value),
					children: VIEWPORT_PRESETS.map((option) => {
						const Icon = PRESET_ICON[option.id];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuRadioItem, {
							value: option.id,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-3 w-3 text-muted-foreground" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: option.label }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-auto font-mono text-[10px] text-muted-foreground",
									children: option.width ? `${option.width}×${option.height}` : "fill"
								})
							]
						}, option.id);
					})
				})]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: "More",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon-sm",
						"aria-label": "More",
						className: "data-[state=open]:bg-foreground/10",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EllipsisVertical, { className: "h-3 w-3" })
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
				align: "end",
				className: "w-56",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						disabled: !hasPage,
						onSelect: onDevTools,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bug, { className: "h-3.5 w-3.5 text-muted-foreground" }),
							"Open DevTools",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuShortcut, { children: "F12" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						disabled: !hasPage,
						onSelect: () => onReload(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "h-3.5 w-3.5 text-muted-foreground" }), "Reload without cache"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						disabled: !hasPage,
						onSelect: onOpenExternal,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5 text-muted-foreground" }), "Open in system browser"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
						disabled: !hasPage,
						onSelect: onCopyUrl,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5 text-muted-foreground" }), "Copy address"]
					})
				]
			})] }),
			nav.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "progressbar",
				"aria-label": "Loading page",
				className: "browser-progress pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden"
			}) : null
		]
	});
}
//#endregion
//#region src/renderer/src/components/workspace/browser/CommentComposer.tsx
var INTENTS = [
	{
		id: "change",
		label: "Change",
		hint: "Ask the agent to change this element",
		placeholder: "What should change here?"
	},
	{
		id: "fix",
		label: "Fix",
		hint: "Something is broken here",
		placeholder: "What is wrong here?"
	},
	{
		id: "question",
		label: "Ask",
		hint: "A question, answered without touching the code",
		placeholder: "What do you want to know about it?"
	}
];
var MOD = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl";
function CommentComposer({ label, selector, thumbDataUrl, sendLabel, initial, onAdd, onSend, onCancel }) {
	const [comment, setComment] = (0, import_react.useState)(initial?.comment ?? "");
	const [intent, setIntent] = (0, import_react.useState)(initial?.intent ?? "change");
	const ready = comment.trim().length > 0;
	const draft = () => ({
		comment: comment.trim(),
		intent
	});
	const current = INTENTS.find((one) => one.id === intent) ?? INTENTS[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex w-[21rem] flex-col gap-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-inset ring-foreground/10 bg-[repeating-conic-gradient(hsl(var(--foreground)/0.06)_0_25%,transparent_0_50%)] bg-[length:8px_8px]",
					children: thumbDataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: thumbDataUrl,
						alt: "Screenshot of the element",
						className: "max-h-full max-w-full object-contain"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
						"data-testid": "comment-thumb-loading",
						className: "h-full w-full rounded-none"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-xs font-semibold text-foreground",
						children: label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate font-mono text-[10px] text-muted-foreground",
						children: selector
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "radiogroup",
				"aria-label": "Kind of comment",
				className: cn(SEGMENT_TRACK, "grid grid-cols-3"),
				children: INTENTS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: option.hint,
					delayDuration: 500,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "radio",
						"aria-checked": intent === option.id,
						onClick: () => setIntent(option.id),
						className: segmentClass(intent === option.id),
						children: option.label
					})
				}, option.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				autoFocus: true,
				"aria-label": "Comment",
				value: comment,
				rows: 3,
				placeholder: current?.placeholder,
				onChange: (event) => setComment(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						onCancel();
						return;
					}
					if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
					event.preventDefault();
					if (!ready) return;
					if (event.shiftKey) onSend(draft());
					else onAdd(draft());
				},
				className: "min-h-[4.5rem] resize-none text-[13px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mr-auto text-[10px] text-muted-foreground/80",
						children: [MOD, "+Enter to add"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: onCancel,
						children: "Cancel"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: `Add and send all comments (${MOD}+Shift+Enter)`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "soft",
							size: "sm",
							className: "[&_svg]:size-3",
							disabled: !ready,
							"aria-label": sendLabel,
							onClick: () => onSend(draft()),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {}), "Send"]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: !ready,
						"aria-label": "Add comment",
						onClick: () => onAdd(draft()),
						children: "Add"
					})
				]
			})
		]
	});
}
//#endregion
//#region src/renderer/src/components/workspace/browser/CommentTray.tsx
var INTENT_CHIP = {
	change: null,
	fix: {
		label: "Fix",
		tone: "destructive"
	},
	question: {
		label: "Ask",
		tone: "primary"
	}
};
function pagePath(url) {
	try {
		const parsed = new URL(url);
		return parsed.pathname + (parsed.hash.startsWith("#/") ? parsed.hash : "");
	} catch {
		return url;
	}
}
function samePage(a, b) {
	const strip = (url) => url.includes("#/") ? url : url.replace(/#.*$/, "");
	return strip(a) === strip(b);
}
function plural(count) {
	return `${count} comment${count === 1 ? "" : "s"}`;
}
function TrayIconButton({ label, onClick, children, tone = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: "ghost",
			size: "icon-xs",
			"aria-label": label,
			onClick,
			className: cn(tone === "danger" && "hover:bg-destructive/15 hover:text-destructive"),
			children
		})
	});
}
function Row({ annotation, n, elsewhere, onEdit, onRemove, onHover, onReveal }) {
	const [editing, setEditing] = (0, import_react.useState)(false);
	const chip = INTENT_CHIP[annotation.intent];
	const label = elementLabel(annotation.element);
	const save = (value) => {
		setEditing(false);
		const next = value.trim();
		if (next && next !== annotation.comment) onEdit(next);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		onMouseEnter: () => onHover(true),
		onMouseLeave: () => onHover(false),
		className: cn("group relative flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-foreground/[0.05]", elsewhere && "opacity-60 hover:opacity-100"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.5)]",
				children: n
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
							label: annotation.thumbDataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: annotation.thumbDataUrl,
								alt: "",
								className: "max-h-40 max-w-56 rounded-md ring-1 ring-foreground/10"
							}) : null,
							side: "left",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 truncate text-[11px] text-muted-foreground",
								children: label
							})
						}), chip ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
							tone: chip.tone,
							className: "h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide",
							children: chip.label
						}) : null]
					}),
					editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						autoFocus: true,
						"aria-label": `Edit comment ${n}`,
						defaultValue: annotation.comment,
						rows: 2,
						onBlur: (event) => save(event.currentTarget.value),
						onKeyDown: (event) => {
							event.stopPropagation();
							if (event.key === "Escape") setEditing(false);
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								save(event.currentTarget.value);
							}
						},
						className: "field-surface mt-0.5 w-full resize-none rounded-md px-1.5 py-1 text-xs outline-none"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onReveal,
						className: "block w-full text-left text-xs leading-snug text-foreground line-clamp-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm",
						children: annotation.comment
					}),
					elsewhere ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 truncate font-mono text-[10px] text-muted-foreground",
						children: ["on ", pagePath(annotation.page.url)]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrayIconButton, {
					label: `Edit comment ${n}`,
					onClick: () => setEditing(true),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-2.5 w-2.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrayIconButton, {
					label: `Delete comment ${n}`,
					tone: "danger",
					onClick: onRemove,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-2.5 w-2.5" })
				})]
			})
		]
	});
}
function CommentTray({ annotations, currentUrl, targets, onSend, onCopy, onClear, onEdit, onRemove, onHover, onReveal }) {
	const [collapsed, setCollapsed] = (0, import_react.useState)(false);
	if (annotations.length === 0) return null;
	const count = plural(annotations.length);
	if (collapsed) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		variant: "ghost",
		onClick: () => setCollapsed(false),
		className: cn(OVERLAY_SURFACE, "pointer-events-auto absolute bottom-3 right-3 h-8 gap-2 rounded-full! pl-1.5 pr-3 text-xs text-foreground animate-in fade-in-0 slide-in-from-bottom-1"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.5)]",
			children: annotations.length
		}), count]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Page comments",
		className: cn(OVERLAY_SURFACE, "pointer-events-auto absolute bottom-3 right-3 flex max-h-[55%] w-[min(21rem,calc(100%-1.5rem))] flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "h-3 w-3 text-primary" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mr-auto text-xs font-semibold",
						children: count
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrayIconButton, {
						label: "Copy comments",
						onClick: onCopy,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3 w-3" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrayIconButton, {
						label: "Clear comments",
						tone: "danger",
						onClick: onClear,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3 w-3" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrayIconButton, {
						label: "Hide comments",
						onClick: () => setCollapsed(true),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				"aria-label": "Comments",
				className: "min-h-0 flex-1 overflow-y-auto p-1",
				children: annotations.map((annotation, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					annotation,
					n: index + 1,
					elsewhere: !samePage(annotation.page.url, currentUrl),
					onEdit: (comment) => onEdit(annotation.id, comment),
					onRemove: () => onRemove(annotation.id),
					onHover: (hovering) => onHover(hovering ? annotation.id : null),
					onReveal: () => onReveal(annotation)
				}, annotation.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: cn(FOOTER_HAIRLINE, "flex items-center gap-2 p-2"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => onSend(void 0),
						"aria-label": `Send to ${targets.defaultLabel}`,
						className: "min-w-0 flex-1 gap-1.5 rounded-r-none px-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-3 w-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "truncate",
							children: ["Send to ", targets.defaultLabel]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							"aria-label": "Choose where to send",
							className: "w-8 rounded-l-none px-0 shadow-[inset_1px_0_0_hsl(var(--primary-foreground)/0.25)] data-[state=open]:brightness-110",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3 w-3" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
						align: "end",
						side: "top",
						className: "w-60",
						children: [
							targets.running.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Running in this workspace" }),
								targets.running.map((target) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
									onSelect: () => onSend({ tabId: target.tabId }),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CliLogo, {
											cliId: target.cliId,
											className: "h-3.5 w-3.5"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: target.label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
											tone: "primary",
											dot: true,
											className: "ml-auto",
											children: "running"
										})
									]
								}, target.tabId)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {})
							] }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Start a new tab" }),
							targets.newTabs.map((cli) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
								onSelect: () => onSend({ newCliId: cli.cliId }),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CliLogo, {
									cliId: cli.cliId,
									className: "h-3.5 w-3.5"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "truncate",
									children: [
										"New ",
										cli.name,
										" tab"
									]
								})]
							}, cli.cliId))
						]
					})] })]
				})
			})
		]
	});
}
//#endregion
//#region src/renderer/src/lib/browser/pickerMachine.ts
var IDLE = { mode: "idle" };
var COMMENTING = {
	mode: "picking",
	intent: "comment"
};
function pickerReducer(state, event) {
	switch (event.type) {
		case "START":
			if (state.mode === "picking" && state.intent === event.intent) return IDLE;
			return {
				mode: "picking",
				intent: event.intent
			};
		case "PICKED":
			if (state.mode !== "picking") return state;
			if (event.copy || state.intent === "copy") return state;
			return {
				mode: "composing",
				payload: event.payload
			};
		case "ADDED":
		case "CANCEL": return state.mode === "composing" ? COMMENTING : state.mode === "picking" ? IDLE : state;
		case "ESC":
			if (state.mode === "composing") return COMMENTING;
			return IDLE;
		case "NAVIGATED": return state.mode === "composing" ? COMMENTING : state;
		case "SENT":
		case "STOP": return IDLE;
	}
}
//#endregion
//#region src/renderer/src/components/workspace/browser/usePagePicker.ts
/**
* Drives the in-page picker of one browser tab: arms it, waits for picks, copies or opens the
* comment card, takes the element's screenshot, and keeps the numbered pins on the page in step
* with the tab's comments. The flow itself is the pure reducer in pickerMachine.ts.
*/
var NO_ANNOTATIONS$1 = [];
/** How long Send waits for a screenshot still on its way, so the prompt can name it. */
var SHOT_WAIT_MS = 2500;
function noop() {}
function isTyping(target) {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
function usePagePicker({ project, tabId, url, preset }) {
	const [state, dispatch] = (0, import_react.useReducer)(pickerReducer, IDLE);
	const [documentId, setDocumentId] = (0, import_react.useState)(0);
	const [shot, setShot] = (0, import_react.useState)(null);
	const shotRef = (0, import_react.useRef)(null);
	const call = (0, import_react.useCallback)((expression) => browserRuntime.picker(tabId, expression), [tabId]);
	(0, import_react.useEffect)(() => browserRuntime.onDocumentReady(tabId, () => {
		setDocumentId((id) => id + 1);
		dispatch({ type: "NAVIGATED" });
	}), [tabId]);
	const picking = state.mode === "picking" ? state.intent : null;
	(0, import_react.useEffect)(() => {
		if (!picking) return;
		let live = true;
		const run = async () => {
			await call("arm()");
			while (live) {
				const result = await call("awaitPick()");
				if (!live) return;
				if (!result || result.kind === "cancel") {
					dispatch({ type: "ESC" });
					return;
				}
				if (result.kind === "copy" || picking === "copy") {
					copyElementContext(result.payload);
					continue;
				}
				dispatch({
					type: "PICKED",
					payload: result.payload,
					copy: false
				});
				return;
			}
		};
		run().catch(() => {
			if (live) dispatch({ type: "STOP" });
		});
		return () => {
			live = false;
		};
	}, [
		picking,
		call,
		documentId
	]);
	const active = state.mode !== "idle";
	const activeRef = (0, import_react.useRef)(active);
	(0, import_react.useEffect)(() => {
		const was = activeRef.current;
		activeRef.current = active;
		if (was && !active) call("disarm()").catch(noop);
	}, [active, call]);
	(0, import_react.useEffect)(() => () => {
		if (activeRef.current) browserRuntime.picker(tabId, "disarm()").catch(noop);
	}, [tabId]);
	const payload = state.mode === "composing" ? state.payload : null;
	(0, import_react.useEffect)(() => {
		if (!payload) return;
		setShot(null);
		const webContentsId = browserRuntime.state(tabId).webContentsId;
		const capture = async () => {
			await call("freeze()");
			if (webContentsId === null) return null;
			await call("setChromeHidden(true)");
			try {
				return await window.agentmat.browser.captureElement(webContentsId, payload.element.rectViewport, payload.page.viewport);
			} catch {
				return null;
			} finally {
				await call("setChromeHidden(false)").catch(noop);
			}
		};
		const promise = capture().catch(() => null);
		shotRef.current = promise;
		let live = true;
		promise.then((result) => {
			if (live) setShot(result);
		});
		return () => {
			live = false;
		};
	}, [
		payload,
		tabId,
		call
	]);
	const annotations = useBrowserStore((s) => s.annotations[tabId]) ?? NO_ANNOTATIONS$1;
	const markers = (0, import_react.useMemo)(() => markersFor(annotations, url), [annotations, url]);
	const hadMarkers = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (markers.length === 0 && !hadMarkers.current) return;
		hadMarkers.current = markers.length > 0;
		call(`setMarkers(${JSON.stringify(markers)})`).catch(noop);
	}, [
		markers,
		call,
		documentId
	]);
	(0, import_react.useEffect)(() => {
		if (state.mode !== "picking") return;
		const onKey = (event) => {
			if (event.key !== "Escape" || isTyping(event.target)) return;
			dispatch({ type: "ESC" });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state.mode]);
	const add = (draft) => {
		if (state.mode !== "composing") return null;
		const { page, element } = state.payload;
		const id = useBrowserStore.getState().addAnnotation({
			tabId,
			page,
			element,
			comment: draft.comment,
			intent: draft.intent,
			preset,
			screenshotPath: shot?.path ?? null,
			thumbDataUrl: shot?.thumbDataUrl ?? null
		});
		if (!id) {
			toast.error(`A tab holds up to 20 comments`, { description: "Send or clear the ones you have first." });
			return null;
		}
		if (!shot) shotRef.current?.then((late) => {
			if (late) useBrowserStore.getState().updateAnnotation(tabId, id, {
				screenshotPath: late.path,
				thumbDataUrl: late.thumbDataUrl
			});
		});
		dispatch({ type: "ADDED" });
		browserRuntime.focus(tabId);
		return id;
	};
	return {
		state,
		shot,
		start: (intent) => dispatch({
			type: "START",
			intent
		}),
		stop: () => dispatch({ type: "STOP" }),
		cancelCard: () => {
			dispatch({ type: "CANCEL" });
			browserRuntime.focus(tabId);
		},
		add,
		/** Adds the comment, then sends every comment of the tab. */
		sendNow: async (draft) => {
			const pending = shotRef.current;
			if (!add(draft)) return;
			dispatch({ type: "SENT" });
			await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, SHOT_WAIT_MS))]);
			await sendAnnotations(project, tabId);
		},
		flash: (id) => {
			if (id) call(`flashMarker(${JSON.stringify(id)})`).catch(noop);
		},
		reveal: (id) => {
			call(`reveal(${JSON.stringify(id)})`).catch(noop);
		}
	};
}
//#endregion
//#region src/renderer/src/components/workspace/browser/BrowserTab.tsx
/**
* A workspace tab showing a web page, usually the project's dev server, where elements can be
* picked and commented on for the agent. The page itself lives in the browser runtime's layer
* and is laid over this tab's body (see browserRuntime.ts); what sits over the page, the comment
* tray and the picking hint, is portaled into the layer above it.
*/
var NO_ANNOTATIONS = [];
function cliName(cliId) {
	return cliId ? getCliDefinition(cliId)?.name ?? cliId : null;
}
/** The dev servers printed by terminals of this workspace. */
function useWorkspaceServers(projectId) {
	const servers = useDevServerStore((s) => s.servers);
	const tabs = useWorkspaceStore((s) => s.workspaces[projectId]?.tabs);
	const terminals = Object.values(tabs ?? {}).flatMap((tab) => tab.kind === "terminal" ? [{
		id: tab.id,
		title: terminalTabLabel(tab)
	}] : []);
	return detectedServersFor(servers, terminals);
}
function useSendTargets(project) {
	useWorkspaceStore((s) => s.workspaces[project.id]?.tabs);
	useTerminalSessionStore((s) => s.ended);
	const agents = useAgentChoices(project);
	const running = listAgentTerminals(project.id).map((tab) => ({
		tabId: tab.id,
		cliId: tab.cliId ?? "",
		label: terminalTabLabel(tab)
	}));
	return {
		defaultLabel: cliName(running[0]?.cliId) ?? cliName(projectCliId(project)) ?? "your agent",
		running,
		newTabs: agents.installed.map((choice) => ({
			cliId: choice.cli.id,
			name: choice.cli.name
		}))
	};
}
function PickingHint({ intent }) {
	const Icon = intent === "copy" ? Crosshair : MessageSquarePlus;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(OVERLAY_SURFACE, "flex items-center gap-2 rounded-full! py-1 pl-2.5 pr-3 text-[11px] text-foreground animate-in fade-in-0 slide-in-from-top-1"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-3 w-3 text-primary" }), intent === "copy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Click an element to copy its details · Esc to stop" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Click an element to comment · Right-click to copy · Esc to stop" })]
		})
	});
}
function BrowserTabBody({ project, tab }) {
	const setBrowserPage = useWorkspaceStore((s) => s.setBrowserPage);
	const setBrowserViewport = useWorkspaceStore((s) => s.setBrowserViewport);
	const hasPage = tab.url !== "";
	const slotRef = (0, import_react.useRef)(null);
	const [overlay, setOverlay] = (0, import_react.useState)(null);
	const [focusAddressToken, setFocusAddressToken] = (0, import_react.useState)(0);
	(0, import_react.useLayoutEffect)(() => {
		if (!hasPage) {
			setOverlay(null);
			return;
		}
		browserRuntime.ensure(tab.id, tab.url);
		setOverlay(browserRuntime.overlay(tab.id));
	}, [hasPage, tab.id]);
	(0, import_react.useLayoutEffect)(() => {
		const slot = slotRef.current;
		if (!hasPage || !slot) return;
		return browserRuntime.attach(tab.id, slot);
	}, [hasPage, tab.id]);
	(0, import_react.useEffect)(() => {
		if (hasPage) browserRuntime.setViewport(tab.id, tab.viewport);
	}, [
		hasPage,
		tab.id,
		tab.viewport
	]);
	const nav = (0, import_react.useSyncExternalStore)((listener) => browserRuntime.subscribe(tab.id, listener), () => browserRuntime.state(tab.id));
	const pageUrl = nav.url || tab.url;
	const preset = viewportPreset(tab.viewport);
	const picker = usePagePicker({
		project,
		tabId: tab.id,
		url: pageUrl,
		preset: preset.id === "responsive" ? null : preset.label
	});
	const annotations = useBrowserStore((s) => s.annotations[tab.id]) ?? NO_ANNOTATIONS;
	const servers = useWorkspaceServers(project.id);
	const recent = useBrowserStore((s) => s.recentUrls[project.id]) ?? NO_ANNOTATIONS_URLS;
	const targets = useSendTargets(project);
	const open = (url) => {
		if (hasPage) browserRuntime.navigate(tab.id, url);
		else setBrowserPage(project.id, tab.id, {
			url,
			title: "",
			faviconUrl: null
		});
	};
	(0, import_react.useEffect)(() => onBrowserShortcut(tab.id, (shortcut) => {
		if (shortcut === "pick") picker.start("comment");
		else if (shortcut === "focusAddress") setFocusAddressToken((n) => n + 1);
		else if (shortcut === "reload") browserRuntime.reload(tab.id, false);
		else if (shortcut === "hardReload") browserRuntime.reload(tab.id, true);
		else if (shortcut === "back") browserRuntime.back(tab.id);
		else if (shortcut === "forward") browserRuntime.forward(tab.id);
		else if (shortcut === "devtools") browserRuntime.openDevTools(tab.id);
	}), [tab.id, picker.start]);
	const clear = async () => {
		if (annotations.length > 2) {
			if (!await confirmDialog({
				title: `Clear ${annotations.length} comments?`,
				description: "They have not been sent to an agent yet.",
				confirmLabel: "Clear",
				variant: "destructive"
			})) return;
		}
		useBrowserStore.getState().clearTab(tab.id);
	};
	const composing = picker.state.mode === "composing" ? picker.state.payload : null;
	const frame = browserRuntime.frame(tab.id);
	const anchor = composing?.element.rectViewport;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		onKeyDownCapture: (event) => {
			if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "l") {
				event.preventDefault();
				setFocusAddressToken((n) => n + 1);
			}
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowserToolbar, {
				nav: {
					...nav,
					url: pageUrl
				},
				viewport: tab.viewport,
				picking: picker.state.mode === "picking" ? picker.state.intent : composing ? "comment" : null,
				commentCount: annotations.length,
				focusAddressToken,
				onNavigate: open,
				onBack: () => browserRuntime.back(tab.id),
				onForward: () => browserRuntime.forward(tab.id),
				onReload: (hard) => browserRuntime.reload(tab.id, hard),
				onStop: () => browserRuntime.stop(tab.id),
				onPick: picker.start,
				onViewport: (viewport) => setBrowserViewport(project.id, tab.id, viewport),
				onDevTools: () => browserRuntime.openDevTools(tab.id),
				onOpenExternal: () => void window.agentmat.shell.openExternal(pageUrl),
				onCopyUrl: () => {
					navigator.clipboard.writeText(pageUrl);
					toast.success("Address copied");
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative min-h-0 flex-1 bg-[repeating-linear-gradient(135deg,hsl(var(--foreground)/0.025)_0_10px,transparent_10px_20px)]",
				children: hasPage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: slotRef,
					"data-browser-slot": tab.id,
					className: "absolute inset-0"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowserStartPage, {
					servers,
					recent,
					onOpen: open
				})
			}),
			overlay ? (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				nav.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowserError, {
					error: nav.error,
					servers,
					onRetry: () => browserRuntime.reload(tab.id, false),
					onOpen: open
				}) : null,
				picker.state.mode === "picking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickingHint, { intent: picker.state.intent }) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
					open: !!composing,
					children: [anchor ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverAnchor, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-none absolute",
							style: {
								left: frame.left + anchor.x * frame.scale,
								top: frame.top + anchor.y * frame.scale,
								width: Math.max(1, anchor.width * frame.scale),
								height: Math.max(1, anchor.height * frame.scale)
							}
						})
					}) : null, composing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContent, {
						side: "bottom",
						align: "start",
						sideOffset: 10,
						className: "w-auto p-3",
						onOpenAutoFocus: (event) => event.preventDefault(),
						onEscapeKeyDown: (event) => {
							event.preventDefault();
							picker.cancelCard();
						},
						onInteractOutside: (event) => event.preventDefault(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommentComposer, {
							label: elementLabel(composing.element),
							selector: composing.element.selector,
							thumbDataUrl: picker.shot?.thumbDataUrl ?? null,
							sendLabel: `Send to ${targets.defaultLabel}`,
							onAdd: picker.add,
							onSend: (draft) => void picker.sendNow(draft),
							onCancel: picker.cancelCard
						})
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommentTray, {
					annotations,
					currentUrl: pageUrl,
					targets,
					onSend: (target) => {
						picker.stop();
						sendAnnotations(project, tab.id, target);
					},
					onCopy: () => void copyAnnotations(tab.id),
					onClear: () => void clear(),
					onEdit: (id, comment) => useBrowserStore.getState().updateAnnotation(tab.id, id, { comment }),
					onRemove: (id) => useBrowserStore.getState().removeAnnotation(tab.id, id),
					onHover: picker.flash,
					onReveal: (annotation) => {
						if (annotation.page.url.replace(/#(?!\/).*$/, "") === pageUrl.replace(/#(?!\/).*$/, "")) picker.reveal(annotation.id);
						else browserRuntime.navigate(tab.id, annotation.page.url);
					}
				})
			] }), overlay) : null
		]
	});
}
var NO_ANNOTATIONS_URLS = [];
function BrowserTab({ project, tabId }) {
	const tab = useWorkspaceStore((s) => s.workspaces[project.id]?.tabs[tabId]);
	if (tab?.kind !== "browser") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowserTabBody, {
		project,
		tab
	});
}
//#endregion
export { BrowserTab as default };
