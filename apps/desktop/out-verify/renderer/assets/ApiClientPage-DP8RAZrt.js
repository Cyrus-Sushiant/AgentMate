import { Ar as X, At as EllipsisVertical, Br as __toESM, Cr as Wand2, F as Button, Fr as require_jsx_runtime, Gt as FolderPlus, Ht as Folder, I as cn, In as Plus, Jn as Search, Kt as FolderTree, Lr as require_react, Mn as Pencil, Pr as toast, Rt as FilePlus, S as create, St as CollapseAll, Wt as FolderOpen, Yn as Send, _ as SECTION_HEADING, f as persist, gt as CircleX, hr as TriangleAlert, lt as ChevronDown, mr as Trash2, or as StopCircle, pt as CircleCheck, qn as Save, t as SimpleTooltip, ut as ChevronRight, wt as Copy } from "./tooltip-BbU-D7og.js";
import { n as useQuery, p as useQueryClient, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { r as Input } from "./input-yQ7bc-An.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as Label } from "./label-D49cSr88.js";
import { t as confirmDialog } from "./confirmStore-BkKLridc.js";
import "./dist-BskwpHU1.js";
import { C as Skeleton, E as LayoutGroup, T as motion, w as useReducedMotion, x as ResizeHandle } from "./pageKit-dgpHZ_9P.js";
import { n as Textarea } from "./textarea-DVv9L3Er.js";
import { t as Checkbox } from "./checkbox-BFTqb7ac.js";
import { c as DropdownMenuSeparator, i as DropdownMenuItem, r as DropdownMenuContent, t as DropdownMenu, u as DropdownMenuTrigger } from "./dropdown-menu-qNy198IJ.js";
import { t as MonacoEditor } from "./MonacoEditor-6KQEKFS9.js";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CUlAg839.js";
import { t as usePageHeader } from "./pageHeaderStore-DyBygWgT.js";
//#region ../../packages/core/dist/apiClient/collectionTree.js
/**
* Tree operations on a collection. They never change the collection they are given: each one
* returns a new collection, so main can apply them to what it loaded from disk and the renderer
* can apply the same ones optimistically.
*/
function isFolder(item) {
	return Array.isArray(item.item);
}
function isRequestItem(item) {
	return !isFolder(item);
}
function walkItems(items, visit, depth = 0) {
	for (const item of items) {
		visit(item, depth);
		if (isFolder(item)) walkItems(item.item, visit, depth + 1);
	}
}
function findItem(collection, id) {
	let found = null;
	walkItems(collection.item, (item) => {
		if (!found && item.id === id) found = item;
	});
	return found;
}
//#endregion
//#region ../../packages/core/dist/apiClient/types.js
var HTTP_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS"
];
//#endregion
//#region ../../packages/core/dist/apiClient/url.js
function newId$1() {
	return globalThis.crypto.randomUUID();
}
/** Splits `url` into the part before the query, the query text and the fragment (with its #). */
function splitUrl(url) {
	const hashAt = url.indexOf("#");
	const hash = hashAt >= 0 ? url.slice(hashAt) : "";
	const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
	const queryAt = beforeHash.indexOf("?");
	if (queryAt < 0) return {
		base: beforeHash,
		query: null,
		hash
	};
	return {
		base: beforeHash.slice(0, queryAt),
		query: beforeHash.slice(queryAt + 1),
		hash
	};
}
/**
* Reads the query string as the user typed it. Nothing is decoded, so `{{var}}` and `%20` come
* back exactly the same and the URL bar never rewrites what was typed.
*/
function parseQuery(url) {
	const { query } = splitUrl(url);
	if (!query) return [];
	const pairs = [];
	for (const piece of query.split("&")) {
		if (!piece) continue;
		const equals = piece.indexOf("=");
		pairs.push(equals < 0 ? {
			key: piece,
			value: ""
		} : {
			key: piece.slice(0, equals),
			value: piece.slice(equals + 1)
		});
	}
	return pairs;
}
/** Writes the enabled rows as the query of `url`, keeping the base and the fragment. */
function replaceQuery(url, params) {
	const { base, hash } = splitUrl(url);
	const query = params.filter((p) => p.enabled && (p.key !== "" || p.value !== "")).map((p) => p.value === "" ? p.key : `${p.key}=${p.value}`).join("&");
	return `${base}${query ? `?${query}` : ""}${hash}`;
}
/**
* Brings the Params table in line with an edited URL. Enabled rows are rewritten in order from
* the URL's pairs, so a row keeps its id and description while its value changes; disabled rows
* stay where they are; extra pairs become new rows.
*/
function syncParamsFromUrl(url, previous) {
	const pairs = parseQuery(url);
	const next = [];
	let used = 0;
	for (const row of previous) {
		if (!row.enabled) {
			next.push(row);
			continue;
		}
		const pair = pairs[used];
		if (!pair) continue;
		used++;
		next.push({
			...row,
			key: pair.key,
			value: pair.value
		});
	}
	for (const pair of pairs.slice(used)) next.push({
		id: newId$1(),
		key: pair.key,
		value: pair.value,
		enabled: true,
		description: ""
	});
	return next;
}
/**
* Breaks a raw URL into Postman's parts. Hosts that are a variable stay one piece, `:name` path
* segments become path variables, and a trailing slash leaves an empty last segment the way
* Postman records it.
*/
function parseRawUrl(raw) {
	if (!raw) return { raw: "" };
	const result = { raw };
	const { base, hash } = splitUrl(raw);
	let rest = base;
	const protocol = /^([a-z][a-z0-9+.-]*):\/\//i.exec(rest);
	if (protocol) {
		result.protocol = protocol[1];
		rest = rest.slice(protocol[0].length);
	}
	const slash = rest.indexOf("/");
	let hostPart = slash >= 0 ? rest.slice(0, slash) : rest;
	const pathPart = slash >= 0 ? rest.slice(slash + 1) : null;
	const port = /:(\d+|\{\{[^}]+\}\})$/.exec(hostPart);
	if (port) {
		result.port = port[1];
		hostPart = hostPart.slice(0, -port[0].length);
	}
	if (hostPart) result.host = /^\{\{[^}]+\}\}$/.test(hostPart) ? [hostPart] : hostPart.split(".");
	if (pathPart !== null) {
		result.path = pathPart.split("/");
		const variables = result.path.filter((segment) => /^:[^/:]+$/.test(segment)).map((segment) => ({
			key: segment.slice(1),
			value: ""
		}));
		if (variables.length > 0) result.variable = variables;
	}
	const query = parseQuery(raw);
	if (query.length > 0) result.query = query.map((pair) => ({ ...pair }));
	if (hash) result.hash = hash.slice(1);
	return result;
}
/** The URL as text. Uses `raw` when present, and otherwise rebuilds it from the parts. */
function buildRawUrl(url) {
	if (!url) return "";
	if (typeof url === "string") return url;
	if (typeof url.raw === "string") return url.raw;
	let text = url.protocol ? `${url.protocol}://` : "";
	text += (url.host ?? []).join(".");
	if (url.port) text += `:${url.port}`;
	if (url.path && url.path.length > 0) text += `/${url.path.join("/")}`;
	const query = (url.query ?? []).filter((q) => !q.disabled).map((q) => q.value ? `${q.key}=${q.value}` : q.key);
	if (query.length > 0) text += `?${query.join("&")}`;
	if (url.hash) text += `#${url.hash}`;
	return text;
}
//#endregion
//#region ../../packages/core/dist/apiClient/requestDraft.js
var RAW_LANGUAGES = [
	"json",
	"text",
	"xml",
	"html",
	"javascript"
];
function newId() {
	return globalThis.crypto.randomUUID();
}
function descriptionText(value) {
	if (typeof value === "string") return value;
	return value?.content ?? "";
}
function toRow(entry) {
	return {
		id: newId(),
		key: String(entry.key ?? ""),
		value: entry.value == null ? "" : String(entry.value),
		enabled: entry.disabled !== true,
		description: descriptionText(entry.description)
	};
}
/** Old exports sometimes keep headers as one "Key: value" block, with `//` for disabled lines. */
function parseHeaderBlock(block) {
	const rows = [];
	for (const line of block.split(/\r?\n/)) {
		const disabled = /^\s*\/\//.test(line);
		const text = line.replace(/^\s*\/\/\s*/, "");
		const colon = text.indexOf(":");
		if (colon <= 0) continue;
		rows.push({
			id: newId(),
			key: text.slice(0, colon).trim(),
			value: text.slice(colon + 1).trim(),
			enabled: !disabled,
			description: ""
		});
	}
	return rows;
}
function fromRow(row) {
	const entry = {
		key: row.key,
		value: row.value
	};
	if (!row.enabled) entry.disabled = true;
	if (row.description) entry.description = row.description;
	return entry;
}
function isBlank(row) {
	return row.key === "" && row.value === "" && row.description === "";
}
function isRawLanguage(value) {
	return typeof value === "string" && RAW_LANGUAGES.includes(value);
}
function emptyBody() {
	return {
		mode: "none",
		raw: "",
		language: "json",
		urlencoded: [],
		formdata: [],
		binaryPath: "",
		graphqlQuery: "",
		graphqlVariables: ""
	};
}
function emptyDraft() {
	return {
		method: "GET",
		url: "",
		params: [],
		pathVariables: [],
		headers: [],
		body: emptyBody(),
		auth: null,
		events: [],
		description: ""
	};
}
function bodyToDraft(body) {
	const draft = emptyBody();
	if (!body) return draft;
	draft.raw = body.raw ?? "";
	draft.language = isRawLanguage(body.options?.raw?.language) ? body.options.raw.language : "json";
	draft.urlencoded = (body.urlencoded ?? []).map(toRow);
	draft.formdata = (body.formdata ?? []).map((entry) => ({
		...toRow(entry),
		value: entry.type === "file" ? "" : entry.value == null ? "" : String(entry.value),
		kind: entry.type === "file" ? "file" : "text",
		files: entry.type === "file" ? (Array.isArray(entry.src) ? entry.src : entry.src ? [entry.src] : []).map(String) : []
	}));
	draft.binaryPath = body.file?.src ?? "";
	draft.graphqlQuery = body.graphql?.query ?? "";
	draft.graphqlVariables = body.graphql?.variables ?? "";
	switch (body.mode) {
		case "raw":
		case "urlencoded":
		case "formdata":
		case "graphql":
			draft.mode = body.mode;
			break;
		case "file":
			draft.mode = "binary";
			break;
		default: draft.mode = "none";
	}
	return draft;
}
function requestToDraft(request, events = []) {
	const url = request.url;
	const raw = buildRawUrl(url);
	const query = typeof url === "object" && url && Array.isArray(url.query) ? url.query : parseQuery(raw).map((pair) => ({ ...pair }));
	const pathVariables = syncPathVariables(raw, (typeof url === "object" && url && Array.isArray(url.variable) ? url.variable : []).map(toRow));
	return {
		method: (request.method || "GET").toUpperCase(),
		url: raw,
		params: query.map(toRow),
		pathVariables,
		headers: typeof request.header === "string" ? parseHeaderBlock(request.header) : (request.header ?? []).map(toRow),
		body: bodyToDraft(request.body),
		auth: request.auth ?? null,
		events,
		description: descriptionText(request.description)
	};
}
/** Path variables are the `:name` segments of the URL path, in order, with any typed values kept. */
function syncPathVariables(url, previous) {
	return (parseRawUrl(url).path ?? []).filter((s) => /^:[^/:]+$/.test(s)).map((s) => s.slice(1)).map((key) => {
		return previous.find((row) => row.key === key) ?? {
			id: newId(),
			key,
			value: "",
			enabled: true,
			description: ""
		};
	});
}
function draftBodyToPostman(body) {
	switch (body.mode) {
		case "raw": return {
			mode: "raw",
			raw: body.raw,
			options: { raw: { language: body.language } }
		};
		case "urlencoded": return {
			mode: "urlencoded",
			urlencoded: body.urlencoded.filter((r) => !isBlank(r)).map(fromRow)
		};
		case "formdata": return {
			mode: "formdata",
			formdata: body.formdata.filter((r) => !(isBlank(r) && r.files.length === 0)).map((row) => {
				const entry = row.kind === "file" ? {
					key: row.key,
					type: "file",
					src: row.files.length === 1 ? row.files[0] : row.files
				} : {
					key: row.key,
					value: row.value,
					type: "text"
				};
				if (!row.enabled) entry.disabled = true;
				if (row.description) entry.description = row.description;
				return entry;
			})
		};
		case "binary": return {
			mode: "file",
			file: { src: body.binaryPath }
		};
		case "graphql": return {
			mode: "graphql",
			graphql: {
				query: body.graphqlQuery,
				variables: body.graphqlVariables
			}
		};
		default: return;
	}
}
/**
* Converts the draft back to a v2.1 request. `base` is the request the draft was opened from;
* fields the editor does not show (a request-level proxy, certificates, and so on) are kept.
*/
function draftToRequest(draft, base = {}) {
	const url = parseRawUrl(draft.url);
	const query = draft.params.filter((r) => !isBlank(r)).map(fromRow);
	if (query.length > 0) url.query = query;
	else delete url.query;
	if (draft.pathVariables.length > 0) url.variable = draft.pathVariables.map((row) => {
		const entry = {
			key: row.key,
			value: row.value
		};
		if (row.description) entry.description = row.description;
		return entry;
	});
	else delete url.variable;
	const request = {
		...base,
		method: draft.method.toUpperCase(),
		header: draft.headers.filter((r) => !isBlank(r)).map(fromRow),
		url
	};
	const body = draftBodyToPostman(draft.body);
	if (body) request.body = body;
	else delete request.body;
	if (draft.auth) request.auth = draft.auth;
	else delete request.auth;
	if (draft.description) request.description = draft.description;
	else delete request.description;
	return request;
}
/** A stable fingerprint of what the user can see, for telling whether a tab has unsaved changes. */
function draftSignature(draft) {
	return JSON.stringify(draftToRequest(draft)) + JSON.stringify(draft.events);
}
//#endregion
//#region src/renderer/src/components/apiClient/format.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
/** Display helpers for the API Client: method and status colours, sizes, times, body languages. */
var METHOD_TONES = {
	GET: "text-emerald-600 dark:text-emerald-400",
	POST: "text-amber-600 dark:text-amber-400",
	PUT: "text-sky-600 dark:text-sky-400",
	PATCH: "text-violet-600 dark:text-violet-400",
	DELETE: "text-red-600 dark:text-red-400"
};
var OTHER_METHOD_TONE = "text-pink-600 dark:text-pink-400";
function methodTone(method) {
	return METHOD_TONES[method.toUpperCase()] ?? OTHER_METHOD_TONE;
}
/** Three or four letters, so methods line up in the sidebar the way they do in Postman. */
function methodLabel(method) {
	const upper = method.toUpperCase();
	if (upper === "DELETE") return "DEL";
	if (upper === "OPTIONS") return "OPT";
	return upper.length > 5 ? upper.slice(0, 4) : upper;
}
function statusTone(status) {
	if (status >= 500) return "danger";
	if (status >= 400) return "warning";
	if (status >= 200 && status < 300) return "success";
	return "info";
}
/** Theme tokens, so the status badge follows each theme's own success and warning colours. */
var STATUS_TONE_CLASSES = {
	success: "bg-success/12 text-success ring-success/30",
	info: "bg-primary/12 text-primary ring-primary/30",
	warning: "bg-warning/12 text-warning ring-warning/30",
	danger: "bg-destructive/12 text-destructive ring-destructive/30"
};
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	const units = [
		"KB",
		"MB",
		"GB"
	];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${Number(value.toFixed(value >= 100 ? 0 : 2))} ${units[unit]}`;
}
function formatDuration(ms) {
	if (ms < 1e3) return `${Math.round(ms)} ms`;
	return `${Number((ms / 1e3).toFixed(2))} s`;
}
/** The Monaco language for a response body, from its media type. */
function bodyLanguage(mime) {
	const subtype = mime.split("/")[1] ?? "";
	if (/json/.test(subtype)) return "json";
	if (/html/.test(subtype)) return "html";
	if (/xml/.test(subtype)) return "xml";
	if (/javascript|ecmascript/.test(subtype)) return "javascript";
	if (subtype === "css") return "css";
	if (/yaml/.test(subtype)) return "yaml";
	return "plaintext";
}
/** Past this, formatting would stall the window for longer than it is worth. */
var MAX_PRETTY_CHARS = 2e6;
function prettyBody(body, language) {
	if (language !== "json" || body.length > MAX_PRETTY_CHARS) return body;
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return body;
	}
}
/** Postman's Preview tab, for the responses where a rendered view means something. */
function canPreview(mime) {
	return /html/.test(mime) || mime === "image/svg+xml";
}
function escapeAttribute(value) {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
/**
* The HTML to render in the preview frame. A base tag makes relative links and anchors point at
* the server the page came from, the way they would in a browser.
*/
function previewDocument(html, baseUrl) {
	if (!baseUrl) return html;
	const base = `<base href="${escapeAttribute(baseUrl)}">`;
	const head = /<head(\s[^>]*)?>/i.exec(html);
	if (!head) return `${base}${html}`;
	const at = head.index + head[0].length;
	return `${html.slice(0, at)}${base}${html.slice(at)}`;
}
//#endregion
//#region src/renderer/src/components/apiClient/MethodBadge.tsx
var import_jsx_runtime = require_jsx_runtime();
/**
* A request's method as a small tinted label, the way the sidebar and the open-request tabs show
* it. The tint is the method's own colour at low strength, so each method keeps one hue that
* reads on both light and dark themes.
*/
function MethodBadge({ method, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-4 w-10 shrink-0 items-center justify-center rounded-[5px] bg-current/10 font-mono text-[9px] font-bold leading-none tracking-wide", methodTone(method), className),
		children: methodLabel(method)
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/CollectionsSidebar.tsx
/** Keeps matching nodes and the folders that lead to them. */
function filterTree(nodes, query) {
	const out = [];
	for (const node of nodes) {
		const selfMatch = node.name.toLowerCase().includes(query);
		if (node.kind === "folder") {
			const children = selfMatch ? node.children ?? [] : filterTree(node.children ?? [], query);
			if (selfMatch || children.length > 0) out.push({
				...node,
				children
			});
		} else if (selfMatch) out.push(node);
	}
	return out;
}
var INDENT_REM = .8;
/** A small square icon button for the sidebar header, with the main menu's hover wash. */
function CollectionsSidebar(props) {
	const { collections, loading, onNewCollection } = props;
	const [query, setQuery] = (0, import_react.useState)("");
	const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
	const reduceMotion = useReducedMotion();
	const needle = query.trim().toLowerCase();
	const visible = (0, import_react.useMemo)(() => {
		if (!needle) return collections.map((c) => ({
			collection: c,
			tree: c.tree
		}));
		return collections.flatMap((c) => {
			const tree = c.name.toLowerCase().includes(needle) ? c.tree : filterTree(c.tree, needle);
			return tree.length > 0 || c.name.toLowerCase().includes(needle) ? [{
				collection: c,
				tree
			}] : [];
		});
	}, [collections, needle]);
	function toggle(key) {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}
	const isOpen = (key) => needle.length > 0 || expanded.has(key);
	const empty = !loading && collections.length === 0;
	const pillTransition = reduceMotion ? { duration: 0 } : {
		type: "spring",
		stiffness: 420,
		damping: 32
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-10 shrink-0 items-center gap-0.5 pl-3.5 pr-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: cn(SECTION_HEADING, "min-w-0 flex-1 truncate"),
						children: "Collections"
					}),
					expanded.size > 0 && !needle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "Collapse all",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-sm",
							"aria-label": "Collapse all",
							onClick: () => setExpanded(/* @__PURE__ */ new Set()),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollapseAll, {})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "New collection",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-sm",
							"aria-label": "New collection",
							onClick: onNewCollection,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {})
						})
					})
				]
			}),
			!empty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "shrink-0 px-2 pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "search-pill flex h-7 items-center gap-1.5 rounded-full pl-2.5 pr-1 transition-colors",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3 w-3 shrink-0 text-muted-foreground" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "search",
							"aria-label": "Filter collections",
							placeholder: "Filter requests",
							value: query,
							onChange: (event) => setQuery(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Escape" && query) {
									event.preventDefault();
									event.stopPropagation();
									setQuery("");
								}
							},
							spellCheck: false,
							className: "h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:appearance-none"
						}),
						query && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Clear filter",
							onClick: () => setQuery(""),
							className: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-2.5 w-2.5" })
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rail-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2",
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "status",
					"aria-label": "Loading collections",
					className: "flex flex-col gap-1 py-0.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-7 w-full rounded-lg" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "ml-4 h-7 w-[85%] rounded-lg" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "ml-4 h-7 w-[70%] rounded-lg" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-7 w-[90%] rounded-lg" })
					]
				}) : empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center gap-3 px-3 pb-6 pt-10 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, { className: "h-5 w-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: "No collections yet"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs leading-relaxed text-muted-foreground",
								children: "Collections keep your saved requests together, organised in folders."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							onClick: onNewCollection,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), " Create a collection"]
						})
					]
				}) : visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center gap-2 px-3 py-8 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-4 w-4 text-muted-foreground/60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							"Nothing matches “",
							query,
							"”."
						]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGroup, {
					id: "api-collections",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						role: "tree",
						"aria-label": "Collections",
						className: "flex flex-col gap-px",
						children: visible.map(({ collection, tree }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionRow, {
							...props,
							collection,
							tree,
							isOpen,
							toggle,
							pillTransition
						}, collection.id))
					})
				})
			})
		]
	});
}
function CollectionRow({ collection, tree, ...ctx }) {
	const open = ctx.isOpen(collection.id);
	const broken = collection.error !== null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeRow, {
		depth: 0,
		label: collection.name,
		strong: true,
		expanded: broken ? void 0 : open,
		broken,
		onActivate: () => !broken && ctx.toggle(collection.id),
		pillTransition: ctx.pillTransition,
		icon: broken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
			label: collection.error,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3.5 w-3.5 shrink-0 text-warning" })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, { className: "h-3.5 w-3.5 shrink-0 text-primary" }),
		trailing: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "rounded-full bg-foreground/[0.06] px-1.5 text-[10px] leading-4 tabular-nums text-muted-foreground group-hover:hidden group-has-[[data-state=open]]:hidden",
			children: collection.requestCount
		}),
		menu: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [!broken && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onNewRequest(collection.id, null),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus, { className: "h-3.5 w-3.5" }), " Add request"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onNewFolder(collection.id, null),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: "h-3.5 w-3.5" }), " Add folder"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onRenameCollection(collection),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-3.5 w-3.5" }), " Rename"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
			onSelect: () => ctx.onDeleteCollection(collection),
			tone: "danger",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Delete"]
		})] })
	}), open && !broken && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "group",
		className: "flex flex-col gap-px pt-px",
		children: tree.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => ctx.onNewRequest(collection.id, null),
			style: { paddingLeft: `${1.15 + .95}rem` },
			className: "flex h-7 w-full items-center gap-1.5 rounded-lg pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus, { className: "h-3 w-3 shrink-0" }), "Add a request"]
		}) : tree.map((node) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeRow, {
			...ctx,
			collectionId: collection.id,
			node,
			depth: 1
		}, node.id))
	})] });
}
function NodeRow({ collectionId, node, depth, ...ctx }) {
	const key = `${collectionId}/${node.id}`;
	if (node.kind === "request") {
		const active = ctx.activeItem?.collectionId === collectionId && ctx.activeItem.itemId === node.id;
		const method = node.method ?? "GET";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeRow, {
			depth,
			label: node.name,
			ariaLabel: `${methodLabel(method)} ${node.name}`,
			selected: active,
			onActivate: () => ctx.onOpenRequest(collectionId, node.id),
			pillTransition: ctx.pillTransition,
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MethodBadge, { method }),
			menu: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onDeleteItem(collectionId, node),
				tone: "danger",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Delete"]
			})
		});
	}
	const open = ctx.isOpen(key);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TreeRow, {
		depth,
		label: node.name,
		expanded: open,
		onActivate: () => ctx.toggle(key),
		pillTransition: ctx.pillTransition,
		icon: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Folder, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
		menu: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onNewRequest(collectionId, node.id),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus, { className: "h-3.5 w-3.5" }), " Add request"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onNewFolder(collectionId, node.id),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: "h-3.5 w-3.5" }), " Add folder"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
				onSelect: () => ctx.onDeleteItem(collectionId, node),
				tone: "danger",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Delete"]
			})
		] })
	}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "group",
		className: "flex flex-col gap-px pt-px",
		children: (node.children ?? []).map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NodeRow, {
			...ctx,
			collectionId,
			node: child,
			depth: depth + 1
		}, child.id))
	})] });
}
function TreeRow({ depth, label, ariaLabel, icon, expanded, selected = false, broken = false, strong = false, trailing, menu, onActivate, pillTransition }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "treeitem",
		"aria-label": ariaLabel ?? label,
		tabIndex: 0,
		"aria-expanded": expanded,
		"aria-selected": selected,
		"data-broken": broken || void 0,
		onClick: onActivate,
		onKeyDown: (event) => {
			if (event.target !== event.currentTarget) return;
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onActivate();
			}
		},
		style: { paddingLeft: `${.35 + depth * INDENT_REM}rem` },
		className: cn("group relative isolate flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-lg pr-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "font-medium text-primary" : "text-foreground/85 hover:bg-foreground/[0.06] hover:text-foreground", strong && !selected && "font-medium text-foreground", broken && "text-muted-foreground"),
		children: [
			selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
				"aria-hidden": true,
				layoutId: "api-collections-active",
				transition: pillTransition,
				className: "absolute inset-0 -z-10 rounded-lg bg-primary/12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex w-3 shrink-0 justify-center text-muted-foreground",
				children: expanded !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-90") })
			}),
			icon,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "min-w-0 flex-1 truncate",
				children: label
			}),
			trailing,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": `Actions for ${label}`,
					onClick: (event) => event.stopPropagation(),
					className: "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EllipsisVertical, { className: "h-3 w-3" })
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent, {
				align: "start",
				onClick: (event) => event.stopPropagation(),
				children: menu
			})] })
		]
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/NameDialog.tsx
/** Matches what main accepts for collection and folder names. */
var MAX_NAME_LENGTH = 120;
/** Asks for one name: a new collection or folder, or a rename. */
function NameDialog({ open, onOpenChange, title, description, icon, label, initialValue = "", placeholder, confirmLabel, onSubmit }) {
	const inputId = (0, import_react.useId)();
	const [value, setValue] = (0, import_react.useState)(initialValue);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (open) {
			setValue(initialValue);
			setError(null);
		}
	}, [open, initialValue]);
	const name = value.trim();
	const unchanged = initialValue !== "" && name === initialValue.trim();
	async function submit() {
		if (!name || busy || unchanged) return;
		setBusy(true);
		setError(null);
		try {
			await onSubmit(name);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md gap-0 overflow-hidden p-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
				className: "flex-row items-center gap-3 border-b border-border/70 px-6 py-5",
				children: [icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary [&_svg]:h-[18px] [&_svg]:w-[18px]",
					children: icon
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 space-y-1 pr-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "text-base",
						children: title
					}), description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "text-xs leading-relaxed",
						children: description
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "sr-only",
						children: label
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => {
					event.preventDefault();
					submit();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2 px-6 py-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: inputId,
								className: "text-xs font-semibold",
								children: label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("text-[11px] tabular-nums text-muted-foreground", value.length >= MAX_NAME_LENGTH && "text-amber-600 dark:text-amber-400"),
								children: [
									value.length,
									"/",
									MAX_NAME_LENGTH
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: inputId,
							value,
							maxLength: MAX_NAME_LENGTH,
							placeholder,
							onChange: (event) => {
								setValue(event.target.value);
								setError(null);
							},
							"aria-invalid": error !== null,
							autoFocus: true,
							onFocus: (event) => event.currentTarget.select(),
							className: "h-10"
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							role: "alert",
							className: "flex items-start gap-1.5 text-xs text-destructive",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3 w-3 shrink-0" }), error]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
					className: "items-center border-t border-border/70 bg-muted/20 px-6 py-3.5 sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "hidden text-[11px] text-muted-foreground sm:block",
						children: [
							"Press",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded border border-border bg-background px-1 py-px font-mono text-[10px]",
								children: "Enter"
							}),
							" ",
							"to ",
							confirmLabel.toLowerCase()
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "soft",
							size: "sm",
							onClick: () => onOpenChange(false),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: !name || busy || unchanged,
							className: "min-w-20",
							children: busy ? "Saving…" : confirmLabel
						})]
					})]
				})]
			})]
		})
	});
}
//#endregion
//#region src/renderer/src/stores/apiClientTabsStore.ts
function newTabId() {
	return crypto.randomUUID();
}
function mapTab(tabs, id, change) {
	return tabs.map((tab) => tab.id === id ? change(tab) : tab);
}
function isTabDirty(tab) {
	if (tab.original && tab.name !== tab.original.name) return true;
	return draftSignature(tab.draft) !== tab.savedSignature;
}
var useApiClientTabsStore = create((set, get) => ({
	tabs: [],
	activeTabId: null,
	newTab: () => {
		const draft = emptyDraft();
		const tab = {
			id: newTabId(),
			name: "Untitled Request",
			source: null,
			original: null,
			draft,
			savedSignature: draftSignature(draft),
			run: { status: "idle" }
		};
		set((state) => ({
			tabs: [...state.tabs, tab],
			activeTabId: tab.id
		}));
		return tab.id;
	},
	openRequest: (collectionId, item) => {
		const existing = get().tabs.find((tab) => tab.source?.collectionId === collectionId && tab.source.itemId === item.id);
		if (existing) {
			set({ activeTabId: existing.id });
			return existing.id;
		}
		const draft = requestToDraft(item.request, item.event ?? []);
		const tab = {
			id: newTabId(),
			name: item.name,
			source: {
				collectionId,
				itemId: item.id
			},
			original: item,
			draft,
			savedSignature: draftSignature(draft),
			run: { status: "idle" }
		};
		set((state) => ({
			tabs: [...state.tabs, tab],
			activeTabId: tab.id
		}));
		return tab.id;
	},
	closeTab: (id) => {
		set((state) => {
			const index = state.tabs.findIndex((tab) => tab.id === id);
			if (index < 0) return state;
			const tabs = state.tabs.filter((tab) => tab.id !== id);
			let activeTabId = state.activeTabId;
			if (activeTabId === id) activeTabId = (tabs[index] ?? tabs[index - 1] ?? null)?.id ?? null;
			return {
				tabs,
				activeTabId
			};
		});
	},
	setActive: (id) => set({ activeTabId: id }),
	forgetSource: (collectionId, itemId) => {
		const doomed = get().tabs.filter((tab) => tab.source?.collectionId === collectionId && (itemId === void 0 || tab.source.itemId === itemId)).map((tab) => tab.id);
		for (const id of doomed) get().closeTab(id);
	},
	updateDraft: (id, change) => {
		set((state) => ({ tabs: mapTab(state.tabs, id, (tab) => ({
			...tab,
			draft: change(tab.draft)
		})) }));
	},
	setUrl: (id, url) => {
		get().updateDraft(id, (draft) => ({
			...draft,
			url,
			params: syncParamsFromUrl(url, draft.params),
			pathVariables: syncPathVariables(url, draft.pathVariables)
		}));
	},
	setParams: (id, params) => {
		get().updateDraft(id, (draft) => ({
			...draft,
			params,
			url: replaceQuery(draft.url, params)
		}));
	},
	renameTab: (id, name) => {
		set((state) => ({ tabs: mapTab(state.tabs, id, (tab) => ({
			...tab,
			name
		})) }));
	},
	requestFor: (id) => {
		const tab = get().tabs.find((t) => t.id === id);
		if (!tab) return null;
		return draftToRequest(tab.draft, tab.original?.request);
	},
	itemFor: (id, itemId, name) => {
		const tab = get().tabs.find((t) => t.id === id);
		if (!tab) return null;
		const item = {
			...tab.original ?? {},
			id: itemId,
			name,
			request: draftToRequest(tab.draft, tab.original?.request)
		};
		if (tab.draft.events.length > 0) item.event = tab.draft.events;
		else delete item.event;
		return item;
	},
	markSaved: (id, source, name) => {
		const item = get().itemFor(id, source.itemId, name);
		if (!item) return null;
		set((state) => ({ tabs: mapTab(state.tabs, id, (current) => ({
			...current,
			name,
			source,
			original: item,
			savedSignature: draftSignature(current.draft)
		})) }));
		return item;
	},
	startSending: (id, requestId) => {
		set((state) => ({ tabs: mapTab(state.tabs, id, (tab) => ({
			...tab,
			run: {
				status: "sending",
				requestId,
				startedAt: Date.now()
			}
		})) }));
	},
	finishSending: (id, result) => {
		set((state) => ({ tabs: mapTab(state.tabs, id, (tab) => tab.run.status === "sending" && tab.run.requestId !== result.requestId ? tab : {
			...tab,
			run: {
				status: "done",
				result
			}
		}) }));
	}
}));
//#endregion
//#region src/renderer/src/components/apiClient/KeyValueTable.tsx
function blankRow(id) {
	return {
		id,
		key: "",
		value: "",
		enabled: true,
		description: ""
	};
}
/** Postman's bulk format: one `key:value` per line, `//` in front of a disabled row. */
function rowsToBulk(rows) {
	return rows.map((r) => `${r.enabled ? "" : "//"}${r.key}:${r.value}`).join("\n");
}
function bulkToRows(text, previous) {
	const rows = [];
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const enabled = !line.trimStart().startsWith("//");
		const body = enabled ? line : line.trimStart().slice(2);
		const colon = body.indexOf(":");
		const key = (colon < 0 ? body : body.slice(0, colon)).trim();
		const value = colon < 0 ? "" : body.slice(colon + 1).trim();
		const kept = previous.find((r) => r.key === key && !rows.some((x) => x.id === r.id));
		rows.push({
			id: kept?.id ?? crypto.randomUUID(),
			key,
			value,
			enabled,
			description: kept?.description ?? ""
		});
	}
	return rows;
}
function KeyValueTable({ label, rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value", allowBulkEdit = true }) {
	const [bulk, setBulk] = (0, import_react.useState)(null);
	const [blankId, setBlankId] = (0, import_react.useState)(() => crypto.randomUUID());
	function update(id, patch) {
		if (id === blankId) {
			onChange([...rows, {
				...blankRow(blankId),
				...patch
			}]);
			setBlankId(crypto.randomUUID());
			return;
		}
		onChange(rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	}
	const toggle = allowBulkEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-end",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: "ghost",
			size: "sm",
			onClick: () => {
				if (bulk === null) setBulk(rowsToBulk(rows));
				else {
					onChange(bulkToRows(bulk, rows));
					setBulk(null);
				}
			},
			className: "text-muted-foreground hover:text-foreground",
			children: bulk === null ? "Bulk edit" : "Key-value edit"
		})
	}) : null;
	if (bulk !== null) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [toggle, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
			"aria-label": `${label} bulk edit`,
			value: bulk,
			onChange: (event) => setBulk(event.target.value),
			spellCheck: false,
			placeholder: "key:value\n//disabled:value",
			className: "min-h-[160px] resize-y font-mono text-xs leading-5"
		})]
	});
	const shown = [...rows, blankRow(blankId)];
	const cell = "h-8 w-full min-w-0 bg-transparent px-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:bg-accent/40";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [toggle, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "table",
			"aria-label": label,
			className: "overflow-hidden rounded-lg border border-border",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "row",
				className: "grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.4fr)_2rem] border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						role: "columnheader",
						className: "sr-only",
						children: "Include"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						role: "columnheader",
						className: "px-2.5 py-1.5",
						children: keyPlaceholder
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						role: "columnheader",
						className: "border-l border-border px-2.5 py-1.5",
						children: valuePlaceholder
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true })
				]
			}), shown.map((r) => {
				const isBlank = r.id === blankId;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "row",
					"data-row": true,
					"data-disabled": !r.enabled,
					className: cn("group grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.4fr)_2rem] items-center border-b border-border last:border-b-0 transition-colors hover:bg-accent/30", !r.enabled && "text-muted-foreground"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex justify-center",
							children: !isBlank && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
								checked: r.enabled,
								onCheckedChange: (checked) => update(r.id, { enabled: checked === true }),
								"aria-label": `Include ${r.key || "row"}`
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": `${label} key`,
							value: r.key,
							placeholder: isBlank ? keyPlaceholder : "",
							onChange: (event) => update(r.id, { key: event.target.value }),
							spellCheck: false,
							className: cn(cell, !r.enabled && "line-through decoration-muted-foreground/50")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": `${label} value`,
							value: r.value,
							placeholder: isBlank ? valuePlaceholder : "",
							onChange: (event) => update(r.id, { value: event.target.value }),
							spellCheck: false,
							className: cn(cell, "border-l border-border")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex justify-center",
							children: !isBlank && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
								label: "Remove",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": `Remove ${r.key || "row"}`,
									onClick: () => onChange(rows.filter((x) => x.id !== r.id)),
									className: "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" })
								})
							})
						})
					]
				}, r.id);
			})]
		})]
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/BodyEditor.tsx
/**
* The Body section of a request. Each body type keeps its own content, so switching from raw to
* a form and back loses nothing, and only the selected type is sent.
*/
var MODES = [
	{
		mode: "none",
		label: "none"
	},
	{
		mode: "raw",
		label: "raw"
	},
	{
		mode: "urlencoded",
		label: "x-www-form-urlencoded"
	}
];
var LANGUAGES = [
	{
		language: "json",
		label: "JSON",
		monaco: "json"
	},
	{
		language: "text",
		label: "Text",
		monaco: "plaintext"
	},
	{
		language: "xml",
		label: "XML",
		monaco: "xml"
	},
	{
		language: "html",
		label: "HTML",
		monaco: "html"
	},
	{
		language: "javascript",
		label: "JavaScript",
		monaco: "javascript"
	}
];
function BodyEditor({ body, onChange }) {
	const language = LANGUAGES.find((l) => l.language === body.language) ?? LANGUAGES[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "radiogroup",
					"aria-label": "Body type",
					className: "flex flex-wrap items-center gap-1",
					children: MODES.map(({ mode, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: cn("flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent/60", body.mode === mode ? "font-semibold text-foreground" : "text-muted-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "body-mode",
							"aria-label": label,
							checked: body.mode === mode,
							onChange: () => onChange({
								...body,
								mode
							}),
							className: "h-3.5 w-3.5 accent-[hsl(var(--primary))]"
						}), label]
					}, mode))
				}), body.mode === "raw" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-label": `Body language ${language.label}`,
							className: "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-accent/60",
							children: [language.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3 w-3" })]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent, {
						align: "end",
						children: LANGUAGES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
							onSelect: () => onChange({
								...body,
								language: l.language
							}),
							children: l.label
						}, l.language))
					})] }), body.language === "json" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "ghost",
						size: "sm",
						onClick: () => onChange({
							...body,
							raw: prettyBody(body.raw, "json")
						}),
						className: "gap-1 px-2 text-muted-foreground hover:text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wand2, { className: "h-3 w-3" }), " Beautify"]
					})]
				})]
			}),
			body.mode === "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "py-6 text-center text-xs text-muted-foreground",
				children: "This request does not have a body."
			}),
			body.mode === "raw" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-[160px] flex-1",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoEditor, {
					value: body.raw,
					language: language.monaco,
					onChange: (raw) => onChange({
						...body,
						raw
					}),
					className: "h-full min-h-[160px]"
				})
			}),
			body.mode === "urlencoded" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyValueTable, {
				label: "Form fields",
				rows: body.urlencoded,
				onChange: (urlencoded) => onChange({
					...body,
					urlencoded
				})
			})
		]
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/RequestEditor.tsx
/** Params, Headers and Body for the request in one tab. */
function RequestEditor({ tab }) {
	const setParams = useApiClientTabsStore((s) => s.setParams);
	const updateDraft = useApiClientTabsStore((s) => s.updateDraft);
	const { draft } = tab;
	const activeParams = draft.params.filter((p) => p.enabled && p.key).length;
	const activeHeaders = draft.headers.filter((h) => h.enabled && h.key).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "params",
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "h-9 shrink-0 border-none bg-transparent px-1.5",
				containerClassName: "shrink-0 border-b-0 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
						value: "params",
						children: ["Params ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Count$1, { value: activeParams })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
						value: "headers",
						children: ["Headers ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Count$1, { value: activeHeaders })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
						value: "body",
						children: ["Body", draft.body.mode !== "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							className: "ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "params",
				className: "mt-0 min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Query parameters" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyValueTable, {
						label: "Query parameters",
						rows: draft.params,
						onChange: (rows) => setParams(tab.id, rows)
					}),
					draft.pathVariables.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Path variables" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PathVariablesTable, {
							rows: draft.pathVariables,
							onChange: (pathVariables) => updateDraft(tab.id, (d) => ({
								...d,
								pathVariables
							}))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "headers",
				className: "mt-0 min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyValueTable, {
					label: "Headers",
					rows: draft.headers,
					onChange: (headers) => updateDraft(tab.id, (d) => ({
						...d,
						headers
					}))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[11px] text-muted-foreground",
					children: "Content-Type, User-Agent and Content-Length are added for you when they are not set here."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "body",
				className: "mt-0 min-h-0 flex-1 px-3 pb-3 pt-2.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BodyEditor, {
					body: draft.body,
					onChange: (body) => updateDraft(tab.id, (d) => ({
						...d,
						body
					}))
				})
			})
		]
	});
}
function Count$1({ value }) {
	if (value === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "ml-1 rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary",
		children: value
	});
}
function SectionTitle({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: cn(SECTION_HEADING, "mb-1.5 mt-1"),
		children
	});
}
/** Path variables come from `:name` in the URL, so only their values are edited here. */
function PathVariablesTable({ rows, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "table",
		"aria-label": "Path variables",
		className: "overflow-hidden rounded-lg border border-border",
		children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "row",
			className: "grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] border-b border-border last:border-b-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "truncate px-2.5 py-2 font-mono text-xs text-muted-foreground",
				children: [":", row.key]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				"aria-label": `Value of ${row.key}`,
				value: row.value,
				placeholder: "Value",
				spellCheck: false,
				onChange: (event) => onChange(rows.map((r) => r.id === row.id ? {
					...r,
					value: event.target.value
				} : r)),
				className: cn("h-8 w-full min-w-0 border-l border-border bg-transparent px-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:bg-accent/40")
			})]
		}, row.id))
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/RequestTabStrip.tsx
/**
* The open requests, one pill each, with a dot on any that has unsaved changes. Drawn like the
* tab strip at the top of a Workspace pane, so the two read as the same kind of control.
*/
function RequestTabStrip({ tabs, activeTabId, isDirty, onSelect, onClose, onNew }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-10 shrink-0 items-stretch gap-1 px-1.5 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "tablist",
			"aria-label": "Open requests",
			className: "flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
			children: tabs.map((tab) => {
				const active = tab.id === activeTabId;
				const dirty = isDirty(tab);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "tab",
					tabIndex: active ? 0 : -1,
					"aria-selected": active,
					"aria-label": `${methodLabel(tab.draft.method)} ${tab.name}${dirty ? ", unsaved changes" : ""}`,
					onClick: () => onSelect(tab.id),
					onKeyDown: (event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							onSelect(tab.id);
						}
					},
					onMouseDown: (event) => {
						if (event.button === 1) event.preventDefault();
					},
					onAuxClick: (event) => {
						if (event.button === 1) {
							event.preventDefault();
							onClose(tab.id);
						}
					},
					className: cn("group relative flex h-7 w-44 min-w-[7rem] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md pl-1.5 pr-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"),
					children: [
						active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							className: "absolute inset-x-2 -bottom-[6px] h-[2px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MethodBadge, {
							method: tab.draft.method,
							className: "w-9"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1 truncate",
							children: tab.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "relative flex h-4 w-4 shrink-0 items-center justify-center",
							children: [dirty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"aria-hidden": true,
								className: "h-1.5 w-1.5 rounded-full bg-primary transition-opacity group-hover:opacity-0"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": `Close ${tab.name}`,
								onClick: (event) => {
									event.stopPropagation();
									onClose(tab.id);
								},
								className: cn("absolute inset-0 flex items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-foreground/15 hover:text-foreground focus-visible:opacity-100", active ? "opacity-70" : "opacity-0 group-hover:opacity-70", dirty && "opacity-0 group-hover:opacity-70"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-2.5 w-2.5" })
							})]
						})
					]
				}, tab.id);
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
			label: "New request (Ctrl+N)",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "ghost",
				size: "icon-sm",
				"aria-label": "New request tab",
				onClick: onNew,
				className: "shrink-0 self-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {})
			})
		})]
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/ResponsePane.tsx
/** The lower half of a request tab: whatever came back from the last send. */
function ResponsePane({ run, onCancel }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Response",
		className: "flex h-full min-h-0 flex-col",
		children: [
			run.status === "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IdleState, {}),
			run.status === "sending" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SendingState, {
				startedAt: run.startedAt,
				onCancel
			}),
			run.status === "done" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultView, { result: run.result })
		]
	});
}
function IdleState() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-3 p-6 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-5 w-5" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "Send a request to see the response here"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: [
					"Press ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, { children: "Ctrl" }),
					" + ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, { children: "Enter" }),
					" from anywhere in the request."
				]
			})]
		})]
	});
}
function Kbd({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
		className: "rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground",
		children
	});
}
function SendingState({ startedAt, onCancel }) {
	const [now, setNow] = (0, import_react.useState)(() => Date.now());
	(0, import_react.useEffect)(() => {
		const timer = setInterval(() => setNow(Date.now()), 100);
		return () => clearInterval(timer);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "status",
		"aria-label": "Sending request",
		className: "flex h-full flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "relative flex h-2 w-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-primary" })]
						}),
						"Sending…",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular-nums",
							children: formatDuration(Math.max(0, now - startedAt))
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "soft",
					size: "sm",
					onClick: onCancel,
					"aria-label": "Cancel request",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StopCircle, {}), " Cancel"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-6 w-2/5" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-4/5" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-3/5" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-2/3" })
		]
	});
}
function errorHint(error) {
	if (/ECONNREFUSED/i.test(error)) return "Is the server running, and is the port right?";
	if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error)) return "The host name could not be found. Check the URL, or whether a variable in it is set.";
	if (/timed? ?out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(error)) return "The server took too long to answer.";
	if (/certificate|SSL|TLS|self.signed/i.test(error)) return "The server certificate was not accepted.";
	if (/Invalid URI|Invalid URL|invalid url/i.test(error)) return "The URL is not valid.";
	return "Check the URL and your connection, then try again.";
}
function ResultView({ result }) {
	if (result.cancelled) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full items-center justify-center p-6 text-sm text-muted-foreground",
		children: "Request cancelled."
	});
	if (!result.response) {
		const error = result.error ?? "Unknown error";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-full items-start justify-center overflow-auto p-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-lg rounded-xl bg-destructive/[0.06] p-4 ring-1 ring-inset ring-destructive/30",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-semibold text-destructive",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-4 w-4" }), " Could not get a response"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-foreground",
						children: errorHint(error)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 whitespace-pre-wrap break-words rounded-lg bg-background/60 p-2.5 font-mono text-xs text-muted-foreground",
						children: error
					})
				]
			})
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponseTabs, {
		result,
		response: result.response
	});
}
function ResponseTabs({ result, response }) {
	const passed = result.tests.filter((t) => t.passed).length;
	const hasTests = result.tests.length > 0 || result.scriptErrors.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "body",
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-center justify-between gap-3 pl-1.5 pr-3 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
					className: "h-9 border-none bg-transparent",
					containerClassName: "min-w-0 border-b-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "body",
							children: "Body"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
							value: "headers",
							children: ["Headers ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Count, { children: response.headers.length })]
						}),
						hasTests && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
							value: "tests",
							children: [
								"Tests",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Count, {
									tone: passed === result.tests.length ? "success" : "danger",
									children: [
										passed,
										"/",
										result.tests.length
									]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponseMeta, { response })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "body",
				className: "mt-0 min-h-0 flex-1",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponseBody, {
					response,
					url: result.sent?.url ?? null
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "headers",
				className: "mt-0 min-h-0 flex-1 overflow-auto p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadersTable, { response })
			}),
			hasTests && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "tests",
				className: "mt-0 min-h-0 flex-1 overflow-auto p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TestResults, { result })
			})
		]
	});
}
function Count({ children, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums", tone === "success" && "bg-success/15 text-success", tone === "danger" && "bg-destructive/15 text-destructive", !tone && "bg-foreground/[0.06] text-muted-foreground"),
		children
	});
}
var TIMING_PHASES = [
	{
		key: "dns",
		label: "DNS lookup"
	},
	{
		key: "tcp",
		label: "TCP handshake"
	},
	{
		key: "tls",
		label: "TLS handshake"
	},
	{
		key: "firstByte",
		label: "Waiting (TTFB)"
	},
	{
		key: "download",
		label: "Download"
	}
];
function TimingBreakdown({ timings }) {
	const total = Math.max(timings.total, 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-56 space-y-1.5 py-1",
		children: [TIMING_PHASES.map(({ key, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-[11px]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "h-1.5 overflow-hidden rounded-full bg-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block h-full rounded-full bg-primary",
						style: { width: `${Math.min(100, timings[key] / total * 100)}%` }
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-right tabular-nums",
					children: formatDuration(timings[key])
				})
			]
		}, key)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex justify-between border-t border-border pt-1.5 text-[11px] font-semibold",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular-nums",
				children: formatDuration(timings.total)
			})]
		})]
	});
}
function ResponseMeta({ response }) {
	const tone = statusTone(response.status);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex shrink-0 items-center gap-1 text-xs",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				"data-tone": tone,
				className: cn("mr-1 inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 font-semibold tabular-nums ring-1 ring-inset", STATUS_TONE_CLASSES[tone]),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: "h-1.5 w-1.5 rounded-full bg-current"
				}), `${response.status} ${response.statusText}`.trim()]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimingBreakdown, { timings: response.timings }),
				side: "bottom",
				align: "end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "cursor-default rounded-full px-2 py-0.5 tabular-nums text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
					children: formatDuration(response.timings.total)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: `Headers ${formatBytes(response.size.headers)}, body ${formatBytes(response.size.body)}`,
				side: "bottom",
				align: "end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "cursor-default rounded-full px-2 py-0.5 tabular-nums text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
					children: formatBytes(response.size.headers + response.size.body)
				})
			})
		]
	});
}
var VIEW_LABELS = {
	pretty: "Pretty",
	raw: "Raw",
	preview: "Preview"
};
function ResponseBody({ response, url }) {
	const [view, setView] = (0, import_react.useState)("pretty");
	const previewable = canPreview(response.mime);
	const views = previewable ? [
		"pretty",
		"raw",
		"preview"
	] : ["pretty", "raw"];
	const [copied, setCopied] = (0, import_react.useState)(false);
	const language = bodyLanguage(response.mime);
	const pretty = (0, import_react.useMemo)(() => response.bodyEncoding === "utf8" ? prettyBody(response.body, language) : "", [
		response.body,
		response.bodyEncoding,
		language
	]);
	if (response.bodyEncoding === "base64") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BinaryBody, { response });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "radiogroup",
					"aria-label": "Body view",
					className: "flex rounded-full bg-foreground/[0.05] p-0.5",
					children: views.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "radio",
						"aria-checked": view === option,
						onClick: () => setView(option),
						className: cn("rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: VIEW_LABELS[option]
					}, option))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: copied ? "Copied" : "Copy body",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						size: "icon-sm",
						"aria-label": "Copy body",
						onClick: () => {
							navigator.clipboard.writeText(view === "pretty" ? pretty : response.body);
							setCopied(true);
							setTimeout(() => setCopied(false), 1200);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {})
					})
				})]
			}),
			response.bodyTruncated && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mx-3 mb-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning",
				children: [
					"This response is ",
					formatBytes(response.size.body),
					". Only the first",
					" ",
					formatBytes(new Blob([response.body]).size),
					" is shown."
				]
			}),
			response.body.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 text-sm text-muted-foreground",
				children: "This response has no body."
			}) : view === "preview" && previewable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BodyPreview, {
				response,
				url
			}) : view === "pretty" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 px-3 pb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoEditor, {
					value: pretty,
					language,
					readOnly: true,
					className: "h-full min-h-0"
				}, `${language}:${response.body.length}`)
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs",
				children: response.body
			})
		]
	});
}
/**
* The rendered page, in a frame sandboxed with no permissions at all: its scripts never run, and
* the app's content policy keeps it from loading anything from other sites.
*/
function BodyPreview({ response, url }) {
	const isSvg = response.mime === "image/svg+xml";
	const srcDoc = (0, import_react.useMemo)(() => isSvg ? "" : previewDocument(response.body, url), [
		isSvg,
		response.body,
		url
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-0 flex-1 overflow-hidden rounded-lg bg-white ring-1 ring-border/60",
			children: isSvg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full items-center justify-center overflow-auto p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					alt: "Response preview",
					src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(response.body)}`,
					className: "max-h-full max-w-full"
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
				title: "Response preview",
				sandbox: "",
				srcDoc,
				referrerPolicy: "no-referrer",
				className: "h-full w-full border-0 bg-white"
			})
		}), !isSvg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] text-muted-foreground",
			children: "Scripts and files from other sites are not loaded in the preview."
		})]
	});
}
function BinaryBody({ response }) {
	if (response.mime.startsWith("image/") && !response.bodyTruncated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full items-center justify-center overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			alt: "Response image",
			src: `data:${response.mime};base64,${response.body}`,
			className: "max-h-full max-w-full rounded-md shadow-lg"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground",
		children: [
			"Binary response (",
			response.mime || "unknown type",
			", ",
			formatBytes(response.size.body),
			")."
		]
	});
}
function HeadersTable({ response }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
		"aria-label": "Response headers",
		className: "w-full table-fixed text-xs",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
			className: "border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
				className: "w-2/5 py-1.5 pr-3 font-semibold",
				children: "Key"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
				className: "py-1.5 font-semibold",
				children: "Value"
			})]
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: response.headers.map((header, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
			className: "border-b border-border/60 align-top last:border-b-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "break-words py-1.5 pr-3 font-mono font-medium",
				children: header.key
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "break-all py-1.5 font-mono text-muted-foreground",
				children: header.value
			})]
		}, `${header.key}-${index}`)) })]
	});
}
function TestResults({ result }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [result.scriptErrors.map((error) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2 rounded-lg bg-destructive/[0.06] p-2 text-xs ring-1 ring-inset ring-destructive/30",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono",
				children: error
			})]
		}, error)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1",
			children: result.tests.map((test, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-start gap-2 rounded-md px-1 py-1 text-xs",
				children: [test.passed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-success" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: test.name
					}), test.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-mono text-[11px] text-muted-foreground",
						children: test.error
					})]
				})]
			}, `${test.name}-${index}`))
		})]
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/SaveRequestDialog.tsx
function folderPlaces(collectionId, nodes, depth) {
	return nodes.flatMap((node) => node.kind === "folder" ? [{
		key: `${collectionId}/${node.id}`,
		collectionId,
		parentId: node.id,
		label: node.name,
		depth
	}, ...folderPlaces(collectionId, node.children ?? [], depth + 1)] : []);
}
/** Asks where a new request goes: a name, and a collection or one of its folders. */
function SaveRequestDialog({ open, onOpenChange, initialName, collections, onSave }) {
	const places = (0, import_react.useMemo)(() => collections.filter((c) => !c.error).flatMap((c) => [{
		key: c.id,
		collectionId: c.id,
		parentId: null,
		label: c.name,
		depth: 0
	}, ...folderPlaces(c.id, c.tree, 1)]), [collections]);
	const [name, setName] = (0, import_react.useState)(initialName);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [newCollection, setNewCollection] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setName(initialName);
		setSelected(places[0]?.key ?? null);
		setCreating(places.length === 0);
		setNewCollection("");
		setError(null);
	}, [
		open,
		initialName,
		places
	]);
	const place = places.find((p) => p.key === selected) ?? null;
	const canSave = name.trim().length > 0 && (creating ? newCollection.trim().length > 0 : place !== null);
	async function save() {
		if (!canSave || saving) return;
		setSaving(true);
		setError(null);
		try {
			await onSave(creating ? {
				newCollectionName: newCollection.trim(),
				parentId: null
			} : {
				collectionId: place.collectionId,
				parentId: place.parentId
			}, name.trim());
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md gap-0 overflow-hidden p-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
				className: "flex-row items-center gap-3 border-b border-border/70 px-6 py-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "h-[18px] w-[18px]" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 space-y-1 pr-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "text-base",
						children: "Save request"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "text-xs leading-relaxed",
						children: "Pick a collection or a folder to keep it in."
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex min-h-0 flex-col",
				onSubmit: (event) => {
					event.preventDefault();
					save();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-col gap-4 px-6 py-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "api-save-name",
								className: "text-xs font-semibold",
								children: "Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "api-save-name",
								"aria-label": "Request name",
								value: name,
								onChange: (event) => setName(event.target.value),
								autoFocus: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-h-0 flex-col gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									className: "text-xs font-semibold",
									children: "Save to"
								}), places.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setCreating((value) => !value),
									className: "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { className: "h-3 w-3" }), creating ? "Pick an existing one" : "New collection"]
								})]
							}), creating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								"aria-label": "New collection name",
								placeholder: "e.g. Payments API",
								value: newCollection,
								onChange: (event) => setNewCollection(event.target.value)
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								role: "listbox",
								"aria-label": "Collections and folders",
								className: "max-h-64 overflow-y-auto rounded-lg border border-border p-1",
								children: places.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									role: "option",
									tabIndex: 0,
									"aria-selected": p.key === selected,
									onClick: () => setSelected(p.key),
									onKeyDown: (event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											setSelected(p.key);
										}
									},
									style: { paddingLeft: `${.5 + p.depth * 1}rem` },
									className: cn("flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", p.key === selected ? "bg-primary/12 font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"),
									children: [p.depth === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, { className: "h-3.5 w-3.5 shrink-0 text-primary" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Folder, { className: "h-3.5 w-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: p.label
									})]
								}, p.key))
							})]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							role: "alert",
							className: "flex items-start gap-1.5 text-xs text-destructive",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3 w-3 shrink-0" }), error]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
					className: "items-center border-t border-border/70 bg-muted/20 px-6 py-3.5 sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden truncate text-[11px] text-muted-foreground sm:block",
						children: creating ? "A new collection will be created" : place ? `Saving to ${place.label}` : "Pick where to save it"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "soft",
							size: "sm",
							onClick: () => onOpenChange(false),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: !canSave || saving,
							className: "min-w-20",
							children: "Save"
						})]
					})]
				})]
			})]
		})
	});
}
//#endregion
//#region src/renderer/src/components/apiClient/UrlBar.tsx
/**
* Method, URL, Send and Save: the row every request starts from. The method, the address and
* Send share one pill, like the search field in the title bar, so they read as one control.
* Save sits beside it. Labels drop to icons when the request area is narrow (it is a container
* query on the request panel, see ApiClientPage).
*/
function UrlBar({ method, url, sending, onMethodChange, onUrlChange, onSend, onCancel, onSave }) {
	const canSend = url.trim().length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "search-pill flex h-10 min-w-0 flex-1 items-center gap-1 rounded-full p-1 transition-colors",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": `Method ${method}`,
						className: cn("flex h-8 w-[5.75rem] shrink-0 items-center justify-between gap-1 rounded-full bg-current/10 pl-3.5 pr-2.5 font-mono text-xs font-bold tracking-wide transition-colors hover:bg-current/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-current/15", methodTone(method)),
						children: [method, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3 w-3 opacity-70" })]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent, {
					align: "start",
					className: "min-w-[8rem]",
					children: HTTP_METHODS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItem, {
						onSelect: () => onMethodChange(m),
						className: cn("font-mono text-xs font-bold", methodTone(m)),
						children: m
					}, m))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Request URL",
					value: url,
					onChange: (event) => onUrlChange(event.target.value),
					onKeyDown: (event) => {
						if (event.key === "Enter" && canSend && !sending) {
							event.preventDefault();
							onSend();
						}
					},
					placeholder: "Enter a URL, like https://api.example.com/users or {{baseUrl}}/users",
					spellCheck: false,
					autoComplete: "off",
					className: "h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
				}),
				sending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "soft",
					className: "shrink-0 @lg/request:w-[6rem]",
					onClick: onCancel,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StopCircle, {}), " Cancel"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Send (Ctrl+Enter)",
					wrapTrigger: !canSend,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						className: "shrink-0 px-3.5 @lg/request:w-[6rem]",
						disabled: !canSend,
						onClick: onSend,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {}), " Send"]
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
			label: "Save (Ctrl+S)",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "soft",
				"aria-label": "Save",
				className: "h-10 shrink-0 px-3 @lg/request:px-4",
				onClick: onSave,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden @lg/request:inline",
					children: "Save"
				})]
			})
		})]
	});
}
//#endregion
//#region src/renderer/src/stores/apiClientLayoutStore.ts
/** Pane sizes on the API Client page, remembered between visits. */
var API_SIDEBAR_WIDTH = {
	min: 200,
	max: 480,
	default: 272
};
var API_REQUEST_HEIGHT = {
	min: 120,
	max: 800,
	default: 300
};
var useApiClientLayoutStore = create()(persist((set) => ({
	sidebarWidth: API_SIDEBAR_WIDTH.default,
	requestHeight: API_REQUEST_HEIGHT.default,
	setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
	setRequestHeight: (requestHeight) => set({ requestHeight })
}), { name: "agentmate-api-client-layout" }));
//#endregion
//#region src/renderer/src/pages/ApiClientPage.tsx
var UNTITLED = "Untitled Request";
/** The page's two cards: the app's glass card, rounded like the Settings cards. */
var PANEL = "glass flex flex-col overflow-hidden rounded-[calc(var(--radius)+2px)]";
/** What the name dialog says for each thing it can name. */
function nameDialogCopy(state) {
	switch (state?.kind) {
		case "rename": return {
			title: "Rename collection",
			description: "The new name shows in the sidebar and in exported files.",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, {}),
			label: "Collection name",
			initialValue: state.collection.name,
			placeholder: "Collection name",
			confirmLabel: "Rename"
		};
		case "newFolder": return {
			title: "New folder",
			description: "Folders group related requests inside a collection.",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, {}),
			label: "Folder name",
			initialValue: "",
			placeholder: "e.g. Users, Orders, Auth",
			confirmLabel: "Create"
		};
		default: return {
			title: "New collection",
			description: "A collection keeps related requests together. It is saved in the Postman format, so you can export it any time.",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, {}),
			label: "Collection name",
			initialValue: "",
			placeholder: "e.g. Payments API",
			confirmLabel: "Create"
		};
	}
}
function message(error) {
	return error instanceof Error ? error.message : String(error);
}
function requestIdsUnder(node) {
	if (node.kind === "request") return [node.id];
	return (node.children ?? []).flatMap(requestIdsUnder);
}
function ApiClientPage() {
	usePageHeader("API Client", "Build, send and save HTTP requests. Collections use the Postman format.");
	const queryClient = useQueryClient();
	const collectionsQuery = useQuery({
		queryKey: queryKeys.apiCollections,
		queryFn: () => window.agentmat.apiClient.listCollections()
	});
	const collections = collectionsQuery.data ?? [];
	const tabs = useApiClientTabsStore((s) => s.tabs);
	const activeTabId = useApiClientTabsStore((s) => s.activeTabId);
	const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
	const sidebarWidth = useApiClientLayoutStore((s) => s.sidebarWidth);
	const setSidebarWidth = useApiClientLayoutStore((s) => s.setSidebarWidth);
	const [nameDialog, setNameDialog] = (0, import_react.useState)(null);
	const [savingTabId, setSavingTabId] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(() => queryClient.invalidateQueries({ queryKey: queryKeys.apiCollections }), [queryClient]);
	const send = (0, import_react.useCallback)(async (tabId) => {
		const store = useApiClientTabsStore.getState();
		const tab = store.tabs.find((t) => t.id === tabId);
		const request = store.requestFor(tabId);
		if (!tab || !request || !tab.draft.url.trim() || tab.run.status === "sending") return;
		const requestId = crypto.randomUUID();
		store.startSending(tabId, requestId);
		try {
			const result = await window.agentmat.apiClient.execute({
				requestId,
				request,
				events: tab.draft.events,
				name: tab.name,
				collectionId: tab.source?.collectionId ?? null,
				itemId: tab.source?.itemId ?? null
			});
			useApiClientTabsStore.getState().finishSending(tabId, result);
		} catch (error) {
			useApiClientTabsStore.getState().finishSending(tabId, {
				requestId,
				ok: false,
				cancelled: false,
				error: message(error),
				response: null,
				sent: null,
				tests: [],
				console: [],
				scriptErrors: [],
				startedAt: Date.now()
			});
		}
	}, []);
	const cancel = (0, import_react.useCallback)((tab) => {
		if (tab.run.status === "sending") window.agentmat.apiClient.cancel(tab.run.requestId);
	}, []);
	/** Writes a tab back to where it came from, or asks where a new one should go. */
	const save = (0, import_react.useCallback)(async (tabId) => {
		const store = useApiClientTabsStore.getState();
		const tab = store.tabs.find((t) => t.id === tabId);
		if (!tab) return;
		if (!tab.source) {
			setSavingTabId(tabId);
			return;
		}
		const item = store.itemFor(tabId, tab.source.itemId, tab.name);
		if (!item) return;
		try {
			await window.agentmat.apiClient.saveRequest({
				collectionId: tab.source.collectionId,
				parentId: null,
				item
			});
			useApiClientTabsStore.getState().markSaved(tabId, tab.source, tab.name);
			await refresh();
		} catch (error) {
			toast.error("Could not save the request", { description: message(error) });
		}
	}, [refresh]);
	const saveNew = (0, import_react.useCallback)(async (tabId, destination, name) => {
		let collectionId;
		if ("newCollectionName" in destination) collectionId = (await window.agentmat.apiClient.createCollection(destination.newCollectionName)).id;
		else collectionId = destination.collectionId;
		const itemId = crypto.randomUUID();
		const item = useApiClientTabsStore.getState().itemFor(tabId, itemId, name);
		if (!item) return;
		await window.agentmat.apiClient.saveRequest({
			collectionId,
			parentId: destination.parentId,
			item
		});
		useApiClientTabsStore.getState().markSaved(tabId, {
			collectionId,
			itemId
		}, name);
		await refresh();
		toast.success(`Saved “${name}”`);
	}, [refresh]);
	const closeTab = (0, import_react.useCallback)(async (tabId) => {
		const tab = useApiClientTabsStore.getState().tabs.find((t) => t.id === tabId);
		if (!tab) return;
		if (isTabDirty(tab)) {
			if (!await confirmDialog({
				title: "Discard unsaved changes?",
				description: `“${tab.name}” has changes that were not saved.`,
				confirmLabel: "Discard",
				variant: "destructive"
			})) return;
		}
		if (tab.run.status === "sending") window.agentmat.apiClient.cancel(tab.run.requestId);
		useApiClientTabsStore.getState().closeTab(tabId);
	}, []);
	const openRequest = (0, import_react.useCallback)(async (collectionId, itemId) => {
		try {
			const item = findItem(await queryClient.fetchQuery({
				queryKey: queryKeys.apiCollection(collectionId),
				queryFn: () => window.agentmat.apiClient.getCollection(collectionId),
				staleTime: 0
			}), itemId);
			if (!item || !isRequestItem(item)) throw new Error("That request no longer exists.");
			useApiClientTabsStore.getState().openRequest(collectionId, item);
		} catch (error) {
			toast.error("Could not open the request", { description: message(error) });
			refresh();
		}
	}, [queryClient, refresh]);
	const addRequest = (0, import_react.useCallback)(async (collectionId, parentId) => {
		const item = {
			id: crypto.randomUUID(),
			name: "New Request",
			request: {
				method: "GET",
				url: ""
			}
		};
		try {
			await window.agentmat.apiClient.saveRequest({
				collectionId,
				parentId,
				item
			});
			useApiClientTabsStore.getState().openRequest(collectionId, item);
			await refresh();
		} catch (error) {
			toast.error("Could not add the request", { description: message(error) });
		}
	}, [refresh]);
	const deleteCollection = (0, import_react.useCallback)(async (collection) => {
		if (!await confirmDialog({
			title: `Delete “${collection.name}”?`,
			description: `Its ${collection.requestCount} saved request${collection.requestCount === 1 ? "" : "s"} will be deleted too. This cannot be undone.`,
			confirmLabel: "Delete",
			variant: "destructive"
		})) return;
		try {
			await window.agentmat.apiClient.removeCollection(collection.id);
			useApiClientTabsStore.getState().forgetSource(collection.id);
			await refresh();
		} catch (error) {
			toast.error("Could not delete the collection", { description: message(error) });
		}
	}, [refresh]);
	const deleteItem = (0, import_react.useCallback)(async (collectionId, node) => {
		if (!await confirmDialog({
			title: `Delete “${node.name}”?`,
			description: node.kind === "folder" ? "Everything in this folder will be deleted too. This cannot be undone." : "This cannot be undone.",
			confirmLabel: "Delete",
			variant: "destructive"
		})) return;
		try {
			await window.agentmat.apiClient.removeItem(collectionId, node.id);
			for (const id of requestIdsUnder(node)) useApiClientTabsStore.getState().forgetSource(collectionId, id);
			await refresh();
		} catch (error) {
			toast.error("Could not delete it", { description: message(error) });
		}
	}, [refresh]);
	const rootRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const onKeyDown = (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			if (!rootRef.current?.contains(event.target)) return;
			const tabId = useApiClientTabsStore.getState().activeTabId;
			if (event.key === "Enter" && tabId) {
				event.preventDefault();
				event.stopPropagation();
				send(tabId);
			} else if (event.key.toLowerCase() === "s" && !event.shiftKey && tabId) {
				event.preventDefault();
				event.stopPropagation();
				save(tabId);
			} else if (event.key.toLowerCase() === "n" && !event.shiftKey) {
				event.preventDefault();
				event.stopPropagation();
				useApiClientTabsStore.getState().newTab();
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [send, save]);
	const savingTab = tabs.find((t) => t.id === savingTabId) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: "flex min-h-0 flex-1 overflow-hidden p-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				"aria-label": "API collections",
				style: {
					width: sidebarWidth,
					maxWidth: "42%"
				},
				className: cn(PANEL, "shrink-0"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionsSidebar, {
					collections,
					loading: collectionsQuery.isPending,
					activeItem: activeTab?.source ?? null,
					onOpenRequest: (collectionId, itemId) => void openRequest(collectionId, itemId),
					onNewCollection: () => setNameDialog({ kind: "newCollection" }),
					onNewRequest: (collectionId, parentId) => void addRequest(collectionId, parentId),
					onNewFolder: (collectionId, parentId) => setNameDialog({
						kind: "newFolder",
						collectionId,
						parentId
					}),
					onRenameCollection: (collection) => setNameDialog({
						kind: "rename",
						collection
					}),
					onDeleteCollection: (collection) => void deleteCollection(collection),
					onDeleteItem: (collectionId, node) => void deleteItem(collectionId, node)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizeHandle, {
				orientation: "vertical",
				label: "Resize collections",
				size: sidebarWidth,
				min: API_SIDEBAR_WIDTH.min,
				max: API_SIDEBAR_WIDTH.max,
				defaultSize: API_SIDEBAR_WIDTH.default,
				onSizeChange: setSidebarWidth,
				quiet: true,
				className: "w-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(PANEL, "@container/request min-w-0 flex-1"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestTabStrip, {
					tabs,
					activeTabId,
					isDirty: isTabDirty,
					onSelect: (id) => useApiClientTabsStore.getState().setActive(id),
					onClose: (id) => void closeTab(id),
					onNew: () => useApiClientTabsStore.getState().newTab()
				}), activeTab ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestWorkspace, {
					tab: activeTab,
					collectionName: collections.find((c) => c.id === activeTab.source?.collectionId)?.name,
					onSend: () => void send(activeTab.id),
					onCancel: () => cancel(activeTab),
					onSave: () => void save(activeTab.id)
				}, activeTab.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyWorkspace, { onNew: () => useApiClientTabsStore.getState().newTab() })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SaveRequestDialog, {
				open: savingTab !== null,
				onOpenChange: (open) => !open && setSavingTabId(null),
				initialName: savingTab ? savingTab.name === UNTITLED ? savingTab.draft.url.trim() || "New Request" : savingTab.name : "",
				collections,
				onSave: (destination, name) => savingTab ? saveNew(savingTab.id, destination, name) : Promise.resolve()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameDialog, {
				open: nameDialog !== null,
				onOpenChange: (open) => !open && setNameDialog(null),
				...nameDialogCopy(nameDialog),
				onSubmit: async (name) => {
					if (!nameDialog) return;
					if (nameDialog.kind === "newCollection") await window.agentmat.apiClient.createCollection(name);
					else if (nameDialog.kind === "rename") await window.agentmat.apiClient.renameCollection(nameDialog.collection.id, name);
					else await window.agentmat.apiClient.createFolder(nameDialog.collectionId, nameDialog.parentId, name);
					await refresh();
				}
			})
		]
	});
}
function EmptyWorkspace({ onNew }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-6 w-6" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-sm space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-semibold tracking-tight",
					children: "Send your first request"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Start a new request, or open one from a collection on the left."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: onNew,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus, {}), " New request"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: [
					"Shortcut:",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
						className: "rounded-md border border-border bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[10px]",
						children: "Ctrl"
					}),
					" ",
					"+",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
						className: "rounded-md border border-border bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[10px]",
						children: "N"
					})
				]
			})
		]
	});
}
function RequestWorkspace({ tab, collectionName, onSend, onCancel, onSave }) {
	const updateDraft = useApiClientTabsStore((s) => s.updateDraft);
	const setUrl = useApiClientTabsStore((s) => s.setUrl);
	const renameTab = useApiClientTabsStore((s) => s.renameTab);
	const requestHeight = useApiClientLayoutStore((s) => s.requestHeight);
	const setRequestHeight = useApiClientLayoutStore((s) => s.setRequestHeight);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-2 px-3 pb-3 pt-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
				children: [collectionName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex min-w-0 max-w-[45%] shrink-0 items-center gap-1.5 pl-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, { className: "h-3 w-3 shrink-0 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: collectionName
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-2.5 w-2.5 shrink-0 opacity-60" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Request name",
					value: tab.name,
					onChange: (event) => renameTab(tab.id, event.target.value),
					onBlur: (event) => {
						if (!event.target.value.trim()) renameTab(tab.id, UNTITLED);
					},
					className: "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-0.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring/40"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrlBar, {
				method: tab.draft.method,
				url: tab.draft.url,
				sending: tab.run.status === "sending",
				onMethodChange: (method) => updateDraft(tab.id, (d) => ({
					...d,
					method
				})),
				onUrlChange: (url) => setUrl(tab.id, url),
				onSend,
				onCancel,
				onSave
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: { height: requestHeight },
					className: "min-h-0 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestEditor, { tab })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizeHandle, {
					orientation: "horizontal",
					label: "Resize request and response",
					size: requestHeight,
					min: API_REQUEST_HEIGHT.min,
					max: API_REQUEST_HEIGHT.max,
					defaultSize: API_REQUEST_HEIGHT.default,
					onSizeChange: setRequestHeight
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-h-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsePane, {
						run: tab.run,
						onCancel
					})
				})
			]
		})]
	});
}
//#endregion
export { ApiClientPage as default };
