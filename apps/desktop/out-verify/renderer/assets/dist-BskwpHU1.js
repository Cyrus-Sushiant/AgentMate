import { I as cn, _ as SECTION_HEADING } from "./tooltip-BbU-D7og.js";
//#region src/renderer/src/components/ui/overlay.ts
/**
* Class strings shared by everything that floats over the page: menus, popovers, the combobox
* list and the few hand-rolled menus that can't use Radix. They draw the same frosted glass as
* the search panel (`.overlay-surface` in index.css) and the same rows as the command palette,
* so a menu opened anywhere looks like part of one family.
*/
/** The glass panel itself. Callers add their own padding, width and overflow. */
var OVERLAY_SURFACE = "overlay-surface text-popover-foreground outline-none";
/**
* Fade plus a slight zoom and slide from the trigger side. Each primitive adds its own
* transform origin, since Radix names that variable per component.
*/
var OVERLAY_MOTION = "overlay-motion data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1";
/**
* Icons that sit directly in a row share one size. A caller that needs another size says so
* with a `size-*` class, which the rule skips.
*/
var ROW_ICONS = "[&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-3.5";
/**
* A menu row. Radix moves focus to the row under the pointer, so `focus` covers hover too.
* Radix marks a disabled row with an empty `data-disabled`, hence no `=true` here.
*/
var MENU_ITEM = cn("relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors", "focus:bg-foreground/[0.07] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", ROW_ICONS);
/** The tint for a row that deletes or turns something off. */
var MENU_ITEM_DANGER = "text-destructive focus:bg-destructive/10 focus:text-destructive";
/** A checkbox or radio row: room on the left for the check, which sits in MENU_INDICATOR. */
var MENU_CHECK_ITEM = "pl-8";
var MENU_INDICATOR = "absolute left-2.5 flex size-3.5 items-center justify-center";
/** The check that marks a chosen row. Colour, not a filled row, says what is selected. */
var MENU_CHECK_ICON = "size-3.5 text-primary";
/** A sub-menu trigger stays lit while its sub-menu is open. */
var MENU_SUB_TRIGGER = "data-[state=open]:bg-foreground/[0.07]";
/** A group label, the same small uppercase heading the main menu puts over its groups. */
var MENU_LABEL = cn(SECTION_HEADING, "block px-2.5 pb-1 pt-1.5");
/** A hairline between groups, inset so it lines up with the row text. */
var MENU_SEPARATOR = "mx-2.5 my-1 h-px bg-foreground/[0.08]";
/** The key hint at the right edge of a row. */
var MENU_SHORTCUT = "ml-auto pl-6 text-[11px] tracking-wide text-muted-foreground";
/**
* A row in a searchable list (the combobox, the project picker). cmdk marks the active row
* with `aria-selected` and a disabled one with `data-disabled="true"`.
*/
var LIST_OPTION = cn("flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors", "aria-selected:bg-foreground/[0.07] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50", ROW_ICONS);
/** The search pill at the top of a searchable list, drawn like the command palette's. */
var LIST_SEARCH = "search-pill flex h-8 items-center gap-2 rounded-full pl-3 pr-2";
//#endregion
//#region ../../packages/core/dist/blueprint/steps.js
/**
* The one table behind the step rail, the prompt headings, the markdown block,
* and the Settings preset groups. Nothing else in the app spells a step's name.
*/
var BLUEPRINT_STEPS = [
	{
		id: "idea",
		label: "Idea",
		hint: "What you are building",
		heading: "Main idea",
		placeholder: "What is this project, who is it for, and what problem does it solve? What does success look like, and what is explicitly out of scope?"
	},
	{
		id: "architecture",
		label: "Architecture",
		hint: "Structure and stack",
		heading: "Architecture and technology choices",
		placeholder: "How is the system laid out? Monolith, services, monorepo? Which languages, frameworks and hosting, and why those?"
	},
	{
		id: "backend",
		label: "Backend",
		hint: "Services and data",
		heading: "Backend",
		placeholder: "APIs, database, auth, background jobs, third-party services. Anything the server side has to get right."
	},
	{
		id: "frontend",
		label: "Frontend",
		hint: "UI and client",
		heading: "Frontend",
		placeholder: "Framework, state management, styling, routing, the screens that matter, accessibility and browser or device targets."
	},
	{
		id: "cicd",
		label: "CI/CD",
		hint: "Build and release",
		heading: "CI/CD and environments",
		placeholder: "How this builds, tests, and ships. Pipelines, environments, secrets, versioning, and what has to pass before a release."
	},
	{
		id: "quality",
		label: "Quality",
		hint: "Testing and standards",
		heading: "Quality, testing and constraints",
		placeholder: "Testing strategy, coverage expectations, linting and formatting rules, performance budgets, security and compliance constraints."
	}
];
function blueprintStep(stepId) {
	return BLUEPRINT_STEPS.find((step) => step.id === stepId) ?? BLUEPRINT_STEPS[0];
}
//#endregion
//#region ../../packages/core/dist/blueprint/attachments.js
/**
* Blueprint files are referenced from inside a step's markdown rather than
* hanging off the step as a list, so a screenshot can sit between the sentence
* that introduces it and the one that follows.
*
* They are addressed through the app's own URL scheme, served by the main
* process straight off disk. That is what lets a 30 MB screen recording play
* (and seek) in the preview: a data URL would mean base64-ing the whole thing
* into the renderer first.
*/
var BLUEPRINT_FILE_SCHEME = "agentmate-file";
var BLUEPRINT_FILE_HOST = "blueprint";
function blueprintFileUrl(fileName) {
	return `${BLUEPRINT_FILE_SCHEME}://${BLUEPRINT_FILE_HOST}/${encodeURIComponent(fileName)}`;
}
/** Reverses `blueprintFileUrl`. Null for anything that isn't one of ours. */
function blueprintFileNameFromUrl(url) {
	const prefix = `${BLUEPRINT_FILE_SCHEME}://${BLUEPRINT_FILE_HOST}/`;
	if (!url.startsWith(prefix)) return null;
	const raw = url.slice(prefix.length).split(/[?#]/)[0];
	try {
		return decodeURIComponent(raw) || null;
	} catch {
		return null;
	}
}
function isImageMime(mime) {
	return mime.startsWith("image/");
}
function isVideoMime(mime) {
	return mime.startsWith("video/");
}
/** True for the types the preview can draw in place rather than link to. */
function isInlineMedia(mime) {
	return isImageMime(mime) || isVideoMime(mime);
}
/**
* The markdown to drop at the caret for one file.
*
* Video uses image syntax on purpose: `![]()` is the only media form plain
* markdown has, and the preview swaps in a `<video>` when the file behind the
* URL is one. That keeps a step's text as ordinary markdown, so it still reads
* correctly anywhere else it ends up.
*/
function blueprintFileMarkdown(attachment) {
	const alt = attachment.displayName.replace(/[[\]\r\n]/g, " ").trim() || "attachment";
	const url = blueprintFileUrl(attachment.fileName);
	return isInlineMedia(attachment.mime) ? `![${alt}](${url})` : `[${alt}](${url})`;
}
var FILE_REF = new RegExp(`!?\\[([^\\]]*)\\]\\(\\s*<?(${BLUEPRINT_FILE_SCHEME}://[^\\s)>]*)>?[^)]*\\)`, "g");
/** The files a step's markdown actually points at, so a delete can say what it will break. */
function referencedAttachmentNames(text) {
	const names = /* @__PURE__ */ new Set();
	for (const match of text.matchAll(FILE_REF)) {
		const fileName = blueprintFileNameFromUrl(match[2]);
		if (fileName) names.add(fileName);
	}
	return names;
}
/**
* Swaps every file reference for a plain mention of what was there.
*
* This runs before a step is translated and before it reaches the generated
* prompt or the project's markdown. Both of those are read somewhere the app's
* URL scheme means nothing, so an embedded `![](agentmate-file://…)` would be a
* dead link; the name is the part that carries the information.
*/
function flattenAttachmentRefs(text) {
	return text.replace(FILE_REF, (_match, alt) => {
		const name = alt.trim();
		return name ? `[attached file: ${name}]` : "[attached file]";
	});
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function joinValues(array, separator = "|") {
	return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
var Cached = class {
	constructor(getter) {
		this._getter = getter;
		this._value = void 0;
	}
	get value() {
		const getter = this._getter;
		if (getter !== void 0) {
			this._value = getter();
			this._getter = void 0;
		}
		return this._value;
	}
};
function cached(getter) {
	return new Cached(getter);
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
/**
* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
*
* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
*/
function rawShape(def) {
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
	return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
	Object.defineProperty(target, key, {
		get() {
			const value = getter();
			assignProp(this, key, value);
			return value;
		},
		enumerable: true,
		configurable: true
	});
}
function putProp(target, key, value) {
	if (key in target) assignProp(target, key, value);
	else target[key] = value;
}
/**
* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
*
* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
*/
function mirrorShape(target, source, keys, wrap) {
	const raw = sourceShape(source);
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => {
			const value = source._zod.def.shape[key];
			return wrap ? wrap(value, key) : value;
		});
		else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
	}
}
function mirrorProps(target, source) {
	for (const key of Reflect.ownKeys(source)) {
		const desc = Object.getOwnPropertyDescriptor(source, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => source[key]);
		else putProp(target, key, desc.value);
	}
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
var propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex$2(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function stringifyPrimitive(value) {
	if (typeof value === "bigint") return value.toString() + "n";
	if (typeof value === "string") return `"${value}"`;
	return `${value}`;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
	});
}
var NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
	int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	const newShape = {};
	mirrorShape(newShape, schema, maskedKeys(schema, mask));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function maskedKeys(schema, mask) {
	const raw = sourceShape(schema);
	const keys = [];
	for (const key of Reflect.ownKeys(mask)) {
		if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
		if (mask[key]) keys.push(key);
	}
	return keys;
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	const omitted = new Set(maskedKeys(schema, mask));
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = sourceShape(schema);
		for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
	mirrorProps(newShape, shape);
	return newShape;
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge$1(a, b) {
	if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	const newShape = {};
	mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
	mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
	return clone(a, mergeDefs(a._zod.def, {
		shape: newShape,
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask, name = "partial") {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
		type: "optional",
		innerType: value
	})));
	return clone(schema, mergeDefs(schema._zod.def, {
		shape: newShape,
		checks: []
	}));
}
function required$1(Class, schema, mask) {
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
		type: "nonoptional",
		innerType: value
	}));
	return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function attachSchema(issues, start, inst) {
	var _a;
	for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
}
function finalizeIssue(iss, ctx, config) {
	var _a;
	const traits = iss.inst?._zod?.traits;
	if (traits?.has("$ZodType")) {
		if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
		else iss.schema = iss.inst;
	}
	const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const full = {};
	for (const k of Object.keys(iss)) {
		if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
		full[k] = iss[k];
	}
	full.path ?? (full.path = []);
	full.message = message;
	if (ctx?.reportInput) full.input = iss.input;
	return full;
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
	const units = str.length;
	if (!highSurrogate.test(str)) return units;
	let count = units;
	for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
		count--;
		i++;
	}
	return count;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function parsedType(data) {
	const t = typeof data;
	switch (t) {
		case "number": return Number.isNaN(data) ? "nan" : "number";
		case "object": {
			if (data === null) return "null";
			if (Array.isArray(data)) return "array";
			const obj = data;
			if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
		}
	}
	return t;
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
/**
* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
*
* Call this from a `proto` initializer, which runs once per prototype — never per instance.
*/
function members(proto, table) {
	for (const key in table) {
		const desc = Object.getOwnPropertyDescriptor(table, key);
		if (desc.get) Object.defineProperty(proto, key, {
			...desc,
			enumerable: false
		});
		else defineBound(proto, key, desc.value);
	}
}
/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
function own(inst, key, value, enumerable = true) {
	Object.defineProperty(inst, key, {
		configurable: true,
		writable: true,
		enumerable,
		value
	});
	return value;
}
/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
function hide(inst, key, value) {
	return own(inst, key, value, false);
}
/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
function derived(computes, table) {
	for (const key in computes) {
		const compute = computes[key];
		Object.defineProperty(table, key, {
			configurable: true,
			enumerable: true,
			get() {
				return own(this, key, compute(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	return table;
}
function defineBound(proto, key, fn) {
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return this == null ? fn : own(this, key, fn.bind(this));
		},
		set(value) {
			own(this, key, value);
		}
	});
}
/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
function claim(inst, sentinel) {
	const proto = Object.getPrototypeOf(inst);
	return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
	configurable: true,
	get() {
		broke = true;
	}
};
/**
* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
* constructor, computed from the internals object itself and cached there on
* first read. One accessor per constructor rather than one per instance.
*/
function defineLazyInternal(inst, key, compute) {
	const proto = Object.getPrototypeOf(inst._zod);
	if (key in proto && installing !== inst._zod) {
		installing = void 0;
		return;
	}
	installing = inst._zod;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			Object.defineProperty(this, key, breaker);
			const outer = broke;
			broke = false;
			try {
				const value = compute(this);
				if (broke) delete this[key];
				else Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
				broke = broke || outer;
				return value;
			} catch (err) {
				delete this[key];
				broke = broke || outer;
				throw err;
			}
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value
			});
		}
	});
}
/**
* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
* data property. One accessor per constructor rather than one per instance, because an own accessor
* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
*/
function installLazyProp(inst, key, make, enumerable) {
	const proto = claim(inst, key);
	if (!proto) return;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			const desc = {
				configurable: true,
				writable: true,
				enumerable,
				value: void 0
			};
			Object.defineProperty(this, key, desc);
			desc.value = make(this);
			Object.defineProperty(this, key, desc);
			return desc.value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
		}
	});
}
/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
var CONSTANT_CATCH = "~constantCatch";
/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
function constantCatch(value) {
	const fn = () => value;
	fn[CONSTANT_CATCH] = true;
	return fn;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/core.js
var _a$1;
var _zodDesc = {
	value: void 0,
	enumerable: false
};
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
	const E = _E;
	if (E) {
		const saved = E.stackTraceLimit;
		if (typeof saved === "number") {
			try {
				E.stackTraceLimit = 0;
			} catch {
				_E = null;
				return new Definition();
			}
			try {
				return new Definition();
			} finally {
				E.stackTraceLimit = saved;
			}
		}
	}
	return new Definition();
}
function $constructor(name, initializer, proto, params) {
	const zodProto = {};
	function Internals(def) {
		this.def = def;
		this.constr = _;
		this.traits = /* @__PURE__ */ new Set();
	}
	Internals.prototype = zodProto;
	const protoMembers = proto;
	const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
	function init(inst, def) {
		if (!inst._zod) {
			_zodDesc.value = new Internals(def);
			try {
				Object.defineProperty(inst, "_zod", _zodDesc);
			} finally {
				_zodDesc.value = void 0;
			}
		} else if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		if (initialized) {
			const own = Object.getPrototypeOf(inst);
			const ctorProto = inst._zod.constr.prototype;
			let up = own;
			while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
			const target = up ?? own;
			if (!initialized.has(target)) {
				initialized.add(target);
				members(target, protoMembers);
			}
		}
		const proto = _.prototype;
		for (const k in proto) {
			if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		const inst = params?.Parent ? newError(Definition) : this;
		init(inst, def);
		const deferred = inst._zod.deferred;
		if (deferred) {
			for (const fn of deferred) fn();
			inst._zod.deferred = void 0;
		}
		const pp = globalThis.__zod_globalConfig?.postProcessor;
		if (pp) pp(inst);
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/errors.js
function _getMessage() {
	const internals = this._zod;
	internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
	return internals.message;
}
function _setMessage(value) {
	this._zod.message = value;
}
var _messageDesc = {
	get: _getMessage,
	set: _setMessage,
	enumerable: true,
	configurable: true
};
var _issuesDesc = {
	value: void 0,
	enumerable: false
};
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	_issuesDesc.value = def;
	Object.defineProperty(inst, "issues", _issuesDesc);
	_issuesDesc.value = void 0;
	Object.defineProperty(inst, "message", _messageDesc);
	const proto = Object.getPrototypeOf(inst);
	if (!_installedToString.has(proto)) {
		_installedToString.add(proto);
		Object.defineProperty(proto, "toString", {
			configurable: true,
			enumerable: false,
			get() {
				const value = () => this.message;
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
};
var $ZodError = $constructor("$ZodError", initializer$1);
$constructor("$ZodError", initializer$1, void 0, { Parent: Error });
/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
* ("toString", "constructor") would otherwise read through to the prototype, and assigning
* "__proto__" would hit the setter instead of creating a key. */
function node(obj, key, make) {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		if (key === "__proto__") Object.defineProperty(obj, key, {
			value: make(),
			writable: true,
			enumerable: true,
			configurable: true
		});
		else obj[key] = make();
	}
	return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
	else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					const terminal = i === fullpath.length - 1;
					if (el === "_errors") {
						if (terminal) curr._errors.push(mapper(issue));
						i++;
						continue;
					}
					if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
						value: { _errors: [] },
						enumerable: true,
						writable: true,
						configurable: true
					});
					const node = curr[el];
					if (terminal) node._errors.push(mapper(issue));
					curr = node;
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
	return {
		callee: params?.callee ?? callee,
		Err: params?.Err
	};
}
var _parse = (_Err) => {
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _parseAsync = (_Err) => {
	const fn = async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
function failure(Err, issues, ctx) {
	let error;
	return {
		success: false,
		get error() {
			if (!error) {
				error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
				issues = void 0;
				ctx = void 0;
			}
			return error;
		},
		set error(e) {
			error = e;
			issues = void 0;
			ctx = void 0;
		}
	};
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate = ((schema, value, _ctx) => {
	const validator = schema._zod.bag.validator;
	if (validator !== void 0) {
		if (validator(value) !== COMPILE_INVALID) return true;
		if (validator.definite === true && _ctx === void 0) return false;
	}
	return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
	const ctx = _ctx ? {
		..._ctx,
		async: false,
		abortEarly: true
	} : {
		async: false,
		abortEarly: true
	};
	const fallbackRun = schema._zod.bag.fallbackRun;
	let result;
	if (fallbackRun) {
		ctx[COMPILE_FALLBACK] = true;
		result = fallbackRun({
			value,
			issues: []
		}, ctx);
	} else result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length === 0;
}
var validateAsync$1 = async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true,
		abortEarly: true
	} : {
		async: true,
		abortEarly: true
	};
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length === 0;
};
var _encode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return parse(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _encodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
	return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
var uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
/** Anchors a pattern source. The interpolation lives here rather than at the call site because
* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
function anchor(source) {
	return new RegExp(`^${source}$`);
}
var date = /*@__PURE__*/ anchor(dateSource);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
	const opts = ["Z"];
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const qualified = `${timeSource({
		precision: args.precision,
		seconds: true
	})}(?:${opts.join("|")})`;
	const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var integer = /^-?\d+$/;
var number$2 = /^-?\d+(?:\.\d+)?$/;
var boolean$1 = /^(?:true|false)$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/checks.js
var $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
var _whenHasLength = (payload) => {
	const val = payload.value;
	return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
var $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
var $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex$2(def.includes);
	def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex$2(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex$2(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = [], closed = {}) {
		this.content = [];
		this.indent = 0;
		this.args = args;
		this.closed = closed;
	}
	indented(fn) {
		this.indent += 1;
		try {
			fn(this);
		} finally {
			this.indent -= 1;
		}
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const content = this?.content ?? [``];
		return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
	}
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/versions.js
var version = {
	major: 4,
	minor: 6,
	patch: 4
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/schemas.js
var $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const defChecks = inst._zod.def.checks;
	const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			if (payload.memo) return payload;
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
}, {
	get "~standard"() {
		return hide(this, "~standard", standardProps(this));
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	}
});
/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
	const ctx = { async: true };
	return toStandardResult(await inst._zod.run({
		value,
		issues: []
	}, ctx), ctx);
}
function standardProps(inst) {
	return {
		validate: (value) => {
			const ctx = { async: false };
			try {
				const r = inst._zod.run({
					value,
					issues: []
				}, ctx);
				if (!(r instanceof Promise)) return toStandardResult(r, ctx);
			} catch (_) {}
			return validateAsync(inst, value);
		},
		vendor: "zod",
		version: 1
	};
}
var $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = def.pattern ?? anyString;
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
var $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
var $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
var $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
var $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
function canParseURL(input) {
	try {
		if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
function validateURL(trimmed, def) {
	if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
	return parseURLObject(trimmed, def);
}
/** Parses a URL while preserving the non-normalizing HTTP guard. */
function parseURLObject(trimmed, def) {
	if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
	try {
		if (typeof URL !== "undefined") {
			const URLStatic = URL;
			if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
		}
		return new URL(trimmed);
	} catch {
		return 2;
	}
}
var asciiTabOrNewline = /[\t\n\r]/g;
/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
function stripTabAndNewline(value) {
	return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
	hostname.lastIndex = 0;
	return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
	protocol.lastIndex = 0;
	return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			const url = validateURL(trimmed, def);
			if (url === 1) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === 2) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === true) {
				payload.value = stripTabAndNewline(trimmed);
				return;
			}
			if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: def.hostname.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: def.protocol.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
var $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
	def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
var $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
var $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date);
	$ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration);
	$ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
});
/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
	if (!ipv6Alphabet.test(value)) return false;
	return canParseURL(`http://[${value}]`);
}
var $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidIPv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
	const parts = value.split("/");
	if (parts.length !== 2) return false;
	const [address, prefix] = parts;
	if (!prefix) return false;
	const prefixNum = Number(prefix);
	if (`${prefixNum}` !== prefix) return false;
	if (prefixNum < 0 || prefixNum > 128) return false;
	return isValidIPv6(address);
}
var $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidCIDRv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64Charset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
	if (!base64urlCharset.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
var $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64urlCharset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
var $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = number$2;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
var $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
var $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
var $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
var $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
var $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
		const proms = [];
		const abortEarly = ctx?.abortEarly;
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else {
				handleArrayResult(result, payload, i);
				if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, optin, optout) {
	const isPresent = key in input;
	const isOptionalOut = optout === "optional";
	if (!isPresent && isOptionalOut && optin === "optional") return;
	if (result.issues.length) {
		if (optin !== void 0 && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && optin === void 0) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	const ownSymbols = Object.getOwnPropertySymbols(def.shape);
	const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
	const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
	for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		allKeys,
		symbolKeys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const optin = _catchall.optin;
	const optout = _catchall.optout;
	let seen = 0;
	for (const key in input) {
		if (abortEarly && payload.issues.length !== seen) {
			if (aborted(payload, seen)) break;
			seen = payload.issues.length;
		}
		if (keySet.has(key)) continue;
		if (key === "__proto__") {
			if (t === "never") unrecognized.push(key);
			continue;
		}
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
		else handlePropertyResult(r, payload, key, input, optin, optout);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst,
		continue: true
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
var $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	const sh = desc?.get ? desc.get.raw : def.shape ?? {};
	if (sh) {
		const get = () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			get.raw = newSh;
			return newSh;
		};
		get.raw = sh;
		Object.defineProperty(def, "shape", { get });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazyInternal(inst, "propValues", (zod) => {
		const shape = zod.def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
				if (field.optin !== void 0) propValues[key].add(void 0);
			}
		}
		return propValues;
	});
	const isObject$2 = isObject;
	const catchall = def.catchall;
	let value;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
		const proms = [];
		const shape = value.shape;
		const abortEarly = ctx?.abortEarly;
		let seen = payload.issues.length;
		for (const key of value.allKeys) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (key === "__proto__") continue;
			const el = shape[key];
			const optin = el._zod.optin;
			const optout = el._zod.optout;
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
	};
});
var $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const memo = globalConfig.memoizer;
	const generateFastpass = (shape) => {
		const normalized = _normalized.value;
		const syms = normalized.symbolKeys;
		const doc = new Doc(["payload", "ctx"], {
			shape,
			inst,
			memo,
			syms
		});
		const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
		doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
		for (const key of normalized.allKeys) {
			if (key === "__proto__") continue;
			const id = ids[key];
			const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
			const isPresent = `${k} in input`;
			const schema = shape[key];
			const optin = schema?._zod?.optin;
			const isOptionalIn = optin !== void 0;
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(k)};`);
			if (isOptionalIn && isOptionalOut) {
				const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
				doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
			else {
				doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
				if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
				else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
			}
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		return doc.compile();
	};
	let fastpass;
	const isObject$1 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
var $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
	defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazyInternal(inst, "values", (zod) => {
		if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		if (zod.def.options.every((o) => o._zod.pattern)) {
			const patterns = zod.def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
function discriminatorMap(def) {
	const map = /* @__PURE__ */ new Map();
	for (const option of def.options) {
		const values = option._zod.propValues?.[def.discriminator];
		if (!values || values.size === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
		for (const value of values) if (map.has(value)) {
			if (value !== void 0) throw new Error(`Duplicate discriminator value "${String(value)}"`);
			map.set(value, null);
		} else map.set(value, option);
	}
	return map;
}
var $ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
	def.inclusive = false;
	$ZodUnion.init(inst, def);
	const _super = inst._zod.parse;
	defineLazyInternal(inst, "propValues", (zod) => {
		const propValues = {};
		let undefinedCount = 0;
		for (const option of zod.def.options) {
			const pv = option._zod.propValues;
			if (!pv || Object.keys(pv).length === 0) throw new Error(`Invalid discriminated union option at index "${zod.def.options.indexOf(option)}"`);
			if (pv[zod.def.discriminator]?.has(void 0)) undefinedCount++;
			for (const [k, v] of Object.entries(pv)) {
				if (!Object.prototype.hasOwnProperty.call(propValues, k)) assignProp(propValues, k, /* @__PURE__ */ new Set());
				for (const val of v) propValues[k].add(val);
			}
		}
		if (!zod.def.unionFallback && undefinedCount > 1) propValues[zod.def.discriminator]?.delete(void 0);
		return propValues;
	});
	def.options.forEach((option, i) => {
		const propShape = rawShape(option._zod.def);
		if (propShape && !Object.prototype.hasOwnProperty.call(propShape, def.discriminator)) throw new Error(`Invalid discriminated union option at index "${i}"`);
	});
	const disc = cached(() => discriminatorMap(def));
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isObject(input)) {
			payload.issues.push({
				code: "invalid_type",
				expected: "object",
				input,
				inst
			});
			return payload;
		}
		const value = input?.[def.discriminator];
		const opt = disc.value.get(value);
		if (opt && (value !== void 0 || ctx.direction !== "backward")) return opt._zod.run(payload, ctx);
		if (def.unionFallback || ctx.direction === "backward") return _super(payload, ctx);
		payload.issues.push({
			code: "invalid_union",
			errors: [],
			note: "No matching discriminator",
			discriminator: def.discriminator,
			options: Array.from(disc.value.keys()).filter((value) => disc.value.get(value) !== null),
			input,
			path: [def.discriminator],
			inst
		});
		return payload;
	};
});
var $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
		for (const key of sharedKeys) {
			if (key === "__proto__") continue;
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	const keyIssues = /* @__PURE__ */ new Map();
	const collect = (iss, side) => {
		let keys;
		if (iss.code === "unrecognized_keys" && !iss.path?.length) {
			unrecIssue ?? (unrecIssue = iss);
			keys = iss.keys;
		} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
			const k = String(iss.path[0]);
			if (!keyIssues.has(k)) keyIssues.set(k, iss);
			keys = [k];
		} else return false;
		for (const k of keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k)[side] = true;
		}
		return true;
	};
	for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
	for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length) {
		const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
		if (aggregated.length) result.issues.push({
			...unrecIssue,
			keys: aggregated
		});
		for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
	}
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) {
		if (aborted(result)) return result;
		throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	}
	result.value = merged.data;
	return result;
}
var $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values && !def.partial) {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				if (key === "__proto__") continue;
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				if (def.mode === "loose") {
					if (key === "__proto__") continue;
					payload.value[key] = input[key];
				} else {
					unrecognized = unrecognized ?? [];
					unrecognized.push(key);
				}
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		} else {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			let unrecognized;
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$2.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else if (values) {
						unrecognized = unrecognized ?? [];
						unrecognized.push(key);
					} else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
var $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	defineLazyInternal(inst, "pattern", (zod) => {
		const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
		return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex$2(o.toString())).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	const values = new Set(def.values);
	inst._zod.values = values;
	defineLazyInternal(inst, "pattern", (zod) => {
		const vals = zod.def.values;
		return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex$2(o) : o ? escapeRegex$2(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	globalConfig.memoizer?.guard(inst);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(payload, result) {
	payload.value = result.issues.length ? void 0 : result.value;
	return payload;
}
var $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	inst._zod.optout = "optional";
	defineLazyInternal(inst, "values", (zod) => {
		const values = zod.def.innerType._zod.values;
		return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === void 0) {
			if (def.innerType._zod.optin !== "defaulted") return payload;
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
			return handleOptionalResult(payload, result);
		}
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazyInternal(inst, "values", (zod) => {
		return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
var $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => {
		const v = zod.def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
function handleCatchResult(payload, result, def, ctx) {
	if (!result.issues.length) {
		payload.value = result.value;
		if (result.memo) payload.memo = true;
		return payload;
	}
	payload.value = def.catchValue({
		...result,
		value: payload.value,
		error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
		input: payload.value
	});
	return payload;
}
var $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run({
			value: payload.value,
			issues: []
		}, ctx);
		if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
		return handleCatchResult(payload, result, def, ctx);
	};
});
var $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
var $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	if (!payload.memo) payload.value = Object.freeze(payload.value);
	return payload;
}
var $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
	constructor() {
		super(`Cannot parse a reference cycle that closes through a transform`);
		this.name = "ZodCyclicError";
	}
};
/** Keyed off the context object every schema in one parse call already shares. */
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
	return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
	return issues.map((iss) => iss.path ? {
		...iss,
		path: iss.path.slice()
	} : { ...iss });
}
var recursive = /*@__PURE__*/ new WeakMap();
/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
function isRecursive(inst, stack, resolve) {
	const cached = recursive.get(inst);
	if (cached !== void 0) return cached ? PROVEN : NONE;
	if (stack.has(inst)) return PROVEN;
	stack.add(inst);
	let result = NONE;
	const check = (child) => {
		if (result !== PROVEN && child?._zod) {
			const answer = isRecursive(child, stack, resolve);
			if (answer > result) result = answer;
		}
	};
	const shape = (sh, spread) => {
		let answer = NONE;
		for (const key of Reflect.ownKeys(sh)) {
			const desc = Object.getOwnPropertyDescriptor(sh, key);
			if (spread && !desc.enumerable) continue;
			const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
			if (child > answer) answer = child;
		}
		return answer;
	};
	const merge = (answer) => {
		if (answer > result) result = answer;
	};
	const def = inst._zod.def;
	switch (def.type) {
		case "object": {
			const raw = rawShape(def);
			merge(raw ? shape(raw, true) : ASSUMED);
			check(def.catchall);
			break;
		}
		case "array":
			check(def.element);
			break;
		case "tuple":
			for (const el of def.items) check(el);
			check(def.rest);
			break;
		case "record":
		case "map":
			check(def.keyType);
			check(def.valueType);
			break;
		case "set":
			check(def.valueType);
			break;
		case "union":
			for (const el of def.options) check(el);
			break;
		case "intersection":
			check(def.left);
			check(def.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			check(def.innerType);
			break;
		case "pipe":
			check(def.in);
			check(def.out);
			break;
		case "function":
			check(def.input);
			check(def.output);
			break;
		case "lazy": {
			const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
			merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (const key in def) {
			const desc = Object.getOwnPropertyDescriptor(def, key);
			if (!desc || desc.get) continue;
			const value = desc.value;
			if (!value || typeof value !== "object") continue;
			if (value._zod) check(value);
			else if (Array.isArray(value)) for (const el of value) check(el);
		}
	}
	stack.delete(inst);
	return settle(inst, result);
}
/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
function settle(inst, answer) {
	if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
	return answer;
}
function bucketFor(state, inst) {
	let bucket = state.buckets.get(inst);
	if (!bucket) {
		bucket = /* @__PURE__ */ new WeakMap();
		state.buckets.set(inst, bucket);
	}
	return bucket;
}
var handoff;
var open = [];
var memo = {
	alloc(_inst, payload, empty) {
		const bucket = handoff;
		if (!bucket) return empty;
		handoff = void 0;
		const entry = {
			value: empty,
			issues: null
		};
		bucket.set(payload.value, entry);
		open.push(entry);
		return empty;
	},
	guard(inst) {
		var _a;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
				return base(payload, ctx);
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	},
	attach(inst) {
		var _a;
		let isRecursiveInst;
		let rechecked = false;
		let lastCtx;
		let lastBucket;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (isRecursiveInst === void 0) {
					const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
					if (walked === NONE) {
						inst._zod.parse = base;
						if (inst._zod.run === wrapped) inst._zod.run = base;
						return base(payload, ctx);
					}
					if (walked === PROVEN || rechecked) isRecursiveInst = true;
					else rechecked = true;
				}
				const input = payload.value;
				if (!isRef(input)) return base(payload, ctx);
				let state = ctx[STATE];
				if (!state) {
					state = {
						buckets: /* @__PURE__ */ new WeakMap(),
						backEdges: void 0
					};
					ctx[STATE] = state;
				}
				let bucket;
				if (lastCtx === ctx) bucket = lastBucket;
				else {
					bucket = bucketFor(state, inst);
					lastCtx = ctx;
					lastBucket = bucket;
				}
				const hit = bucket.get(input);
				if (hit) {
					payload.value = hit.value;
					if (hit.issues) {
						if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
					} else {
						payload.memo = true;
						state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
						state.backEdges.add(hit.value);
					}
					return payload;
				}
				handoff = bucket;
				const depth = open.length;
				const result = base(payload, ctx);
				handoff = void 0;
				const entry = open.length > depth ? open.pop() : void 0;
				if (result instanceof Promise) return result.then((r) => {
					if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
					return r;
				});
				if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
				return result;
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	}
};
/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
function memoizer() {
	return memo;
}
/** Whether this value is a node a back-edge resolved to before it finished. */
function isBackEdge(ctx, value) {
	const backEdges = ctx[STATE]?.backEdges;
	return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/locales/en.js
var error = () => {
	const Sizable = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function getSizing(origin) {
		return Sizable[origin] ?? null;
	}
	const FormatDictionary = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	};
	const TypeDictionary = { nan: "NaN" };
	function getTypeName(type, input) {
		if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
		return TypeDictionary[type] ?? type;
	}
	return (issue) => {
		switch (issue.code) {
			case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
			case "invalid_value":
				if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
				return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
			case "too_big": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
				return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
			}
			case "too_small": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
				return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
			}
			case "invalid_format": {
				const _issue = issue;
				if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
				if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
				if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
				if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
				return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${issue.origin}`;
			case "invalid_union":
				if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
				if (issue.inclusive === false) return "Invalid input: more than one option matched";
				return "Invalid input";
			case "invalid_element": return `Invalid value in ${issue.origin}`;
			default: return `Invalid input`;
		}
	};
};
function en_default() {
	return { localeError: error() };
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
	if (def.checks) def.checks = [...def.checks];
	return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class(snapshotChecks({
		type: "string",
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		checks: [],
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _coercedNumber(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		coerce: true,
		checks: [],
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
	for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
	return target;
}
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: params?.external ?? void 0
	};
}
/**
* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
* custom JSON Schema was written into `json`, in which case the caller must not write its own.
*/
function handleUnrepresentable(schema, ctx, json, params, message) {
	const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
		zodSchema: schema,
		path: params.path,
		message
	}) : ctx.unrepresentable;
	if (result === "any") return false;
	if (result === void 0 || result === "throw") throw new Error(message);
	Object.assign(json, result);
	return true;
}
function processSchema(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	ctx.sharedDefsExtractedFor = void 0;
	ctx.sharedEmitDoneFor = void 0;
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			processSchema(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) assignProps(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function encodeJSONPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
			};
		}
		const uriPrefix = `#`;
		const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
		if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + encodeJSONPointerSegment(defId)
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") extractToDef(entry);
		}
	}
	if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
}
/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
function compactTypeUnion(schema) {
	const options = schema.anyOf;
	if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
	const types = [];
	for (const option of options) {
		if (!option || typeof option !== "object") return;
		compactTypeUnion(option);
		const keys = Object.keys(option);
		if (keys.length !== 1 || keys[0] !== "type") return;
		const type = option.type;
		for (const member of Array.isArray(type) ? type : [type]) {
			if (typeof member !== "string") return;
			if (!types.includes(member)) types.push(member);
		}
	}
	delete schema.anyOf;
	schema.type = types.length === 1 ? types[0] : types;
}
/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
* an annotation like `description` — makes a member unfoldable, so a constraint this does not
* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
var FOLDABLE_KEYS = /* @__PURE__ */ new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]);
var UNION_KEYS = ["oneOf", "anyOf"];
/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
function undeclaredConstraint(member) {
	const extra = member.additionalProperties;
	if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
	return Object.keys(extra).length ? extra : null;
}
/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
function foldObjects(members) {
	const objects = [];
	for (const member of members) {
		if (typeof member !== "object" || member.type !== "object") return null;
		for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
		objects.push(member);
	}
	const properties = {};
	const required = /* @__PURE__ */ new Set();
	for (const object of objects) {
		for (const key in object.properties) {
			if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
			const parts = [];
			for (const other of objects) {
				const part = other.properties?.[key] ?? undeclaredConstraint(other);
				if (part === null || part === void 0) continue;
				if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
			}
			assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
		}
		for (const key of object.required ?? []) required.add(key);
	}
	const folded = {
		type: "object",
		properties
	};
	if (required.size) folded.required = [...required];
	if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
	else {
		const constraints = [];
		for (const object of objects) {
			const constraint = undeclaredConstraint(object);
			if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
		}
		if (constraints.length === 1) folded.additionalProperties = constraints[0];
		else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
	}
	return folded;
}
/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
* closed object members reject each other's keys and the schema validates nothing. Zod's parser
* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
* into one object is the encoding that says so on every target.
*
* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
* keeps its reference and its own closedness rather than being inlined as a stale copy. */
function foldIntersection(json) {
	const allOf = json.allOf;
	if (!Array.isArray(allOf) || allOf.length < 2) return;
	for (const key of FOLDABLE_KEYS) if (key in json) return;
	const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
	let folded = null;
	if (!unions.length) folded = foldObjects(allOf);
	else {
		const union = unions[0];
		const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
		if (Object.keys(union).length !== 1) return;
		const rest = allOf.filter((m) => m !== union);
		const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
		if (branches.some((b) => !b)) return;
		folded = { [keyword]: branches };
	}
	if (!folded) return;
	delete json.allOf;
	assignProps(json, folded);
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else assignProps(schema, refSchema);
			assignProps(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
		for (const rewrite of ctx.deferred) rewrite();
		if (ctx.intersections.length) {
			const carriers = /* @__PURE__ */ new Map();
			for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
				const allOf = json?.allOf;
				if (!Array.isArray(allOf)) continue;
				const existing = carriers.get(allOf);
				if (existing) existing.push(json);
				else carriers.set(allOf, [json]);
			}
			for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
		}
	}
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			assignProp(defs, seen.defId, seen.def);
		}
	}
	if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
	if (ctx.external) {} else if (Object.keys(defs).length > 0) {
		if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
	}
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
	if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
};
var narrowMax = (agg, key, value) => {
	if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
};
var narrowBoth = (agg, value) => {
	narrowMin(agg, "minimum", value);
	narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
	agg.multipleOf ?? (agg.multipleOf = []);
	if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
	agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
	agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
	agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
	agg.format = format;
	if (format.includes("int")) agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
	setFormat(agg, def.format);
	const [minimum, maximum] = ranges[def.format];
	narrowMin(agg, "minimum", minimum);
	narrowMax(agg, "maximum", maximum);
};
var contributors = {
	greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
	less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
	multiple_of: (agg, def) => addDivisor(agg, def.value),
	number_format: formatContributor(NUMBER_FORMAT_RANGES),
	bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
	min_length: minContributor,
	max_length: maxContributor,
	length_equals: (agg, def) => narrowBoth(agg, def.length),
	min_size: minContributor,
	max_size: maxContributor,
	size_equals: (agg, def) => narrowBoth(agg, def.size),
	string_format: (agg, def) => {
		setFormat(agg, def.format);
		if (def.pattern) addPattern(agg, def.pattern);
		if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
		if (def.local || def.precision === -1) agg.laxFormat = true;
	},
	mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
	const agg = {};
	const def = schema._zod.def;
	const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
	for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
	const bag = schema._zod.bag;
	if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
	if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
	if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
	if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
	if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
	if (bag.format !== void 0) {
		agg.format ?? (agg.format = bag.format);
		if (bag.format.includes("int")) agg.isInt = true;
	}
	if (bag.mime) intersectMime(agg, bag.mime);
	for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
	return agg;
}
var formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
var exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time" || laxFormat) delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const patternList = [...patterns].map(exactPattern);
		if (patternList.length === 1) json.pattern = patternList[0].source;
		else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
var numberProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
	json.type = isInt ? "integer" : "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) {
		if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
	} else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) {
		if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
	} else if (typeof maximum === "number") json.maximum = maximum;
	if (multipleOf) {
		const divisors = /* @__PURE__ */ new Set();
		for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
		else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
		const [first, ...rest] = divisors;
		if (first !== void 0) json.multipleOf = first;
		if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
	}
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
var neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
var enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.length === 0) {
		json.not = {};
		return;
	}
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
var literalProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	if (def.values.length === 0) {
		json.not = {};
		return;
	}
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema")) return;
	} else if (typeof val === "bigint") {
		if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema")) return;
		vals.push(Number(val));
	} else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
var customProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = processSchema(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
function inputOptin(schema) {
	const def = schema._zod.def;
	if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
	if (def.type === "catch") return inputOptin(def.innerType);
	return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const shape = def.shape;
	if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
	json.type = "object";
	json.properties = {};
	for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	}));
	const requiredKeys = [];
	for (const key of Object.keys(shape)) {
		const field = def.shape[key];
		if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
	}
	if (requiredKeys.length > 0) json.required = requiredKeys;
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
var unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
var intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = processSchema(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = processSchema(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	json.allOf = allOf;
	ctx.intersections.push(allOf);
};
/** JSON object keys are always strings, so a numeric record key schema is re-expressed over the
* numeric-string form the record parser matches. Deferred to `finalize`, after the flatten: a key
* behind a wrapper only carries its own `type` before then, and a union key only has its branches.
*
* A numeric bound cannot apply to a property name, so `minimum` and its siblings are dropped rather
* than carried over: keeping them beside `type: "string"` reproduces the match-nothing schema this
* exists to fix. A key that carries one therefore emits wider than the record parses — `z.record(z.number().min(5), V)`
* accepts `"3"` — which is the deliberate trade, since throwing on it would reject an ordinary schema
* outright. */
function stringifyKeyNames(bySchema, json, visited) {
	if (json.$ref) {
		if (visited.has(json)) return json;
		visited.add(json);
		const def = bySchema.get(json)?.def;
		if (!def) return json;
		const inlined = stringifyKeyNames(bySchema, def, visited);
		return inlined === def ? json : inlined;
	}
	for (const keyword of ["anyOf", "oneOf"]) {
		const branches = json[keyword];
		if (!Array.isArray(branches)) continue;
		const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
		if (mapped.some((branch, i) => branch !== branches[i])) json = {
			...json,
			[keyword]: mapped
		};
	}
	const types = Array.isArray(json.type) ? json.type : [json.type];
	const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
	const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
	if (!numericType && !values?.some((v) => typeof v === "number")) return json;
	const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
	if (rest.enum) rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
	else if (typeof rest.const === "number") rest.const = String(rest.const);
	if (!numericType) return rest;
	rest.type = "string";
	if (!values) rest.pattern = (types.includes("number") ? number$2 : integer).source;
	return rest;
}
/** Every record of one conversion, so the carriers are found in a single pass rather than once per record. */
var pendingRecords = /* @__PURE__ */ new WeakMap();
function rewriteKeyNames(ctx) {
	const bySchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.values()) if (entry.def && !bySchema.has(entry.schema)) bySchema.set(entry.schema, entry);
	const rewrites = /* @__PURE__ */ new Map();
	for (const record of pendingRecords.get(ctx) ?? []) {
		const seen = ctx.seen.get(record);
		const names = (seen?.def ?? seen?.schema)?.propertyNames;
		if (!names || names === true || rewrites.has(names)) continue;
		const rewritten = stringifyKeyNames(bySchema, names, /* @__PURE__ */ new Set());
		if (rewritten !== names) rewrites.set(names, rewritten);
	}
	if (!rewrites.size) return;
	for (const entry of ctx.seen.values()) for (const carrier of [entry.schema, entry.def]) {
		const rewritten = carrier && rewrites.get(carrier.propertyNames);
		if (rewritten) carrier.propertyNames = rewritten;
	}
}
var recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = aggregateChecks(keyType).patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = processSchema(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
			json.propertyNames = processSchema(def.keyType, ctx, {
				...params,
				path: [...params.path, "propertyNames"]
			});
			let pending = pendingRecords.get(ctx);
			if (!pending) {
				pending = [];
				pendingRecords.set(ctx, pending);
				ctx.deferred.push(() => rewriteKeyNames(ctx));
			}
			pending.push(schema);
		}
		json.additionalProperties = processSchema(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
	if (keyValues && !def.partial && !omittableOnInput) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues.map(String);
	}
};
var nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
var UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
	let unrepresentable = false;
	const serialized = JSON.stringify(value, (_, val) => {
		if (typeof val !== "bigint") return val;
		unrepresentable = true;
		return null;
	});
	if (!unrepresentable) return JSON.parse(serialized);
	handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
	return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io !== "input") return;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	processSchema(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
	Object.defineProperty(proto, key, {
		configurable: true,
		enumerable: false,
		get() {
			const value = make(this);
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
		}
	});
}
var initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	const proto = Object.getPrototypeOf(inst);
	if (_installedErrorProtos.has(proto)) return;
	_installedErrorProtos.add(proto);
	_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
	_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
	_lazyMethod(proto, "addIssue", (self) => (issue) => {
		self.issues.push(issue);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	_lazyMethod(proto, "addIssues", (self) => (issues) => {
		self.issues.push(...issues);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	Object.defineProperty(proto, "isEmpty", {
		configurable: true,
		enumerable: false,
		get() {
			return this.issues.length === 0;
		}
	});
};
var ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/classic/parse.js
var parse$1 = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
	if (!globalConfig.localeError) config(en_default());
}
function _ensureDefaultMemoizer() {
	if (!globalConfig.memoizer) config({ memoizer: memoizer() });
}
var ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	_ensureDefaultLocale();
	$ZodType.init(inst, def);
	inst.def = def;
	inst.type = def.type;
	return inst;
}, {
	check(...chks) {
		const def = this.def;
		return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
			check: ch,
			def: { check: "custom" },
			onattach: []
		} } : ch)] }), { parent: true });
	},
	with(...chks) {
		return this.check(...chks);
	},
	clone(def, params) {
		return clone(this, def, params);
	},
	brand() {
		return this;
	},
	register(reg, meta) {
		reg.add(this, meta);
		return this;
	},
	refine(check, params) {
		return this.check(refine(check, params));
	},
	superRefine(refinement, params) {
		return this.check(superRefine(refinement, params));
	},
	overwrite(fn) {
		return this.check(/* @__PURE__ */ _overwrite(fn));
	},
	optional() {
		return optional(this);
	},
	exactOptional() {
		return exactOptional(this);
	},
	nullable() {
		return nullable(this);
	},
	nullish() {
		return optional(nullable(this));
	},
	nonoptional(params) {
		return nonoptional(this, params);
	},
	array() {
		return array(this);
	},
	or(arg) {
		return union([this, arg]);
	},
	and(arg) {
		return intersection(this, arg);
	},
	transform(tx) {
		return pipe(this, transform(tx));
	},
	default(d) {
		return _default(this, d);
	},
	prefault(d) {
		return prefault(this, d);
	},
	catch(params) {
		return _catch(this, params);
	},
	pipe(target) {
		return pipe(this, target);
	},
	readonly() {
		return readonly(this);
	},
	describe(description) {
		const cl = this.clone();
		globalRegistry.add(cl, { description });
		return cl;
	},
	meta(...args) {
		if (args.length === 0) return globalRegistry.get(this);
		const cl = this.clone();
		globalRegistry.add(cl, args[0]);
		return cl;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(fn, ...args) {
		return args.length === 0 ? fn(this) : fn(this, ...args);
	},
	get "~standard"() {
		return hide(this, "~standard", {
			...standardProps(this),
			jsonSchema: {
				input: createStandardJSONSchemaMethod(this, "input"),
				output: createStandardJSONSchemaMethod(this, "output")
			}
		});
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	},
	parse: function _parse(data, params) {
		return parse$1(this, data, params, { callee: _parse });
	},
	parseAsync: async function _parseAsync(data, params) {
		return await parseAsync(this, data, params, { callee: _parseAsync });
	},
	safeParse(data, params) {
		return safeParse(this, data, params);
	},
	async safeParseAsync(data, params) {
		return safeParseAsync(this, data, params);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(value) {
		own(this, "spa", value);
	},
	validate(data, params) {
		return validate(this, data, params);
	},
	validateAsync(data, params) {
		return validateAsync$1(this, data, params);
	},
	encode: function _encode(data, params) {
		return encode(this, data, params, { callee: _encode });
	},
	decode: function _decode(data, params) {
		return decode(this, data, params, { callee: _decode });
	},
	encodeAsync: async function _encodeAsync(data, params) {
		return await encodeAsync(this, data, params, { callee: _encodeAsync });
	},
	decodeAsync: async function _decodeAsync(data, params) {
		return await decodeAsync(this, data, params, { callee: _decodeAsync });
	},
	safeEncode(data, params) {
		return safeEncode(this, data, params);
	},
	safeDecode(data, params) {
		return safeDecode(this, data, params);
	},
	async safeEncodeAsync(data, params) {
		return safeEncodeAsync(this, data, params);
	},
	async safeDecodeAsync(data, params) {
		return safeDecodeAsync(this, data, params);
	},
	toJSONSchema(params) {
		return createToJSONSchemaMethod(this, {})(params);
	},
	get description() {
		return globalRegistry.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
});
/** @internal */
var _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /*@__PURE__*/ derived({
	format: (inst) => aggregateChecks(inst).format ?? null,
	minLength: (inst) => aggregateChecks(inst).minimum ?? null,
	maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
	regex(...args) {
		return this.check(/* @__PURE__ */ _regex(...args));
	},
	includes(...args) {
		return this.check(/* @__PURE__ */ _includes(...args));
	},
	startsWith(...args) {
		return this.check(/* @__PURE__ */ _startsWith(...args));
	},
	endsWith(...args) {
		return this.check(/* @__PURE__ */ _endsWith(...args));
	},
	min(...args) {
		return this.check(/* @__PURE__ */ _minLength(...args));
	},
	max(...args) {
		return this.check(/* @__PURE__ */ _maxLength(...args));
	},
	length(...args) {
		return this.check(/* @__PURE__ */ _length(...args));
	},
	nonempty(...args) {
		return this.check(/* @__PURE__ */ _minLength(1, ...args));
	},
	lowercase(params) {
		return this.check(/* @__PURE__ */ _lowercase(params));
	},
	uppercase(params) {
		return this.check(/* @__PURE__ */ _uppercase(params));
	},
	trim() {
		return this.check(/* @__PURE__ */ _trim());
	},
	normalize(...args) {
		return this.check(/* @__PURE__ */ _normalize(...args));
	},
	toLowerCase() {
		return this.check(/* @__PURE__ */ _toLowerCase());
	},
	toUpperCase() {
		return this.check(/* @__PURE__ */ _toUpperCase());
	},
	slugify() {
		return this.check(/* @__PURE__ */ _slugify());
	}
}));
var ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
}, {
	email(params) {
		return this.check(/* @__PURE__ */ _email(ZodEmail, params));
	},
	url(params) {
		return this.check(/* @__PURE__ */ _url(ZodURL, params));
	},
	jwt(params) {
		return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	},
	emoji(params) {
		return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	},
	guid(params) {
		return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
	},
	uuid(params) {
		return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	},
	uuidv4(params) {
		return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	},
	uuidv6(params) {
		return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	},
	uuidv7(params) {
		return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	},
	nanoid(params) {
		return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	},
	cuid(params) {
		return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	},
	cuid2(params) {
		return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	},
	ulid(params) {
		return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
	},
	base64(params) {
		return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
	},
	base64url(params) {
		return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	},
	xid(params) {
		return this.check(/* @__PURE__ */ _xid(ZodXID, params));
	},
	ksuid(params) {
		return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	},
	ipv4(params) {
		return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	},
	ipv6(params) {
		return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	},
	cidrv4(params) {
		return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	},
	cidrv6(params) {
		return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	},
	e164(params) {
		return this.check(/* @__PURE__ */ _e164(ZodE164, params));
	},
	datetime(params) {
		return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
	},
	date(params) {
		return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
	},
	time(params) {
		return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
	},
	duration(params) {
		return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
	}
});
function string$1(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
var ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
var ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	inst.isFinite = true;
}, /*@__PURE__*/ derived({
	minValue: (inst) => {
		const { minimum, exclusiveMinimum } = aggregateChecks(inst);
		return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
	},
	maxValue: (inst) => {
		const { maximum, exclusiveMaximum } = aggregateChecks(inst);
		return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
	},
	isInt: (inst) => {
		const { isInt, multipleOf } = aggregateChecks(inst);
		return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
	},
	format: (inst) => aggregateChecks(inst).format ?? null
}, {
	gt(value, params) {
		return this.check(/* @__PURE__ */ _gt(value, params));
	},
	gte(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	min(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	lt(value, params) {
		return this.check(/* @__PURE__ */ _lt(value, params));
	},
	lte(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	max(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	int(params) {
		return this.check(int$2(params));
	},
	safe(params) {
		return this.check(int$2(params));
	},
	positive(params) {
		return this.check(/* @__PURE__ */ _gt(0, params));
	},
	nonnegative(params) {
		return this.check(/* @__PURE__ */ _gte(0, params));
	},
	negative(params) {
		return this.check(/* @__PURE__ */ _lt(0, params));
	},
	nonpositive(params) {
		return this.check(/* @__PURE__ */ _lte(0, params));
	},
	multipleOf(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	step(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	finite() {
		return this;
	}
}));
function number$1(params) {
	return /* @__PURE__ */ _number(ZodNumber, params);
}
var ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int$2(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
var ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
var ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
var ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
var ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
}, {
	min(n, params) {
		return this.check(/* @__PURE__ */ _minLength(n, params));
	},
	nonempty(params) {
		return this.check(/* @__PURE__ */ _minLength(1, params));
	},
	max(n, params) {
		return this.check(/* @__PURE__ */ _maxLength(n, params));
	},
	length(n, params) {
		return this.check(/* @__PURE__ */ _length(n, params));
	},
	unwrap() {
		return this.element;
	}
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
var ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
	keyof() {
		return _enum(Object.keys(this._zod.def.shape));
	},
	catchall(catchall) {
		return this.clone(mergeDefs(this._zod.def, { catchall }));
	},
	passthrough() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	loose() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	strict() {
		return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
	},
	strip() {
		return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
	},
	extend(incoming) {
		return extend(this, incoming);
	},
	safeExtend(incoming) {
		return safeExtend(this, incoming);
	},
	merge(other) {
		return merge$1(this, other);
	},
	pick(mask) {
		return pick(this, mask);
	},
	omit(mask) {
		return omit(this, mask);
	},
	partial(...args) {
		return partial(ZodOptional, this, args[0]);
	},
	exactPartial(...args) {
		return partial(ZodExactOptional, this, args[0], "exactPartial");
	},
	required(...args) {
		return required$1(ZodNonOptional, this, args[0]);
	}
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
var ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
var ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("ZodDiscriminatedUnion", (inst, def) => {
	ZodUnion.init(inst, def);
	$ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
	return new ZodDiscriminatedUnion({
		type: "union",
		options,
		discriminator,
		...normalizeParams(params)
	});
}
var ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
var ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string$1(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
var ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = [...inst._zod.values];
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
var ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal$1(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
var ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
var ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
var ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
var ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
var ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
var ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
	});
}
var ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
var ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
var ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.6.4/node_modules/zod/v4/classic/coerce.js
function number(params) {
	return /* @__PURE__ */ _coercedNumber(ZodNumber, params);
}
//#endregion
//#region ../../packages/core/dist/models/catalog.js
/**
* Every AI model name AgentMate knows, in one file.
*
* When a provider ships a new model (or renames one), this is the only file to edit. The rest of
* the app reads from here: the run recommendation in Prompt Builder, launch defaults in Settings,
* CLI argument hints, Ask AI's model pickers, the Diffray wizard, token cost estimates, and the
* labels on usage windows.
*
* Each entry keeps the three names a model goes by apart:
* - `label` is what people read ("Opus 5.5").
* - `cliArg` is what goes after the CLI's model flag ("opus").
* - `apiId` is the id the provider's API and logs use ("claude-opus-5-5"). Cost estimates match it
*   against MODEL_PRICES by prefix.
*
* This file imports nothing, so any module can read it without an import cycle.
*/
var CLAUDE_MODELS = {
	haiku: {
		label: "Haiku 5.5",
		family: "Haiku",
		cliArg: "haiku",
		apiId: "claude-haiku-5-5"
	},
	sonnet: {
		label: "Sonnet 5.5",
		family: "Sonnet",
		cliArg: "sonnet",
		apiId: "claude-sonnet-5-5"
	},
	opus: {
		label: "Opus 5.5",
		family: "Opus",
		cliArg: "opus",
		apiId: "claude-opus-5-5"
	},
	fable: {
		label: "Fable 5.1",
		family: "Fable",
		cliArg: "fable",
		apiId: "claude-fable-5-1"
	}
};
Object.values(CLAUDE_MODELS).map((m) => m.family);
/**
* The Claude model that plans above Pro meter in a weekly bucket of its own. It moved from Opus
* to Fable once already. The stored window key stays 'week-fable' either way.
*/
var CLAUDE_WEEKLY_METERED_MODEL = CLAUDE_MODELS.fable;
var CODEX_MODELS = {
	luna: {
		label: "GPT-6 Luna",
		cliArg: "gpt-6-luna",
		apiId: "gpt-6-luna"
	},
	sol: {
		label: "GPT-6.1 Sol",
		cliArg: "gpt-6.1-sol",
		apiId: "gpt-6.1-sol"
	},
	astra: {
		label: "GPT-6 Astra",
		cliArg: "gpt-6-astra",
		apiId: "gpt-6-astra"
	}
};
var GEMINI_CLI_MODELS = {
	flashLite: {
		label: "Gemini 3.5 Flash-Lite",
		cliArg: "gemini-3.5-flash-lite",
		apiId: "gemini-3.5-flash-lite"
	},
	flash: {
		label: "Gemini 3.8 Flash",
		cliArg: "gemini-3.8-flash",
		apiId: "gemini-3.8-flash"
	},
	pro: {
		label: "Gemini 3.1 Pro",
		cliArg: "gemini-3.1-pro-preview",
		apiId: "gemini-3.1-pro-preview"
	}
};
var CLI_MODEL_EXAMPLES = {
	"claude-code": CLAUDE_MODELS.sonnet.cliArg,
	openclaude: CLAUDE_MODELS.sonnet.cliArg,
	aider: CLAUDE_MODELS.sonnet.cliArg,
	pi: CLAUDE_MODELS.sonnet.cliArg,
	"gemini-cli": GEMINI_CLI_MODELS.pro.cliArg,
	opencode: `anthropic/${CLAUDE_MODELS.sonnet.apiId}`,
	"codex-cli": CODEX_MODELS.sol.cliArg,
	"grok-cli": "grok-4.7",
	"cursor-cli": "sonnet-4-thinking",
	"copilot-cli": CLAUDE_MODELS.sonnet.apiId,
	"qwen-cli": "qwen3-coder-plus",
	"cline-cli": CLAUDE_MODELS.sonnet.apiId,
	"continue-cli": "owner/package"
};
var OPENAI_API_MODELS = [
	{
		value: CODEX_MODELS.luna.apiId,
		label: CODEX_MODELS.luna.apiId
	},
	{
		value: CODEX_MODELS.sol.apiId,
		label: CODEX_MODELS.sol.apiId
	},
	{
		value: CODEX_MODELS.astra.apiId,
		label: CODEX_MODELS.astra.apiId
	}
];
var DEFAULT_OPENAI_API_MODEL = CODEX_MODELS.luna.apiId;
var GEMINI_API_MODELS = [
	{
		value: GEMINI_CLI_MODELS.flash.apiId,
		label: GEMINI_CLI_MODELS.flash.apiId
	},
	{
		value: GEMINI_CLI_MODELS.flashLite.apiId,
		label: GEMINI_CLI_MODELS.flashLite.apiId
	},
	{
		value: GEMINI_CLI_MODELS.pro.apiId,
		label: GEMINI_CLI_MODELS.pro.apiId
	}
];
/** Google points new projects at Flash. Gemini 2.x is closed to new users. */
var DEFAULT_GEMINI_API_MODEL = GEMINI_CLI_MODELS.flash.apiId;
/**
* The embedding model the help chat uses with each API provider. Ollama's has to be pulled
* (`ollama pull nomic-embed-text`); without it the chat still answers from keyword search.
*/
var HELP_EMBEDDING_MODELS = {
	openai: {
		id: "text-embedding-3-small",
		dimensions: 1536
	},
	gemini: {
		id: "gemini-embedding-001",
		dimensions: 768
	},
	ollama: {
		id: "nomic-embed-text",
		dimensions: 768
	}
};
/** The embedding model the help chat uses with `provider`: the one picked in Settings, or the default. */
function helpEmbeddingModel(provider, picked) {
	return picked?.[provider]?.trim() || HELP_EMBEDDING_MODELS[provider].id;
}
/** Strix takes one model in provider/model form. */
var STRIX_DEFAULT_MODEL = `anthropic/${CLAUDE_MODELS.sonnet.apiId}`;
CLI_MODEL_EXAMPLES["codex-cli"];
/** Models Diffray accepts, per executor. An empty value leaves it to the executor. */
var DIFFRAY_EXECUTOR_MODELS = {
	"claude-cli": [
		{
			value: CLAUDE_MODELS.haiku.cliArg,
			label: `${CLAUDE_MODELS.haiku.family} (fast)`
		},
		{
			value: CLAUDE_MODELS.sonnet.cliArg,
			label: `${CLAUDE_MODELS.sonnet.family} (balanced)`
		},
		{
			value: CLAUDE_MODELS.opus.cliArg,
			label: `${CLAUDE_MODELS.opus.family} (thorough)`
		}
	],
	"cursor-agent-cli": [
		{
			value: "auto",
			label: "Auto"
		},
		{
			value: "sonnet-4.5",
			label: "Sonnet 4.5"
		},
		{
			value: "opus-4.5",
			label: "Opus 4.5"
		}
	],
	"opencode-cli": [{
		value: "opencode/gpt-5-nano",
		label: "GPT-5 nano"
	}, {
		value: "opencode/grok-code",
		label: "Grok code"
	}],
	"codex-cli": []
};
/** Model names as Diffray's docs write them in its speed vs quality table. */
var DIFFRAY_DOC_MODELS = {
	haiku: CLAUDE_MODELS.haiku.cliArg,
	sonnet: CLAUDE_MODELS.sonnet.cliArg,
	opus: CLAUDE_MODELS.opus.cliArg,
	codex: CODEX_MODELS.sol.cliArg,
	opencodeNano: "opencode/gpt-5-nano"
};
var WHISPER_MODELS = [
	{
		key: "tiny",
		label: "Tiny (fastest, ~75 MB)",
		hubId: "onnx-community/whisper-tiny"
	},
	{
		key: "base",
		label: "Base (balanced, ~145 MB)",
		hubId: "onnx-community/whisper-base"
	},
	{
		key: "small",
		label: "Small (most accurate, ~490 MB)",
		hubId: "onnx-community/whisper-small"
	}
];
/** `base` is the accuracy and size sweet spot for short dictation. */
var DEFAULT_WHISPER_MODEL = "base";
/**
* Hand-maintained subset of model pricing (USD per 1,000,000 tokens), in the spirit of LiteLLM's
* price map. Keys are matched by longest prefix against the model id, so dated variants
* ("claude-sonnet-5-5-20260101") fall through to their base entry. Older ids stay listed because
* past logs still name them.
*/
var MODEL_PRICES = {
	"claude-fable-5-1": {
		input: 10,
		output: 50,
		cacheRead: .25,
		cacheWrite: 12.5
	},
	"claude-fable-5": {
		input: 10,
		output: 50,
		cacheRead: 1,
		cacheWrite: 12.5
	},
	"claude-mythos-5-1": {
		input: 10,
		output: 50,
		cacheRead: .25,
		cacheWrite: 12.5
	},
	"claude-mythos-5": {
		input: 10,
		output: 50,
		cacheRead: 1,
		cacheWrite: 12.5
	},
	"claude-opus-5-5": {
		input: 4,
		output: 20,
		cacheRead: .2,
		cacheWrite: 5
	},
	"claude-opus-5": {
		input: 5,
		output: 25,
		cacheRead: .5,
		cacheWrite: 6.25
	},
	"claude-opus-4-8": {
		input: 5,
		output: 25,
		cacheRead: .5,
		cacheWrite: 6.25
	},
	"claude-opus-4-7": {
		input: 5,
		output: 25,
		cacheRead: .5,
		cacheWrite: 6.25
	},
	"claude-opus-4-6": {
		input: 5,
		output: 25,
		cacheRead: .5,
		cacheWrite: 6.25
	},
	"claude-opus-4-5": {
		input: 5,
		output: 25,
		cacheRead: .5,
		cacheWrite: 6.25
	},
	"claude-opus-4": {
		input: 15,
		output: 75,
		cacheRead: 1.5,
		cacheWrite: 18.75
	},
	"claude-sonnet-4": {
		input: 3,
		output: 15,
		cacheRead: .3,
		cacheWrite: 3.75
	},
	"claude-sonnet-5-5": {
		input: 2,
		output: 10,
		cacheRead: .2,
		cacheWrite: 2.5
	},
	"claude-sonnet-5": {
		input: 2,
		output: 10,
		cacheRead: .2,
		cacheWrite: 2.5
	},
	"claude-haiku-5-5": {
		input: .1,
		output: .5,
		cacheRead: .01,
		cacheWrite: .125
	},
	"claude-haiku-4": {
		input: 1,
		output: 5,
		cacheRead: .1,
		cacheWrite: 1.25
	},
	"claude-3-5-sonnet": {
		input: 3,
		output: 15,
		cacheRead: .3,
		cacheWrite: 3.75
	},
	"claude-3-5-haiku": {
		input: .8,
		output: 4,
		cacheRead: .08,
		cacheWrite: 1
	},
	"claude-3-opus": {
		input: 15,
		output: 75,
		cacheRead: 1.5,
		cacheWrite: 18.75
	},
	"gpt-6-astra": {
		input: 10,
		output: 50,
		cacheRead: 1,
		cacheWrite: 12.5
	},
	"gpt-6.1-sol": {
		input: 2,
		output: 10,
		cacheRead: .1,
		cacheWrite: 2.5
	},
	"gpt-6-sol": {
		input: 2,
		output: 10,
		cacheRead: .2,
		cacheWrite: 2.5
	},
	"gpt-6-luna": {
		input: .1,
		output: .5,
		cacheRead: .01,
		cacheWrite: .125
	},
	"gpt-5.6-sol": {
		input: 4,
		output: 20,
		cacheRead: .4,
		cacheWrite: 5
	},
	"gpt-5.6-terra": {
		input: 2,
		output: 12,
		cacheRead: .2,
		cacheWrite: 2.5
	},
	"gpt-5.6-luna": {
		input: .2,
		output: 1.2,
		cacheRead: .02,
		cacheWrite: .25
	},
	"gpt-5.5-pro": {
		input: 30,
		output: 180,
		cacheRead: 30,
		cacheWrite: 30
	},
	"gpt-5.5": {
		input: 5,
		output: 30,
		cacheRead: .5,
		cacheWrite: 5
	},
	"gpt-5.4-pro": {
		input: 30,
		output: 180,
		cacheRead: 30,
		cacheWrite: 30
	},
	"gpt-5.4-mini": {
		input: .75,
		output: 4.5,
		cacheRead: .075,
		cacheWrite: .75
	},
	"gpt-5.4-nano": {
		input: .2,
		output: 1.25,
		cacheRead: .02,
		cacheWrite: .2
	},
	"gpt-5.4": {
		input: 2.5,
		output: 15,
		cacheRead: .25,
		cacheWrite: 2.5
	},
	"gpt-5.3-codex": {
		input: 1.75,
		output: 14,
		cacheRead: .175,
		cacheWrite: 1.75
	},
	"gpt-5.2": {
		input: 1.75,
		output: 14,
		cacheRead: .175,
		cacheWrite: 1.75
	},
	"gpt-5-mini": {
		input: .25,
		output: 2,
		cacheRead: .025,
		cacheWrite: .25
	},
	"gpt-5-nano": {
		input: .05,
		output: .4,
		cacheRead: .005,
		cacheWrite: .05
	},
	"gpt-5": {
		input: 1.25,
		output: 10,
		cacheRead: .125,
		cacheWrite: 1.25
	},
	"gpt-4.1": {
		input: 2,
		output: 8,
		cacheRead: .5,
		cacheWrite: 2
	},
	"gpt-4o-mini": {
		input: .15,
		output: .6,
		cacheRead: .075,
		cacheWrite: .15
	},
	"gpt-4o": {
		input: 2.5,
		output: 10,
		cacheRead: 1.25,
		cacheWrite: 2.5
	},
	"o4-mini": {
		input: 1.1,
		output: 4.4,
		cacheRead: .275,
		cacheWrite: 1.1
	},
	o3: {
		input: 2,
		output: 8,
		cacheRead: .5,
		cacheWrite: 2
	},
	"codex-mini": {
		input: 1.5,
		output: 6,
		cacheRead: .375,
		cacheWrite: 1.5
	},
	"gemini-3.8-flash": {
		input: .75,
		output: 3.75,
		cacheRead: .075,
		cacheWrite: .75
	},
	"gemini-3.5-flash-lite": {
		input: .3,
		output: 2.5,
		cacheRead: .03,
		cacheWrite: .3
	},
	"gemini-3.1-pro": {
		input: 2,
		output: 12,
		cacheRead: .2,
		cacheWrite: 2
	},
	"gemini-2.5-pro": {
		input: 1.25,
		output: 10,
		cacheRead: .31,
		cacheWrite: 1.25
	},
	"gemini-2.5-flash": {
		input: .3,
		output: 2.5,
		cacheRead: .075,
		cacheWrite: .3
	},
	"gemini-2.0-flash": {
		input: .1,
		output: .4,
		cacheRead: .025,
		cacheWrite: .1
	},
	"grok-4.7": {
		input: 2,
		output: 6,
		cacheRead: .5,
		cacheWrite: 2
	},
	"grok-4.6": {
		input: 2,
		output: 6,
		cacheRead: .5,
		cacheWrite: 2
	},
	"grok-4.5": {
		input: 2,
		output: 6,
		cacheRead: .3,
		cacheWrite: 2
	},
	"grok-4.3": {
		input: 1.25,
		output: 2.5,
		cacheRead: .2,
		cacheWrite: 1.25
	},
	"grok-4.20": {
		input: 1.25,
		output: 2.5,
		cacheRead: .2,
		cacheWrite: 1.25
	},
	"grok-build": {
		input: 1,
		output: 2,
		cacheRead: .2,
		cacheWrite: 1
	},
	"deepseek-chat": {
		input: .27,
		output: 1.1,
		cacheRead: .07,
		cacheWrite: .27
	},
	"deepseek-reasoner": {
		input: .55,
		output: 2.19,
		cacheRead: .14,
		cacheWrite: .55
	},
	"mistral-large": {
		input: 2,
		output: 6,
		cacheRead: .5,
		cacheWrite: 2
	}
};
/** The catalog entry whose API id this is, ignoring a date suffix and a `[1m]` context tag. */
function catalogModelForApiId(model) {
	const id = model.trim().toLowerCase().replace(/\[1m\]$/, "").replace(/-\d{8}$/, "");
	return [
		...Object.values(CLAUDE_MODELS),
		...Object.values(CODEX_MODELS),
		...Object.values(GEMINI_CLI_MODELS)
	].find((m) => m.apiId === id);
}
//#endregion
//#region ../../packages/core/dist/cli/registry.js
var SupportedOSSchema = _enum([
	"win32",
	"darwin",
	"linux"
]);
var ShellCommandSchema = object({
	command: string$1(),
	args: array(string$1()).default([])
});
var UpdateCheckSourceSchema = object({
	type: _enum([
		"npm",
		"pypi",
		"github-release"
	]),
	/** npm/PyPI package name, or "owner/repo" for github-release. */
	package: string$1()
});
object({
	id: string$1(),
	name: string$1(),
	/**
	* Short name used in every agent picker (Target AI, project agent type, and
	* similar dropdowns) so those lists cannot drift from this registry.
	*/
	label: string$1(),
	description: string$1(),
	homepageUrl: string$1().url().optional(),
	docsUrl: string$1().url().optional(),
	executableNames: array(string$1()).min(1),
	detectCommand: ShellCommandSchema,
	versionCommand: ShellCommandSchema,
	/**
	* One-shot ("headless") prompt invocation: the agent answers on stdout without
	* opening a TUI. Absent for CLIs that have no non-interactive mode we can rely on.
	*/
	promptCommand: ShellCommandSchema.optional(),
	/**
	* How the prompt text reaches `promptCommand`: appended as the final argument
	* (the default), or piped through stdin. Windows routes every npm-installed CLI
	* through cmd.exe, which caps its own command line at ~8191 characters, so a
	* diff-heavy prompt needs the stdin path to avoid "The command line is too long."
	* Only set this for CLIs confirmed to read a piped prompt in headless mode.
	*/
	promptInputMode: _enum(["arg", "stdin"]).optional(),
	/**
	* Extra args that let a headless run actually edit files. Without them these CLIs
	* either stop to ask for approval (which nothing can answer with no TTY) or refuse
	* to write at all. Absent for CLIs that already edit by default in headless mode, and
	* for read-only ones. Only ever added for prompts the user explicitly asked to apply.
	*/
	promptWriteArgs: array(string$1()).optional(),
	/**
	* Example for the per-CLI "Arguments" field, shown as its placeholder. Each one names
	* a flag this CLI really has (taken from its own --help), since the flag for picking a
	* model differs per CLI: `--model sonnet`, `-m provider/model`, and so on. Absent for
	* CLIs with no obvious flag worth suggesting.
	*/
	argsExample: string$1().optional(),
	/**
	* How a file is referred to in this CLI's input box: `@path` (the default, which the CLI
	* turns into an attached file) or the bare path for CLIs with no mention syntax.
	*/
	fileMention: _enum(["at", "plain"]).optional(),
	/**
	* How a headless run attaches a screenshot: a CLI flag per image (`flag`), a file mention in
	* the prompt (`mention`), or a prompt that tells the agent to open the file with its own read
	* tool (`read-tool`). Absent for CLIs that cannot look at an image in headless mode. Only set
	* after checking by hand that the CLI really describes the attached image.
	*/
	promptImageInput: _enum([
		"flag",
		"mention",
		"read-tool"
	]).optional(),
	/**
	* Args added once to a run that attaches images. For `read-tool` they are what lets the agent
	* use that tool without a TTY to approve it.
	*/
	promptImageArgs: array(string$1()).optional(),
	/** For `flag`: the flag that names one image, repeated with each image's path. */
	promptImageFlag: string$1().optional(),
	/** Env vars for a run that attaches images, e.g. to let the CLI read from a temp folder. */
	promptImageEnv: record(string$1(), string$1()).optional(),
	/** Keyed by SupportedOS; not every OS needs an entry. */
	installCommand: record(string$1(), string$1()),
	/** Keyed by SupportedOS; falls back to installCommand when absent. */
	updateCommand: record(string$1(), string$1()).optional(),
	/** Where to look up the latest published version, if known. */
	updateCheck: UpdateCheckSourceSchema.optional(),
	supportedOS: array(SupportedOSSchema).min(1)
});
var CLI_REGISTRY = [
	{
		id: "claude-code",
		name: "Claude Code CLI",
		label: "Claude Code",
		description: "Anthropic's agentic coding CLI.",
		homepageUrl: "https://claude.com/claude-code",
		docsUrl: "https://docs.claude.com/en/docs/claude-code",
		executableNames: ["claude"],
		detectCommand: {
			command: "claude",
			args: ["--version"]
		},
		versionCommand: {
			command: "claude",
			args: ["--version"]
		},
		promptCommand: {
			command: "claude",
			args: ["-p"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--permission-mode", "acceptEdits"],
		promptImageInput: "read-tool",
		promptImageArgs: ["--allowedTools", "Read"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["claude-code"]}`,
		installCommand: {
			win32: "npm install -g @anthropic-ai/claude-code",
			darwin: "npm install -g @anthropic-ai/claude-code",
			linux: "npm install -g @anthropic-ai/claude-code"
		},
		updateCheck: {
			type: "npm",
			package: "@anthropic-ai/claude-code"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "gemini-cli",
		name: "Gemini CLI",
		label: "Gemini",
		description: "Google's Gemini command-line AI agent.",
		homepageUrl: "https://github.com/google-gemini/gemini-cli",
		executableNames: ["gemini"],
		detectCommand: {
			command: "gemini",
			args: ["--version"]
		},
		versionCommand: {
			command: "gemini",
			args: ["--version"]
		},
		promptCommand: {
			command: "gemini",
			args: ["-p"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--yolo"],
		promptImageInput: "mention",
		promptImageEnv: { GEMINI_CLI_TRUST_WORKSPACE: "true" },
		argsExample: `-m ${CLI_MODEL_EXAMPLES["gemini-cli"]}`,
		installCommand: {
			win32: "npm install -g @google/gemini-cli",
			darwin: "npm install -g @google/gemini-cli",
			linux: "npm install -g @google/gemini-cli"
		},
		updateCheck: {
			type: "npm",
			package: "@google/gemini-cli"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "opencode",
		name: "OpenCode",
		label: "OpenCode",
		description: "Open-source AI coding agent for the terminal.",
		homepageUrl: "https://opencode.ai",
		executableNames: ["opencode"],
		detectCommand: {
			command: "opencode",
			args: ["--version"]
		},
		versionCommand: {
			command: "opencode",
			args: ["--version"]
		},
		promptCommand: {
			command: "opencode",
			args: ["run"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--auto"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["opencode"]}`,
		installCommand: {
			win32: "npm install -g opencode-ai@latest",
			darwin: "npm install -g opencode-ai@latest",
			linux: "npm install -g opencode-ai@latest"
		},
		updateCheck: {
			type: "npm",
			package: "opencode-ai"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "openclaude",
		name: "OpenClaude",
		label: "OpenClaude",
		description: "Open-source coding agent CLI that runs against any model provider.",
		homepageUrl: "https://openclaude.gitlawb.com",
		docsUrl: "https://openclaude.gitlawb.com/docs/cli-reference/",
		executableNames: ["openclaude"],
		detectCommand: {
			command: "openclaude",
			args: ["--version"]
		},
		versionCommand: {
			command: "openclaude",
			args: ["--version"]
		},
		promptCommand: {
			command: "openclaude",
			args: ["-p"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--permission-mode", "acceptEdits"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["openclaude"]}`,
		installCommand: {
			win32: "npm install -g @gitlawb/openclaude@latest",
			darwin: "npm install -g @gitlawb/openclaude@latest",
			linux: "npm install -g @gitlawb/openclaude@latest"
		},
		updateCheck: {
			type: "npm",
			package: "@gitlawb/openclaude"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "codex-cli",
		name: "Codex CLI",
		label: "Codex",
		description: "OpenAI's local coding agent CLI.",
		homepageUrl: "https://github.com/openai/codex",
		executableNames: ["codex"],
		detectCommand: {
			command: "codex",
			args: ["--version"]
		},
		versionCommand: {
			command: "codex",
			args: ["--version"]
		},
		promptCommand: {
			command: "codex",
			args: ["exec"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--sandbox", "workspace-write"],
		promptImageInput: "flag",
		promptImageFlag: "--image",
		promptImageArgs: ["--skip-git-repo-check"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["codex-cli"]}`,
		installCommand: {
			win32: "npm install -g @openai/codex",
			darwin: "npm install -g @openai/codex",
			linux: "npm install -g @openai/codex"
		},
		updateCheck: {
			type: "npm",
			package: "@openai/codex"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "grok-cli",
		name: "Grok CLI",
		label: "Grok",
		description: "xAI's official Grok coding agent CLI.",
		homepageUrl: "https://x.ai",
		docsUrl: "https://docs.x.ai/build/overview",
		executableNames: ["grok"],
		detectCommand: {
			command: "grok",
			args: ["--version"]
		},
		versionCommand: {
			command: "grok",
			args: ["--version"]
		},
		promptCommand: {
			command: "grok",
			args: ["-p"]
		},
		promptWriteArgs: ["--permission-mode", "acceptEdits"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["grok-cli"]}`,
		installCommand: {
			win32: "npm install -g @xai-official/grok",
			darwin: "npm install -g @xai-official/grok",
			linux: "npm install -g @xai-official/grok"
		},
		updateCheck: {
			type: "npm",
			package: "@xai-official/grok"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "cursor-cli",
		name: "Cursor CLI",
		label: "Cursor",
		description: "Cursor's agentic coding CLI for the terminal.",
		homepageUrl: "https://cursor.com/cli",
		docsUrl: "https://cursor.com/docs/cli/overview",
		executableNames: ["cursor-agent"],
		detectCommand: {
			command: "cursor-agent",
			args: ["--version"]
		},
		versionCommand: {
			command: "cursor-agent",
			args: ["--version"]
		},
		promptCommand: {
			command: "cursor-agent",
			args: ["-p"]
		},
		promptWriteArgs: ["--force"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["cursor-cli"]}`,
		installCommand: {
			win32: "irm 'https://cursor.com/install?win32=true' | iex",
			darwin: "curl https://cursor.com/install -fsS | bash",
			linux: "curl https://cursor.com/install -fsS | bash"
		},
		updateCommand: {
			win32: "cursor-agent update",
			darwin: "cursor-agent update",
			linux: "cursor-agent update"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "copilot-cli",
		name: "GitHub Copilot CLI",
		label: "Copilot",
		description: "GitHub's Copilot coding agent in the terminal.",
		homepageUrl: "https://github.com/features/copilot/cli",
		docsUrl: "https://docs.github.com/en/copilot/how-tos/copilot-cli",
		executableNames: ["copilot"],
		detectCommand: {
			command: "copilot",
			args: ["--version"]
		},
		versionCommand: {
			command: "copilot",
			args: ["--version"]
		},
		promptCommand: {
			command: "copilot",
			args: ["-s"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--allow-all-tools"],
		argsExample: `--model ${CLI_MODEL_EXAMPLES["copilot-cli"]}`,
		installCommand: {
			win32: "npm install -g @github/copilot",
			darwin: "npm install -g @github/copilot",
			linux: "npm install -g @github/copilot"
		},
		updateCheck: {
			type: "npm",
			package: "@github/copilot"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "freebuff-cli",
		name: "FreeBuff CLI",
		label: "FreeBuff",
		description: "Free, ad-supported AI coding agent for the terminal.",
		homepageUrl: "https://freebuff.com",
		docsUrl: "https://freebuff.com/get-started",
		executableNames: ["freebuff"],
		detectCommand: {
			command: "freebuff",
			args: ["--version"]
		},
		versionCommand: {
			command: "freebuff",
			args: ["--version"]
		},
		argsExample: "--continue",
		installCommand: {
			win32: "npm install -g freebuff",
			darwin: "npm install -g freebuff",
			linux: "npm install -g freebuff"
		},
		updateCheck: {
			type: "npm",
			package: "freebuff"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "qwen-cli",
		name: "Qwen CLI",
		label: "Qwen",
		description: "Alibaba's Qwen Code command-line AI agent.",
		homepageUrl: "https://github.com/QwenLM/qwen-code",
		executableNames: ["qwen"],
		detectCommand: {
			command: "qwen",
			args: ["--version"]
		},
		versionCommand: {
			command: "qwen",
			args: ["--version"]
		},
		promptCommand: {
			command: "qwen",
			args: ["-p"]
		},
		promptInputMode: "stdin",
		promptWriteArgs: ["--yolo"],
		argsExample: `-m ${CLI_MODEL_EXAMPLES["qwen-cli"]}`,
		installCommand: {
			win32: "npm install -g @qwen-code/qwen-code",
			darwin: "npm install -g @qwen-code/qwen-code",
			linux: "npm install -g @qwen-code/qwen-code"
		},
		updateCheck: {
			type: "npm",
			package: "@qwen-code/qwen-code"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "aider",
		name: "Aider",
		label: "Aider",
		description: "AI pair programming CLI that edits code in your local git repo.",
		homepageUrl: "https://aider.chat",
		executableNames: ["aider"],
		detectCommand: {
			command: "aider",
			args: ["--version"]
		},
		versionCommand: {
			command: "aider",
			args: ["--version"]
		},
		argsExample: `--model ${CLI_MODEL_EXAMPLES["aider"]}`,
		fileMention: "plain",
		installCommand: {
			win32: "pipx install aider-chat",
			darwin: "pipx install aider-chat",
			linux: "pipx install aider-chat"
		},
		updateCommand: {
			win32: "pipx upgrade aider-chat",
			darwin: "pipx upgrade aider-chat",
			linux: "pipx upgrade aider-chat"
		},
		updateCheck: {
			type: "pypi",
			package: "aider-chat"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "goose",
		name: "Goose",
		label: "Goose",
		description: "Block's on-machine AI agent CLI.",
		homepageUrl: "https://github.com/block/goose",
		executableNames: ["goose"],
		detectCommand: {
			command: "goose",
			args: ["--version"]
		},
		versionCommand: {
			command: "goose",
			args: ["--version"]
		},
		promptCommand: {
			command: "goose",
			args: ["run", "-t"]
		},
		fileMention: "plain",
		installCommand: {
			darwin: "curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash",
			linux: "curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash"
		},
		updateCommand: {
			darwin: "goose update",
			linux: "goose update"
		},
		updateCheck: {
			type: "github-release",
			package: "block/goose"
		},
		supportedOS: ["darwin", "linux"]
	},
	{
		id: "cline-cli",
		name: "Cline CLI",
		label: "Cline",
		description: "Autonomous coding agent CLI from the Cline team.",
		homepageUrl: "https://cline.bot/cli",
		docsUrl: "https://docs.cline.bot/cli/cli-reference",
		executableNames: ["cline"],
		detectCommand: {
			command: "cline",
			args: ["--version"]
		},
		versionCommand: {
			command: "cline",
			args: ["--version"]
		},
		promptCommand: {
			command: "cline",
			args: ["-y"]
		},
		argsExample: `--model ${CLI_MODEL_EXAMPLES["cline-cli"]}`,
		installCommand: {
			win32: "npm install -g cline",
			darwin: "npm install -g cline",
			linux: "npm install -g cline"
		},
		updateCheck: {
			type: "npm",
			package: "cline"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "continue-cli",
		name: "Continue CLI",
		label: "Continue",
		description: "Open-source AI coding assistant CLI (\"cn\").",
		homepageUrl: "https://continue.dev",
		executableNames: ["cn"],
		detectCommand: {
			command: "cn",
			args: ["--version"]
		},
		versionCommand: {
			command: "cn",
			args: ["--version"]
		},
		promptCommand: {
			command: "cn",
			args: ["-p"]
		},
		argsExample: `--model ${CLI_MODEL_EXAMPLES["continue-cli"]}`,
		installCommand: {
			win32: "npm install -g @continuedev/cli",
			darwin: "npm install -g @continuedev/cli",
			linux: "npm install -g @continuedev/cli"
		},
		updateCheck: {
			type: "npm",
			package: "@continuedev/cli"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	},
	{
		id: "pi",
		name: "Pi",
		label: "Pi",
		description: "Minimal, extensible terminal coding agent.",
		homepageUrl: "https://pi.dev",
		docsUrl: "https://pi.dev/docs",
		executableNames: ["pi"],
		detectCommand: {
			command: "pi",
			args: ["--version"]
		},
		versionCommand: {
			command: "pi",
			args: ["--version"]
		},
		promptCommand: {
			command: "pi",
			args: ["-p"]
		},
		promptInputMode: "stdin",
		argsExample: `--model ${CLI_MODEL_EXAMPLES["pi"]}`,
		installCommand: {
			win32: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
			darwin: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
			linux: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent"
		},
		updateCheck: {
			type: "npm",
			package: "@earendil-works/pi-coding-agent"
		},
		supportedOS: [
			"win32",
			"darwin",
			"linux"
		]
	}
];
function getCliDefinition(id) {
	return CLI_REGISTRY.find((cli) => cli.id === id);
}
/**
* Prompt Builder / Target AI values. Same order and names as CLI_REGISTRY, so a
* new CLI shows up in every picker without a second handwritten list.
*/
var TARGET_AIS = CLI_REGISTRY.map((cli) => cli.label);
var DEFAULT_TARGET_AI = CLI_REGISTRY[0]?.label ?? "Claude Code";
/** Prompt Builder used to store "Claude" before the label matched Claude Code. */
var LEGACY_TARGET_AI_LABELS = { Claude: "Claude Code" };
/** Map a stored Target AI string (current label, legacy label, or CLI id) onto today's label. */
function normalizeTargetAI(value) {
	const mapped = LEGACY_TARGET_AI_LABELS[value] ?? value;
	const byLabel = CLI_REGISTRY.find((cli) => cli.label === mapped);
	if (byLabel) return byLabel.label;
	const byId = getCliDefinition(mapped);
	if (byId) return byId.label;
	return mapped;
}
function isTargetAI(value) {
	return TARGET_AIS.includes(normalizeTargetAI(value));
}
function cliIdForTargetAI(targetAI) {
	const normalized = normalizeTargetAI(targetAI);
	return CLI_REGISTRY.find((cli) => cli.label === normalized || cli.id === targetAI)?.id;
}
function targetAIForCliId(cliId) {
	return getCliDefinition(cliId)?.label;
}
/**
* Pick the Target AI for a prompt form. Prefers an explicit stored value when it
* still names a known CLI. `untouched` covers empty forms that still hold the old
* hardcoded Claude default from before this followed the project's agent.
*/
function resolvePromptTargetAI(stored, fallback, options) {
	if (!stored) return fallback;
	const normalized = normalizeTargetAI(stored);
	if (options?.untouched && stored === "Claude" && fallback !== normalized) return fallback;
	if (TARGET_AIS.includes(normalized)) return normalized;
	return fallback;
}
//#endregion
//#region ../../packages/core/dist/promptBuilder/targetAiNotes.js
var DEFAULT_TARGET_AI_NOTE = "Be explicit about the desired outcome, constraints, and files to touch.";
/** Notes keyed by CLI_REGISTRY id. Missing CLIs fall back to DEFAULT_TARGET_AI_NOTE. */
var TARGET_AI_NOTES_BY_CLI_ID = {
	"claude-code": "Use clear markdown structure with explicit headers; state constraints up front; ask for a brief plan before large edits.",
	"gemini-cli": "Be direct and concise; enumerate steps explicitly; prefer bullet lists over long prose.",
	openclaude: "Name the provider/model if it matters; spell out the files to touch and keep the diff reviewable.",
	opencode: "State the target files/directories explicitly if known; keep instructions terminal-and-diff friendly.",
	"codex-cli": "Favor precise, code-first instructions; specify exact function/file names where possible.",
	"qwen-cli": "Keep instructions explicit and unambiguous; avoid idioms that may not translate well.",
	aider: "Reference exact file paths to edit; keep the request scoped to a small, reviewable diff.",
	goose: "Describe the desired end state and let it choose tool calls; provide acceptance criteria.",
	"continue-cli": "Keep the request self-contained since context window/session state may reset between runs.",
	"cursor-cli": "State the goal and constraints clearly; name the files to edit when known; keep the request scoped so the agent can apply a reviewable diff.",
	"copilot-cli": "Lean on its GitHub context (repo, issues, PRs) when useful; state the files to change and the expected result.",
	"grok-cli": "Be direct; spell out the files, the expected change, and what should stay untouched.",
	"cline-cli": "Give a concrete end state and acceptance criteria; mention paths to edit when you know them.",
	"freebuff-cli": "Keep the request self-contained and explicit about files, constraints, and the desired result.",
	pi: "Assume a bare read/write/edit/bash toolset and no plan mode; spell out each step and file."
};
function targetAINote(targetAI) {
	const cliId = cliIdForTargetAI(targetAI);
	if (cliId && TARGET_AI_NOTES_BY_CLI_ID[cliId]) return TARGET_AI_NOTES_BY_CLI_ID[cliId];
	return DEFAULT_TARGET_AI_NOTE;
}
//#endregion
//#region ../../packages/core/dist/blueprint/prompt.js
function filled(sections) {
	return sections.filter((section) => section.text.trim().length > 0);
}
function sectionBlocks(sections) {
	return filled(sections).map((section) => `## ${blueprintStep(section.stepId).heading}\n\n${flattenAttachmentRefs(section.text).trim()}`).join("\n\n");
}
function attachmentNames(sections) {
	return [...new Set(sections.flatMap((section) => section.attachmentNames))].filter(Boolean);
}
function referenceBlock(sections) {
	const names = attachmentNames(sections);
	if (names.length === 0) return "None.";
	return [
		...names.map((name) => `- ${name}`),
		"",
		"These were attached to the blueprint and may not be present in the repository. Ask for any",
		"you need rather than guessing at their contents."
	].join("\n");
}
var ARTIFACTS = (docsFolder) => `1. \`${docsFolder}/PRODUCT_BRIEF.md\`: the problem, who has it, the value it delivers, how success
   is measured, and an explicit "Out of scope" list.
2. \`${docsFolder}/ROADMAP.md\`: the delivery phases in order. Each phase gets a name, a goal stated
   as an outcome rather than an activity, entry and exit criteria, and links to its epics.
3. \`${docsFolder}/epics/NN-slug.md\`: one file per epic, numbered in delivery order, each with its
   objective, the user-visible outcome, acceptance criteria, dependencies, and the risks it carries.
4. \`${docsFolder}/BACKLOG.md\`: every epic broken into implementation-sized tasks, each with a
   stable id (E<epic>-T<task>), a one-line description, acceptance criteria, and its dependencies.
5. \`${docsFolder}/MILESTONES.md\`: the order the phases ship in and what can be demonstrated at each one.
6. \`${docsFolder}/RISKS.md\`: technical and delivery risks, each with impact, likelihood, and a
   concrete mitigation.`;
var RULES = `- Ground every artifact in the blueprint above. Where the blueprint is silent, write the
  assumption down under an "## Assumptions" heading instead of quietly inventing a requirement.
- Use the technologies the blueprint names. Do not substitute them or modernize them.
- Size tasks so each one is a single focused change. Split anything that would take more than
  about a day.
- Order the phases so every phase ends with something that can be run and demonstrated.
- Cross-link the files: the roadmap links to the epics, and each epic links to its backlog tasks.
- Write in English, in Markdown. No "TBD", no placeholder sections.`;
/**
* Assembles the Product Manager prompt locally. This is what seeds the editor
* before any AI call, and the result the user keeps when no provider is
* configured: translation needs no key, but generation does, and the wizard
* shouldn't be dead for someone who never set one up.
*/
function buildBlueprintPrompt(input) {
	const { projectName, agentLabel, docsFolder, sections, confirmBeforeWriting } = input;
	const confirm = confirmBeforeWriting ? `

# Before you start

List the phases and epics you intend to create, then wait for confirmation before writing any files.` : "";
	return `# Role

You are an experienced Product Manager and delivery lead. You have just been handed the project
blueprint below. Your job is to turn it into an executable plan that an engineering team, human
or AI, can start working from tomorrow.

# Project

Name: ${projectName}
Primary coding agent: ${agentLabel}

${sectionBlocks(sections) || "_(the blueprint is empty; ask for it before planning)_"}

## Reference material provided by the author

${referenceBlock(sections)}

# What to produce

Work only inside \`${docsFolder}/\`. Create the folder if it does not exist. Do not modify
application source, configuration, or dependencies as part of this task.

Write these files:

${ARTIFACTS(docsFolder)}

# Rules

${RULES}${confirm}
`;
}
/**
* The request sent to the user's provider so *it* writes the final prompt, the
* same division of labour `buildPromptGenerationRequest` uses: only the English
* blueprint goes in verbatim, everything else is guidance.
*/
function buildBlueprintGenerationRequest(input) {
	const { projectName, agentLabel, targetAI, docsFolder, sections, confirmBeforeWriting } = input;
	const names = attachmentNames(sections);
	return `You are an expert prompt engineer. Write a single, complete, ready-to-use prompt that a developer can paste directly into ${targetAI} to have it act as the Product Manager for the project described below.

The prompt you write must instruct the assistant to:
- take the role of an experienced Product Manager and delivery lead, not to write application code;
- produce delivery phases, epics, an implementation-sized task backlog, milestones, and a risk register;
- write every artifact as Markdown files inside the project's \`${docsFolder}/\` folder, creating it if needed, and to change nothing else in the repository;
- ground everything in the blueprint and record assumptions explicitly wherever the blueprint is silent;
- keep the technology choices exactly as the blueprint states them;
- cross-link the artifacts so the roadmap, the epics, and the backlog reference each other;${confirmBeforeWriting ? "\n- list the phases and epics it intends to create and wait for confirmation before writing any files;" : ""}
- write in English, in Markdown, with no "TBD" and no placeholder sections.

Suggested artifacts to name in the prompt:

${ARTIFACTS(docsFolder)}

Project name: ${projectName}
Primary coding agent: ${agentLabel}
Docs folder: ${docsFolder}
Reference material the author attached: ${names.length > 0 ? names.join(", ") : "none"}.

Notes specific to ${targetAI}: ${targetAINote(targetAI)}

Project blueprint:
"""
${sectionBlocks(sections)}
"""

Write the final prompt now, in clear English, structured for ${targetAI}. Base it only on the blueprint above; do not invent unrelated requirements. Output ONLY the prompt text itself, with no preamble, explanation, or surrounding commentary.`;
}
//#endregion
//#region ../../packages/core/dist/cli/agentTypes.js
/**
* Project agent types and the CLI_REGISTRY id each one maps to.
* Labels are read from that CLI so Target AI, the project form, and badges stay in sync.
* `generic` is project-only (no CLI).
*/
var AGENT_TYPE_DEFS = [
	{
		value: "claude-code",
		cliId: "claude-code"
	},
	{
		value: "gemini",
		cliId: "gemini-cli"
	},
	{
		value: "opencode",
		cliId: "opencode"
	},
	{
		value: "codex",
		cliId: "codex-cli"
	},
	{
		value: "cursor",
		cliId: "cursor-cli"
	},
	{
		value: "generic",
		cliId: null
	}
];
var AGENT_TYPE_CLI_ID = Object.fromEntries(AGENT_TYPE_DEFS.map((def) => [def.value, def.cliId]));
function agentTypeLabel(agentType) {
	if (agentType === "generic") return "Generic";
	const cliId = AGENT_TYPE_CLI_ID[agentType];
	return (cliId ? getCliDefinition(cliId) : void 0)?.label ?? agentType;
}
var AGENT_TYPE_LABELS = Object.fromEntries(AGENT_TYPE_DEFS.map((def) => [def.value, agentTypeLabel(def.value)]));
var AGENT_TYPES = AGENT_TYPE_DEFS.map((def) => ({
	value: def.value,
	label: agentTypeLabel(def.value),
	cliId: def.cliId
}));
/** Target AI label for a project: its agent type's CLI, then an explicit CLI override. */
function targetAIForProject(agentType, cliId) {
	const fromAgent = AGENT_TYPE_CLI_ID[agentType];
	if (fromAgent) {
		const label = targetAIForCliId(fromAgent);
		if (label) return label;
	}
	if (cliId) {
		const label = targetAIForCliId(cliId);
		if (label) return label;
	}
	return CLI_REGISTRY[0]?.label ?? "Claude Code";
}
//#endregion
//#region ../../packages/core/dist/cli/fileMention.js
/**
* Turns files and folders into the text a CLI's input box understands as references to them,
* e.g. `@src/app.ts @src/lib/ ` for Claude Code. Paths use forward slashes on every OS, folders
* end in a slash, and a path with whitespace is quoted so the CLI reads it as one. The text ends
* in a space so the user can type the question straight after it.
*/
function formatFileMentions(cliId, entries) {
	const style = getCliDefinition(cliId)?.fileMention ?? "at";
	const mentions = entries.map(({ relativePath, isDirectory }) => {
		const trimmed = relativePath.replace(/\\/g, "/").replace(/\/+$/, "");
		const path = isDirectory ? `${trimmed || "."}/` : trimmed;
		const quoted = /\s/.test(path) ? `"${path}"` : path;
		return style === "at" ? `@${quoted}` : quoted;
	});
	return mentions.length > 0 ? `${mentions.join(" ")} ` : "";
}
//#endregion
//#region ../../packages/core/dist/promptBuilder/runRecommendation.js
var EFFORT_LABELS = {
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
	max: "Max"
};
/** Rough spend multiplier per effort level, relative to `high`. */
var EFFORT_COST_FACTOR = {
	low: .5,
	medium: .75,
	high: 1,
	xhigh: 1.4,
	max: 2
};
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
/** The names half of a model option, taken from the catalog so a rename is one edit there. */
function fromCatalog(id, model) {
	return {
		id,
		label: model.label,
		modelArg: model.cliArg,
		...model.apiId ? { pricingId: model.apiId } : {}
	};
}
var CLAUDE_EFFORTS = [
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
var CODEX_EFFORTS = [
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
/**
* Hand-maintained per CLI. Model names change often, so only CLIs whose flags and model
* names we've checked against their docs get a concrete profile; the rest get the generic
* one, which describes models by class instead of guessing ids.
*/
var RUN_PROFILES = {
	"claude-code": {
		generic: false,
		modelFlag: "--model",
		effortArgs: (level) => ["--effort", level],
		effortHint: `${CLAUDE_MODELS.haiku.family} has no effort setting. It is already the quickest, cheapest option.`,
		models: [
			{
				...fromCatalog("haiku", CLAUDE_MODELS.haiku),
				tier: "Fast",
				costWeight: 1,
				bestFor: "Small, well-defined edits and quick lookups",
				maxScore: 22
			},
			{
				...fromCatalog("sonnet", CLAUDE_MODELS.sonnet),
				tier: "Balanced",
				costWeight: 3,
				bestFor: "Everyday features, fixes, and tests",
				maxScore: 60,
				efforts: CLAUDE_EFFORTS,
				effortPicks: [
					"low",
					"medium",
					"high"
				]
			},
			{
				...fromCatalog("opus", CLAUDE_MODELS.opus),
				tier: "Deep",
				costWeight: 4,
				bestFor: "Multi-file refactors and tricky systems work",
				maxScore: 86,
				efforts: CLAUDE_EFFORTS,
				effortPicks: [
					"medium",
					"high",
					"xhigh"
				]
			},
			{
				...fromCatalog("fable", CLAUDE_MODELS.fable),
				tier: "Frontier",
				costWeight: 10,
				bestFor: "Long, demanding agent sessions and hard reasoning",
				maxScore: 100,
				efforts: CLAUDE_EFFORTS,
				effortPicks: [
					"high",
					"high",
					"xhigh"
				]
			}
		]
	},
	"codex-cli": {
		generic: false,
		modelFlag: "--model",
		effortArgs: (level) => ["-c", `model_reasoning_effort=${level}`],
		effortHint: "This model has no effort setting.",
		models: [
			{
				...fromCatalog("luna", CODEX_MODELS.luna),
				tier: "Fast",
				costWeight: 1,
				bestFor: "Small, well-defined edits",
				maxScore: 30,
				efforts: CODEX_EFFORTS,
				effortPicks: [
					"low",
					"low",
					"medium"
				]
			},
			{
				...fromCatalog("sol", CODEX_MODELS.sol),
				tier: "Balanced",
				costWeight: 3,
				bestFor: "Everyday features, fixes, and tests",
				maxScore: 65,
				efforts: CODEX_EFFORTS,
				effortPicks: [
					"medium",
					"medium",
					"high"
				]
			},
			{
				...fromCatalog("astra", CODEX_MODELS.astra),
				tier: "Deep",
				costWeight: 6,
				bestFor: "Complex, multi-step engineering work",
				maxScore: 100,
				efforts: CODEX_EFFORTS,
				effortPicks: [
					"high",
					"high",
					"xhigh"
				]
			}
		]
	},
	"gemini-cli": {
		generic: false,
		modelFlag: "--model",
		effortHint: "Gemini CLI has no per-run effort flag. Its thinking budget lives in settings.json (thinkingConfig).",
		models: [
			{
				...fromCatalog("flash-lite", GEMINI_CLI_MODELS.flashLite),
				tier: "Fast",
				costWeight: 1,
				bestFor: "Small, well-defined edits",
				maxScore: 30
			},
			{
				...fromCatalog("flash", GEMINI_CLI_MODELS.flash),
				tier: "Balanced",
				costWeight: 2,
				bestFor: "Everyday features, fixes, and tests",
				maxScore: 65
			},
			{
				...fromCatalog("pro", GEMINI_CLI_MODELS.pro),
				tier: "Deep",
				costWeight: 6,
				bestFor: "Complex reasoning and larger changes",
				maxScore: 100
			}
		]
	}
};
var GENERIC_MODELS = [
	{
		id: "fast",
		label: "Small model",
		tier: "Fast",
		costWeight: 1,
		bestFor: `A ${CLAUDE_MODELS.haiku.family}, Flash, or mini class model for small edits`,
		maxScore: 30
	},
	{
		id: "balanced",
		label: "Mid-tier model",
		tier: "Balanced",
		costWeight: 3,
		bestFor: `A ${CLAUDE_MODELS.sonnet.family} class model for everyday coding`,
		maxScore: 65
	},
	{
		id: "frontier",
		label: "Frontier model",
		tier: "Deep",
		costWeight: 6,
		bestFor: `An ${CLAUDE_MODELS.opus.family} or Pro class model for complex work`,
		maxScore: 100
	}
];
function runProfileForTargetAI(targetAI) {
	const cliId = cliIdForTargetAI(targetAI);
	const cli = cliId ? getCliDefinition(cliId) : void 0;
	const executable = cli?.executableNames[0];
	const known = cliId ? RUN_PROFILES[cliId] : void 0;
	if (known) return {
		...known,
		cliId,
		executable
	};
	const exampleFlag = cli?.argsExample?.split(/\s+/)[0];
	return {
		cliId,
		executable,
		generic: true,
		modelFlag: exampleFlag && /^-/.test(exampleFlag) && /model|^-m$/.test(exampleFlag) ? exampleFlag : void 0,
		effortHint: "If your provider has a reasoning effort setting, set it there.",
		note: `${cli?.label ?? targetAI} runs whichever provider you set up, so pick the matching model from it.`,
		models: GENERIC_MODELS
	};
}
function effortForBand(model, band) {
	if (!model.efforts?.length) return void 0;
	return model.effortPicks?.[band] ?? model.efforts[Math.floor(model.efforts.length / 2)];
}
/** The effort to show when the user switches to a model without a score to place it by. */
function defaultEffortFor(model) {
	return effortForBand(model, 1);
}
function bandFor(profile, model, score) {
	const index = profile.models.indexOf(model);
	const floor = index > 0 ? profile.models[index - 1]?.maxScore ?? 0 : 0;
	const position = (score - floor) / Math.max(1, model.maxScore - floor);
	return position < 1 / 3 ? 0 : position < 2 / 3 ? 1 : 2;
}
/** The cheapest model whose band covers `score`, for answers that name no usable model. */
function modelForScore(profile, score) {
	return profile.models.find((m) => score <= m.maxScore) ?? profile.models[profile.models.length - 1];
}
object({
	score: number(),
	model: string$1().optional(),
	effort: string$1().nullish(),
	summary: string$1().optional(),
	reasons: array(object({
		label: string$1(),
		direction: string$1().optional()
	})).optional()
});
/** Rebuilds the full recommendation (profile included) from an assessment that crossed IPC. */
function recommendationFromAssessment(targetAI, assessment) {
	const profile = runProfileForTargetAI(targetAI);
	const model = profile.models.find((m) => m.id === assessment.modelId) ?? modelForScore(profile, assessment.score);
	return {
		targetAI,
		profile,
		assessment,
		recommended: {
			model,
			effort: assessment.effort && model.efforts?.includes(assessment.effort) ? assessment.effort : effortForBand(model, bandFor(profile, model, assessment.score))
		}
	};
}
/** CLI args that apply a choice, e.g. `['--model', 'sonnet', '--effort', 'medium']`. */
function runChoiceArgs(profile, choice) {
	const args = [];
	if (profile.modelFlag && choice.model.modelArg) args.push(profile.modelFlag, choice.model.modelArg);
	if (choice.effort && profile.effortArgs && choice.model.efforts?.includes(choice.effort)) args.push(...profile.effortArgs(choice.effort));
	return args;
}
/**
* Where a choice sits on this CLI's own cost range, 1 being its cheapest run and 5 its
* priciest. It's relative on purpose: token counts depend on the repo and the agent's
* path through it, so a dollar figure per task would be a guess dressed up as a number.
*/
function relativeCostLevel(profile, choice) {
	const value = (m, e) => m.costWeight * (e ? EFFORT_COST_FACTOR[e] : 1);
	let min = Number.POSITIVE_INFINITY;
	let max = 0;
	for (const m of profile.models) {
		const levels = m.efforts?.length ? m.efforts : [void 0];
		for (const e of levels) {
			const v = value(m, e);
			min = Math.min(min, v);
			max = Math.max(max, v);
		}
	}
	const current = value(choice.model, choice.effort);
	if (max <= min) return 3;
	const t = Math.log(current / min) / Math.log(max / min);
	return clamp(Math.round(1 + t * 4), 1, 5);
}
//#endregion
//#region ../../packages/core/dist/workspace/shellQuote.js
/**
* Quoting for text typed into an interactive shell: a dropped file path, or an argument in a
* launch command. Each shell family has its own rules, and getting them wrong either breaks
* paths with spaces or, worse, runs part of a file name as a command.
*/
function shellKindFor(shell, platform) {
	const name = (shell ?? "").toLowerCase().replace(/\\/g, "/").split("/").pop() ?? "";
	if (name === "powershell.exe" || name === "pwsh.exe" || name === "pwsh" || name === "powershell") return "powershell";
	if (name === "cmd.exe" || name === "cmd") return "cmd";
	if (name === "fish") return "fish";
	if (name === "bash" || name === "zsh" || name === "sh") return "posix";
	return platform === "win32" ? "powershell" : "posix";
}
/** Characters every shell here treats literally, so such a word needs no quotes at all. */
var SAFE_WORD = /^[A-Za-z0-9_@%+=:,./\\-]+$/;
function quoteForShell(value, kind) {
	const backslashIsSpecial = kind === "posix" || kind === "fish";
	if (value.length > 0 && SAFE_WORD.test(value) && !(backslashIsSpecial && value.includes("\\"))) return value;
	switch (kind) {
		case "powershell": return `'${value.replace(/'/g, "''")}'`;
		case "cmd": return `"${value.replace(/"/g, "\"\"")}"`;
		case "fish": return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
		case "posix": return `'${value.replace(/'/g, `'\\''`)}'`;
	}
}
//#endregion
//#region ../../packages/core/dist/cli/launchDefaults.js
var CLAUDE_MODES = {
	flags: ["--permission-mode", "--dangerously-skip-permissions"],
	modes: [
		{
			id: "manual",
			label: "Ask first",
			description: "Asks before edits and commands.",
			args: ["--permission-mode", "manual"]
		},
		{
			id: "acceptEdits",
			label: "Accept edits",
			description: "Edits files without asking, still asks before commands.",
			args: ["--permission-mode", "acceptEdits"]
		},
		{
			id: "plan",
			label: "Plan",
			description: "Reads and plans, makes no changes.",
			args: ["--permission-mode", "plan"]
		},
		{
			id: "auto",
			label: "Auto",
			description: "Decides on its own which actions are safe to run.",
			args: ["--permission-mode", "auto"]
		},
		{
			id: "bypassPermissions",
			label: "Bypass permissions",
			description: "Runs everything without asking.",
			args: ["--permission-mode", "bypassPermissions"],
			risky: true
		}
	]
};
/** CLIs that only document how to start a session in a particular mode get an entry here. */
var MODE_SPECS = {
	"claude-code": CLAUDE_MODES,
	openclaude: {
		flags: CLAUDE_MODES.flags,
		modes: [{
			id: "default",
			label: "Ask first",
			description: "Asks before edits and commands.",
			args: ["--permission-mode", "default"]
		}, ...CLAUDE_MODES.modes.filter((mode) => mode.id !== "manual" && mode.id !== "auto")]
	},
	"grok-cli": {
		flags: ["--permission-mode"],
		modes: [
			{
				id: "default",
				label: "Ask first",
				description: "Asks before edits and commands.",
				args: ["--permission-mode", "default"]
			},
			{
				id: "acceptEdits",
				label: "Accept edits",
				description: "Edits files without asking, still asks before commands.",
				args: ["--permission-mode", "acceptEdits"]
			},
			{
				id: "plan",
				label: "Plan",
				description: "Reads and plans, makes no changes.",
				args: ["--permission-mode", "plan"]
			},
			{
				id: "auto",
				label: "Auto",
				description: "Decides on its own which actions are safe to run.",
				args: ["--permission-mode", "auto"]
			},
			{
				id: "bypassPermissions",
				label: "Bypass permissions",
				description: "Runs everything without asking.",
				args: ["--permission-mode", "bypassPermissions"],
				risky: true
			}
		]
	},
	"codex-cli": {
		flags: [
			"--sandbox",
			"-s",
			"--ask-for-approval",
			"-a",
			"--approve-for-me",
			"--full-auto",
			"--dangerously-bypass-approvals-and-sandbox",
			"--yolo"
		],
		modes: [
			{
				id: "read-only",
				label: "Read only",
				description: "Can read the project but not change it.",
				args: ["--sandbox", "read-only"]
			},
			{
				id: "ask",
				label: "Ask first",
				description: "Works in the project folder and asks when it needs more.",
				args: [
					"--sandbox",
					"workspace-write",
					"--ask-for-approval",
					"on-request"
				]
			},
			{
				id: "auto",
				label: "Auto",
				description: "Approval requests are reviewed automatically, inside the sandbox.",
				args: ["--approve-for-me"]
			},
			{
				id: "full-access",
				label: "Full access",
				description: "No sandbox and no approvals.",
				args: ["--dangerously-bypass-approvals-and-sandbox"],
				risky: true
			}
		]
	},
	"gemini-cli": {
		flags: [
			"--approval-mode",
			"--yolo",
			"-y"
		],
		modes: [
			{
				id: "default",
				label: "Ask first",
				description: "Asks before running tools.",
				args: ["--approval-mode", "default"]
			},
			{
				id: "auto_edit",
				label: "Accept edits",
				description: "Edits files without asking.",
				args: ["--approval-mode", "auto_edit"]
			},
			{
				id: "plan",
				label: "Plan",
				description: "Read only, makes no changes.",
				args: ["--approval-mode", "plan"]
			},
			{
				id: "yolo",
				label: "YOLO",
				description: "Runs every tool without asking.",
				args: ["--approval-mode", "yolo"],
				risky: true
			}
		]
	},
	"qwen-cli": {
		flags: [
			"--approval-mode",
			"--yolo",
			"-y"
		],
		modes: [{
			id: "yolo",
			label: "YOLO",
			description: "Runs every tool without asking.",
			args: ["--yolo"],
			risky: true
		}]
	},
	"cursor-cli": {
		flags: [
			"--mode",
			"--plan",
			"--force",
			"-f",
			"--yolo"
		],
		modes: [
			{
				id: "plan",
				label: "Plan",
				description: "Analyzes and proposes plans, makes no edits.",
				args: ["--mode", "plan"]
			},
			{
				id: "ask",
				label: "Ask",
				description: "Questions and explanations only, read only.",
				args: ["--mode", "ask"]
			},
			{
				id: "force",
				label: "Run everything",
				description: "Allows commands unless they are explicitly denied.",
				args: ["--force"],
				risky: true
			}
		]
	},
	"copilot-cli": {
		flags: [
			"--mode",
			"--plan",
			"--autopilot",
			"--allow-all",
			"--allow-all-tools",
			"--yolo"
		],
		modes: [
			{
				id: "plan",
				label: "Plan",
				description: "Starts by planning before it changes anything.",
				args: ["--mode", "plan"]
			},
			{
				id: "autopilot",
				label: "Autopilot",
				description: "Keeps working on its own until the task is done.",
				args: ["--mode", "autopilot"]
			},
			{
				id: "allow-all",
				label: "Allow all",
				description: "Every tool, path, and URL without asking.",
				args: ["--allow-all"],
				risky: true
			}
		]
	}
};
var ALL_EFFORTS = Object.keys(EFFORT_LABELS);
/** Effort flags for CLIs that have one but no model profile to take it from. */
var EFFORT_SPECS = {
	"copilot-cli": {
		efforts: ALL_EFFORTS,
		effortArgs: (level) => ["--reasoning-effort", level]
	},
	"grok-cli": {
		efforts: [
			"low",
			"medium",
			"high"
		],
		effortArgs: (level) => ["--reasoning-effort", level]
	}
};
/** What can be preset for a CLI's launch. Null when AgentMate knows no launch flags for it. */
function cliLaunchOptions(cliId) {
	const cli = getCliDefinition(cliId);
	if (!cli) return null;
	const profile = runProfileForTargetAI(cliId);
	const models = profile.generic ? [] : profile.models.filter((model) => model.modelArg).map((model) => ({
		value: model.modelArg,
		label: model.label,
		efforts: model.efforts
	}));
	const profileEfforts = profile.effortArgs ? ALL_EFFORTS.filter((level) => profile.models.some((m) => m.efforts?.includes(level))) : [];
	const effortSpec = EFFORT_SPECS[cliId];
	const modeSpec = MODE_SPECS[cliId];
	const options = {
		cliId,
		modelFlag: profile.modelFlag,
		models,
		modelPlaceholder: profile.modelFlag ? cli.argsExample?.split(/\s+/).slice(1).join(" ") || void 0 : void 0,
		efforts: profileEfforts.length ? profileEfforts : effortSpec?.efforts ?? [],
		effortArgs: profileEfforts.length ? profile.effortArgs : effortSpec?.effortArgs,
		modes: modeSpec?.modes ?? [],
		modeFlags: modeSpec?.flags ?? []
	};
	return options.modelFlag || options.efforts.length || options.modes.length ? options : null;
}
/** The flag names an argument group sets, for spotting it among the user's own arguments. */
function flagKeys(args) {
	const keys = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-c" && args[i + 1]) {
			keys.push(`${args[i + 1].split("=")[0]}=`);
			i++;
		} else if (arg.startsWith("-")) keys.push(arg);
	}
	return keys;
}
function setsAny(taken, keys) {
	return keys.some((key) => key.endsWith("=") ? taken.some((arg) => arg.startsWith(key)) : taken.some((arg) => arg === key || arg.startsWith(`${key}=`)));
}
function modelFlagKeys(modelFlag) {
	return modelFlag === "--model" ? ["--model", "-m"] : [modelFlag];
}
function effortFlagKeys(effortArgs) {
	return [...flagKeys(effortArgs), ...effortArgs[0] === "--reasoning-effort" ? ["--effort"] : []];
}
/**
* Turns a CLI's launch defaults into flags, one group per field that is set. `takenArgs` are
* the arguments the launch already carries (a model and effort picked for this one run). A
* default never fights them: a group whose flag is already there is marked not applied.
*/
function launchDefaultParts(cliId, defaults, takenArgs = []) {
	const options = cliLaunchOptions(cliId);
	if (!options || !defaults) return [];
	const parts = [];
	const model = defaults.model?.trim();
	if (model && options.modelFlag) parts.push({
		kind: "model",
		args: [options.modelFlag, model],
		applied: !setsAny(takenArgs, modelFlagKeys(options.modelFlag))
	});
	const takenModel = options.modelFlag ? findTakenFlag(takenArgs, modelFlagKeys(options.modelFlag))?.value : void 0;
	const known = options.models.find((m) => m.value === (takenModel ?? model));
	if (defaults.effort && options.efforts.includes(defaults.effort) && (!known || known.efforts?.includes(defaults.effort)) && options.effortArgs && defaults.effort) {
		const args = options.effortArgs(defaults.effort);
		parts.push({
			kind: "effort",
			args,
			applied: !setsAny(takenArgs, effortFlagKeys(args))
		});
	}
	const mode = options.modes.find((m) => m.id === defaults.mode);
	if (mode) parts.push({
		kind: "mode",
		args: [...mode.args],
		applied: !setsAny(takenArgs, options.modeFlags)
	});
	return parts;
}
/** The launch-default flags to add to a launch, leaving out whatever it already sets. */
function launchDefaultArgs(cliId, defaults, takenArgs = []) {
	return launchDefaultParts(cliId, defaults, takenArgs).filter((part) => part.applied).flatMap((part) => part.args);
}
function findTakenFlag(takenArgs, keys) {
	for (let i = 0; i < takenArgs.length; i++) {
		const arg = takenArgs[i];
		const next = takenArgs[i + 1];
		for (const key of keys) if (key.endsWith("=")) {
			if (arg === "-c" && next?.startsWith(key)) return {
				flag: "-c",
				value: next
			};
		} else if (arg === key) return next !== void 0 && !next.startsWith("-") ? {
			flag: key,
			value: next
		} : { flag: key };
		else if (arg.startsWith(`${key}=`)) return {
			flag: key,
			value: arg.slice(key.length + 1)
		};
	}
}
//#endregion
//#region ../../packages/core/dist/cli/launchCommand.js
/**
* The line a terminal types to start an agent CLI: the executable, any leading words, status
* hooks, the launch defaults, then the run arguments. A run argument replaces the launch default
* for the same flag. Nothing is added that the user didn't set, so a CLI with no launch defaults
* starts exactly as if typed by hand.
*
* The Arguments box from CLI Manager is deliberately not read here. Those flags belong to
* background tasks only (see buildHeadlessCliArgs), so a `--model haiku` saved for commit
* messages never changes the model of a terminal session.
*/
function buildAgentLaunchCommand(input) {
	const cli = getCliDefinition(input.cliId);
	if (!cli) return null;
	const kind = input.shellKind;
	const run = [...input.runArgs ?? []];
	const defaults = input.skipLaunchDefaults ? [] : launchDefaultArgs(input.cliId, input.launchDefaults, run);
	return [
		cli.executableNames[0],
		...(input.leadingArgs ?? []).map((arg) => quoteForShell(arg, kind)),
		...input.hookSettingsPath ? ["--settings", quoteForShell(input.hookSettingsPath, kind)] : [],
		...defaults.map((arg) => quoteForShell(arg, kind)),
		...run.map((arg) => quoteForShell(arg, kind))
	].filter(Boolean).join(" ");
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/define.js
/**
* Builds a template and checks the parts the type system cannot: the default version is listed,
* every parameter has a field for the install sheet and no field is left over, and ids and
* secret keys are unique. A template that fails throws when the catalog loads, so a broken one
* never reaches the install sheet.
*/
function defineCatalogTemplate(template) {
	const versions = template.versions.map((version) => version.id);
	if (!versions.includes(template.defaultVersion)) throw new Error(`${template.id}: the default version ${template.defaultVersion} is not one of its versions.`);
	if (new Set(versions).size !== versions.length) throw new Error(`${template.id}: two versions share an id.`);
	const keys = Object.keys(template.parameters.shape).sort();
	const fields = Object.keys(template.fields).sort();
	const missing = keys.filter((key) => !fields.includes(key));
	const extra = fields.filter((key) => !keys.includes(key));
	if (missing.length > 0 || extra.length > 0) throw new Error(`${template.id}: fields and parameters differ (no field for ${missing.join(", ") || "none"}, no parameter for ${extra.join(", ") || "none"}).`);
	const secrets = template.secrets.map((secret) => secret.key);
	if (new Set(secrets).size !== secrets.length) throw new Error(`${template.id}: two secrets share a key.`);
	return template;
}
var PORT_RANGE = "Ports go from 1 to 65535.";
/** A host port, bound to 127.0.0.1. */
function portParam(fallback) {
	return number$1({ error: "Enter a port number." }).int("A port is a whole number.").min(1, PORT_RANGE).max(65535, PORT_RANGE).default(fallback);
}
/** A database, user or account name: safe in SQL, URLs, shells and YAML as it is. */
function identifierParam(fallback) {
	return string$1({ error: "Enter a name." }).regex(/^[A-Za-z][A-Za-z0-9_]{0,62}$/, "Use letters, digits and underscores, starting with a letter, up to 63 characters.").default(fallback);
}
/** An existing Docker network to join, such as another app's `name_default`. */
function networkParam() {
	return string$1({ error: "Enter a network name." }).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/, "Use the name of an existing Docker network: letters, digits, dots, dashes and underscores.").optional();
}
/** A host name another container answers to, such as `db` or `postgres`. */
function hostParam(fallback) {
	return string$1({ error: "Enter a host name." }).regex(/^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/, "Use a container or host name: letters, digits, dots and dashes.").default(fallback);
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/images.js
/**
* Every image the catalog runs, pinned by tag and by the digest of its multi-platform index.
* Each digest was read from the registry with `docker buildx imagetools inspect` on the date in
* CATALOG_RESOLVED_AT, and each index was checked to carry linux/amd64 and linux/arm64 images. Only
* Docker Official Images and images from the vendor's own namespace are listed.
*
* To move a pin, inspect the new tag and replace both the tag and the digest. Installed apps keep
* their old digest until someone applies the update (updates.ts).
*/
var CATALOG_RESOLVED_AT = "2026-10-01";
var PLATFORMS = ["linux/amd64", "linux/arm64"];
function pin(repository, tag, digest, source, publisher) {
	return {
		repository,
		tag,
		digest,
		platforms: PLATFORMS,
		source,
		publisher,
		resolvedAt: CATALOG_RESOLVED_AT
	};
}
var official = (name, tag, digest) => pin(`docker.io/library/${name}`, tag, digest, "docker-official", "Docker Official Images");
var CATALOG_IMAGES = {
	mysql97: official("mysql", "9.7.2", "sha256:e2bde46db6563855d7177adb5f0b57b9dc663f5a20927a90f4259d3312068497"),
	mysql84: official("mysql", "8.4.11", "sha256:6ea90827b1100f8f2ae306a539f86d2c264a26ed435a2a9f75551dd5c3aeb242"),
	mariadb123: official("mariadb", "12.3.3", "sha256:805c8e104bd563d5bfa24fadd3f31cd419ea859cb5277f32b5dbf2db714f9ed1"),
	mariadb114: official("mariadb", "11.4.13", "sha256:70cc072b29b4a89ae07abb2d4da2c64678a7f2dfe092751bb51c87d67dc1338b"),
	postgres18: official("postgres", "18.6", "sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722"),
	postgres17: official("postgres", "17.11", "sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f"),
	redis810: official("redis", "8.10.2", "sha256:6f81e8915c60b065a524e6967e0ad1c639ba6efa84d669f823683ea04d9150ee"),
	mongo90: official("mongo", "9.0.2", "sha256:c73153413b453d7d31199be36e101ab51195a4e6cff7bee8a2aa52a9769e4e11"),
	mongo80: official("mongo", "8.0.32", "sha256:4968f22d0c6c10ef29952f3e807f62872ba22b3312f25803564fbfc08255efc2"),
	wordpress71: official("wordpress", "7.1.2-php8.3-apache", "sha256:4abf7a450ee477dde967584f8174d7e03221d224c4971a0c38d84e7254426e64"),
	ghost6: official("ghost", "6.67.0", "sha256:428ce627d581017a534d756eae5e8fa973052dd8ec5f5a0c6cd6a83ab85e94ca"),
	adminer6: official("adminer", "6.1.1-standalone", "sha256:74f29c416e148b98305e84446a18db7cd2c1038264dec464359d36774ef080ce"),
	phpmyadmin52: official("phpmyadmin", "5.2.3-apache", "sha256:e1d42a6985a9622e1e2461d31d2cea82fb069ee05194dbe2a6c758f86c9ef6b8"),
	nextcloud35: official("nextcloud", "35.0.1-apache", "sha256:b1ae671e9815401b0e837b19b9c778e89887721d67f0c8f9d34aa1d27a9a208f"),
	nextcloud34: official("nextcloud", "34.0.4-apache", "sha256:37b109885aa3cba3e056362a899556a625c986f2c17cd2c0cc157d21c789f53b"),
	rabbitmq43: official("rabbitmq", "4.3.6-management", "sha256:751bf4eeaa6965c0cdee73e1282ec62ac010191b168a18beda8b3e903cbe9769"),
	ollama: pin("docker.io/ollama/ollama", "0.35.0", "sha256:2a6e883b917fc543389599dae79918f5cac9e1438890506982f44aa4f5625d01", "vendor", "Ollama"),
	openWebUi: pin("ghcr.io/open-webui/open-webui", "v0.11.4", "sha256:9591b13f13843c7721c2b8eaf7382846c81b3ffe126526d1888d1fed50c6a33f", "vendor", "Open WebUI"),
	n8n: pin("docker.io/n8nio/n8n", "2.41.4", "sha256:3cd1d3a03f5e059a0757d8c95823ff09ef61d3b6bf7fcb4ac3ac5fd5303b6c6d", "vendor", "n8n"),
	uptimeKuma: pin("docker.io/louislam/uptime-kuma", "2.5.5-rootless", "sha256:c4e17ce033deb811aff8a61a5f8f736f35b1bd937458ddeec46c59ca190f0e03", "vendor", "Uptime Kuma"),
	gitea: pin("docker.io/gitea/gitea", "28.0.0-rootless", "sha256:c168e7ccb767164793a67e1e874639488260795567337452b06292d1515bea12", "vendor", "Gitea"),
	grafana: pin("docker.io/grafana/grafana", "13.2.3", "sha256:b28bae15e219c998fb0e0424ed724930cc61b1f61fb404d47c862f9a23f9e572", "vendor", "Grafana Labs"),
	prometheus: pin("docker.io/prom/prometheus", "v3.15.0", "sha256:efd719c99d83b060d9daefdcf00360461adf279f45ef5391f8d111892118753e", "vendor", "Prometheus"),
	meilisearch: pin("docker.io/getmeili/meilisearch", "v1.54.2", "sha256:1c9dc9b037162d59224a4fc8b1fadd96e343213acf7c828e5d380e28407443fb", "vendor", "Meilisearch")
};
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/shared.js
/** Pieces several templates share: their bundled databases, health checks and facts. */
var fact = (id, label, value, sensitive = false) => ({
	id,
	label,
	value,
	sensitive
});
/** Where the app answers: its domain when it has one, else its port on the server's loopback. */
var appUrl = (publicUrl, port) => publicUrl ?? `http://127.0.0.1:${port}`;
/** The host part of an app URL, such as example.com or 127.0.0.1. */
var urlHost = (url) => new URL(url).hostname;
/** A health check through Node's own fetch, for images that ship neither curl nor wget. */
function nodeHttpCheck(url, startPeriod = "1m") {
	return {
		test: [
			"CMD",
			"node",
			"-e",
			`fetch('${url}', { redirect: 'manual' }).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))`
		],
		startPeriod
	};
}
function curlCheck(url, startPeriod = "1m") {
	return {
		test: [
			"CMD",
			"curl",
			"-fsS",
			"-o",
			"/dev/null",
			url
		],
		startPeriod
	};
}
/** `mysqladmin ping` exits 0 once the server answers on TCP, which it only does after setup. */
var MYSQL_HEALTHCHECK = {
	test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 --silent"],
	startPeriod: "1m"
};
/** The image's own script, with the healthcheck user it creates on first start. */
var MARIADB_HEALTHCHECK = {
	test: [
		"CMD",
		"healthcheck.sh",
		"--connect",
		"--innodb_initialized"
	],
	startPeriod: "1m"
};
/** MySQL and MariaDB create root themselves and refuse an app user of that name. */
var notRootUser = (name) => name.toLowerCase() !== "root";
var NOT_ROOT_MESSAGE = "root is the administrator account. Pick another name.";
/** The MySQL server an app bundles, reachable only by the app's own containers. */
function bundledMysql(options) {
	return {
		image: "db",
		environment: {
			MYSQL_ROOT_PASSWORD: { secret: options.rootSecret },
			MYSQL_DATABASE: options.database,
			MYSQL_USER: options.user,
			MYSQL_PASSWORD: { secret: options.passwordSecret }
		},
		volumes: [{
			volume: "db",
			target: "/var/lib/mysql"
		}],
		healthcheck: MYSQL_HEALTHCHECK
	};
}
/** The MariaDB server an app bundles, reachable only by the app's own containers. */
function bundledMariadb(options) {
	return {
		image: "db",
		...options.command ? { command: options.command } : {},
		environment: {
			MARIADB_ROOT_PASSWORD: { secret: options.rootSecret },
			MARIADB_DATABASE: options.database,
			MARIADB_USER: options.user,
			MARIADB_PASSWORD: { secret: options.passwordSecret },
			MARIADB_AUTO_UPGRADE: "1"
		},
		volumes: [{
			volume: "db",
			target: "/var/lib/mysql"
		}],
		healthcheck: MARIADB_HEALTHCHECK
	};
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/adminer.js
var adminer = defineCatalogTemplate({
	id: "adminer",
	name: "Adminer",
	description: "A one-page database manager for MySQL, MariaDB, PostgreSQL and SQLite.",
	category: "database",
	homepage: "https://www.adminer.org",
	versions: [{
		id: "6",
		label: "Adminer 6.1",
		images: { app: CATALOG_IMAGES.adminer6 }
	}],
	defaultVersion: "6",
	parameters: object({
		port: portParam(8081),
		server: hostParam("db"),
		network: networkParam()
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, best opened through an SSH tunnel.",
			input: "port"
		},
		server: {
			label: "Default server",
			help: "The database host filled in on the login page, such as the service name of another app.",
			input: "text"
		},
		network: {
			label: "Network",
			help: "Another app's Docker network to join, such as mysql_default, so Adminer can reach its database.",
			input: "text"
		}
	},
	secrets: [],
	minMemoryMb: 64,
	firstVisitorSetup: false,
	exposureNote: "Adminer is a login page for your databases. Keep it on 127.0.0.1, or put it on a domain only behind basic auth or an IP allowlist.",
	acknowledgments: [],
	build: ({ version, params, publicUrl }) => ({
		services: { adminer: {
			image: "app",
			environment: { ADMINER_DEFAULT_SERVER: params.server },
			ports: [{
				label: "Web interface",
				target: 8080,
				published: params.port
			}],
			healthcheck: {
				test: [
					"CMD",
					"php",
					"-r",
					"exit(@fsockopen('127.0.0.1', 8080) ? 0 : 1);"
				],
				startPeriod: "10s"
			},
			externalNetworks: params.network ? [params.network] : void 0
		} },
		web: {
			service: "adminer",
			port: 8080
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Web interface", appUrl(publicUrl, params.port)),
			fact("server", "Default server", params.server),
			fact("network", "Joined network", params.network ?? "None, only its own")
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/ghost.js
var ghost = defineCatalogTemplate({
	id: "ghost",
	name: "Ghost",
	description: "A publishing platform for blogs and newsletters, with a MySQL database of its own.",
	category: "website",
	homepage: "https://ghost.org",
	versions: [{
		id: "6",
		label: "Ghost 6.67 with MySQL 8.4",
		images: {
			app: CATALOG_IMAGES.ghost6,
			db: CATALOG_IMAGES.mysql84
		}
	}],
	defaultVersion: "6",
	parameters: object({ port: portParam(2368) }),
	fields: { port: {
		label: "Port",
		help: "The port on the server that the proxy forwards the domain to.",
		input: "port"
	} },
	secrets: [{
		key: "GHOST_DB_PASSWORD",
		label: "Database password",
		kind: "password",
		length: 32
	}, {
		key: "MYSQL_ROOT_PASSWORD",
		label: "MySQL root password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 1024,
	firstVisitorSetup: true,
	exposureNote: "Whoever opens /ghost first creates the owner account, so do that before putting the site on a domain. Staff invites and newsletters need mail settings, which this install leaves out.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => ({
		services: {
			ghost: {
				image: "app",
				environment: {
					url: appUrl(publicUrl, params.port),
					database__client: "mysql",
					database__connection__host: "db",
					database__connection__user: "ghost",
					database__connection__password: { secret: "GHOST_DB_PASSWORD" },
					database__connection__database: "ghost"
				},
				ports: [{
					label: "Website",
					target: 2368,
					published: params.port
				}],
				volumes: [{
					volume: "content",
					target: "/var/lib/ghost/content"
				}],
				healthcheck: nodeHttpCheck("http://127.0.0.1:2368/ghost/api/admin/site/", "2m"),
				dependsOn: ["db"]
			},
			db: bundledMysql({
				database: "ghost",
				user: "ghost",
				passwordSecret: "GHOST_DB_PASSWORD",
				rootSecret: "MYSQL_ROOT_PASSWORD"
			})
		},
		web: {
			service: "ghost",
			port: 2368
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Site", appUrl(publicUrl, params.port)),
			fact("admin", "Admin", `${appUrl(publicUrl, params.port)}/ghost/`),
			fact("db-password", "Database password", secret("GHOST_DB_PASSWORD"), true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/gitea.js
var gitea = defineCatalogTemplate({
	id: "gitea",
	name: "Gitea",
	description: "Lightweight self-hosted Git with issues, pull requests and package registries.",
	category: "developer",
	homepage: "https://about.gitea.com",
	versions: [{
		id: "28",
		label: "Gitea 28.0 (rootless)",
		images: { app: CATALOG_IMAGES.gitea }
	}],
	defaultVersion: "28",
	parameters: object({
		port: portParam(3002),
		sshPort: portParam(2222)
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server that the proxy forwards the domain to.",
			input: "port"
		},
		sshPort: {
			label: "SSH port",
			help: "For cloning over SSH. It is bound to 127.0.0.1 like every other port.",
			input: "port"
		}
	},
	secrets: [{
		key: "GITEA_SECRET_KEY",
		label: "Secret key",
		kind: "hex",
		length: 32
	}, {
		key: "GITEA_INTERNAL_TOKEN",
		label: "Internal token",
		kind: "hex",
		length: 32
	}],
	minMemoryMb: 512,
	firstVisitorSetup: true,
	exposureNote: "The first visit opens the setup page, and the first account registered becomes the admin. Finish both before putting Gitea on a domain.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => {
		const url = appUrl(publicUrl, params.port);
		return {
			services: { gitea: {
				image: "app",
				environment: {
					GITEA__database__DB_TYPE: "sqlite3",
					GITEA__server__ROOT_URL: `${url}/`,
					GITEA__server__DOMAIN: urlHost(url),
					GITEA__server__SSH_DOMAIN: urlHost(url),
					GITEA__server__SSH_PORT: String(params.sshPort),
					GITEA__server__SSH_LISTEN_PORT: "2222",
					GITEA__security__SECRET_KEY: { secret: "GITEA_SECRET_KEY" },
					GITEA__security__INTERNAL_TOKEN: { secret: "GITEA_INTERNAL_TOKEN" }
				},
				ports: [{
					label: "Web interface",
					target: 3e3,
					published: params.port
				}, {
					label: "Git over SSH",
					target: 2222,
					published: params.sshPort
				}],
				volumes: [{
					volume: "data",
					target: "/var/lib/gitea"
				}, {
					volume: "config",
					target: "/etc/gitea"
				}],
				healthcheck: curlCheck("http://localhost:3000/api/healthz")
			} },
			web: {
				service: "gitea",
				port: 3e3
			},
			facts: [
				fact("version", "Version", version.label),
				fact("url", "Web interface", url),
				fact("ssh", "Clone over SSH", `ssh://git@${urlHost(url)}:${params.sshPort}/owner/repo.git`),
				fact("secret-key", "Secret key", secret("GITEA_SECRET_KEY"), true)
			]
		};
	}
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/grafana.js
var grafana = defineCatalogTemplate({
	id: "grafana",
	name: "Grafana",
	description: "Dashboards and alerts over Prometheus, databases and many other data sources.",
	category: "monitoring",
	homepage: "https://grafana.com",
	versions: [{
		id: "13.2",
		label: "Grafana 13.2",
		images: { app: CATALOG_IMAGES.grafana }
	}],
	defaultVersion: "13.2",
	parameters: object({
		port: portParam(3e3),
		admin: identifierParam("admin")
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server that the proxy forwards the domain to.",
			input: "port"
		},
		admin: {
			label: "Admin user",
			help: "The administrator account, created on first start.",
			input: "text"
		}
	},
	secrets: [{
		key: "GF_SECURITY_ADMIN_PASSWORD",
		label: "Admin password",
		kind: "password",
		length: 32
	}, {
		key: "GF_SECURITY_SECRET_KEY",
		label: "Secret key",
		kind: "hex",
		length: 32
	}],
	minMemoryMb: 256,
	firstVisitorSetup: false,
	exposureNote: null,
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => ({
		services: { grafana: {
			image: "app",
			environment: {
				GF_SECURITY_ADMIN_USER: params.admin,
				GF_SECURITY_ADMIN_PASSWORD: { secret: "GF_SECURITY_ADMIN_PASSWORD" },
				GF_SECURITY_SECRET_KEY: { secret: "GF_SECURITY_SECRET_KEY" },
				GF_SERVER_ROOT_URL: appUrl(publicUrl, params.port),
				GF_USERS_ALLOW_SIGN_UP: "false",
				GF_ANALYTICS_REPORTING_ENABLED: "false"
			},
			ports: [{
				label: "Web interface",
				target: 3e3,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/var/lib/grafana"
			}],
			healthcheck: curlCheck("http://localhost:3000/api/health")
		} },
		web: {
			service: "grafana",
			port: 3e3
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Web interface", appUrl(publicUrl, params.port)),
			fact("admin", "Admin user", params.admin),
			fact("admin-password", "Admin password", secret("GF_SECURITY_ADMIN_PASSWORD"), true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/mariadb.js
var mariadb = defineCatalogTemplate({
	id: "mariadb",
	name: "MariaDB",
	description: "The community fork of MySQL, a drop-in for apps written against it.",
	category: "database",
	homepage: "https://mariadb.org",
	versions: [{
		id: "12.3",
		label: "MariaDB 12.3 LTS",
		images: { db: CATALOG_IMAGES.mariadb123 }
	}, {
		id: "11.4",
		label: "MariaDB 11.4 LTS",
		images: { db: CATALOG_IMAGES.mariadb114 }
	}],
	defaultVersion: "12.3",
	parameters: object({
		port: portParam(3307),
		database: identifierParam("app"),
		user: identifierParam("app").refine(notRootUser, NOT_ROOT_MESSAGE)
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server. It defaults to 3307 so MySQL can keep 3306.",
			input: "port"
		},
		database: {
			label: "Database",
			help: "Created on first start.",
			input: "text"
		},
		user: {
			label: "User",
			help: "An account with full rights on that database, created on first start.",
			input: "text"
		}
	},
	secrets: [{
		key: "MARIADB_ROOT_PASSWORD",
		label: "Root password",
		kind: "password",
		length: 32
	}, {
		key: "MARIADB_PASSWORD",
		label: "User password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 512,
	firstVisitorSetup: false,
	exposureNote: "MariaDB speaks its own protocol, not HTTP, so it is not put on a domain. Reach it through an SSH tunnel.",
	acknowledgments: [],
	build: ({ version, params, secret }) => ({
		services: { mariadb: {
			image: "db",
			environment: {
				MARIADB_ROOT_PASSWORD: { secret: "MARIADB_ROOT_PASSWORD" },
				MARIADB_DATABASE: params.database,
				MARIADB_USER: params.user,
				MARIADB_PASSWORD: { secret: "MARIADB_PASSWORD" },
				MARIADB_AUTO_UPGRADE: "1"
			},
			ports: [{
				label: "MariaDB",
				target: 3306,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/var/lib/mysql"
			}],
			healthcheck: MARIADB_HEALTHCHECK
		} },
		web: null,
		facts: [
			fact("version", "Version", version.label),
			fact("host", "Host", `127.0.0.1:${params.port}`),
			fact("database", "Database", params.database),
			fact("user", "User", params.user),
			fact("password", "Password", secret("MARIADB_PASSWORD"), true),
			fact("url", "Connection string", `mariadb://${params.user}:${secret("MARIADB_PASSWORD")}@127.0.0.1:${params.port}/${params.database}`, true),
			fact("root-password", "Root password", secret("MARIADB_ROOT_PASSWORD"), true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/meilisearch.js
var meilisearch = defineCatalogTemplate({
	id: "meilisearch",
	name: "Meilisearch",
	description: "A fast, typo-tolerant search engine for adding search to your own apps.",
	category: "search",
	homepage: "https://www.meilisearch.com",
	versions: [{
		id: "1.54",
		label: "Meilisearch 1.54",
		images: { app: CATALOG_IMAGES.meilisearch }
	}],
	defaultVersion: "1.54",
	parameters: object({ port: portParam(7700) }),
	fields: { port: {
		label: "Port",
		help: "The port on the server that the proxy forwards the domain to.",
		input: "port"
	} },
	secrets: [{
		key: "MEILI_MASTER_KEY",
		label: "Master key",
		kind: "hex",
		length: 32
	}],
	minMemoryMb: 512,
	firstVisitorSetup: false,
	exposureNote: "Hand out scoped API keys made with the master key, never the master key itself, to apps that search from the browser.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => ({
		services: { meilisearch: {
			image: "app",
			environment: {
				MEILI_MASTER_KEY: { secret: "MEILI_MASTER_KEY" },
				MEILI_ENV: "production",
				MEILI_NO_ANALYTICS: "true"
			},
			ports: [{
				label: "API",
				target: 7700,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/meili_data"
			}],
			healthcheck: curlCheck("http://localhost:7700/health", "30s")
		} },
		web: {
			service: "meilisearch",
			port: 7700
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "API", appUrl(publicUrl, params.port)),
			fact("master-key", "Master key", secret("MEILI_MASTER_KEY"), true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/mongodb.js
var mongodb = defineCatalogTemplate({
	id: "mongodb",
	name: "MongoDB",
	description: "A document database that stores JSON-like records without a fixed schema.",
	category: "database",
	homepage: "https://www.mongodb.com",
	versions: [{
		id: "9.0",
		label: "MongoDB 9.0",
		images: { db: CATALOG_IMAGES.mongo90 }
	}, {
		id: "8.0",
		label: "MongoDB 8.0",
		images: { db: CATALOG_IMAGES.mongo80 }
	}],
	defaultVersion: "9.0",
	parameters: object({
		port: portParam(27017),
		user: identifierParam("admin")
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, reachable from the server itself or an SSH tunnel.",
			input: "port"
		},
		user: {
			label: "Admin user",
			help: "The root account, created in the admin database on first start.",
			input: "text"
		}
	},
	secrets: [{
		key: "MONGO_INITDB_ROOT_PASSWORD",
		label: "Admin password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 1024,
	firstVisitorSetup: false,
	exposureNote: "MongoDB speaks its own protocol, not HTTP, so it is not put on a domain. On x86 servers it needs a CPU with AVX.",
	acknowledgments: [],
	build: ({ version, params, secret }) => ({
		services: { mongodb: {
			image: "db",
			environment: {
				MONGO_INITDB_ROOT_USERNAME: params.user,
				MONGO_INITDB_ROOT_PASSWORD: { secret: "MONGO_INITDB_ROOT_PASSWORD" }
			},
			ports: [{
				label: "MongoDB",
				target: 27017,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/data/db"
			}, {
				volume: "config",
				target: "/data/configdb"
			}],
			healthcheck: {
				test: [
					"CMD",
					"mongosh",
					"--quiet",
					"--eval",
					"db.adminCommand({ ping: 1 }).ok"
				],
				startPeriod: "1m"
			}
		} },
		web: null,
		facts: [
			fact("version", "Version", version.label),
			fact("host", "Host", `127.0.0.1:${params.port}`),
			fact("user", "Admin user", params.user),
			fact("password", "Admin password", secret("MONGO_INITDB_ROOT_PASSWORD"), true),
			fact("url", "Connection string", `mongodb://${params.user}:${secret("MONGO_INITDB_ROOT_PASSWORD")}@127.0.0.1:${params.port}/?authSource=admin`, true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/mysql.js
var mysql = defineCatalogTemplate({
	id: "mysql",
	name: "MySQL",
	description: "The relational database most web apps already know how to talk to.",
	category: "database",
	homepage: "https://www.mysql.com",
	versions: [{
		id: "9.7",
		label: "MySQL 9.7 LTS",
		images: { db: CATALOG_IMAGES.mysql97 }
	}, {
		id: "8.4",
		label: "MySQL 8.4 LTS",
		images: { db: CATALOG_IMAGES.mysql84 }
	}],
	defaultVersion: "9.7",
	parameters: object({
		port: portParam(3306),
		database: identifierParam("app"),
		user: identifierParam("app").refine(notRootUser, NOT_ROOT_MESSAGE)
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, reachable from the server itself or an SSH tunnel.",
			input: "port"
		},
		database: {
			label: "Database",
			help: "Created on first start.",
			input: "text"
		},
		user: {
			label: "User",
			help: "An account with full rights on that database, created on first start.",
			input: "text"
		}
	},
	secrets: [{
		key: "MYSQL_ROOT_PASSWORD",
		label: "Root password",
		kind: "password",
		length: 32
	}, {
		key: "MYSQL_PASSWORD",
		label: "User password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 512,
	firstVisitorSetup: false,
	exposureNote: "MySQL speaks its own protocol, not HTTP, so it is not put on a domain. Reach it through an SSH tunnel.",
	acknowledgments: [],
	build: ({ version, params, secret }) => ({
		services: { mysql: {
			image: "db",
			environment: {
				MYSQL_ROOT_PASSWORD: { secret: "MYSQL_ROOT_PASSWORD" },
				MYSQL_DATABASE: params.database,
				MYSQL_USER: params.user,
				MYSQL_PASSWORD: { secret: "MYSQL_PASSWORD" }
			},
			ports: [{
				label: "MySQL",
				target: 3306,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/var/lib/mysql"
			}],
			healthcheck: MYSQL_HEALTHCHECK
		} },
		web: null,
		facts: [
			fact("version", "Version", version.label),
			fact("host", "Host", `127.0.0.1:${params.port}`),
			fact("database", "Database", params.database),
			fact("user", "User", params.user),
			fact("password", "Password", secret("MYSQL_PASSWORD"), true),
			fact("url", "Connection string", `mysql://${params.user}:${secret("MYSQL_PASSWORD")}@127.0.0.1:${params.port}/${params.database}`, true),
			fact("root-password", "Root password", secret("MYSQL_ROOT_PASSWORD"), true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/n8n.js
var n8n = defineCatalogTemplate({
	id: "n8n",
	name: "n8n",
	description: "Workflow automation that connects your apps and APIs with a visual editor.",
	category: "automation",
	homepage: "https://n8n.io",
	versions: [{
		id: "2.41",
		label: "n8n 2.41",
		images: { app: CATALOG_IMAGES.n8n }
	}],
	defaultVersion: "2.41",
	parameters: object({ port: portParam(5678) }),
	fields: { port: {
		label: "Port",
		help: "The port on the server that the proxy forwards the domain to.",
		input: "port"
	} },
	secrets: [{
		key: "N8N_ENCRYPTION_KEY",
		label: "Credentials key",
		kind: "hex",
		length: 32
	}],
	minMemoryMb: 1024,
	firstVisitorSetup: true,
	exposureNote: "Whoever opens n8n first sets up the owner account, so do that before putting it on a domain. Webhooks need the domain to be reachable from the services that call them.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => {
		const url = appUrl(publicUrl, params.port);
		return {
			services: { n8n: {
				image: "app",
				environment: {
					N8N_ENCRYPTION_KEY: { secret: "N8N_ENCRYPTION_KEY" },
					N8N_HOST: urlHost(url),
					N8N_PORT: "5678",
					N8N_PROTOCOL: publicUrl ? "https" : "http",
					WEBHOOK_URL: `${url}/`,
					N8N_SECURE_COOKIE: publicUrl ? "true" : "false",
					N8N_PROXY_HOPS: publicUrl ? "1" : "0",
					N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true",
					N8N_DIAGNOSTICS_ENABLED: "false"
				},
				ports: [{
					label: "Editor",
					target: 5678,
					published: params.port
				}],
				volumes: [{
					volume: "data",
					target: "/home/node/.n8n"
				}],
				healthcheck: nodeHttpCheck("http://127.0.0.1:5678/healthz")
			} },
			web: {
				service: "n8n",
				port: 5678
			},
			facts: [
				fact("version", "Version", version.label),
				fact("url", "Editor", url),
				fact("webhooks", "Webhook base URL", `${url}/webhook/`),
				fact("key", "Credentials key", secret("N8N_ENCRYPTION_KEY"), true)
			]
		};
	}
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/nextcloud.js
var nextcloud = defineCatalogTemplate({
	id: "nextcloud",
	name: "Nextcloud",
	description: "Your own file sync and sharing, with calendars and contacts, on a MariaDB database.",
	category: "storage",
	homepage: "https://nextcloud.com",
	versions: [{
		id: "35",
		label: "Nextcloud 35 with MariaDB 11.4",
		images: {
			app: CATALOG_IMAGES.nextcloud35,
			db: CATALOG_IMAGES.mariadb114
		}
	}, {
		id: "34",
		label: "Nextcloud 34 (production channel) with MariaDB 11.4",
		images: {
			app: CATALOG_IMAGES.nextcloud34,
			db: CATALOG_IMAGES.mariadb114
		}
	}],
	defaultVersion: "34",
	parameters: object({
		port: portParam(8083),
		admin: identifierParam("admin")
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server that the proxy forwards the domain to.",
			input: "port"
		},
		admin: {
			label: "Admin user",
			help: "The administrator account, set up on first start.",
			input: "text"
		}
	},
	secrets: [
		{
			key: "NEXTCLOUD_ADMIN_PASSWORD",
			label: "Admin password",
			kind: "password",
			length: 32
		},
		{
			key: "NEXTCLOUD_DB_PASSWORD",
			label: "Database password",
			kind: "password",
			length: 32
		},
		{
			key: "MARIADB_ROOT_PASSWORD",
			label: "MariaDB root password",
			kind: "password",
			length: 32
		}
	],
	minMemoryMb: 2048,
	firstVisitorSetup: false,
	exposureNote: "The first start installs Nextcloud and can take a few minutes. Give it a domain with SSL before anyone syncs over the internet.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => {
		const domains = ["127.0.0.1", "localhost"];
		if (publicUrl) domains.unshift(urlHost(publicUrl));
		return {
			services: {
				nextcloud: {
					image: "app",
					environment: {
						MYSQL_HOST: "db",
						MYSQL_DATABASE: "nextcloud",
						MYSQL_USER: "nextcloud",
						MYSQL_PASSWORD: { secret: "NEXTCLOUD_DB_PASSWORD" },
						NEXTCLOUD_ADMIN_USER: params.admin,
						NEXTCLOUD_ADMIN_PASSWORD: { secret: "NEXTCLOUD_ADMIN_PASSWORD" },
						NEXTCLOUD_TRUSTED_DOMAINS: domains.join(" "),
						...publicUrl ? {
							OVERWRITEPROTOCOL: "https",
							OVERWRITECLIURL: publicUrl,
							TRUSTED_PROXIES: "172.16.0.0/12 192.168.0.0/16 10.0.0.0/8"
						} : {}
					},
					ports: [{
						label: "Website",
						target: 80,
						published: params.port
					}],
					volumes: [{
						volume: "nextcloud",
						target: "/var/www/html"
					}],
					healthcheck: curlCheck("http://localhost/status.php", "10m"),
					dependsOn: ["db"]
				},
				db: bundledMariadb({
					database: "nextcloud",
					user: "nextcloud",
					passwordSecret: "NEXTCLOUD_DB_PASSWORD",
					rootSecret: "MARIADB_ROOT_PASSWORD",
					command: [
						"--transaction-isolation=READ-COMMITTED",
						"--log-bin=binlog",
						"--binlog-format=ROW"
					]
				})
			},
			web: {
				service: "nextcloud",
				port: 80
			},
			facts: [
				fact("version", "Version", version.label),
				fact("url", "Web interface", appUrl(publicUrl, params.port)),
				fact("admin", "Admin user", params.admin),
				fact("admin-password", "Admin password", secret("NEXTCLOUD_ADMIN_PASSWORD"), true),
				fact("webdav", "WebDAV", `${appUrl(publicUrl, params.port)}/remote.php/dav/files/${params.admin}/`)
			]
		};
	}
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/ollama.js
var ollama = defineCatalogTemplate({
	id: "ollama",
	name: "Ollama",
	description: "Runs open language models on your server, with Open WebUI as a chat front end.",
	category: "ai",
	homepage: "https://ollama.com",
	versions: [{
		id: "0.35",
		label: "Ollama 0.35 with Open WebUI 0.11",
		images: {
			ollama: CATALOG_IMAGES.ollama,
			webui: CATALOG_IMAGES.openWebUi
		}
	}],
	defaultVersion: "0.35",
	parameters: object({
		port: portParam(11434),
		webUi: boolean().default(true),
		webUiPort: portParam(3003),
		gpu: boolean().default(false)
	}),
	fields: {
		port: {
			label: "API port",
			help: "The port of the Ollama API on the server. It has no login, so it stays on 127.0.0.1.",
			input: "port"
		},
		webUi: {
			label: "Open WebUI",
			help: "Adds a chat interface in the browser, with accounts of its own.",
			input: "toggle"
		},
		webUiPort: {
			label: "Open WebUI port",
			help: "The port on the server that the proxy forwards the domain to.",
			input: "port"
		},
		gpu: {
			label: "Use NVIDIA GPUs",
			help: "Gives Ollama every NVIDIA GPU. The server needs the NVIDIA Container Toolkit.",
			input: "toggle"
		}
	},
	secrets: [{
		key: "WEBUI_SECRET_KEY",
		label: "Open WebUI session key",
		kind: "hex",
		length: 32
	}],
	secretInUse: (key, params) => key !== "WEBUI_SECRET_KEY" || params.webUi,
	minMemoryMb: 8192,
	firstVisitorSetup: true,
	exposureNote: "The first account created in Open WebUI becomes its admin, so create yours before putting it on a domain. The Ollama API has no login and should never go on a domain without one in front of it.",
	acknowledgments: [],
	build: ({ version, params, publicUrl }) => {
		const services = { ollama: {
			image: "ollama",
			ports: [{
				label: "Ollama API",
				target: 11434,
				published: params.port
			}],
			volumes: [{
				volume: "models",
				target: "/root/.ollama"
			}],
			healthcheck: {
				test: [
					"CMD",
					"ollama",
					"list"
				],
				startPeriod: "30s"
			},
			gpu: params.gpu
		} };
		if (params.webUi) services["open-webui"] = {
			image: "webui",
			environment: {
				OLLAMA_BASE_URL: "http://ollama:11434",
				WEBUI_SECRET_KEY: { secret: "WEBUI_SECRET_KEY" },
				WEBUI_URL: appUrl(publicUrl, params.webUiPort),
				ANONYMIZED_TELEMETRY: "false"
			},
			ports: [{
				label: "Open WebUI",
				target: 8080,
				published: params.webUiPort
			}],
			volumes: [{
				volume: "webui",
				target: "/app/backend/data"
			}],
			healthcheck: curlCheck("http://localhost:8080/health", "10m"),
			dependsOn: ["ollama"]
		};
		return {
			services,
			web: params.webUi ? {
				service: "open-webui",
				port: 8080
			} : null,
			facts: [
				fact("version", "Version", version.label),
				fact("api", "Ollama API", `http://127.0.0.1:${params.port}`),
				...params.webUi ? [fact("webui", "Open WebUI", appUrl(publicUrl, params.webUiPort))] : [],
				fact("gpu", "GPU", params.gpu ? "Every NVIDIA GPU" : "None, models run on the CPU")
			]
		};
	}
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/phpmyadmin.js
var phpmyadmin = defineCatalogTemplate({
	id: "phpmyadmin",
	name: "phpMyAdmin",
	description: "The classic web interface for MySQL and MariaDB.",
	category: "database",
	homepage: "https://www.phpmyadmin.net",
	versions: [{
		id: "5.2",
		label: "phpMyAdmin 5.2",
		images: { app: CATALOG_IMAGES.phpmyadmin52 }
	}],
	defaultVersion: "5.2",
	parameters: object({
		port: portParam(8082),
		server: hostParam("db"),
		network: networkParam()
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, best opened through an SSH tunnel.",
			input: "port"
		},
		server: {
			label: "Database server",
			help: "The MySQL or MariaDB host to manage, such as the service name of another app.",
			input: "text"
		},
		network: {
			label: "Network",
			help: "Another app's Docker network to join, such as mysql_default, so phpMyAdmin can reach its database.",
			input: "text"
		}
	},
	secrets: [],
	minMemoryMb: 128,
	firstVisitorSetup: false,
	exposureNote: "phpMyAdmin is a login page for your databases. Keep it on 127.0.0.1, or put it on a domain only behind basic auth or an IP allowlist.",
	acknowledgments: [],
	build: ({ version, params, publicUrl }) => ({
		services: { phpmyadmin: {
			image: "app",
			environment: {
				PMA_HOST: params.server,
				...publicUrl ? { PMA_ABSOLUTE_URI: `${publicUrl}/` } : {}
			},
			ports: [{
				label: "Web interface",
				target: 80,
				published: params.port
			}],
			healthcheck: curlCheck("http://localhost/", "30s"),
			externalNetworks: params.network ? [params.network] : void 0
		} },
		web: {
			service: "phpmyadmin",
			port: 80
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Web interface", appUrl(publicUrl, params.port)),
			fact("server", "Database server", params.server),
			fact("network", "Joined network", params.network ?? "None, only its own")
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/postgres.js
var postgres = defineCatalogTemplate({
	id: "postgres",
	name: "PostgreSQL",
	description: "A dependable SQL database that handles JSON, full-text search and big tables well.",
	category: "database",
	homepage: "https://www.postgresql.org",
	versions: [{
		id: "18",
		label: "PostgreSQL 18",
		images: { db: CATALOG_IMAGES.postgres18 }
	}, {
		id: "17",
		label: "PostgreSQL 17",
		images: { db: CATALOG_IMAGES.postgres17 }
	}],
	defaultVersion: "18",
	parameters: object({
		port: portParam(5432),
		database: identifierParam("app"),
		user: identifierParam("app")
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, reachable from the server itself or an SSH tunnel.",
			input: "port"
		},
		database: {
			label: "Database",
			help: "Created on first start.",
			input: "text"
		},
		user: {
			label: "User",
			help: "The superuser created on first start. It owns the database.",
			input: "text"
		}
	},
	secrets: [{
		key: "POSTGRES_PASSWORD",
		label: "Password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 256,
	firstVisitorSetup: false,
	exposureNote: "PostgreSQL speaks its own protocol, not HTTP, so it is not put on a domain. Reach it through an SSH tunnel.",
	acknowledgments: [],
	build: ({ version, params, secret }) => ({
		services: { postgres: {
			image: "db",
			environment: {
				POSTGRES_DB: params.database,
				POSTGRES_USER: params.user,
				POSTGRES_PASSWORD: { secret: "POSTGRES_PASSWORD" }
			},
			ports: [{
				label: "PostgreSQL",
				target: 5432,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: version.id === "17" ? "/var/lib/postgresql/data" : "/var/lib/postgresql"
			}],
			healthcheck: {
				test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\" --quiet"],
				startPeriod: "1m"
			},
			stopGracePeriod: "1m"
		} },
		web: null,
		facts: [
			fact("version", "Version", version.label),
			fact("host", "Host", `127.0.0.1:${params.port}`),
			fact("database", "Database", params.database),
			fact("user", "User", params.user),
			fact("password", "Password", secret("POSTGRES_PASSWORD"), true),
			fact("url", "Connection string", `postgresql://${params.user}:${secret("POSTGRES_PASSWORD")}@127.0.0.1:${params.port}/${params.database}`, true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/prometheus.js
var prometheus = defineCatalogTemplate({
	id: "prometheus",
	name: "Prometheus",
	description: "Collects metrics from your services and keeps them as time series for querying.",
	category: "monitoring",
	homepage: "https://prometheus.io",
	versions: [{
		id: "3",
		label: "Prometheus 3.15",
		images: { app: CATALOG_IMAGES.prometheus }
	}],
	defaultVersion: "3",
	parameters: object({
		port: portParam(9090),
		retention: string$1({ error: "Enter how long to keep data." }).regex(/^[1-9][0-9]{0,3}[hdwy]$/, "Use a number and a unit, such as 15d, 12w or 1y.").default("15d")
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server, best opened through an SSH tunnel.",
			input: "port"
		},
		retention: {
			label: "Keep data for",
			help: "How long samples are kept, such as 15d, 12w or 1y.",
			input: "text"
		}
	},
	secrets: [],
	minMemoryMb: 512,
	firstVisitorSetup: false,
	exposureNote: "Prometheus has no login of its own. Keep it on 127.0.0.1 for Grafana and SSH tunnels, or put basic auth in front of it before it goes on a domain.",
	acknowledgments: [],
	build: ({ version, params, publicUrl }) => ({
		services: { prometheus: {
			image: "app",
			command: [
				"--config.file=/etc/prometheus/prometheus.yml",
				"--storage.tsdb.path=/prometheus",
				`--storage.tsdb.retention.time=${params.retention}`,
				...publicUrl ? [`--web.external-url=${publicUrl}/`] : []
			],
			ports: [{
				label: "Web interface and API",
				target: 9090,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/prometheus"
			}],
			healthcheck: {
				test: [
					"CMD",
					"wget",
					"-q",
					"-O",
					"/dev/null",
					"http://127.0.0.1:9090/-/healthy"
				],
				startPeriod: "30s"
			}
		} },
		web: {
			service: "prometheus",
			port: 9090
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Web interface", appUrl(publicUrl, params.port)),
			fact("retention", "Keeps data for", params.retention)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/rabbitmq.js
var rabbitmq = defineCatalogTemplate({
	id: "rabbitmq",
	name: "RabbitMQ",
	description: "A message broker for queues between services, with its management UI included.",
	category: "messaging",
	homepage: "https://www.rabbitmq.com",
	versions: [{
		id: "4.3",
		label: "RabbitMQ 4.3 with management",
		images: { app: CATALOG_IMAGES.rabbitmq43 }
	}],
	defaultVersion: "4.3",
	parameters: object({
		port: portParam(5672),
		managementPort: portParam(15672),
		user: identifierParam("admin").refine((name) => name !== "guest", "guest can only sign in from inside the container. Pick another name.")
	}),
	fields: {
		port: {
			label: "AMQP port",
			help: "The port clients connect to, on the server or through an SSH tunnel.",
			input: "port"
		},
		managementPort: {
			label: "Management port",
			help: "The port of the management UI, which the proxy forwards the domain to.",
			input: "port"
		},
		user: {
			label: "User",
			help: "The administrator account, created on first start.",
			input: "text"
		}
	},
	secrets: [{
		key: "RABBITMQ_DEFAULT_PASS",
		label: "Password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 512,
	firstVisitorSetup: false,
	exposureNote: "Only the management UI goes on a domain. Clients keep using the AMQP port.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => ({
		services: { rabbitmq: {
			image: "app",
			hostname: "rabbitmq",
			environment: {
				RABBITMQ_DEFAULT_USER: params.user,
				RABBITMQ_DEFAULT_PASS: { secret: "RABBITMQ_DEFAULT_PASS" }
			},
			ports: [{
				label: "AMQP",
				target: 5672,
				published: params.port
			}, {
				label: "Management UI",
				target: 15672,
				published: params.managementPort
			}],
			volumes: [{
				volume: "data",
				target: "/var/lib/rabbitmq"
			}],
			healthcheck: {
				test: [
					"CMD",
					"rabbitmq-diagnostics",
					"-q",
					"ping"
				],
				startPeriod: "1m"
			}
		} },
		web: {
			service: "rabbitmq",
			port: 15672
		},
		facts: [
			fact("version", "Version", version.label),
			fact("management", "Management UI", appUrl(publicUrl, params.managementPort)),
			fact("user", "User", params.user),
			fact("password", "Password", secret("RABBITMQ_DEFAULT_PASS"), true),
			fact("url", "Connection string", `amqp://${params.user}:${secret("RABBITMQ_DEFAULT_PASS")}@127.0.0.1:${params.port}/`, true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/redis.js
var redis = defineCatalogTemplate({
	id: "redis",
	name: "Redis",
	description: "An in-memory store for caches, queues and sessions, saved to disk as it goes.",
	category: "database",
	homepage: "https://redis.io",
	versions: [{
		id: "8.10",
		label: "Redis 8.10",
		images: { db: CATALOG_IMAGES.redis810 }
	}],
	defaultVersion: "8.10",
	parameters: object({ port: portParam(6379) }),
	fields: { port: {
		label: "Port",
		help: "The port on the server, reachable from the server itself or an SSH tunnel.",
		input: "port"
	} },
	secrets: [{
		key: "REDIS_PASSWORD",
		label: "Password",
		kind: "password",
		length: 32
	}],
	minMemoryMb: 128,
	firstVisitorSetup: false,
	exposureNote: "Redis speaks its own protocol, not HTTP, so it is not put on a domain. Reach it through an SSH tunnel.",
	acknowledgments: [],
	build: ({ version, params, secret }) => ({
		services: { redis: {
			image: "db",
			user: "999:999",
			command: [
				"sh",
				"-c",
				"exec redis-server --requirepass \"$$REDIS_PASSWORD\" --appendonly yes --save 60 1000"
			],
			environment: {
				REDIS_PASSWORD: { secret: "REDIS_PASSWORD" },
				REDISCLI_AUTH: { secret: "REDIS_PASSWORD" }
			},
			ports: [{
				label: "Redis",
				target: 6379,
				published: params.port
			}],
			volumes: [{
				volume: "data",
				target: "/data"
			}],
			healthcheck: {
				test: ["CMD-SHELL", "redis-cli ping | grep -q PONG"],
				startPeriod: "20s"
			}
		} },
		web: null,
		facts: [
			fact("version", "Version", version.label),
			fact("host", "Host", `127.0.0.1:${params.port}`),
			fact("password", "Password", secret("REDIS_PASSWORD"), true),
			fact("url", "Connection string", `redis://:${secret("REDIS_PASSWORD")}@127.0.0.1:${params.port}/0`, true)
		]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/uptimeKuma.js
var uptimeKuma = defineCatalogTemplate({
	id: "uptime-kuma",
	name: "Uptime Kuma",
	description: "Watches your sites and services and tells you when one goes down.",
	category: "monitoring",
	homepage: "https://uptime.kuma.pet",
	versions: [{
		id: "2",
		label: "Uptime Kuma 2.5 (rootless)",
		images: { app: CATALOG_IMAGES.uptimeKuma }
	}],
	defaultVersion: "2",
	parameters: object({ port: portParam(3001) }),
	fields: { port: {
		label: "Port",
		help: "The port on the server that the proxy forwards the domain to.",
		input: "port"
	} },
	secrets: [],
	minMemoryMb: 256,
	firstVisitorSetup: true,
	exposureNote: "Whoever opens Uptime Kuma first creates the admin account, so do that before putting it on a domain.",
	acknowledgments: [],
	build: ({ version, params, publicUrl }) => ({
		services: { "uptime-kuma": {
			image: "app",
			volumes: [{
				volume: "data",
				target: "/app/data"
			}],
			ports: [{
				label: "Dashboard",
				target: 3001,
				published: params.port
			}],
			healthcheck: {
				test: ["CMD-SHELL", "extra/healthcheck"],
				interval: "1m",
				timeout: "30s",
				startPeriod: "3m"
			}
		} },
		web: {
			service: "uptime-kuma",
			port: 3001
		},
		facts: [fact("version", "Version", version.label), fact("url", "Dashboard", appUrl(publicUrl, params.port))]
	})
});
//#endregion
//#region ../../packages/core/dist/deploy/catalog/templates/wordpress.js
/** WordPress signs cookies and nonces with these. Set here, they survive a container rebuild. */
var SALTS = [
	"AUTH_KEY",
	"SECURE_AUTH_KEY",
	"LOGGED_IN_KEY",
	"NONCE_KEY",
	"AUTH_SALT",
	"SECURE_AUTH_SALT",
	"LOGGED_IN_SALT",
	"NONCE_SALT"
];
var saltSecrets = SALTS.map((name) => ({
	key: `WORDPRESS_${name}`,
	label: `WordPress ${name.toLowerCase().replaceAll("_", " ")}`,
	kind: "hex",
	length: 32
}));
/** Behind the proxy the request reaches Apache over plain HTTP; this tells WordPress it was HTTPS. */
var BEHIND_PROXY = "if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') { $_SERVER['HTTPS'] = 'on'; }";
var wordpress = defineCatalogTemplate({
	id: "wordpress",
	name: "WordPress",
	description: "The blog and website builder, with a MySQL database of its own.",
	category: "website",
	homepage: "https://wordpress.org",
	versions: [{
		id: "7.1",
		label: "WordPress 7.1 with MySQL 8.4",
		images: {
			app: CATALOG_IMAGES.wordpress71,
			db: CATALOG_IMAGES.mysql84
		}
	}],
	defaultVersion: "7.1",
	parameters: object({
		port: portParam(8080),
		database: identifierParam("wordpress"),
		user: identifierParam("wordpress").refine(notRootUser, NOT_ROOT_MESSAGE)
	}),
	fields: {
		port: {
			label: "Port",
			help: "The port on the server that the proxy forwards the domain to.",
			input: "port"
		},
		database: {
			label: "Database",
			help: "The MySQL database WordPress uses.",
			input: "text"
		},
		user: {
			label: "Database user",
			help: "The MySQL account WordPress uses.",
			input: "text"
		}
	},
	secrets: [
		{
			key: "WORDPRESS_DB_PASSWORD",
			label: "Database password",
			kind: "password",
			length: 32
		},
		{
			key: "MYSQL_ROOT_PASSWORD",
			label: "MySQL root password",
			kind: "password",
			length: 32
		},
		...saltSecrets
	],
	minMemoryMb: 1024,
	firstVisitorSetup: true,
	exposureNote: "Until the setup page is finished, whoever opens the site first picks the admin account. Finish it before putting the site on a domain.",
	acknowledgments: [],
	build: ({ version, params, secret, publicUrl }) => ({
		services: {
			wordpress: {
				image: "app",
				environment: {
					WORDPRESS_DB_HOST: "db",
					WORDPRESS_DB_NAME: params.database,
					WORDPRESS_DB_USER: params.user,
					WORDPRESS_DB_PASSWORD: { secret: "WORDPRESS_DB_PASSWORD" },
					...Object.fromEntries(SALTS.map((name) => [`WORDPRESS_${name}`, { secret: `WORDPRESS_${name}` }])),
					WORDPRESS_CONFIG_EXTRA: BEHIND_PROXY
				},
				ports: [{
					label: "Website",
					target: 80,
					published: params.port
				}],
				volumes: [{
					volume: "wordpress",
					target: "/var/www/html"
				}],
				healthcheck: curlCheck("http://localhost/wp-includes/images/blank.gif"),
				dependsOn: ["db"]
			},
			db: bundledMysql({
				database: params.database,
				user: params.user,
				passwordSecret: "WORDPRESS_DB_PASSWORD",
				rootSecret: "MYSQL_ROOT_PASSWORD"
			})
		},
		web: {
			service: "wordpress",
			port: 80
		},
		facts: [
			fact("version", "Version", version.label),
			fact("url", "Site", appUrl(publicUrl, params.port)),
			fact("admin", "Dashboard", `${appUrl(publicUrl, params.port)}/wp-admin/`),
			fact("database", "Database", `${params.database} on the bundled MySQL (host db)`),
			fact("db-password", "Database password", secret("WORDPRESS_DB_PASSWORD"), true)
		]
	})
});
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = Symbol.for("yaml.alias");
var DOC = Symbol.for("yaml.document");
var MAP = Symbol.for("yaml.map");
var PAIR = Symbol.for("yaml.pair");
var SCALAR$1 = Symbol.for("yaml.scalar");
var SEQ = Symbol.for("yaml.seq");
var NODE_TYPE = Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR$1;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
	if (node && typeof node === "object") switch (node[NODE_TYPE]) {
		case MAP:
		case SEQ: return true;
	}
	return false;
}
function isNode(node) {
	if (node && typeof node === "object") switch (node[NODE_TYPE]) {
		case ALIAS:
		case MAP:
		case SCALAR$1:
		case SEQ: return true;
	}
	return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/visit.js
var BREAK$1 = Symbol("break visit");
var SKIP$1 = Symbol("skip children");
var REMOVE$1 = Symbol("remove node");
/**
* Apply a visitor to an AST node or document.
*
* Walks through the tree (depth-first) starting from `node`, calling a
* `visitor` function with three arguments:
*   - `key`: For sequence values and map `Pair`, the node's index in the
*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
*     `null` for the root node.
*   - `node`: The current node.
*   - `path`: The ancestry of the current node.
*
* The return value of the visitor may be used to control the traversal:
*   - `undefined` (default): Do nothing and continue
*   - `visit.SKIP`: Do not visit the children of this node, continue with next
*     sibling
*   - `visit.BREAK`: Terminate traversal completely
*   - `visit.REMOVE`: Remove the current node, then continue with the next one
*   - `Node`: Replace the current node, then continue by visiting it
*   - `number`: While iterating the items of a sequence or map, set the index
*     of the next step. This is useful especially if the index of the current
*     node has changed.
*
* If `visitor` is a single function, it will be called with all values
* encountered in the tree, including e.g. `null` values. Alternatively,
* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
* `Alias` and `Scalar` node. To define the same visitor function for more than
* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
* specific defined one will be used for each node.
*/
function visit$1(node, visitor) {
	const visitor_ = initVisitor(visitor);
	if (isDocument(node)) {
		if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
	} else visit_(null, node, visitor_, Object.freeze([]));
}
/** Terminate visit traversal completely */
visit$1.BREAK = BREAK$1;
/** Do not visit the children of the current node */
visit$1.SKIP = SKIP$1;
/** Remove the current node */
visit$1.REMOVE = REMOVE$1;
function visit_(key, node, visitor, path) {
	const ctrl = callVisitor(key, node, visitor, path);
	if (isNode(ctrl) || isPair(ctrl)) {
		replaceNode(key, path, ctrl);
		return visit_(key, ctrl, visitor, path);
	}
	if (typeof ctrl !== "symbol") {
		if (isCollection(node)) {
			path = Object.freeze(path.concat(node));
			for (let i = 0; i < node.items.length; ++i) {
				const ci = visit_(i, node.items[i], visitor, path);
				if (typeof ci === "number") i = ci - 1;
				else if (ci === BREAK$1) return BREAK$1;
				else if (ci === REMOVE$1) {
					node.items.splice(i, 1);
					i -= 1;
				}
			}
		} else if (isPair(node)) {
			path = Object.freeze(path.concat(node));
			const ck = visit_("key", node.key, visitor, path);
			if (ck === BREAK$1) return BREAK$1;
			else if (ck === REMOVE$1) node.key = null;
			const cv = visit_("value", node.value, visitor, path);
			if (cv === BREAK$1) return BREAK$1;
			else if (cv === REMOVE$1) node.value = null;
		}
	}
	return ctrl;
}
/**
* Apply an async visitor to an AST node or document.
*
* Walks through the tree (depth-first) starting from `node`, calling a
* `visitor` function with three arguments:
*   - `key`: For sequence values and map `Pair`, the node's index in the
*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
*     `null` for the root node.
*   - `node`: The current node.
*   - `path`: The ancestry of the current node.
*
* The return value of the visitor may be used to control the traversal:
*   - `Promise`: Must resolve to one of the following values
*   - `undefined` (default): Do nothing and continue
*   - `visit.SKIP`: Do not visit the children of this node, continue with next
*     sibling
*   - `visit.BREAK`: Terminate traversal completely
*   - `visit.REMOVE`: Remove the current node, then continue with the next one
*   - `Node`: Replace the current node, then continue by visiting it
*   - `number`: While iterating the items of a sequence or map, set the index
*     of the next step. This is useful especially if the index of the current
*     node has changed.
*
* If `visitor` is a single function, it will be called with all values
* encountered in the tree, including e.g. `null` values. Alternatively,
* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
* `Alias` and `Scalar` node. To define the same visitor function for more than
* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
* specific defined one will be used for each node.
*/
async function visitAsync(node, visitor) {
	const visitor_ = initVisitor(visitor);
	if (isDocument(node)) {
		if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
	} else await visitAsync_(null, node, visitor_, Object.freeze([]));
}
/** Terminate visit traversal completely */
visitAsync.BREAK = BREAK$1;
/** Do not visit the children of the current node */
visitAsync.SKIP = SKIP$1;
/** Remove the current node */
visitAsync.REMOVE = REMOVE$1;
async function visitAsync_(key, node, visitor, path) {
	const ctrl = await callVisitor(key, node, visitor, path);
	if (isNode(ctrl) || isPair(ctrl)) {
		replaceNode(key, path, ctrl);
		return visitAsync_(key, ctrl, visitor, path);
	}
	if (typeof ctrl !== "symbol") {
		if (isCollection(node)) {
			path = Object.freeze(path.concat(node));
			for (let i = 0; i < node.items.length; ++i) {
				const ci = await visitAsync_(i, node.items[i], visitor, path);
				if (typeof ci === "number") i = ci - 1;
				else if (ci === BREAK$1) return BREAK$1;
				else if (ci === REMOVE$1) {
					node.items.splice(i, 1);
					i -= 1;
				}
			}
		} else if (isPair(node)) {
			path = Object.freeze(path.concat(node));
			const ck = await visitAsync_("key", node.key, visitor, path);
			if (ck === BREAK$1) return BREAK$1;
			else if (ck === REMOVE$1) node.key = null;
			const cv = await visitAsync_("value", node.value, visitor, path);
			if (cv === BREAK$1) return BREAK$1;
			else if (cv === REMOVE$1) node.value = null;
		}
	}
	return ctrl;
}
function initVisitor(visitor) {
	if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
		Alias: visitor.Node,
		Map: visitor.Node,
		Scalar: visitor.Node,
		Seq: visitor.Node
	}, visitor.Value && {
		Map: visitor.Value,
		Scalar: visitor.Value,
		Seq: visitor.Value
	}, visitor.Collection && {
		Map: visitor.Collection,
		Seq: visitor.Collection
	}, visitor);
	return visitor;
}
function callVisitor(key, node, visitor, path) {
	if (typeof visitor === "function") return visitor(key, node, path);
	if (isMap(node)) return visitor.Map?.(key, node, path);
	if (isSeq(node)) return visitor.Seq?.(key, node, path);
	if (isPair(node)) return visitor.Pair?.(key, node, path);
	if (isScalar(node)) return visitor.Scalar?.(key, node, path);
	if (isAlias(node)) return visitor.Alias?.(key, node, path);
}
function replaceNode(key, path, node) {
	const parent = path[path.length - 1];
	if (isCollection(parent)) parent.items[key] = node;
	else if (isPair(parent)) {
		if (key === "key") parent.key = node;
		else parent.value = node;
	} else if (isDocument(parent)) parent.contents = node;
	else {
		const pt = isAlias(parent) ? "alias" : "scalar";
		throw new Error(`Cannot replace node with ${pt} parent`);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
	"!": "%21",
	",": "%2C",
	"[": "%5B",
	"]": "%5D",
	"{": "%7B",
	"}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class Directives {
	constructor(yaml, tags) {
		/**
		* The directives-end/doc-start marker `---`. If `null`, a marker may still be
		* included in the document's stringified representation.
		*/
		this.docStart = null;
		/** The doc-end marker `...`.  */
		this.docEnd = false;
		this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
		this.tags = Object.assign({}, Directives.defaultTags, tags);
	}
	clone() {
		const copy = new Directives(this.yaml, this.tags);
		copy.docStart = this.docStart;
		return copy;
	}
	/**
	* During parsing, get a Directives instance for the current document and
	* update the stream state according to the current version's spec.
	*/
	atDocument() {
		const res = new Directives(this.yaml, this.tags);
		switch (this.yaml.version) {
			case "1.1":
				this.atNextDocument = true;
				break;
			case "1.2":
				this.atNextDocument = false;
				this.yaml = {
					explicit: Directives.defaultYaml.explicit,
					version: "1.2"
				};
				this.tags = Object.assign({}, Directives.defaultTags);
		}
		return res;
	}
	/**
	* @param onError - May be called even if the action was successful
	* @returns `true` on success
	*/
	add(line, onError) {
		if (this.atNextDocument) {
			this.yaml = {
				explicit: Directives.defaultYaml.explicit,
				version: "1.1"
			};
			this.tags = Object.assign({}, Directives.defaultTags);
			this.atNextDocument = false;
		}
		const parts = line.trim().split(/[ \t]+/);
		const name = parts.shift();
		switch (name) {
			case "%TAG": {
				if (parts.length !== 2) {
					onError(0, "%TAG directive should contain exactly two parts");
					if (parts.length < 2) return false;
				}
				const [handle, prefix] = parts;
				this.tags[handle] = prefix;
				return true;
			}
			case "%YAML": {
				this.yaml.explicit = true;
				if (parts.length !== 1) {
					onError(0, "%YAML directive should contain exactly one part");
					return false;
				}
				const [version] = parts;
				if (version === "1.1" || version === "1.2") {
					this.yaml.version = version;
					return true;
				} else {
					const isValid = /^\d+\.\d+$/.test(version);
					onError(6, `Unsupported YAML version ${version}`, isValid);
					return false;
				}
			}
			default:
				onError(0, `Unknown directive ${name}`, true);
				return false;
		}
	}
	/**
	* Resolves a tag, matching handles to those defined in %TAG directives.
	*
	* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
	*   `'!local'` tag, or `null` if unresolvable.
	*/
	tagName(source, onError) {
		if (source === "!") return "!";
		if (source[0] !== "!") {
			onError(`Not a valid tag: ${source}`);
			return null;
		}
		if (source[1] === "<") {
			const verbatim = source.slice(2, -1);
			if (verbatim === "!" || verbatim === "!!") {
				onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
				return null;
			}
			if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
			return verbatim;
		}
		const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
		if (!suffix) onError(`The ${source} tag has no suffix`);
		const prefix = this.tags[handle];
		if (prefix) try {
			return prefix + decodeURIComponent(suffix);
		} catch (error) {
			onError(String(error));
			return null;
		}
		if (handle === "!") return source;
		onError(`Could not resolve tag: ${source}`);
		return null;
	}
	/**
	* Given a fully resolved tag, returns its printable string form,
	* taking into account current tag prefixes and defaults.
	*/
	tagString(tag) {
		for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
		return tag[0] === "!" ? tag : `!<${tag}>`;
	}
	toString(doc) {
		const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
		const tagEntries = Object.entries(this.tags);
		let tagNames;
		if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
			const tags = {};
			visit$1(doc.contents, (_key, node) => {
				if (isNode(node) && node.tag) tags[node.tag] = true;
			});
			tagNames = Object.keys(tags);
		} else tagNames = [];
		for (const [handle, prefix] of tagEntries) {
			if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
			if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
		}
		return lines.join("\n");
	}
};
Directives.defaultYaml = {
	explicit: false,
	version: "1.2"
};
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/anchors.js
/**
* Verify that the input string is a valid anchor.
*
* Will throw on errors.
*/
function anchorIsValid(anchor) {
	if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
		const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
		throw new Error(msg);
	}
	return true;
}
function anchorNames(root) {
	const anchors = /* @__PURE__ */ new Set();
	visit$1(root, { Value(_key, node) {
		if (node.anchor) anchors.add(node.anchor);
	} });
	return anchors;
}
/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
function findNewAnchor(prefix, exclude) {
	for (let i = 1;; ++i) {
		const name = `${prefix}${i}`;
		if (!exclude.has(name)) return name;
	}
}
function createNodeAnchors(doc, prefix) {
	const aliasObjects = [];
	const sourceObjects = /* @__PURE__ */ new Map();
	let prevAnchors = null;
	return {
		onAnchor: (source) => {
			aliasObjects.push(source);
			prevAnchors ?? (prevAnchors = anchorNames(doc));
			const anchor = findNewAnchor(prefix, prevAnchors);
			prevAnchors.add(anchor);
			return anchor;
		},
		/**
		* With circular references, the source node is only resolved after all
		* of its child nodes are. This is why anchors are set only after all of
		* the nodes have been created.
		*/
		setAnchors: () => {
			for (const source of aliasObjects) {
				const ref = sourceObjects.get(source);
				if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) ref.node.anchor = ref.anchor;
				else {
					const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
					error.source = source;
					throw error;
				}
			}
		},
		sourceObjects
	};
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/applyReviver.js
/**
* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
*
* Includes extensions for handling Map and Set objects.
*/
function applyReviver(reviver, obj, key, val) {
	if (val && typeof val === "object") {
		if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
			const v0 = val[i];
			const v1 = applyReviver(reviver, val, String(i), v0);
			if (v1 === void 0) delete val[i];
			else if (v1 !== v0) val[i] = v1;
		}
		else if (val instanceof Map) for (const k of Array.from(val.keys())) {
			const v0 = val.get(k);
			const v1 = applyReviver(reviver, val, k, v0);
			if (v1 === void 0) val.delete(k);
			else if (v1 !== v0) val.set(k, v1);
		}
		else if (val instanceof Set) for (const v0 of Array.from(val)) {
			const v1 = applyReviver(reviver, val, v0, v0);
			if (v1 === void 0) val.delete(v0);
			else if (v1 !== v0) {
				val.delete(v0);
				val.add(v1);
			}
		}
		else for (const [k, v0] of Object.entries(val)) {
			const v1 = applyReviver(reviver, val, k, v0);
			if (v1 === void 0) delete val[k];
			else if (v1 !== v0) val[k] = v1;
		}
	}
	return reviver.call(obj, key, val);
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/toJS.js
/**
* Recursively convert any node or its contents to native JavaScript
*
* @param value - The input value
* @param arg - If `value` defines a `toJSON()` method, use this
*   as its first argument
* @param ctx - Conversion context, originally set in Document#toJS(). If
*   `{ keep: true }` is not set, output should be suitable for JSON
*   stringification.
*/
function toJS(value, arg, ctx) {
	if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
	if (value && typeof value.toJSON === "function") {
		if (!ctx || !hasAnchor(value)) return value.toJSON(arg, ctx);
		const data = {
			aliasCount: 0,
			count: 1,
			res: void 0
		};
		ctx.anchors.set(value, data);
		ctx.onCreate = (res) => {
			data.res = res;
			delete ctx.onCreate;
		};
		const res = value.toJSON(arg, ctx);
		if (ctx.onCreate) ctx.onCreate(res);
		return res;
	}
	if (typeof value === "bigint" && !ctx?.keep) return Number(value);
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
	constructor(type) {
		Object.defineProperty(this, NODE_TYPE, { value: type });
	}
	/** Create a copy of this node.  */
	clone() {
		const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
		if (this.range) copy.range = this.range.slice();
		return copy;
	}
	/** A plain JavaScript representation of this node. */
	toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
		if (!isDocument(doc)) throw new TypeError("A document argument is required");
		const ctx = {
			anchors: /* @__PURE__ */ new Map(),
			doc,
			keep: true,
			mapAsMap: mapAsMap === true,
			mapKeyWarned: false,
			maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
		};
		const res = toJS(this, "", ctx);
		if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
		return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
	constructor(source) {
		super(ALIAS);
		this.source = source;
		Object.defineProperty(this, "tag", { set() {
			throw new Error("Alias nodes cannot have tags");
		} });
	}
	/**
	* Resolve the value of this alias within `doc`, finding the last
	* instance of the `source` anchor before this node.
	*/
	resolve(doc, ctx) {
		if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
		let nodes;
		if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
		else {
			nodes = [];
			visit$1(doc, { Node: (_key, node) => {
				if (isAlias(node) || hasAnchor(node)) nodes.push(node);
			} });
			if (ctx) ctx.aliasResolveCache = nodes;
		}
		let found = void 0;
		for (const node of nodes) {
			if (node === this) break;
			if (node.anchor === this.source) found = node;
		}
		if (found && ctx) {
			const { anchors, doc, maxAliasCount } = ctx;
			let data = anchors.get(found);
			if (!data) {
				toJS(found, null, ctx);
				data = anchors.get(found);
			}
			/* istanbul ignore if */
			if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
			if (maxAliasCount >= 0) {
				data.count += 1;
				if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, found, anchors);
				if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
			}
		}
		return found;
	}
	toJSON(_arg, ctx) {
		if (!ctx) return { source: this.source };
		const source = this.resolve(ctx.doc, ctx);
		if (!source) {
			const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
			throw new ReferenceError(msg);
		}
		return ctx.anchors.get(source).res;
	}
	toString(ctx, _onComment, _onChompKeep) {
		const src = `*${this.source}`;
		if (ctx) {
			anchorIsValid(this.source);
			if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
				const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
				throw new Error(msg);
			}
			if (ctx.implicitKey) return `${src} `;
		}
		return src;
	}
};
function getAliasCount(doc, node, anchors) {
	if (isAlias(node)) {
		const source = node.resolve(doc);
		const anchor = anchors && source && anchors.get(source);
		return anchor ? anchor.count * anchor.aliasCount : 0;
	} else if (isCollection(node)) {
		let count = 0;
		for (const item of node.items) {
			const c = getAliasCount(doc, item, anchors);
			if (c > count) count = c;
		}
		return count;
	} else if (isPair(node)) {
		const kc = getAliasCount(doc, node.key, anchors);
		const vc = getAliasCount(doc, node.value, anchors);
		return Math.max(kc, vc);
	}
	return 1;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
	constructor(value) {
		super(SCALAR$1);
		this.value = value;
	}
	toJSON(arg, ctx) {
		return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
	}
	toString() {
		return String(this.value);
	}
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
	if (tagName) {
		const match = tags.filter((t) => t.tag === tagName);
		const tagObj = match.find((t) => !t.format) ?? match[0];
		if (!tagObj) throw new Error(`Tag ${tagName} not found`);
		return tagObj;
	}
	return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
	if (isDocument(value)) value = value.contents;
	if (isNode(value)) return value;
	if (isPair(value)) {
		const map = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
		map.items.push(value);
		return map;
	}
	if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
	const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
	let ref = void 0;
	if (aliasDuplicateObjects && value && typeof value === "object") {
		ref = sourceObjects.get(value);
		if (ref) {
			ref.anchor ?? (ref.anchor = onAnchor(value));
			return new Alias(ref.anchor);
		} else {
			ref = {
				anchor: null,
				node: null
			};
			sourceObjects.set(value, ref);
		}
	}
	if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
	let tagObj = findTagObject(value, tagName, schema.tags);
	if (!tagObj) {
		if (value && typeof value.toJSON === "function") value = value.toJSON();
		if (!value || typeof value !== "object") {
			const node = new Scalar(value);
			if (ref) ref.node = node;
			return node;
		}
		tagObj = value instanceof Map ? schema[MAP] : Symbol.iterator in Object(value) ? schema[SEQ] : schema[MAP];
	}
	if (onTagObj) {
		onTagObj(tagObj);
		delete ctx.onTagObj;
	}
	const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
	if (tagName) node.tag = tagName;
	else if (!tagObj.default) node.tag = tagObj.tag;
	if (ref) ref.node = node;
	return node;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema, path, value) {
	let v = value;
	for (let i = path.length - 1; i >= 0; --i) {
		const k = path[i];
		if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
			const a = [];
			a[k] = v;
			v = a;
		} else v = /* @__PURE__ */ new Map([[k, v]]);
	}
	return createNode(v, void 0, {
		aliasDuplicateObjects: false,
		keepUndefined: false,
		onAnchor: () => {
			throw new Error("This should not happen, please report a bug.");
		},
		schema,
		sourceObjects: /* @__PURE__ */ new Map()
	});
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
	constructor(type, schema) {
		super(type);
		Object.defineProperty(this, "schema", {
			value: schema,
			configurable: true,
			enumerable: false,
			writable: true
		});
	}
	/**
	* Create a copy of this collection.
	*
	* @param schema - If defined, overwrites the original's schema
	*/
	clone(schema) {
		const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
		if (schema) copy.schema = schema;
		copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema) : it);
		if (this.range) copy.range = this.range.slice();
		return copy;
	}
	/**
	* Adds a value to the collection. For `!!map` and `!!omap` the value must
	* be a Pair instance or a `{ key, value }` object, which may not have a key
	* that already exists in the map.
	*/
	addIn(path, value) {
		if (isEmptyPath(path)) this.add(value);
		else {
			const [key, ...rest] = path;
			const node = this.get(key, true);
			if (isCollection(node)) node.addIn(rest, value);
			else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
	}
	/**
	* Removes a value from the collection.
	* @returns `true` if the item was found and removed.
	*/
	deleteIn(path) {
		const [key, ...rest] = path;
		if (rest.length === 0) return this.delete(key);
		const node = this.get(key, true);
		if (isCollection(node)) return node.deleteIn(rest);
		else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
	}
	/**
	* Returns item at `key`, or `undefined` if not found. By default unwraps
	* scalar values from their surrounding node; to disable set `keepScalar` to
	* `true` (collections are always returned intact).
	*/
	getIn(path, keepScalar) {
		const [key, ...rest] = path;
		const node = this.get(key, true);
		if (rest.length === 0) return !keepScalar && isScalar(node) ? node.value : node;
		else return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
	}
	hasAllNullValues(allowScalar) {
		return this.items.every((node) => {
			if (!isPair(node)) return false;
			const n = node.value;
			return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
		});
	}
	/**
	* Checks if the collection includes a value with the key `key`.
	*/
	hasIn(path) {
		const [key, ...rest] = path;
		if (rest.length === 0) return this.has(key);
		const node = this.get(key, true);
		return isCollection(node) ? node.hasIn(rest) : false;
	}
	/**
	* Sets a value in this collection. For `!!set`, `value` needs to be a
	* boolean to add/remove the item from the set.
	*/
	setIn(path, value) {
		const [key, ...rest] = path;
		if (rest.length === 0) this.set(key, value);
		else {
			const node = this.get(key, true);
			if (isCollection(node)) node.setIn(rest, value);
			else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyComment.js
/**
* Stringifies a comment.
*
* Empty comment lines are left empty,
* lines consisting of a single space are replaced by `#`,
* and all other lines are prefixed with a `#`.
*/
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
	if (/^\n+$/.test(comment)) return comment.substring(1);
	return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
/**
* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
* terminated with `\n` and started with `indent`.
*/
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
	if (!lineWidth || lineWidth < 0) return text;
	if (lineWidth < minContentWidth) minContentWidth = 0;
	const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
	if (text.length <= endStep) return text;
	const folds = [];
	const escapedFolds = {};
	let end = lineWidth - indent.length;
	if (typeof indentAtStart === "number") {
		if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
		else end = lineWidth - indentAtStart;
	}
	let split = void 0;
	let prev = void 0;
	let overflow = false;
	let i = -1;
	let escStart = -1;
	let escEnd = -1;
	if (mode === "block") {
		i = consumeMoreIndentedLines(text, i, indent.length);
		if (i !== -1) end = i + endStep;
	}
	for (let ch; ch = text[i += 1];) {
		if (mode === "quoted" && ch === "\\") {
			escStart = i;
			switch (text[i + 1]) {
				case "x":
					i += 3;
					break;
				case "u":
					i += 5;
					break;
				case "U":
					i += 9;
					break;
				default: i += 1;
			}
			escEnd = i;
		}
		if (ch === "\n") {
			if (mode === "block") i = consumeMoreIndentedLines(text, i, indent.length);
			end = i + indent.length + endStep;
			split = void 0;
		} else {
			if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
				const next = text[i + 1];
				if (next && next !== " " && next !== "\n" && next !== "	") split = i;
			}
			if (i >= end) {
				if (split) {
					folds.push(split);
					end = split + endStep;
					split = void 0;
				} else if (mode === "quoted") {
					while (prev === " " || prev === "	") {
						prev = ch;
						ch = text[i += 1];
						overflow = true;
					}
					const j = i > escEnd + 1 ? i - 2 : escStart - 1;
					if (escapedFolds[j]) return text;
					folds.push(j);
					escapedFolds[j] = true;
					end = j + endStep;
					split = void 0;
				} else overflow = true;
			}
		}
		prev = ch;
	}
	if (overflow && onOverflow) onOverflow();
	if (folds.length === 0) return text;
	if (onFold) onFold();
	let res = text.slice(0, folds[0]);
	for (let i = 0; i < folds.length; ++i) {
		const fold = folds[i];
		const end = folds[i + 1] || text.length;
		if (fold === 0) res = `\n${indent}${text.slice(0, end)}`;
		else {
			if (mode === "quoted" && escapedFolds[fold]) res += `${text[fold]}\\`;
			res += `\n${indent}${text.slice(fold + 1, end)}`;
		}
	}
	return res;
}
/**
* Presumes `i + 1` is at the start of a line
* @returns index of last newline in more-indented block
*/
function consumeMoreIndentedLines(text, i, indent) {
	let end = i;
	let start = i + 1;
	let ch = text[start];
	while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
	else {
		do
			ch = text[++i];
		while (ch && ch !== "\n");
		end = i;
		start = i + 1;
		ch = text[start];
	}
	return end;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock) => ({
	indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
	lineWidth: ctx.options.lineWidth,
	minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
	if (!lineWidth || lineWidth < 0) return false;
	const limit = lineWidth - indentLength;
	const strLen = str.length;
	if (strLen <= limit) return false;
	for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
		if (i - start > limit) return true;
		start = i + 1;
		if (strLen - start <= limit) return false;
	}
	return true;
}
function doubleQuotedString(value, ctx) {
	const json = JSON.stringify(value);
	if (ctx.options.doubleQuotedAsJSON) return json;
	const { implicitKey } = ctx;
	const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
	const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
	let str = "";
	let start = 0;
	for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
		if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
			str += json.slice(start, i) + "\\ ";
			i += 1;
			start = i;
			ch = "\\";
		}
		if (ch === "\\") switch (json[i + 1]) {
			case "u":
				{
					str += json.slice(start, i);
					const code = json.substr(i + 2, 4);
					switch (code) {
						case "0000":
							str += "\\0";
							break;
						case "0007":
							str += "\\a";
							break;
						case "000b":
							str += "\\v";
							break;
						case "001b":
							str += "\\e";
							break;
						case "0085":
							str += "\\N";
							break;
						case "00a0":
							str += "\\_";
							break;
						case "2028":
							str += "\\L";
							break;
						case "2029":
							str += "\\P";
							break;
						default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
						else str += json.substr(i, 6);
					}
					i += 5;
					start = i + 1;
				}
				break;
			case "n":
				if (implicitKey || json[i + 2] === "\"" || json.length < minMultiLineLength) i += 1;
				else {
					str += json.slice(start, i) + "\n\n";
					while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== "\"") {
						str += "\n";
						i += 2;
					}
					str += indent;
					if (json[i + 2] === " ") str += "\\";
					i += 1;
					start = i + 1;
				}
				break;
			default: i += 1;
		}
	}
	str = start ? str + json.slice(start) : json;
	return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
	if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
	const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
	const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
	return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
	const { singleQuote } = ctx.options;
	let qs;
	if (singleQuote === false) qs = doubleQuotedString;
	else {
		const hasDouble = value.includes("\"");
		const hasSingle = value.includes("'");
		if (hasDouble && !hasSingle) qs = singleQuotedString;
		else if (hasSingle && !hasDouble) qs = doubleQuotedString;
		else qs = singleQuote ? singleQuotedString : doubleQuotedString;
	}
	return qs(value, ctx);
}
var blockEndNewlines;
try {
	blockEndNewlines = /* @__PURE__ */ new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
	blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
	const { blockQuote, commentString, lineWidth } = ctx.options;
	if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
	const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
	const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
	if (!value) return literal ? "|\n" : ">\n";
	let chomp;
	let endStart;
	for (endStart = value.length; endStart > 0; --endStart) {
		const ch = value[endStart - 1];
		if (ch !== "\n" && ch !== "	" && ch !== " ") break;
	}
	let end = value.substring(endStart);
	const endNlPos = end.indexOf("\n");
	if (endNlPos === -1) chomp = "-";
	else if (value === end || endNlPos !== end.length - 1) {
		chomp = "+";
		if (onChompKeep) onChompKeep();
	} else chomp = "";
	if (end) {
		value = value.slice(0, -end.length);
		if (end[end.length - 1] === "\n") end = end.slice(0, -1);
		end = end.replace(blockEndNewlines, `$&${indent}`);
	}
	let startWithSpace = false;
	let startEnd;
	let startNlPos = -1;
	for (startEnd = 0; startEnd < value.length; ++startEnd) {
		const ch = value[startEnd];
		if (ch === " ") startWithSpace = true;
		else if (ch === "\n") startNlPos = startEnd;
		else break;
	}
	let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
	if (start) {
		value = value.substring(start.length);
		start = start.replace(/\n+/g, `$&${indent}`);
	}
	let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
	if (comment) {
		header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
		if (onComment) onComment();
	}
	if (!literal) {
		const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
		let literalFallback = false;
		const foldOptions = getFoldOptions(ctx, true);
		if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
			literalFallback = true;
		};
		const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
		if (!literalFallback) return `>${header}\n${indent}${body}`;
	}
	value = value.replace(/\n+/g, `$&${indent}`);
	return `|${header}\n${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
	const { type, value } = item;
	const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
	if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
	if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
	if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
	if (containsDocumentMarker(value)) {
		if (indent === "") {
			ctx.forceBlockIndent = true;
			return blockString(item, ctx, onComment, onChompKeep);
		} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
	}
	const str = value.replace(/\n+/g, `$&\n${indent}`);
	if (actualString) {
		const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
		const { compat, tags } = ctx.doc.schema;
		if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
	}
	return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
	const { implicitKey, inFlow } = ctx;
	const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
	let { type } = item;
	if (type !== Scalar.QUOTE_DOUBLE) {
		if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar.QUOTE_DOUBLE;
	}
	const _stringify = (_type) => {
		switch (_type) {
			case Scalar.BLOCK_FOLDED:
			case Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
			case Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
			case Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
			case Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
			default: return null;
		}
	};
	let res = _stringify(type);
	if (res === null) {
		const { defaultKeyType, defaultStringType } = ctx.options;
		const t = implicitKey && defaultKeyType || defaultStringType;
		res = _stringify(t);
		if (res === null) throw new Error(`Unsupported default string type ${t}`);
	}
	return res;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
	const opt = Object.assign({
		blockQuote: true,
		commentString: stringifyComment,
		defaultKeyType: null,
		defaultStringType: "PLAIN",
		directives: null,
		doubleQuotedAsJSON: false,
		doubleQuotedMinMultiLineLength: 40,
		falseStr: "false",
		flowCollectionPadding: true,
		indentSeq: true,
		lineWidth: 80,
		minContentWidth: 20,
		nullStr: "null",
		simpleKeys: false,
		singleQuote: null,
		trailingComma: false,
		trueStr: "true",
		verifyAliasOrder: true
	}, doc.schema.toStringOptions, options);
	let inFlow;
	switch (opt.collectionStyle) {
		case "block":
			inFlow = false;
			break;
		case "flow":
			inFlow = true;
			break;
		default: inFlow = null;
	}
	return {
		anchors: /* @__PURE__ */ new Set(),
		doc,
		flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
		indent: "",
		indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
		inFlow,
		options: opt
	};
}
function getTagObject(tags, item) {
	if (item.tag) {
		const match = tags.filter((t) => t.tag === item.tag);
		if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
	}
	let tagObj = void 0;
	let obj;
	if (isScalar(item)) {
		obj = item.value;
		let match = tags.filter((t) => t.identify?.(obj));
		if (match.length > 1) {
			const testMatch = match.filter((t) => t.test);
			if (testMatch.length > 0) match = testMatch;
		}
		tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
	} else {
		obj = item;
		tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
	}
	if (!tagObj) {
		const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
		throw new Error(`Tag not resolved for ${name} value`);
	}
	return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
	if (!doc.directives) return "";
	const props = [];
	const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
	if (anchor && anchorIsValid(anchor)) {
		anchors.add(anchor);
		props.push(`&${anchor}`);
	}
	const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
	if (tag) props.push(doc.directives.tagString(tag));
	return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
	if (isPair(item)) return item.toString(ctx, onComment, onChompKeep);
	if (isAlias(item)) {
		if (ctx.doc.directives) return item.toString(ctx);
		if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
		else {
			if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
			else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
			item = item.resolve(ctx.doc);
		}
	}
	let tagObj = void 0;
	const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
	tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
	const props = stringifyProps(node, tagObj, ctx);
	if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
	const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
	if (!props) return str;
	return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
	const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
	let keyComment = isNode(key) && key.comment || null;
	if (simpleKeys) {
		if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
		if (isCollection(key) || !isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
	}
	let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
	ctx = Object.assign({}, ctx, {
		allNullValues: false,
		implicitKey: !explicitKey && (simpleKeys || !allNullValues),
		indent: indent + indentStep
	});
	let keyCommentDone = false;
	let chompKeep = false;
	let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
	if (!explicitKey && !ctx.inFlow && str.length > 1024) {
		if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
		explicitKey = true;
	}
	if (ctx.inFlow) {
		if (allNullValues || value == null) {
			if (keyCommentDone && onComment) onComment();
			return str === "" ? "?" : explicitKey ? `? ${str}` : str;
		}
	} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
		str = `? ${str}`;
		if (keyComment && !keyCommentDone) str += lineComment(str, ctx.indent, commentString(keyComment));
		else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	if (keyCommentDone) keyComment = null;
	if (explicitKey) {
		if (keyComment) str += lineComment(str, ctx.indent, commentString(keyComment));
		str = `? ${str}\n${indent}:`;
	} else {
		str = `${str}:`;
		if (keyComment) str += lineComment(str, ctx.indent, commentString(keyComment));
	}
	let vsb, vcb, valueComment;
	if (isNode(value)) {
		vsb = !!value.spaceBefore;
		vcb = value.commentBefore;
		valueComment = value.comment;
	} else {
		vsb = false;
		vcb = null;
		valueComment = null;
		if (value && typeof value === "object") value = doc.createNode(value);
	}
	ctx.implicitKey = false;
	if (!explicitKey && !keyComment && isScalar(value)) ctx.indentAtStart = str.length + 1;
	chompKeep = false;
	if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
	let valueCommentDone = false;
	const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
	let ws = " ";
	if (keyComment || vsb || vcb) {
		ws = vsb ? "\n" : "";
		if (vcb) {
			const cs = commentString(vcb);
			ws += `\n${indentComment(cs, ctx.indent)}`;
		}
		if (valueStr === "" && !ctx.inFlow) {
			if (ws === "\n" && valueComment) ws = "\n\n";
		} else ws += `\n${ctx.indent}`;
	} else if (!explicitKey && isCollection(value)) {
		const vs0 = valueStr[0];
		const nl0 = valueStr.indexOf("\n");
		const hasNewline = nl0 !== -1;
		const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
		if (hasNewline || !flow) {
			let hasPropsLine = false;
			if (hasNewline && (vs0 === "&" || vs0 === "!")) {
				let sp0 = valueStr.indexOf(" ");
				if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
				if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
			}
			if (!hasPropsLine) ws = `\n${ctx.indent}`;
		}
	} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
	str += ws + valueStr;
	if (ctx.inFlow) {
		if (valueCommentDone && onComment) onComment();
	} else if (valueComment && !valueCommentDone) str += lineComment(str, ctx.indent, commentString(valueComment));
	else if (chompKeep && onChompKeep) onChompKeep();
	return str;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
	if (logLevel === "debug" || logLevel === "warn") console.warn(warning);
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
	identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
	default: "key",
	tag: "tag:yaml.org,2002:merge",
	test: /^<<$/,
	resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
	stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map, value) {
	const source = resolveAliasValue(ctx, value);
	if (isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
	else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
	else mergeValue(ctx, map, source);
}
function mergeValue(ctx, map, value) {
	const source = resolveAliasValue(ctx, value);
	if (!isMap(source)) throw new Error("Merge sources must be maps or map aliases");
	const srcMap = source.toJSON(null, ctx, Map);
	for (const [key, value] of srcMap) if (map instanceof Map) {
		if (!map.has(key)) map.set(key, value);
	} else if (map instanceof Set) map.add(key);
	else if (!Object.prototype.hasOwnProperty.call(map, key)) Object.defineProperty(map, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
	return map;
}
function resolveAliasValue(ctx, value) {
	return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map, { key, value }) {
	if (isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
	else if (isMergeKey(ctx, key)) addMergeToJSMap(ctx, map, value);
	else {
		const jsKey = toJS(key, "", ctx);
		if (map instanceof Map) map.set(jsKey, toJS(value, jsKey, ctx));
		else if (map instanceof Set) map.add(jsKey);
		else {
			const stringKey = stringifyKey(key, jsKey, ctx);
			const jsValue = toJS(value, stringKey, ctx);
			if (stringKey in map) Object.defineProperty(map, stringKey, {
				value: jsValue,
				writable: true,
				enumerable: true,
				configurable: true
			});
			else map[stringKey] = jsValue;
		}
	}
	return map;
}
function stringifyKey(key, jsKey, ctx) {
	if (jsKey === null) return "";
	if (typeof jsKey !== "object") return String(jsKey);
	if (isNode(key) && ctx?.doc) {
		const strCtx = createStringifyContext(ctx.doc, {});
		strCtx.anchors = /* @__PURE__ */ new Set();
		for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
		strCtx.inFlow = true;
		strCtx.inStringifyKey = true;
		const strKey = key.toString(strCtx);
		if (!ctx.mapKeyWarned) {
			let jsonStr = JSON.stringify(strKey);
			if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
			warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
			ctx.mapKeyWarned = true;
		}
		return strKey;
	}
	return JSON.stringify(jsKey);
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key, value, ctx) {
	return new Pair(createNode(key, void 0, ctx), createNode(value, void 0, ctx));
}
var Pair = class Pair {
	constructor(key, value = null) {
		Object.defineProperty(this, NODE_TYPE, { value: PAIR });
		this.key = key;
		this.value = value;
	}
	clone(schema) {
		let { key, value } = this;
		if (isNode(key)) key = key.clone(schema);
		if (isNode(value)) value = value.clone(schema);
		return new Pair(key, value);
	}
	toJSON(_, ctx) {
		return addPairToJSMap(ctx, ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {}, this);
	}
	toString(ctx, onComment, onChompKeep) {
		return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
	return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
	const { indent, options: { commentString } } = ctx;
	const itemCtx = Object.assign({}, ctx, {
		indent: itemIndent,
		type: null
	});
	let chompKeep = false;
	const lines = [];
	for (let i = 0; i < items.length; ++i) {
		const item = items[i];
		let comment = null;
		if (isNode(item)) {
			if (!chompKeep && item.spaceBefore) lines.push("");
			addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
			if (item.comment) comment = item.comment;
		} else if (isPair(item)) {
			const ik = isNode(item.key) ? item.key : null;
			if (ik) {
				if (!chompKeep && ik.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
			}
		}
		chompKeep = false;
		let str = stringify(item, itemCtx, () => comment = null, () => chompKeep = true);
		if (comment) str += lineComment(str, itemIndent, commentString(comment));
		if (chompKeep && comment) chompKeep = false;
		lines.push(blockItemPrefix + str);
	}
	let str;
	if (lines.length === 0) str = flowChars.start + flowChars.end;
	else {
		str = lines[0];
		for (let i = 1; i < lines.length; ++i) {
			const line = lines[i];
			str += line ? `\n${indent}${line}` : "\n";
		}
	}
	if (comment) {
		str += "\n" + indentComment(commentString(comment), indent);
		if (onComment) onComment();
	} else if (chompKeep && onChompKeep) onChompKeep();
	return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
	const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
	itemIndent += indentStep;
	const itemCtx = Object.assign({}, ctx, {
		indent: itemIndent,
		inFlow: true,
		type: null
	});
	let reqNewline = false;
	let linesAtValue = 0;
	const lines = [];
	for (let i = 0; i < items.length; ++i) {
		const item = items[i];
		let comment = null;
		if (isNode(item)) {
			if (item.spaceBefore) lines.push("");
			addCommentBefore(ctx, lines, item.commentBefore, false);
			if (item.comment) comment = item.comment;
		} else if (isPair(item)) {
			const ik = isNode(item.key) ? item.key : null;
			if (ik) {
				if (ik.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, ik.commentBefore, false);
				if (ik.comment) reqNewline = true;
			}
			const iv = isNode(item.value) ? item.value : null;
			if (iv) {
				if (iv.comment) comment = iv.comment;
				if (iv.commentBefore) reqNewline = true;
			} else if (item.value == null && ik?.comment) comment = ik.comment;
		}
		if (comment) reqNewline = true;
		let str = stringify(item, itemCtx, () => comment = null);
		reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
		if (i < items.length - 1) str += ",";
		else if (ctx.options.trailingComma) {
			if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
			if (reqNewline) str += ",";
		}
		if (comment) str += lineComment(str, itemIndent, commentString(comment));
		lines.push(str);
		linesAtValue = lines.length;
	}
	const { start, end } = flowChars;
	if (lines.length === 0) return start + end;
	else {
		if (!reqNewline) {
			const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
			reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
		}
		if (reqNewline) {
			let str = start;
			for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
			return `${str}\n${indent}${end}`;
		} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
	}
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
	if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
	if (comment) {
		const ic = indentComment(commentString(comment), indent);
		lines.push(ic.trimStart());
	}
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key) {
	const k = isScalar(key) ? key.value : key;
	for (const it of items) if (isPair(it)) {
		if (it.key === key || it.key === k) return it;
		if (isScalar(it.key) && it.key.value === k) return it;
	}
}
var YAMLMap = class extends Collection {
	static get tagName() {
		return "tag:yaml.org,2002:map";
	}
	constructor(schema) {
		super(MAP, schema);
		this.items = [];
	}
	/**
	* A generic collection parsing method that can be extended
	* to other node classes that inherit from YAMLMap
	*/
	static from(schema, obj, ctx) {
		const { keepUndefined, replacer } = ctx;
		const map = new this(schema);
		const add = (key, value) => {
			if (typeof replacer === "function") value = replacer.call(obj, key, value);
			else if (Array.isArray(replacer) && !replacer.includes(key)) return;
			if (value !== void 0 || keepUndefined) map.items.push(createPair(key, value, ctx));
		};
		if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
		else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
		if (typeof schema.sortMapEntries === "function") map.items.sort(schema.sortMapEntries);
		return map;
	}
	/**
	* Adds a value to the collection.
	*
	* @param overwrite - If not set `true`, using a key that is already in the
	*   collection will throw. Otherwise, overwrites the previous value.
	*/
	add(pair, overwrite) {
		let _pair;
		if (isPair(pair)) _pair = pair;
		else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair(pair, pair?.value);
		else _pair = new Pair(pair.key, pair.value);
		const prev = findPair(this.items, _pair.key);
		const sortEntries = this.schema?.sortMapEntries;
		if (prev) {
			if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
			if (isScalar(prev.value) && isScalarValue(_pair.value)) prev.value.value = _pair.value;
			else prev.value = _pair.value;
		} else if (sortEntries) {
			const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
			if (i === -1) this.items.push(_pair);
			else this.items.splice(i, 0, _pair);
		} else this.items.push(_pair);
	}
	delete(key) {
		const it = findPair(this.items, key);
		if (!it) return false;
		return this.items.splice(this.items.indexOf(it), 1).length > 0;
	}
	get(key, keepScalar) {
		const node = findPair(this.items, key)?.value;
		return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
	}
	has(key) {
		return !!findPair(this.items, key);
	}
	set(key, value) {
		this.add(new Pair(key, value), true);
	}
	/**
	* @param ctx - Conversion context, originally set in Document#toJS()
	* @param {Class} Type - If set, forces the returned collection type
	* @returns Instance of Type, Map, or Object
	*/
	toJSON(_, ctx, Type) {
		const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
		if (ctx?.onCreate) ctx.onCreate(map);
		for (const item of this.items) addPairToJSMap(ctx, map, item);
		return map;
	}
	toString(ctx, onComment, onChompKeep) {
		if (!ctx) return JSON.stringify(this);
		for (const item of this.items) if (!isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
		if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
		return stringifyCollection(this, ctx, {
			blockItemPrefix: "",
			flowChars: {
				start: "{",
				end: "}"
			},
			itemIndent: ctx.indent || "",
			onChompKeep,
			onComment
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/map.js
var map = {
	collection: "map",
	default: true,
	nodeClass: YAMLMap,
	tag: "tag:yaml.org,2002:map",
	resolve(map, onError) {
		if (!isMap(map)) onError("Expected a mapping for this tag");
		return map;
	},
	createNode: (schema, obj, ctx) => YAMLMap.from(schema, obj, ctx)
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
	static get tagName() {
		return "tag:yaml.org,2002:seq";
	}
	constructor(schema) {
		super(SEQ, schema);
		this.items = [];
	}
	add(value) {
		this.items.push(value);
	}
	/**
	* Removes a value from the collection.
	*
	* `key` must contain a representation of an integer for this to succeed.
	* It may be wrapped in a `Scalar`.
	*
	* @returns `true` if the item was found and removed.
	*/
	delete(key) {
		const idx = asItemIndex(key);
		if (typeof idx !== "number") return false;
		return this.items.splice(idx, 1).length > 0;
	}
	get(key, keepScalar) {
		const idx = asItemIndex(key);
		if (typeof idx !== "number") return void 0;
		const it = this.items[idx];
		return !keepScalar && isScalar(it) ? it.value : it;
	}
	/**
	* Checks if the collection includes a value with the key `key`.
	*
	* `key` must contain a representation of an integer for this to succeed.
	* It may be wrapped in a `Scalar`.
	*/
	has(key) {
		const idx = asItemIndex(key);
		return typeof idx === "number" && idx < this.items.length;
	}
	/**
	* Sets a value in this collection. For `!!set`, `value` needs to be a
	* boolean to add/remove the item from the set.
	*
	* If `key` does not contain a representation of an integer, this will throw.
	* It may be wrapped in a `Scalar`.
	*/
	set(key, value) {
		const idx = asItemIndex(key);
		if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
		const prev = this.items[idx];
		if (isScalar(prev) && isScalarValue(value)) prev.value = value;
		else this.items[idx] = value;
	}
	toJSON(_, ctx) {
		const seq = [];
		if (ctx?.onCreate) ctx.onCreate(seq);
		let i = 0;
		for (const item of this.items) seq.push(toJS(item, String(i++), ctx));
		return seq;
	}
	toString(ctx, onComment, onChompKeep) {
		if (!ctx) return JSON.stringify(this);
		return stringifyCollection(this, ctx, {
			blockItemPrefix: "- ",
			flowChars: {
				start: "[",
				end: "]"
			},
			itemIndent: (ctx.indent || "") + "  ",
			onChompKeep,
			onComment
		});
	}
	static from(schema, obj, ctx) {
		const { replacer } = ctx;
		const seq = new this(schema);
		if (obj && Symbol.iterator in Object(obj)) {
			let i = 0;
			for (let it of obj) {
				if (typeof replacer === "function") {
					const key = obj instanceof Set ? it : String(i++);
					it = replacer.call(obj, key, it);
				}
				seq.items.push(createNode(it, void 0, ctx));
			}
		}
		return seq;
	}
};
function asItemIndex(key) {
	let idx = isScalar(key) ? key.value : key;
	if (idx && typeof idx === "string") idx = Number(idx);
	return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
	collection: "seq",
	default: true,
	nodeClass: YAMLSeq,
	tag: "tag:yaml.org,2002:seq",
	resolve(seq, onError) {
		if (!isSeq(seq)) onError("Expected a sequence for this tag");
		return seq;
	},
	createNode: (schema, obj, ctx) => YAMLSeq.from(schema, obj, ctx)
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/string.js
var string = {
	identify: (value) => typeof value === "string",
	default: true,
	tag: "tag:yaml.org,2002:str",
	resolve: (str) => str,
	stringify(item, ctx, onComment, onChompKeep) {
		ctx = Object.assign({ actualString: true }, ctx);
		return stringifyString(item, ctx, onComment, onChompKeep);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
	identify: (value) => value == null,
	createNode: () => new Scalar(null),
	default: true,
	tag: "tag:yaml.org,2002:null",
	test: /^(?:~|[Nn]ull|NULL)?$/,
	resolve: () => new Scalar(null),
	stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
	identify: (value) => typeof value === "boolean",
	default: true,
	tag: "tag:yaml.org,2002:bool",
	test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
	resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
	stringify({ source, value }, ctx) {
		if (source && boolTag.test.test(source)) {
			if (value === (source[0] === "t" || source[0] === "T")) return source;
		}
		return value ? ctx.options.trueStr : ctx.options.falseStr;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format, minFractionDigits, tag, value }) {
	if (typeof value === "bigint") return String(value);
	const num = typeof value === "number" ? value : Number(value);
	if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
	let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
	if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
		let i = n.indexOf(".");
		if (i < 0) {
			i = n.length;
			n += ".";
		}
		let d = minFractionDigits - (n.length - i - 1);
		while (d-- > 0) n += "0";
	}
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN$1 = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
	resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
	stringify: stringifyNumber
};
var floatExp$1 = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	format: "EXP",
	test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
	resolve: (str) => parseFloat(str),
	stringify(node) {
		const num = Number(node.value);
		return isFinite(num) ? num.toExponential() : stringifyNumber(node);
	}
};
var float$1 = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
	resolve(str) {
		const node = new Scalar(parseFloat(str));
		const dot = str.indexOf(".");
		if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
		return node;
	},
	stringify: stringifyNumber
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify$2 = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve$1 = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify$1(node, radix, prefix) {
	const { value } = node;
	if (intIdentify$2(value) && value >= 0) return prefix + value.toString(radix);
	return stringifyNumber(node);
}
var intOct$1 = {
	identify: (value) => intIdentify$2(value) && value >= 0,
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "OCT",
	test: /^0o[0-7]+$/,
	resolve: (str, _onError, opt) => intResolve$1(str, 2, 8, opt),
	stringify: (node) => intStringify$1(node, 8, "0o")
};
var int$1 = {
	identify: intIdentify$2,
	default: true,
	tag: "tag:yaml.org,2002:int",
	test: /^[-+]?[0-9]+$/,
	resolve: (str, _onError, opt) => intResolve$1(str, 0, 10, opt),
	stringify: stringifyNumber
};
var intHex$1 = {
	identify: (value) => intIdentify$2(value) && value >= 0,
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "HEX",
	test: /^0x[0-9a-fA-F]+$/,
	resolve: (str, _onError, opt) => intResolve$1(str, 2, 16, opt),
	stringify: (node) => intStringify$1(node, 16, "0x")
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/schema.js
var schema$2 = [
	map,
	seq,
	string,
	nullTag,
	boolTag,
	intOct$1,
	int$1,
	intHex$1,
	floatNaN$1,
	floatExp$1,
	float$1
];
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify$1(value) {
	return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
	{
		identify: (value) => typeof value === "string",
		default: true,
		tag: "tag:yaml.org,2002:str",
		resolve: (str) => str,
		stringify: stringifyJSON
	},
	{
		identify: (value) => value == null,
		createNode: () => new Scalar(null),
		default: true,
		tag: "tag:yaml.org,2002:null",
		test: /^null$/,
		resolve: () => null,
		stringify: stringifyJSON
	},
	{
		identify: (value) => typeof value === "boolean",
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^true$|^false$/,
		resolve: (str) => str === "true",
		stringify: stringifyJSON
	},
	{
		identify: intIdentify$1,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^-?(?:0|[1-9][0-9]*)$/,
		resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
		stringify: ({ value }) => intIdentify$1(value) ? value.toString() : JSON.stringify(value)
	},
	{
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
		resolve: (str) => parseFloat(str),
		stringify: stringifyJSON
	}
];
var schema$1 = [map, seq].concat(jsonScalars, {
	default: true,
	tag: "",
	test: /^/,
	resolve(str, onError) {
		onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
		return str;
	}
});
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
	identify: (value) => value instanceof Uint8Array,
	default: false,
	tag: "tag:yaml.org,2002:binary",
	/**
	* Returns a Buffer in node and an Uint8Array in browsers
	*
	* To use the resulting buffer as an image, you'll want to do something like:
	*
	*   const blob = new Blob([buffer], { type: 'image/jpeg' })
	*   document.querySelector('#photo').src = URL.createObjectURL(blob)
	*/
	resolve(src, onError) {
		if (typeof atob === "function") {
			const str = atob(src.replace(/[\n\r]/g, ""));
			const buffer = new Uint8Array(str.length);
			for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
			return buffer;
		} else {
			onError("This environment does not support reading binary tags; either Buffer or atob is required");
			return src;
		}
	},
	stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
		if (!value) return "";
		const buf = value;
		let str;
		if (typeof btoa === "function") {
			let s = "";
			for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
			str = btoa(s);
		} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
		type ?? (type = Scalar.BLOCK_LITERAL);
		if (type !== Scalar.QUOTE_DOUBLE) {
			const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
			const n = Math.ceil(str.length / lineWidth);
			const lines = new Array(n);
			for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
			str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
		}
		return stringifyString({
			comment,
			type,
			value: str
		}, ctx, onComment, onChompKeep);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq, onError) {
	if (isSeq(seq)) for (let i = 0; i < seq.items.length; ++i) {
		let item = seq.items[i];
		if (isPair(item)) continue;
		else if (isMap(item)) {
			if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
			const pair = item.items[0] || new Pair(new Scalar(null));
			if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
			if (item.comment) {
				const cn = pair.value ?? pair.key;
				cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
			}
			item = pair;
		}
		seq.items[i] = isPair(item) ? item : new Pair(item);
	}
	else onError("Expected a sequence for this tag");
	return seq;
}
function createPairs(schema, iterable, ctx) {
	const { replacer } = ctx;
	const pairs = new YAMLSeq(schema);
	pairs.tag = "tag:yaml.org,2002:pairs";
	let i = 0;
	if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
		if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
		let key, value;
		if (Array.isArray(it)) {
			if (it.length === 2) {
				key = it[0];
				value = it[1];
			} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
		} else if (it && it instanceof Object) {
			const keys = Object.keys(it);
			if (keys.length === 1) {
				key = keys[0];
				value = it[key];
			} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
		} else key = it;
		pairs.items.push(createPair(key, value, ctx));
	}
	return pairs;
}
var pairs = {
	collection: "seq",
	default: false,
	tag: "tag:yaml.org,2002:pairs",
	resolve: resolvePairs,
	createNode: createPairs
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class YAMLOMap extends YAMLSeq {
	constructor() {
		super();
		this.add = YAMLMap.prototype.add.bind(this);
		this.delete = YAMLMap.prototype.delete.bind(this);
		this.get = YAMLMap.prototype.get.bind(this);
		this.has = YAMLMap.prototype.has.bind(this);
		this.set = YAMLMap.prototype.set.bind(this);
		this.tag = YAMLOMap.tag;
	}
	/**
	* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
	* but TypeScript won't allow widening the signature of a child method.
	*/
	toJSON(_, ctx) {
		if (!ctx) return super.toJSON(_);
		const map = /* @__PURE__ */ new Map();
		if (ctx?.onCreate) ctx.onCreate(map);
		for (const pair of this.items) {
			let key, value;
			if (isPair(pair)) {
				key = toJS(pair.key, "", ctx);
				value = toJS(pair.value, key, ctx);
			} else key = toJS(pair, "", ctx);
			if (map.has(key)) throw new Error("Ordered maps must not include duplicate keys");
			map.set(key, value);
		}
		return map;
	}
	static from(schema, iterable, ctx) {
		const pairs = createPairs(schema, iterable, ctx);
		const omap = new this();
		omap.items = pairs.items;
		return omap;
	}
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
	collection: "seq",
	identify: (value) => value instanceof Map,
	nodeClass: YAMLOMap,
	default: false,
	tag: "tag:yaml.org,2002:omap",
	resolve(seq, onError) {
		const pairs = resolvePairs(seq, onError);
		const seenKeys = [];
		for (const { key } of pairs.items) if (isScalar(key)) {
			if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
			else seenKeys.push(key.value);
		}
		return Object.assign(new YAMLOMap(), pairs);
	},
	createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
	if (source && (value ? trueTag : falseTag).test.test(source)) return source;
	return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
	identify: (value) => value === true,
	default: true,
	tag: "tag:yaml.org,2002:bool",
	test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
	resolve: () => new Scalar(true),
	stringify: boolStringify
};
var falseTag = {
	identify: (value) => value === false,
	default: true,
	tag: "tag:yaml.org,2002:bool",
	test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
	resolve: () => new Scalar(false),
	stringify: boolStringify
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
	resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
	stringify: stringifyNumber
};
var floatExp = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	format: "EXP",
	test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
	resolve: (str) => parseFloat(str.replace(/_/g, "")),
	stringify(node) {
		const num = Number(node.value);
		return isFinite(num) ? num.toExponential() : stringifyNumber(node);
	}
};
var float = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
	resolve(str) {
		const node = new Scalar(parseFloat(str.replace(/_/g, "")));
		const dot = str.indexOf(".");
		if (dot !== -1) {
			const f = str.substring(dot + 1).replace(/_/g, "");
			if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
		}
		return node;
	},
	stringify: stringifyNumber
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve(str, offset, radix, { intAsBigInt }) {
	const sign = str[0];
	if (sign === "-" || sign === "+") offset += 1;
	str = str.substring(offset).replace(/_/g, "");
	if (intAsBigInt) {
		switch (radix) {
			case 2:
				str = `0b${str}`;
				break;
			case 8:
				str = `0o${str}`;
				break;
			case 16: str = `0x${str}`;
		}
		const n = BigInt(str);
		return sign === "-" ? BigInt(-1) * n : n;
	}
	const n = parseInt(str, radix);
	return sign === "-" ? -1 * n : n;
}
function intStringify(node, radix, prefix) {
	const { value } = node;
	if (intIdentify(value)) {
		const str = value.toString(radix);
		return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
	}
	return stringifyNumber(node);
}
var intBin = {
	identify: intIdentify,
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "BIN",
	test: /^[-+]?0b[0-1_]+$/,
	resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
	stringify: (node) => intStringify(node, 2, "0b")
};
var intOct = {
	identify: intIdentify,
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "OCT",
	test: /^[-+]?0[0-7_]+$/,
	resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
	stringify: (node) => intStringify(node, 8, "0")
};
var int = {
	identify: intIdentify,
	default: true,
	tag: "tag:yaml.org,2002:int",
	test: /^[-+]?[0-9][0-9_]*$/,
	resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
	stringify: stringifyNumber
};
var intHex = {
	identify: intIdentify,
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "HEX",
	test: /^[-+]?0x[0-9a-fA-F_]+$/,
	resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
	stringify: (node) => intStringify(node, 16, "0x")
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class YAMLSet extends YAMLMap {
	constructor(schema) {
		super(schema);
		this.tag = YAMLSet.tag;
	}
	add(key) {
		let pair;
		if (isPair(key)) pair = key;
		else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair(key.key, null);
		else pair = new Pair(key, null);
		if (!findPair(this.items, pair.key)) this.items.push(pair);
	}
	/**
	* If `keepPair` is `true`, returns the Pair matching `key`.
	* Otherwise, returns the value of that Pair's key.
	*/
	get(key, keepPair) {
		const pair = findPair(this.items, key);
		return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
	}
	set(key, value) {
		if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
		const prev = findPair(this.items, key);
		if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
		else if (!prev && value) this.items.push(new Pair(key));
	}
	toJSON(_, ctx) {
		return super.toJSON(_, ctx, Set);
	}
	toString(ctx, onComment, onChompKeep) {
		if (!ctx) return JSON.stringify(this);
		if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
		else throw new Error("Set items must all have null values");
	}
	static from(schema, iterable, ctx) {
		const { replacer } = ctx;
		const set = new this(schema);
		if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
			if (typeof replacer === "function") value = replacer.call(iterable, value, value);
			set.items.push(createPair(value, null, ctx));
		}
		return set;
	}
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
	collection: "map",
	identify: (value) => value instanceof Set,
	nodeClass: YAMLSet,
	default: false,
	tag: "tag:yaml.org,2002:set",
	createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
	resolve(map, onError) {
		if (isMap(map)) {
			if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
			else onError("Set items must all have null values");
		} else onError("Expected a mapping for this tag");
		return map;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
/** Internal types handle bigint as number, because TS can't figure it out. */
function parseSexagesimal(str, asBigInt) {
	const sign = str[0];
	const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
	const num = (n) => asBigInt ? BigInt(n) : Number(n);
	const res = parts.replace(/_/g, "").split(":").reduce((res, p) => res * num(60) + num(p), num(0));
	return sign === "-" ? num(-1) * res : res;
}
/**
* hhhh:mm:ss.sss
*
* Internal types handle bigint as number, because TS can't figure it out.
*/
function stringifySexagesimal(node) {
	let { value } = node;
	let num = (n) => n;
	if (typeof value === "bigint") num = (n) => BigInt(n);
	else if (isNaN(value) || !isFinite(value)) return stringifyNumber(node);
	let sign = "";
	if (value < 0) {
		sign = "-";
		value *= num(-1);
	}
	const _60 = num(60);
	const parts = [value % _60];
	if (value < 60) parts.unshift(0);
	else {
		value = (value - parts[0]) / _60;
		parts.unshift(value % _60);
		if (value >= 60) {
			value = (value - parts[0]) / _60;
			parts.unshift(value);
		}
	}
	return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
	identify: (value) => typeof value === "bigint" || Number.isInteger(value),
	default: true,
	tag: "tag:yaml.org,2002:int",
	format: "TIME",
	test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
	resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
	stringify: stringifySexagesimal
};
var floatTime = {
	identify: (value) => typeof value === "number",
	default: true,
	tag: "tag:yaml.org,2002:float",
	format: "TIME",
	test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
	resolve: (str) => parseSexagesimal(str, false),
	stringify: stringifySexagesimal
};
var timestamp$1 = {
	identify: (value) => value instanceof Date,
	default: true,
	tag: "tag:yaml.org,2002:timestamp",
	test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
	resolve(str) {
		const match = str.match(timestamp$1.test);
		if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
		const [, year, month, day, hour, minute, second] = match.map(Number);
		const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
		let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
		const tz = match[8];
		if (tz && tz !== "Z") {
			let d = parseSexagesimal(tz, false);
			if (Math.abs(d) < 30) d *= 60;
			date -= 6e4 * d;
		}
		return new Date(date);
	},
	stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema = [
	map,
	seq,
	string,
	nullTag,
	trueTag,
	falseTag,
	intBin,
	intOct,
	int,
	intHex,
	floatNaN,
	floatExp,
	float,
	binary,
	merge,
	omap,
	pairs,
	set,
	intTime,
	floatTime,
	timestamp$1
];
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
	["core", schema$2],
	["failsafe", [
		map,
		seq,
		string
	]],
	["json", schema$1],
	["yaml11", schema],
	["yaml-1.1", schema]
]);
var tagsByName = {
	binary,
	bool: boolTag,
	float: float$1,
	floatExp: floatExp$1,
	floatNaN: floatNaN$1,
	floatTime,
	int: int$1,
	intHex: intHex$1,
	intOct: intOct$1,
	intTime,
	map,
	merge,
	null: nullTag,
	omap,
	pairs,
	seq,
	set,
	timestamp: timestamp$1
};
var coreKnownTags = {
	"tag:yaml.org,2002:binary": binary,
	"tag:yaml.org,2002:merge": merge,
	"tag:yaml.org,2002:omap": omap,
	"tag:yaml.org,2002:pairs": pairs,
	"tag:yaml.org,2002:set": set,
	"tag:yaml.org,2002:timestamp": timestamp$1
};
function getTags(customTags, schemaName, addMergeTag) {
	const schemaTags = schemas.get(schemaName);
	if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
	let tags = schemaTags;
	if (!tags) {
		if (Array.isArray(customTags)) tags = [];
		else {
			const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
			throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
		}
	}
	if (Array.isArray(customTags)) for (const tag of customTags) tags = tags.concat(tag);
	else if (typeof customTags === "function") tags = customTags(tags.slice());
	if (addMergeTag) tags = tags.concat(merge);
	return tags.reduce((tags, tag) => {
		const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
		if (!tagObj) {
			const tagName = JSON.stringify(tag);
			const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
			throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
		}
		if (!tags.includes(tagObj)) tags.push(tagObj);
		return tags;
	}, []);
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class Schema {
	constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
		this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
		this.name = typeof schema === "string" && schema || "core";
		this.knownTags = resolveKnownTags ? coreKnownTags : {};
		this.tags = getTags(customTags, this.name, merge);
		this.toStringOptions = toStringDefaults ?? null;
		Object.defineProperty(this, MAP, { value: map });
		Object.defineProperty(this, SCALAR$1, { value: string });
		Object.defineProperty(this, SEQ, { value: seq });
		this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
	}
	clone() {
		const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
		copy.tags = this.tags.slice();
		return copy;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
	const lines = [];
	let hasDirectives = options.directives === true;
	if (options.directives !== false && doc.directives) {
		const dir = doc.directives.toString(doc);
		if (dir) {
			lines.push(dir);
			hasDirectives = true;
		} else if (doc.directives.docStart) hasDirectives = true;
	}
	if (hasDirectives) lines.push("---");
	const ctx = createStringifyContext(doc, options);
	const { commentString } = ctx.options;
	if (doc.commentBefore) {
		if (lines.length !== 1) lines.unshift("");
		const cs = commentString(doc.commentBefore);
		lines.unshift(indentComment(cs, ""));
	}
	let chompKeep = false;
	let contentComment = null;
	if (doc.contents) {
		if (isNode(doc.contents)) {
			if (doc.contents.spaceBefore && hasDirectives) lines.push("");
			if (doc.contents.commentBefore) {
				const cs = commentString(doc.contents.commentBefore);
				lines.push(indentComment(cs, ""));
			}
			ctx.forceBlockIndent = !!doc.comment;
			contentComment = doc.contents.comment;
		}
		const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
		let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
		if (contentComment) body += lineComment(body, "", commentString(contentComment));
		if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
		else lines.push(body);
	} else lines.push(stringify(doc.contents, ctx));
	if (doc.directives?.docEnd) {
		if (doc.comment) {
			const cs = commentString(doc.comment);
			if (cs.includes("\n")) {
				lines.push("...");
				lines.push(indentComment(cs, ""));
			} else lines.push(`... ${cs}`);
		} else lines.push("...");
	} else {
		let dc = doc.comment;
		if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
		if (dc) {
			if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
			lines.push(indentComment(commentString(dc), ""));
		}
	}
	return lines.join("\n") + "\n";
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/Document.js
var Document = class Document {
	constructor(value, replacer, options) {
		/** A comment before this Document */
		this.commentBefore = null;
		/** A comment immediately after this Document */
		this.comment = null;
		/** Errors encountered during parsing. */
		this.errors = [];
		/** Warnings encountered during parsing. */
		this.warnings = [];
		Object.defineProperty(this, NODE_TYPE, { value: DOC });
		let _replacer = null;
		if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
		else if (options === void 0 && replacer) {
			options = replacer;
			replacer = void 0;
		}
		const opt = Object.assign({
			intAsBigInt: false,
			keepSourceTokens: false,
			logLevel: "warn",
			prettyErrors: true,
			strict: true,
			stringKeys: false,
			uniqueKeys: true,
			version: "1.2"
		}, options);
		this.options = opt;
		let { version } = opt;
		if (options?._directives) {
			this.directives = options._directives.atDocument();
			if (this.directives.yaml.explicit) version = this.directives.yaml.version;
		} else this.directives = new Directives({ version });
		this.setSchema(version, options);
		this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
	}
	/**
	* Create a deep copy of this Document and its contents.
	*
	* Custom Node values that inherit from `Object` still refer to their original instances.
	*/
	clone() {
		const copy = Object.create(Document.prototype, { [NODE_TYPE]: { value: DOC } });
		copy.commentBefore = this.commentBefore;
		copy.comment = this.comment;
		copy.errors = this.errors.slice();
		copy.warnings = this.warnings.slice();
		copy.options = Object.assign({}, this.options);
		if (this.directives) copy.directives = this.directives.clone();
		copy.schema = this.schema.clone();
		copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
		if (this.range) copy.range = this.range.slice();
		return copy;
	}
	/** Adds a value to the document. */
	add(value) {
		if (assertCollection(this.contents)) this.contents.add(value);
	}
	/** Adds a value to the document. */
	addIn(path, value) {
		if (assertCollection(this.contents)) this.contents.addIn(path, value);
	}
	/**
	* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
	*
	* If `node` already has an anchor, `name` is ignored.
	* Otherwise, the `node.anchor` value will be set to `name`,
	* or if an anchor with that name is already present in the document,
	* `name` will be used as a prefix for a new unique anchor.
	* If `name` is undefined, the generated anchor will use 'a' as a prefix.
	*/
	createAlias(node, name) {
		if (!node.anchor) {
			const prev = anchorNames(this);
			node.anchor = !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
		}
		return new Alias(node.anchor);
	}
	createNode(value, replacer, options) {
		let _replacer = void 0;
		if (typeof replacer === "function") {
			value = replacer.call({ "": value }, "", value);
			_replacer = replacer;
		} else if (Array.isArray(replacer)) {
			const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
			const asStr = replacer.filter(keyToStr).map(String);
			if (asStr.length > 0) replacer = replacer.concat(asStr);
			_replacer = replacer;
		} else if (options === void 0 && replacer) {
			options = replacer;
			replacer = void 0;
		}
		const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
		const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(this, anchorPrefix || "a");
		const ctx = {
			aliasDuplicateObjects: aliasDuplicateObjects ?? true,
			keepUndefined: keepUndefined ?? false,
			onAnchor,
			onTagObj,
			replacer: _replacer,
			schema: this.schema,
			sourceObjects
		};
		const node = createNode(value, tag, ctx);
		if (flow && isCollection(node)) node.flow = true;
		setAnchors();
		return node;
	}
	/**
	* Convert a key and a value into a `Pair` using the current schema,
	* recursively wrapping all values as `Scalar` or `Collection` nodes.
	*/
	createPair(key, value, options = {}) {
		return new Pair(this.createNode(key, null, options), this.createNode(value, null, options));
	}
	/**
	* Removes a value from the document.
	* @returns `true` if the item was found and removed.
	*/
	delete(key) {
		return assertCollection(this.contents) ? this.contents.delete(key) : false;
	}
	/**
	* Removes a value from the document.
	* @returns `true` if the item was found and removed.
	*/
	deleteIn(path) {
		if (isEmptyPath(path)) {
			if (this.contents == null) return false;
			this.contents = null;
			return true;
		}
		return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
	}
	/**
	* Returns item at `key`, or `undefined` if not found. By default unwraps
	* scalar values from their surrounding node; to disable set `keepScalar` to
	* `true` (collections are always returned intact).
	*/
	get(key, keepScalar) {
		return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
	}
	/**
	* Returns item at `path`, or `undefined` if not found. By default unwraps
	* scalar values from their surrounding node; to disable set `keepScalar` to
	* `true` (collections are always returned intact).
	*/
	getIn(path, keepScalar) {
		if (isEmptyPath(path)) return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
		return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
	}
	/**
	* Checks if the document includes a value with the key `key`.
	*/
	has(key) {
		return isCollection(this.contents) ? this.contents.has(key) : false;
	}
	/**
	* Checks if the document includes a value at `path`.
	*/
	hasIn(path) {
		if (isEmptyPath(path)) return this.contents !== void 0;
		return isCollection(this.contents) ? this.contents.hasIn(path) : false;
	}
	/**
	* Sets a value in this document. For `!!set`, `value` needs to be a
	* boolean to add/remove the item from the set.
	*/
	set(key, value) {
		if (this.contents == null) this.contents = collectionFromPath(this.schema, [key], value);
		else if (assertCollection(this.contents)) this.contents.set(key, value);
	}
	/**
	* Sets a value in this document. For `!!set`, `value` needs to be a
	* boolean to add/remove the item from the set.
	*/
	setIn(path, value) {
		if (isEmptyPath(path)) this.contents = value;
		else if (this.contents == null) this.contents = collectionFromPath(this.schema, Array.from(path), value);
		else if (assertCollection(this.contents)) this.contents.setIn(path, value);
	}
	/**
	* Change the YAML version and schema used by the document.
	* A `null` version disables support for directives, explicit tags, anchors, and aliases.
	* It also requires the `schema` option to be given as a `Schema` instance value.
	*
	* Overrides all previously set schema options.
	*/
	setSchema(version, options = {}) {
		if (typeof version === "number") version = String(version);
		let opt;
		switch (version) {
			case "1.1":
				if (this.directives) this.directives.yaml.version = "1.1";
				else this.directives = new Directives({ version: "1.1" });
				opt = {
					resolveKnownTags: false,
					schema: "yaml-1.1"
				};
				break;
			case "1.2":
			case "next":
				if (this.directives) this.directives.yaml.version = version;
				else this.directives = new Directives({ version });
				opt = {
					resolveKnownTags: true,
					schema: "core"
				};
				break;
			case null:
				if (this.directives) delete this.directives;
				opt = null;
				break;
			default: {
				const sv = JSON.stringify(version);
				throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
			}
		}
		if (options.schema instanceof Object) this.schema = options.schema;
		else if (opt) this.schema = new Schema(Object.assign(opt, options));
		else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
	}
	toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
		const ctx = {
			anchors: /* @__PURE__ */ new Map(),
			doc: this,
			keep: !json,
			mapAsMap: mapAsMap === true,
			mapKeyWarned: false,
			maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
		};
		const res = toJS(this.contents, jsonArg ?? "", ctx);
		if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
		return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
	}
	/**
	* A JSON representation of the document `contents`.
	*
	* @param jsonArg Used by `JSON.stringify` to indicate the array index or
	*   property name.
	*/
	toJSON(jsonArg, onAnchor) {
		return this.toJS({
			json: true,
			jsonArg,
			mapAsMap: false,
			onAnchor
		});
	}
	/** A YAML representation of the document. */
	toString(options = {}) {
		if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
		if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
			const s = JSON.stringify(options.indent);
			throw new Error(`"indent" option must be a positive integer, not ${s}`);
		}
		return stringifyDocument(this, options);
	}
};
function assertCollection(contents) {
	if (isCollection(contents)) return true;
	throw new Error("Expected a YAML collection as document contents");
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
	constructor(name, pos, code, message) {
		super();
		this.name = name;
		this.code = code;
		this.message = message;
		this.pos = pos;
	}
};
var YAMLParseError = class extends YAMLError {
	constructor(pos, code, message) {
		super("YAMLParseError", pos, code, message);
	}
};
var YAMLWarning = class extends YAMLError {
	constructor(pos, code, message) {
		super("YAMLWarning", pos, code, message);
	}
};
var prettifyError = (src, lc) => (error) => {
	if (error.pos[0] === -1) return;
	error.linePos = error.pos.map((pos) => lc.linePos(pos));
	const { line, col } = error.linePos[0];
	error.message += ` at line ${line}, column ${col}`;
	let ci = col - 1;
	let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
	if (ci >= 60 && lineStr.length > 80) {
		const trimStart = Math.min(ci - 39, lineStr.length - 79);
		lineStr = "…" + lineStr.substring(trimStart);
		ci -= trimStart - 1;
	}
	if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
	if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
		let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
		if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
		lineStr = prev + lineStr;
	}
	if (/[^ ]/.test(lineStr)) {
		let count = 1;
		const end = error.linePos[1];
		if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
		const pointer = " ".repeat(ci) + "^".repeat(count);
		error.message += `:\n\n${lineStr}\n${pointer}\n`;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
	let spaceBefore = false;
	let atNewline = startOnNewline;
	let hasSpace = startOnNewline;
	let comment = "";
	let commentSep = "";
	let hasNewline = false;
	let reqSpace = false;
	let tab = null;
	let anchor = null;
	let tag = null;
	let newlineAfterProp = null;
	let comma = null;
	let found = null;
	let start = null;
	for (const token of tokens) {
		if (reqSpace) {
			if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
			reqSpace = false;
		}
		if (tab) {
			if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
			tab = null;
		}
		switch (token.type) {
			case "space":
				if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
				hasSpace = true;
				break;
			case "comment": {
				if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
				const cb = token.source.substring(1) || " ";
				if (!comment) comment = cb;
				else comment += commentSep + cb;
				commentSep = "";
				atNewline = false;
				break;
			}
			case "newline":
				if (atNewline) {
					if (comment) comment += token.source;
					else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
				} else commentSep += token.source;
				atNewline = true;
				hasNewline = true;
				if (anchor || tag) newlineAfterProp = token;
				hasSpace = true;
				break;
			case "anchor":
				if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
				if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
				anchor = token;
				start ?? (start = token.offset);
				atNewline = false;
				hasSpace = false;
				reqSpace = true;
				break;
			case "tag":
				if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
				tag = token;
				start ?? (start = token.offset);
				atNewline = false;
				hasSpace = false;
				reqSpace = true;
				break;
			case indicator:
				if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
				if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
				found = token;
				atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
				hasSpace = false;
				break;
			case "comma": if (flow) {
				if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
				comma = token;
				atNewline = false;
				hasSpace = false;
				break;
			}
			default:
				onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
				atNewline = false;
				hasSpace = false;
		}
	}
	const last = tokens[tokens.length - 1];
	const end = last ? last.offset + last.source.length : offset;
	if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
	if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
	return {
		comma,
		found,
		spaceBefore,
		comment,
		hasNewline,
		anchor,
		tag,
		newlineAfterProp,
		end,
		start: start ?? end
	};
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key) {
	if (!key) return null;
	switch (key.type) {
		case "alias":
		case "scalar":
		case "double-quoted-scalar":
		case "single-quoted-scalar":
			if (key.source.includes("\n")) return true;
			if (key.end) {
				for (const st of key.end) if (st.type === "newline") return true;
			}
			return false;
		case "flow-collection":
			for (const it of key.items) {
				for (const st of it.start) if (st.type === "newline") return true;
				if (it.sep) {
					for (const st of it.sep) if (st.type === "newline") return true;
				}
				if (containsNewline(it.key) || containsNewline(it.value)) return true;
			}
			return false;
		default: return true;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc, onError) {
	if (fc?.type === "flow-collection") {
		const end = fc.end[0];
		if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
	const { uniqueKeys } = ctx.options;
	if (uniqueKeys === false) return false;
	const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
	return items.some((pair) => isEqual(pair.key, search));
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
	const map = new ((tag?.nodeClass) ?? YAMLMap)(ctx.schema);
	if (ctx.atRoot) ctx.atRoot = false;
	let offset = bm.offset;
	let commentEnd = null;
	for (const collItem of bm.items) {
		const { start, key, sep, value } = collItem;
		const keyProps = resolveProps(start, {
			indicator: "explicit-key-ind",
			next: key ?? sep?.[0],
			offset,
			onError,
			parentIndent: bm.indent,
			startOnNewline: true
		});
		const implicitKey = !keyProps.found;
		if (implicitKey) {
			if (key) {
				if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
				else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
			}
			if (!keyProps.anchor && !keyProps.tag && !sep) {
				commentEnd = keyProps.end;
				if (keyProps.comment) {
					if (map.comment) map.comment += "\n" + keyProps.comment;
					else map.comment = keyProps.comment;
				}
				continue;
			}
			if (keyProps.newlineAfterProp || containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
		} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
		ctx.atKey = true;
		const keyStart = keyProps.end;
		const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
		if (ctx.schema.compat) flowIndentCheck(bm.indent, key, onError);
		ctx.atKey = false;
		if (mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
		const valueProps = resolveProps(sep ?? [], {
			indicator: "map-value-ind",
			next: value,
			offset: keyNode.range[2],
			onError,
			parentIndent: bm.indent,
			startOnNewline: !key || key.type === "block-scalar"
		});
		offset = valueProps.end;
		if (valueProps.found) {
			if (implicitKey) {
				if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
				if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
			}
			const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
			if (ctx.schema.compat) flowIndentCheck(bm.indent, value, onError);
			offset = valueNode.range[2];
			const pair = new Pair(keyNode, valueNode);
			if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
			map.items.push(pair);
		} else {
			if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
			if (valueProps.comment) {
				if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
				else keyNode.comment = valueProps.comment;
			}
			const pair = new Pair(keyNode);
			if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
			map.items.push(pair);
		}
	}
	if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
	map.range = [
		bm.offset,
		offset,
		commentEnd ?? offset
	];
	return map;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
	const seq = new ((tag?.nodeClass) ?? YAMLSeq)(ctx.schema);
	if (ctx.atRoot) ctx.atRoot = false;
	if (ctx.atKey) ctx.atKey = false;
	let offset = bs.offset;
	let commentEnd = null;
	for (const { start, value } of bs.items) {
		const props = resolveProps(start, {
			indicator: "seq-item-ind",
			next: value,
			offset,
			onError,
			parentIndent: bs.indent,
			startOnNewline: true
		});
		if (!props.found) {
			if (props.anchor || props.tag || value) {
				if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
				else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
			} else {
				commentEnd = props.end;
				if (props.comment) seq.comment = props.comment;
				continue;
			}
		}
		const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
		if (ctx.schema.compat) flowIndentCheck(bs.indent, value, onError);
		offset = node.range[2];
		seq.items.push(node);
	}
	seq.range = [
		bs.offset,
		offset,
		commentEnd ?? offset
	];
	return seq;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
	let comment = "";
	if (end) {
		let hasSpace = false;
		let sep = "";
		for (const token of end) {
			const { source, type } = token;
			switch (type) {
				case "space":
					hasSpace = true;
					break;
				case "comment": {
					if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					const cb = source.substring(1) || " ";
					if (!comment) comment = cb;
					else comment += sep + cb;
					sep = "";
					break;
				}
				case "newline":
					if (comment) sep += source;
					hasSpace = true;
					break;
				default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
			}
			offset += source.length;
		}
	}
	return {
		comment,
		offset
	};
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
	const isMap = fc.start.source === "{";
	const fcName = isMap ? "flow map" : "flow sequence";
	const coll = new ((tag?.nodeClass) ?? (isMap ? YAMLMap : YAMLSeq))(ctx.schema);
	coll.flow = true;
	const atRoot = ctx.atRoot;
	if (atRoot) ctx.atRoot = false;
	if (ctx.atKey) ctx.atKey = false;
	let offset = fc.offset + fc.start.source.length;
	for (let i = 0; i < fc.items.length; ++i) {
		const collItem = fc.items[i];
		const { start, key, sep, value } = collItem;
		const props = resolveProps(start, {
			flow: fcName,
			indicator: "explicit-key-ind",
			next: key ?? sep?.[0],
			offset,
			onError,
			parentIndent: fc.indent,
			startOnNewline: false
		});
		if (!props.found) {
			if (!props.anchor && !props.tag && !sep && !value) {
				if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
				else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
				if (props.comment) {
					if (coll.comment) coll.comment += "\n" + props.comment;
					else coll.comment = props.comment;
				}
				offset = props.end;
				continue;
			}
			if (!isMap && ctx.options.strict && containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
		}
		if (i === 0) {
			if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
		} else {
			if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
			if (props.comment) {
				let prevItemComment = "";
				loop: for (const st of start) switch (st.type) {
					case "comma":
					case "space": break;
					case "comment":
						prevItemComment = st.source.substring(1);
						break loop;
					default: break loop;
				}
				if (prevItemComment) {
					let prev = coll.items[coll.items.length - 1];
					if (isPair(prev)) prev = prev.value ?? prev.key;
					if (prev.comment) prev.comment += "\n" + prevItemComment;
					else prev.comment = prevItemComment;
					props.comment = props.comment.substring(prevItemComment.length + 1);
				}
			}
		}
		if (!isMap && !sep && !props.found) {
			const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
			coll.items.push(valueNode);
			offset = valueNode.range[2];
			if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
		} else {
			ctx.atKey = true;
			const keyStart = props.end;
			const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
			if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
			ctx.atKey = false;
			const valueProps = resolveProps(sep ?? [], {
				flow: fcName,
				indicator: "map-value-ind",
				next: value,
				offset: keyNode.range[2],
				onError,
				parentIndent: fc.indent,
				startOnNewline: false
			});
			if (valueProps.found) {
				if (!isMap && !props.found && ctx.options.strict) {
					if (sep) for (const st of sep) {
						if (st === valueProps.found) break;
						if (st.type === "newline") {
							onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
							break;
						}
					}
					if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
				}
			} else if (value) {
				if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
				else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
			}
			const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
			if (valueNode) {
				if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
			} else if (valueProps.comment) {
				if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
				else keyNode.comment = valueProps.comment;
			}
			const pair = new Pair(keyNode, valueNode);
			if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
			if (isMap) {
				const map = coll;
				if (mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
				map.items.push(pair);
			} else {
				const map = new YAMLMap(ctx.schema);
				map.flow = true;
				map.items.push(pair);
				const endRange = (valueNode ?? keyNode).range;
				map.range = [
					keyNode.range[0],
					endRange[1],
					endRange[2]
				];
				coll.items.push(map);
			}
			offset = valueNode ? valueNode.range[2] : valueProps.end;
		}
	}
	const expectedEnd = isMap ? "}" : "]";
	const [ce, ...ee] = fc.end;
	let cePos = offset;
	if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
	else {
		const name = fcName[0].toUpperCase() + fcName.substring(1);
		const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
		onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
		if (ce && ce.source.length !== 1) ee.unshift(ce);
	}
	if (ee.length > 0) {
		const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
		if (end.comment) {
			if (coll.comment) coll.comment += "\n" + end.comment;
			else coll.comment = end.comment;
		}
		coll.range = [
			fc.offset,
			cePos,
			end.offset
		];
	} else coll.range = [
		fc.offset,
		cePos,
		cePos
	];
	return coll;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN, ctx, token, onError, tagName, tag) {
	const coll = token.type === "block-map" ? resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection(CN, ctx, token, onError, tag);
	const Coll = coll.constructor;
	if (tagName === "!" || tagName === Coll.tagName) {
		coll.tag = Coll.tagName;
		return coll;
	}
	if (tagName) coll.tag = tagName;
	return coll;
}
function composeCollection(CN, ctx, token, props, onError) {
	const tagToken = props.tag;
	const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
	if (token.type === "block-seq") {
		const { anchor, newlineAfterProp: nl } = props;
		const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
		if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
	}
	const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
	if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") return resolveCollection(CN, ctx, token, onError, tagName);
	let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
	if (!tag) {
		const kt = ctx.schema.knownTags[tagName];
		if (kt?.collection === expType) {
			ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
			tag = kt;
		} else {
			if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
			else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
			return resolveCollection(CN, ctx, token, onError, tagName);
		}
	}
	const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
	const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
	const node = isNode(res) ? res : new Scalar(res);
	node.range = coll.range;
	node.tag = tagName;
	if (tag?.format) node.format = tag.format;
	return node;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar, onError) {
	const start = scalar.offset;
	const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
	if (!header) return {
		value: "",
		type: null,
		comment: "",
		range: [
			start,
			start,
			start
		]
	};
	const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
	const lines = scalar.source ? splitLines(scalar.source) : [];
	let chompStart = lines.length;
	for (let i = lines.length - 1; i >= 0; --i) {
		const content = lines[i][1];
		if (content === "" || content === "\r") chompStart = i;
		else break;
	}
	if (chompStart === 0) {
		const value = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
		let end = start + header.length;
		if (scalar.source) end += scalar.source.length;
		return {
			value,
			type,
			comment: header.comment,
			range: [
				start,
				end,
				end
			]
		};
	}
	let trimIndent = scalar.indent + header.indent;
	let offset = scalar.offset + header.length;
	let contentStart = 0;
	for (let i = 0; i < chompStart; ++i) {
		const [indent, content] = lines[i];
		if (content === "" || content === "\r") {
			if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
		} else {
			if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
			if (header.indent === 0) trimIndent = indent.length;
			contentStart = i;
			if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
			break;
		}
		offset += indent.length + content.length + 1;
	}
	for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
	let value = "";
	let sep = "";
	let prevMoreIndented = false;
	for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
	for (let i = contentStart; i < chompStart; ++i) {
		let [indent, content] = lines[i];
		offset += indent.length + content.length + 1;
		const crlf = content[content.length - 1] === "\r";
		if (crlf) content = content.slice(0, -1);
		/* istanbul ignore if already caught in lexer */
		if (content && indent.length < trimIndent) {
			const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
			onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
			indent = "";
		}
		if (type === Scalar.BLOCK_LITERAL) {
			value += sep + indent.slice(trimIndent) + content;
			sep = "\n";
		} else if (indent.length > trimIndent || content[0] === "	") {
			if (sep === " ") sep = "\n";
			else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
			value += sep + indent.slice(trimIndent) + content;
			sep = "\n";
			prevMoreIndented = true;
		} else if (content === "") {
			if (sep === "\n") value += "\n";
			else sep = "\n";
		} else {
			value += sep + content;
			sep = " ";
			prevMoreIndented = false;
		}
	}
	switch (header.chomp) {
		case "-": break;
		case "+":
			for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
			if (value[value.length - 1] !== "\n") value += "\n";
			break;
		default: value += "\n";
	}
	const end = start + header.length + scalar.source.length;
	return {
		value,
		type,
		comment: header.comment,
		range: [
			start,
			end,
			end
		]
	};
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
	/* istanbul ignore if should not happen */
	if (props[0].type !== "block-scalar-header") {
		onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
		return null;
	}
	const { source } = props[0];
	const mode = source[0];
	let indent = 0;
	let chomp = "";
	let error = -1;
	for (let i = 1; i < source.length; ++i) {
		const ch = source[i];
		if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
		else {
			const n = Number(ch);
			if (!indent && n) indent = n;
			else if (error === -1) error = offset + i;
		}
	}
	if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
	let hasSpace = false;
	let comment = "";
	let length = source.length;
	for (let i = 1; i < props.length; ++i) {
		const token = props[i];
		switch (token.type) {
			case "space": hasSpace = true;
			case "newline":
				length += token.source.length;
				break;
			case "comment":
				if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
				length += token.source.length;
				comment = token.source.substring(1);
				break;
			case "error":
				onError(token, "UNEXPECTED_TOKEN", token.message);
				length += token.source.length;
				break;
			/* istanbul ignore next should not happen */
			default: {
				onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
				const ts = token.source;
				if (ts && typeof ts === "string") length += ts.length;
			}
		}
	}
	return {
		mode,
		indent,
		chomp,
		comment,
		length
	};
}
/** @returns Array of lines split up as `[indent, content]` */
function splitLines(source) {
	const split = source.split(/\n( *)/);
	const first = split[0];
	const m = first.match(/^( *)/);
	const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
	for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
	return lines;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar, strict, onError) {
	const { offset, type, source, end } = scalar;
	let _type;
	let value;
	const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
	switch (type) {
		case "scalar":
			_type = Scalar.PLAIN;
			value = plainValue(source, _onError);
			break;
		case "single-quoted-scalar":
			_type = Scalar.QUOTE_SINGLE;
			value = singleQuotedValue(source, _onError);
			break;
		case "double-quoted-scalar":
			_type = Scalar.QUOTE_DOUBLE;
			value = doubleQuotedValue(source, _onError);
			break;
		/* istanbul ignore next should not happen */
		default:
			onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
			return {
				value: "",
				type: null,
				comment: "",
				range: [
					offset,
					offset + source.length,
					offset + source.length
				]
			};
	}
	const valueEnd = offset + source.length;
	const re = resolveEnd(end, valueEnd, strict, onError);
	return {
		value,
		type: _type,
		comment: re.comment,
		range: [
			offset,
			valueEnd,
			re.offset
		]
	};
}
function plainValue(source, onError) {
	let badChar = "";
	switch (source[0]) {
		/* istanbul ignore next should not happen */
		case "	":
			badChar = "a tab character";
			break;
		case ",":
			badChar = "flow indicator character ,";
			break;
		case "%":
			badChar = "directive indicator character %";
			break;
		case "|":
		case ">":
			badChar = `block scalar indicator ${source[0]}`;
			break;
		case "@":
		case "`": badChar = `reserved character ${source[0]}`;
	}
	if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
	return unfoldLines(source);
}
function singleQuotedValue(source, onError) {
	if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
	return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function unfoldLines(source) {
	const line = /(.*?)\r?\n/sy;
	let match = line.exec(source);
	if (!match) return source;
	/**
	* The negative lookbehinds in these RegExps are to
	* prevent causing a polynomial search time in certain cases.
	*
	* The try-catch is for Safari < 16.4 and other old browsers:
	* https://caniuse.com/js-regexp-lookbehind
	*/
	let trimEnd, trimBoth;
	try {
		trimEnd = /* @__PURE__ */ new RegExp("(?<![ 	])[ 	]+$");
		trimBoth = /* @__PURE__ */ new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
	} catch {
		trimEnd = /[ \t]+$/;
		trimBoth = /^[ \t]+|[ \t]+$/g;
	}
	let res = match[1].replace(trimEnd, "");
	let sep = " ";
	let pos = line.lastIndex;
	while (match = line.exec(source)) {
		const lm = match[1].replace(trimBoth, "");
		if (lm === "") {
			if (sep === "\n") res += sep;
			else sep = "\n";
		} else {
			res += sep + lm;
			sep = " ";
		}
		pos = line.lastIndex;
	}
	const last = /[ \t]*(.*)/sy;
	last.lastIndex = pos;
	match = last.exec(source);
	return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
	let res = "";
	for (let i = 1; i < source.length - 1; ++i) {
		const ch = source[i];
		if (ch === "\r" && source[i + 1] === "\n") continue;
		if (ch === "\n") {
			const { fold, offset } = foldNewline(source, i);
			res += fold;
			i = offset;
		} else if (ch === "\\") {
			let next = source[++i];
			const cc = escapeCodes[next];
			if (cc) res += cc;
			else if (next === "\n") {
				next = source[i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
			} else if (next === "\r" && source[i + 1] === "\n") {
				next = source[++i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
			} else if (next === "x" || next === "u" || next === "U") {
				const length = next === "x" ? 2 : next === "u" ? 4 : 8;
				res += parseCharCode(source, i + 1, length, onError);
				i += length;
			} else {
				const raw = source.substr(i - 1, 2);
				onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
				res += raw;
			}
		} else if (ch === " " || ch === "	") {
			const wsStart = i;
			let next = source[i + 1];
			while (next === " " || next === "	") next = source[++i + 1];
			if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
		} else res += ch;
	}
	if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
	return res;
}
/**
* Fold a single newline into a space, multiple newlines to N - 1 newlines.
* Presumes `source[offset] === '\n'`
*/
function foldNewline(source, offset) {
	let fold = "";
	let ch = source[offset + 1];
	while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
		if (ch === "\r" && source[offset + 2] !== "\n") break;
		if (ch === "\n") fold += "\n";
		offset += 1;
		ch = source[offset + 1];
	}
	if (!fold) fold = " ";
	return {
		fold,
		offset
	};
}
var escapeCodes = {
	"0": "\0",
	a: "\x07",
	b: "\b",
	e: "\x1B",
	f: "\f",
	n: "\n",
	r: "\r",
	t: "	",
	v: "\v",
	N: "",
	_: "\xA0",
	L: "\u2028",
	P: "\u2029",
	" ": " ",
	"\"": "\"",
	"/": "/",
	"\\": "\\",
	"	": "	"
};
function parseCharCode(source, offset, length, onError) {
	const cc = source.substr(offset, length);
	const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
	try {
		return String.fromCodePoint(code);
	} catch {
		const raw = source.substr(offset - 2, length + 2);
		onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
		return raw;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
	const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
	const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
	let tag;
	if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[SCALAR$1];
	else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
	else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
	else tag = ctx.schema[SCALAR$1];
	let scalar;
	try {
		const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
		scalar = isScalar(res) ? res : new Scalar(res);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
		scalar = new Scalar(value);
	}
	scalar.range = range;
	scalar.source = value;
	if (type) scalar.type = type;
	if (tagName) scalar.tag = tagName;
	if (tag.format) scalar.format = tag.format;
	if (comment) scalar.comment = comment;
	return scalar;
}
function findScalarTagByName(schema, value, tagName, tagToken, onError) {
	if (tagName === "!") return schema[SCALAR$1];
	const matchWithTest = [];
	for (const tag of schema.tags) if (!tag.collection && tag.tag === tagName) {
		if (tag.default && tag.test) matchWithTest.push(tag);
		else return tag;
	}
	for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
	const kt = schema.knownTags[tagName];
	if (kt && !kt.collection) {
		schema.tags.push(Object.assign({}, kt, {
			default: false,
			test: void 0
		}));
		return kt;
	}
	onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
	return schema[SCALAR$1];
}
function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
	const tag = schema.tags.find((tag) => (tag.default === true || atKey && tag.default === "key") && tag.test?.test(value)) || schema[SCALAR$1];
	if (schema.compat) {
		const compat = schema.compat.find((tag) => tag.default && tag.test?.test(value)) ?? schema[SCALAR$1];
		if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives.tagString(tag.tag)} or ${directives.tagString(compat.tag)}`, true);
	}
	return tag;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
	if (before) {
		pos ?? (pos = before.length);
		for (let i = pos - 1; i >= 0; --i) {
			let st = before[i];
			switch (st.type) {
				case "space":
				case "comment":
				case "newline":
					offset -= st.source.length;
					continue;
			}
			st = before[++i];
			while (st?.type === "space") {
				offset += st.source.length;
				st = before[++i];
			}
			break;
		}
	}
	return offset;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-node.js
var CN = {
	composeNode,
	composeEmptyNode
};
function composeNode(ctx, token, props, onError) {
	const atKey = ctx.atKey;
	const { spaceBefore, comment, anchor, tag } = props;
	let node;
	let isSrcToken = true;
	switch (token.type) {
		case "alias":
			node = composeAlias(ctx, token, onError);
			if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
			break;
		case "scalar":
		case "single-quoted-scalar":
		case "double-quoted-scalar":
		case "block-scalar":
			node = composeScalar(ctx, token, tag, onError);
			if (anchor) node.anchor = anchor.source.substring(1);
			break;
		case "block-map":
		case "block-seq":
		case "flow-collection":
			try {
				node = composeCollection(CN, ctx, token, props, onError);
				if (anchor) node.anchor = anchor.source.substring(1);
			} catch (error) {
				onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
			}
			break;
		default:
			onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
			isSrcToken = false;
	}
	node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
	if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
	if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
	if (spaceBefore) node.spaceBefore = true;
	if (comment) {
		if (token.type === "scalar" && token.source === "") node.comment = comment;
		else node.commentBefore = comment;
	}
	if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
	return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
	const node = composeScalar(ctx, {
		type: "scalar",
		offset: emptyScalarPosition(offset, before, pos),
		indent: -1,
		source: ""
	}, tag, onError);
	if (anchor) {
		node.anchor = anchor.source.substring(1);
		if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
	}
	if (spaceBefore) node.spaceBefore = true;
	if (comment) {
		node.comment = comment;
		node.range[2] = end;
	}
	return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
	const alias = new Alias(source.substring(1));
	if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
	if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
	const valueEnd = offset + source.length;
	const re = resolveEnd(end, valueEnd, options.strict, onError);
	alias.range = [
		offset,
		valueEnd,
		re.offset
	];
	if (re.comment) alias.comment = re.comment;
	return alias;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
	const doc = new Document(void 0, Object.assign({ _directives: directives }, options));
	const ctx = {
		atKey: false,
		atRoot: true,
		directives: doc.directives,
		options: doc.options,
		schema: doc.schema
	};
	const props = resolveProps(start, {
		indicator: "doc-start",
		next: value ?? end?.[0],
		offset,
		onError,
		parentIndent: 0,
		startOnNewline: true
	});
	if (props.found) {
		doc.directives.docStart = true;
		if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
	}
	doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
	const contentEnd = doc.contents.range[2];
	const re = resolveEnd(end, contentEnd, false, onError);
	if (re.comment) doc.comment = re.comment;
	doc.range = [
		offset,
		contentEnd,
		re.offset
	];
	return doc;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
	if (typeof src === "number") return [src, src + 1];
	if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
	const { offset, source } = src;
	return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
	let comment = "";
	let atComment = false;
	let afterEmptyLine = false;
	for (let i = 0; i < prelude.length; ++i) {
		const source = prelude[i];
		switch (source[0]) {
			case "#":
				comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
				atComment = true;
				afterEmptyLine = false;
				break;
			case "%":
				if (prelude[i + 1]?.[0] !== "#") i += 1;
				atComment = false;
				break;
			default:
				if (!atComment) afterEmptyLine = true;
				atComment = false;
		}
	}
	return {
		comment,
		afterEmptyLine
	};
}
/**
* Compose a stream of CST nodes into a stream of YAML Documents.
*
* ```ts
* import { Composer, Parser } from 'yaml'
*
* const src: string = ...
* const tokens = new Parser().parse(src)
* const docs = new Composer().compose(tokens)
* ```
*/
var Composer = class {
	constructor(options = {}) {
		this.doc = null;
		this.atDirectives = false;
		this.prelude = [];
		this.errors = [];
		this.warnings = [];
		this.onError = (source, code, message, warning) => {
			const pos = getErrorPos(source);
			if (warning) this.warnings.push(new YAMLWarning(pos, code, message));
			else this.errors.push(new YAMLParseError(pos, code, message));
		};
		this.directives = new Directives({ version: options.version || "1.2" });
		this.options = options;
	}
	decorate(doc, afterDoc) {
		const { comment, afterEmptyLine } = parsePrelude(this.prelude);
		if (comment) {
			const dc = doc.contents;
			if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
			else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
			else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
				let it = dc.items[0];
				if (isPair(it)) it = it.key;
				const cb = it.commentBefore;
				it.commentBefore = cb ? `${comment}\n${cb}` : comment;
			} else {
				const cb = dc.commentBefore;
				dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
			}
		}
		if (afterDoc) {
			for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
			for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
		} else {
			doc.errors = this.errors;
			doc.warnings = this.warnings;
		}
		this.prelude = [];
		this.errors = [];
		this.warnings = [];
	}
	/**
	* Current stream status information.
	*
	* Mostly useful at the end of input for an empty stream.
	*/
	streamInfo() {
		return {
			comment: parsePrelude(this.prelude).comment,
			directives: this.directives,
			errors: this.errors,
			warnings: this.warnings
		};
	}
	/**
	* Compose tokens into documents.
	*
	* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
	* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
	*/
	*compose(tokens, forceDoc = false, endOffset = -1) {
		for (const token of tokens) yield* this.next(token);
		yield* this.end(forceDoc, endOffset);
	}
	/** Advance the composer by one CST token. */
	*next(token) {
		switch (token.type) {
			case "directive":
				this.directives.add(token.source, (offset, message, warning) => {
					const pos = getErrorPos(token);
					pos[0] += offset;
					this.onError(pos, "BAD_DIRECTIVE", message, warning);
				});
				this.prelude.push(token.source);
				this.atDirectives = true;
				break;
			case "document": {
				const doc = composeDoc(this.options, this.directives, token, this.onError);
				if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
				this.decorate(doc, false);
				if (this.doc) yield this.doc;
				this.doc = doc;
				this.atDirectives = false;
				break;
			}
			case "byte-order-mark":
			case "space": break;
			case "comment":
			case "newline":
				this.prelude.push(token.source);
				break;
			case "error": {
				const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
				const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
				if (this.atDirectives || !this.doc) this.errors.push(error);
				else this.doc.errors.push(error);
				break;
			}
			case "doc-end": {
				if (!this.doc) {
					this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
					break;
				}
				this.doc.directives.docEnd = true;
				const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
				this.decorate(this.doc, true);
				if (end.comment) {
					const dc = this.doc.comment;
					this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
				}
				this.doc.range[2] = end.offset;
				break;
			}
			default: this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
		}
	}
	/**
	* Call at end of input to yield any remaining document.
	*
	* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
	* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
	*/
	*end(forceDoc = false, endOffset = -1) {
		if (this.doc) {
			this.decorate(this.doc, true);
			yield this.doc;
			this.doc = null;
		} else if (forceDoc) {
			const doc = new Document(void 0, Object.assign({ _directives: this.directives }, this.options));
			if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
			doc.range = [
				0,
				endOffset,
				endOffset
			];
			this.decorate(doc, false);
			yield doc;
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK = Symbol("break visit");
var SKIP = Symbol("skip children");
var REMOVE = Symbol("remove item");
/**
* Apply a visitor to a CST document or item.
*
* Walks through the tree (depth-first) starting from the root, calling a
* `visitor` function with two arguments when entering each item:
*   - `item`: The current item, which included the following members:
*     - `start: SourceToken[]` – Source tokens before the key or value,
*       possibly including its anchor or tag.
*     - `key?: Token | null` – Set for pair values. May then be `null`, if
*       the key before the `:` separator is empty.
*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
*       which should include the `:` map value indicator if `value` is set.
*     - `value?: Token` – The value of a sequence item, or of a map pair.
*   - `path`: The steps from the root to the current node, as an array of
*     `['key' | 'value', number]` tuples.
*
* The return value of the visitor may be used to control the traversal:
*   - `undefined` (default): Do nothing and continue
*   - `visit.SKIP`: Do not visit the children of this token, continue with
*      next sibling
*   - `visit.BREAK`: Terminate traversal completely
*   - `visit.REMOVE`: Remove the current item, then continue with the next one
*   - `number`: Set the index of the next step. This is useful especially if
*     the index of the current token has changed.
*   - `function`: Define the next visitor for this item. After the original
*     visitor is called on item entry, next visitors are called after handling
*     a non-empty `key` and when exiting the item.
*/
function visit(cst, visitor) {
	if ("type" in cst && cst.type === "document") cst = {
		start: cst.start,
		value: cst.value
	};
	_visit(Object.freeze([]), cst, visitor);
}
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current item */
visit.SKIP = SKIP;
/** Remove the current item */
visit.REMOVE = REMOVE;
/** Find the item at `path` from `cst` as the root */
visit.itemAtPath = (cst, path) => {
	let item = cst;
	for (const [field, index] of path) {
		const tok = item?.[field];
		if (tok && "items" in tok) item = tok.items[index];
		else return void 0;
	}
	return item;
};
/**
* Get the immediate parent collection of the item at `path` from `cst` as the root.
*
* Throws an error if the collection is not found, which should never happen if the item itself exists.
*/
visit.parentCollection = (cst, path) => {
	const parent = visit.itemAtPath(cst, path.slice(0, -1));
	const field = path[path.length - 1][0];
	const coll = parent?.[field];
	if (coll && "items" in coll) return coll;
	throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
	let ctrl = visitor(item, path);
	if (typeof ctrl === "symbol") return ctrl;
	for (const field of ["key", "value"]) {
		const token = item[field];
		if (token && "items" in token) {
			for (let i = 0; i < token.items.length; ++i) {
				const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
				if (typeof ci === "number") i = ci - 1;
				else if (ci === BREAK) return BREAK;
				else if (ci === REMOVE) {
					token.items.splice(i, 1);
					i -= 1;
				}
			}
			if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
		}
	}
	return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}
/** Identify the type of a lexer token. May return `null` for unknown tokens. */
function tokenType(source) {
	switch (source) {
		case "﻿": return "byte-order-mark";
		case "": return "doc-mode";
		case "": return "flow-error-end";
		case "": return "scalar";
		case "---": return "doc-start";
		case "...": return "doc-end";
		case "":
		case "\n":
		case "\r\n": return "newline";
		case "-": return "seq-item-ind";
		case "?": return "explicit-key-ind";
		case ":": return "map-value-ind";
		case "{": return "flow-map-start";
		case "}": return "flow-map-end";
		case "[": return "flow-seq-start";
		case "]": return "flow-seq-end";
		case ",": return "comma";
	}
	switch (source[0]) {
		case " ":
		case "	": return "space";
		case "#": return "comment";
		case "%": return "directive-line";
		case "*": return "alias";
		case "&": return "anchor";
		case "!": return "tag";
		case "'": return "single-quoted-scalar";
		case "\"": return "double-quoted-scalar";
		case "|":
		case ">": return "block-scalar-header";
	}
	return null;
}
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
	switch (ch) {
		case void 0:
		case " ":
		case "\n":
		case "\r":
		case "	": return true;
		default: return false;
	}
}
var hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
var tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
var invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
/**
* Splits an input string into lexical tokens, i.e. smaller strings that are
* easily identifiable by `tokens.tokenType()`.
*
* Lexing starts always in a "stream" context. Incomplete input may be buffered
* until a complete token can be emitted.
*
* In addition to slices of the original input, the following control characters
* may also be emitted:
*
* - `\x02` (Start of Text): A document starts with the next token
* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
* - `\x1f` (Unit Separator): Next token is a scalar value
* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
*/
var Lexer = class {
	constructor() {
		/**
		* Flag indicating whether the end of the current buffer marks the end of
		* all input
		*/
		this.atEnd = false;
		/**
		* Explicit indent set in block scalar header, as an offset from the current
		* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
		* explicitly set.
		*/
		this.blockScalarIndent = -1;
		/**
		* Block scalars that include a + (keep) chomping indicator in their header
		* include trailing empty lines, which are otherwise excluded from the
		* scalar's contents.
		*/
		this.blockScalarKeep = false;
		/** Current input */
		this.buffer = "";
		/**
		* Flag noting whether the map value indicator : can immediately follow this
		* node within a flow context.
		*/
		this.flowKey = false;
		/** Count of surrounding flow collection levels. */
		this.flowLevel = 0;
		/**
		* Minimum level of indentation required for next lines to be parsed as a
		* part of the current scalar value.
		*/
		this.indentNext = 0;
		/** Indentation level of the current line. */
		this.indentValue = 0;
		/** Position of the next \n character. */
		this.lineEndPos = null;
		/** Stores the state of the lexer if reaching the end of incpomplete input */
		this.next = null;
		/** A pointer to `buffer`; the current position of the lexer. */
		this.pos = 0;
	}
	/**
	* Generate YAML tokens from the `source` string. If `incomplete`,
	* a part of the last line may be left as a buffer for the next call.
	*
	* @returns A generator of lexical tokens
	*/
	*lex(source, incomplete = false) {
		if (source) {
			if (typeof source !== "string") throw TypeError("source is not a string");
			this.buffer = this.buffer ? this.buffer + source : source;
			this.lineEndPos = null;
		}
		this.atEnd = !incomplete;
		let next = this.next ?? "stream";
		while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
	}
	atLineEnd() {
		let i = this.pos;
		let ch = this.buffer[i];
		while (ch === " " || ch === "	") ch = this.buffer[++i];
		if (!ch || ch === "#" || ch === "\n") return true;
		if (ch === "\r") return this.buffer[i + 1] === "\n";
		return false;
	}
	charAt(n) {
		return this.buffer[this.pos + n];
	}
	continueScalar(offset) {
		let ch = this.buffer[offset];
		if (this.indentNext > 0) {
			let indent = 0;
			while (ch === " ") ch = this.buffer[++indent + offset];
			if (ch === "\r") {
				const next = this.buffer[indent + offset + 1];
				if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
			}
			return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
		}
		if (ch === "-" || ch === ".") {
			const dt = this.buffer.substr(offset, 3);
			if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
		}
		return offset;
	}
	getLine() {
		let end = this.lineEndPos;
		if (typeof end !== "number" || end !== -1 && end < this.pos) {
			end = this.buffer.indexOf("\n", this.pos);
			this.lineEndPos = end;
		}
		if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
		if (this.buffer[end - 1] === "\r") end -= 1;
		return this.buffer.substring(this.pos, end);
	}
	hasChars(n) {
		return this.pos + n <= this.buffer.length;
	}
	setNext(state) {
		this.buffer = this.buffer.substring(this.pos);
		this.pos = 0;
		this.lineEndPos = null;
		this.next = state;
		return null;
	}
	peek(n) {
		return this.buffer.substr(this.pos, n);
	}
	*parseNext(next) {
		switch (next) {
			case "stream": return yield* this.parseStream();
			case "line-start": return yield* this.parseLineStart();
			case "block-start": return yield* this.parseBlockStart();
			case "doc": return yield* this.parseDocument();
			case "flow": return yield* this.parseFlowCollection();
			case "quoted-scalar": return yield* this.parseQuotedScalar();
			case "block-scalar": return yield* this.parseBlockScalar();
			case "plain-scalar": return yield* this.parsePlainScalar();
		}
	}
	*parseStream() {
		let line = this.getLine();
		if (line === null) return this.setNext("stream");
		if (line[0] === "﻿") {
			yield* this.pushCount(1);
			line = line.substring(1);
		}
		if (line[0] === "%") {
			let dirEnd = line.length;
			let cs = line.indexOf("#");
			while (cs !== -1) {
				const ch = line[cs - 1];
				if (ch === " " || ch === "	") {
					dirEnd = cs - 1;
					break;
				} else cs = line.indexOf("#", cs + 1);
			}
			while (true) {
				const ch = line[dirEnd - 1];
				if (ch === " " || ch === "	") dirEnd -= 1;
				else break;
			}
			const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
			yield* this.pushCount(line.length - n);
			this.pushNewline();
			return "stream";
		}
		if (this.atLineEnd()) {
			const sp = yield* this.pushSpaces(true);
			yield* this.pushCount(line.length - sp);
			yield* this.pushNewline();
			return "stream";
		}
		yield "";
		return yield* this.parseLineStart();
	}
	*parseLineStart() {
		const ch = this.charAt(0);
		if (!ch && !this.atEnd) return this.setNext("line-start");
		if (ch === "-" || ch === ".") {
			if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
			const s = this.peek(3);
			if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
				yield* this.pushCount(3);
				this.indentValue = 0;
				this.indentNext = 0;
				return s === "---" ? "doc" : "stream";
			}
		}
		this.indentValue = yield* this.pushSpaces(false);
		if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
		return yield* this.parseBlockStart();
	}
	*parseBlockStart() {
		const [ch0, ch1] = this.peek(2);
		if (!ch1 && !this.atEnd) return this.setNext("block-start");
		if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
			const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
			this.indentNext = this.indentValue + 1;
			this.indentValue += n;
			return "block-start";
		}
		return "doc";
	}
	*parseDocument() {
		yield* this.pushSpaces(true);
		const line = this.getLine();
		if (line === null) return this.setNext("doc");
		let n = yield* this.pushIndicators();
		switch (line[n]) {
			case "#": yield* this.pushCount(line.length - n);
			case void 0:
				yield* this.pushNewline();
				return yield* this.parseLineStart();
			case "{":
			case "[":
				yield* this.pushCount(1);
				this.flowKey = false;
				this.flowLevel = 1;
				return "flow";
			case "}":
			case "]":
				yield* this.pushCount(1);
				return "doc";
			case "*":
				yield* this.pushUntil(isNotAnchorChar);
				return "doc";
			case "\"":
			case "'": return yield* this.parseQuotedScalar();
			case "|":
			case ">":
				n += yield* this.parseBlockScalarHeader();
				n += yield* this.pushSpaces(true);
				yield* this.pushCount(line.length - n);
				yield* this.pushNewline();
				return yield* this.parseBlockScalar();
			default: return yield* this.parsePlainScalar();
		}
	}
	*parseFlowCollection() {
		let nl, sp;
		let indent = -1;
		do {
			nl = yield* this.pushNewline();
			if (nl > 0) {
				sp = yield* this.pushSpaces(false);
				this.indentValue = indent = sp;
			} else sp = 0;
			sp += yield* this.pushSpaces(true);
		} while (nl + sp > 0);
		const line = this.getLine();
		if (line === null) return this.setNext("flow");
		if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
			if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
				this.flowLevel = 0;
				yield "";
				return yield* this.parseLineStart();
			}
		}
		let n = 0;
		while (line[n] === ",") {
			n += yield* this.pushCount(1);
			n += yield* this.pushSpaces(true);
			this.flowKey = false;
		}
		n += yield* this.pushIndicators();
		switch (line[n]) {
			case void 0: return "flow";
			case "#":
				yield* this.pushCount(line.length - n);
				return "flow";
			case "{":
			case "[":
				yield* this.pushCount(1);
				this.flowKey = false;
				this.flowLevel += 1;
				return "flow";
			case "}":
			case "]":
				yield* this.pushCount(1);
				this.flowKey = true;
				this.flowLevel -= 1;
				return this.flowLevel ? "flow" : "doc";
			case "*":
				yield* this.pushUntil(isNotAnchorChar);
				return "flow";
			case "\"":
			case "'":
				this.flowKey = true;
				return yield* this.parseQuotedScalar();
			case ":": {
				const next = this.charAt(1);
				if (this.flowKey || isEmpty(next) || next === ",") {
					this.flowKey = false;
					yield* this.pushCount(1);
					yield* this.pushSpaces(true);
					return "flow";
				}
			}
			default:
				this.flowKey = false;
				return yield* this.parsePlainScalar();
		}
	}
	*parseQuotedScalar() {
		const quote = this.charAt(0);
		let end = this.buffer.indexOf(quote, this.pos + 1);
		if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
		else while (end !== -1) {
			let n = 0;
			while (this.buffer[end - 1 - n] === "\\") n += 1;
			if (n % 2 === 0) break;
			end = this.buffer.indexOf("\"", end + 1);
		}
		const qb = this.buffer.substring(0, end);
		let nl = qb.indexOf("\n", this.pos);
		if (nl !== -1) {
			while (nl !== -1) {
				const cs = this.continueScalar(nl + 1);
				if (cs === -1) break;
				nl = qb.indexOf("\n", cs);
			}
			if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
		}
		if (end === -1) {
			if (!this.atEnd) return this.setNext("quoted-scalar");
			end = this.buffer.length;
		}
		yield* this.pushToIndex(end + 1, false);
		return this.flowLevel ? "flow" : "doc";
	}
	*parseBlockScalarHeader() {
		this.blockScalarIndent = -1;
		this.blockScalarKeep = false;
		let i = this.pos;
		while (true) {
			const ch = this.buffer[++i];
			if (ch === "+") this.blockScalarKeep = true;
			else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
			else if (ch !== "-") break;
		}
		return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
	}
	*parseBlockScalar() {
		let nl = this.pos - 1;
		let indent = 0;
		let ch;
		loop: for (let i = this.pos; ch = this.buffer[i]; ++i) switch (ch) {
			case " ":
				indent += 1;
				break;
			case "\n":
				nl = i;
				indent = 0;
				break;
			case "\r": {
				const next = this.buffer[i + 1];
				if (!next && !this.atEnd) return this.setNext("block-scalar");
				if (next === "\n") break;
			}
			default: break loop;
		}
		if (!ch && !this.atEnd) return this.setNext("block-scalar");
		if (indent >= this.indentNext) {
			if (this.blockScalarIndent === -1) this.indentNext = indent;
			else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
			do {
				const cs = this.continueScalar(nl + 1);
				if (cs === -1) break;
				nl = this.buffer.indexOf("\n", cs);
			} while (nl !== -1);
			if (nl === -1) {
				if (!this.atEnd) return this.setNext("block-scalar");
				nl = this.buffer.length;
			}
		}
		let i = nl + 1;
		ch = this.buffer[i];
		while (ch === " ") ch = this.buffer[++i];
		if (ch === "	") {
			while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
			nl = i - 1;
		} else if (!this.blockScalarKeep) do {
			let i = nl - 1;
			let ch = this.buffer[i];
			if (ch === "\r") ch = this.buffer[--i];
			const lastChar = i;
			while (ch === " ") ch = this.buffer[--i];
			if (ch === "\n" && i >= this.pos && i + 1 + indent > lastChar) nl = i;
			else break;
		} while (true);
		yield "";
		yield* this.pushToIndex(nl + 1, true);
		return yield* this.parseLineStart();
	}
	*parsePlainScalar() {
		const inFlow = this.flowLevel > 0;
		let end = this.pos - 1;
		let i = this.pos - 1;
		let ch;
		while (ch = this.buffer[++i]) if (ch === ":") {
			const next = this.buffer[i + 1];
			if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
			end = i;
		} else if (isEmpty(ch)) {
			let next = this.buffer[i + 1];
			if (ch === "\r") {
				if (next === "\n") {
					i += 1;
					ch = "\n";
					next = this.buffer[i + 1];
				} else end = i;
			}
			if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
			if (ch === "\n") {
				const cs = this.continueScalar(i + 1);
				if (cs === -1) break;
				i = Math.max(i, cs - 2);
			}
		} else {
			if (inFlow && flowIndicatorChars.has(ch)) break;
			end = i;
		}
		if (!ch && !this.atEnd) return this.setNext("plain-scalar");
		yield "";
		yield* this.pushToIndex(end + 1, true);
		return inFlow ? "flow" : "doc";
	}
	*pushCount(n) {
		if (n > 0) {
			yield this.buffer.substr(this.pos, n);
			this.pos += n;
			return n;
		}
		return 0;
	}
	*pushToIndex(i, allowEmpty) {
		const s = this.buffer.slice(this.pos, i);
		if (s) {
			yield s;
			this.pos += s.length;
			return s.length;
		} else if (allowEmpty) yield "";
		return 0;
	}
	*pushIndicators() {
		let n = 0;
		loop: while (true) {
			switch (this.charAt(0)) {
				case "!":
					n += yield* this.pushTag();
					n += yield* this.pushSpaces(true);
					continue loop;
				case "&":
					n += yield* this.pushUntil(isNotAnchorChar);
					n += yield* this.pushSpaces(true);
					continue loop;
				case "-":
				case "?":
				case ":": {
					const inFlow = this.flowLevel > 0;
					const ch1 = this.charAt(1);
					if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
						if (!inFlow) this.indentNext = this.indentValue + 1;
						else if (this.flowKey) this.flowKey = false;
						n += yield* this.pushCount(1);
						n += yield* this.pushSpaces(true);
						continue loop;
					}
				}
			}
			break loop;
		}
		return n;
	}
	*pushTag() {
		if (this.charAt(1) === "<") {
			let i = this.pos + 2;
			let ch = this.buffer[i];
			while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
			return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
		} else {
			let i = this.pos + 1;
			let ch = this.buffer[i];
			while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
			else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
			else break;
			return yield* this.pushToIndex(i, false);
		}
	}
	*pushNewline() {
		const ch = this.buffer[this.pos];
		if (ch === "\n") return yield* this.pushCount(1);
		else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
		else return 0;
	}
	*pushSpaces(allowTabs) {
		let i = this.pos - 1;
		let ch;
		do
			ch = this.buffer[++i];
		while (ch === " " || allowTabs && ch === "	");
		const n = i - this.pos;
		if (n > 0) {
			yield this.buffer.substr(this.pos, n);
			this.pos = i;
		}
		return n;
	}
	*pushUntil(test) {
		let i = this.pos;
		let ch = this.buffer[i];
		while (!test(ch)) ch = this.buffer[++i];
		return yield* this.pushToIndex(i, false);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/line-counter.js
/**
* Tracks newlines during parsing in order to provide an efficient API for
* determining the one-indexed `{ line, col }` position for any offset
* within the input.
*/
var LineCounter = class {
	constructor() {
		this.lineStarts = [];
		/**
		* Should be called in ascending order. Otherwise, call
		* `lineCounter.lineStarts.sort()` before calling `linePos()`.
		*/
		this.addNewLine = (offset) => this.lineStarts.push(offset);
		/**
		* Performs a binary search and returns the 1-indexed { line, col }
		* position of `offset`. If `line === 0`, `addNewLine` has never been
		* called or `offset` is before the first known newline.
		*/
		this.linePos = (offset) => {
			let low = 0;
			let high = this.lineStarts.length;
			while (low < high) {
				const mid = low + high >> 1;
				if (this.lineStarts[mid] < offset) low = mid + 1;
				else high = mid;
			}
			if (this.lineStarts[low] === offset) return {
				line: low + 1,
				col: 1
			};
			if (low === 0) return {
				line: 0,
				col: offset
			};
			const start = this.lineStarts[low - 1];
			return {
				line: low,
				col: offset - start + 1
			};
		};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list, type) {
	for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
	return false;
}
function findNonEmptyIndex(list) {
	for (let i = 0; i < list.length; ++i) switch (list[i].type) {
		case "space":
		case "comment":
		case "newline": break;
		default: return i;
	}
	return -1;
}
function isFlowToken(token) {
	switch (token?.type) {
		case "alias":
		case "scalar":
		case "single-quoted-scalar":
		case "double-quoted-scalar":
		case "flow-collection": return true;
		default: return false;
	}
}
function getPrevProps(parent) {
	switch (parent.type) {
		case "document": return parent.start;
		case "block-map": {
			const it = parent.items[parent.items.length - 1];
			return it.sep ?? it.start;
		}
		case "block-seq": return parent.items[parent.items.length - 1].start;
		/* istanbul ignore next should not happen */
		default: return [];
	}
}
/** Note: May modify input array */
function getFirstKeyStartProps(prev) {
	if (prev.length === 0) return [];
	let i = prev.length;
	loop: while (--i >= 0) switch (prev[i].type) {
		case "doc-start":
		case "explicit-key-ind":
		case "map-value-ind":
		case "seq-item-ind":
		case "newline": break loop;
	}
	while (prev[++i]?.type === "space");
	return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
	if (source.length < 1e5) Array.prototype.push.apply(target, source);
	else for (let i = 0; i < source.length; ++i) target.push(source[i]);
}
function fixFlowSeqItems(fc) {
	if (fc.start.type === "flow-seq-start") {
		for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
			if (it.key) it.value = it.key;
			delete it.key;
			if (isFlowToken(it.value)) {
				if (it.value.end) arrayPushArray(it.value.end, it.sep);
				else it.value.end = it.sep;
			} else arrayPushArray(it.start, it.sep);
			delete it.sep;
		}
	}
}
/**
* A YAML concrete syntax tree (CST) parser
*
* ```ts
* const src: string = ...
* for (const token of new Parser().parse(src)) {
*   // token: Token
* }
* ```
*
* To use the parser with a user-provided lexer:
*
* ```ts
* function* parse(source: string, lexer: Lexer) {
*   const parser = new Parser()
*   for (const lexeme of lexer.lex(source))
*     yield* parser.next(lexeme)
*   yield* parser.end()
* }
*
* const src: string = ...
* const lexer = new Lexer()
* for (const token of parse(src, lexer)) {
*   // token: Token
* }
* ```
*/
var Parser = class {
	/**
	* @param onNewLine - If defined, called separately with the start position of
	*   each new line (in `parse()`, including the start of input).
	*/
	constructor(onNewLine) {
		/** If true, space and sequence indicators count as indentation */
		this.atNewLine = true;
		/** If true, next token is a scalar value */
		this.atScalar = false;
		/** Current indentation level */
		this.indent = 0;
		/** Current offset since the start of parsing */
		this.offset = 0;
		/** On the same line with a block map key */
		this.onKeyLine = false;
		/** Top indicates the node that's currently being built */
		this.stack = [];
		/** The source of the current token, set in parse() */
		this.source = "";
		/** The type of the current token, set in parse() */
		this.type = "";
		this.lexer = new Lexer();
		this.onNewLine = onNewLine;
	}
	/**
	* Parse `source` as a YAML stream.
	* If `incomplete`, a part of the last line may be left as a buffer for the next call.
	*
	* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
	*
	* @returns A generator of tokens representing each directive, document, and other structure.
	*/
	*parse(source, incomplete = false) {
		if (this.onNewLine && this.offset === 0) this.onNewLine(0);
		for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
		if (!incomplete) yield* this.end();
	}
	/**
	* Advance the parser by the `source` of one lexical token.
	*/
	*next(source) {
		this.source = source;
		if (this.atScalar) {
			this.atScalar = false;
			yield* this.step();
			this.offset += source.length;
			return;
		}
		const type = tokenType(source);
		if (!type) {
			const message = `Not a YAML token: ${source}`;
			yield* this.pop({
				type: "error",
				offset: this.offset,
				message,
				source
			});
			this.offset += source.length;
		} else if (type === "scalar") {
			this.atNewLine = false;
			this.atScalar = true;
			this.type = "scalar";
		} else {
			this.type = type;
			yield* this.step();
			switch (type) {
				case "newline":
					this.atNewLine = true;
					this.indent = 0;
					if (this.onNewLine) this.onNewLine(this.offset + source.length);
					break;
				case "space":
					if (this.atNewLine && source[0] === " ") this.indent += source.length;
					break;
				case "explicit-key-ind":
				case "map-value-ind":
				case "seq-item-ind":
					if (this.atNewLine) this.indent += source.length;
					break;
				case "doc-mode":
				case "flow-error-end": return;
				default: this.atNewLine = false;
			}
			this.offset += source.length;
		}
	}
	/** Call at end of input to push out any remaining constructions */
	*end() {
		while (this.stack.length > 0) yield* this.pop();
	}
	get sourceToken() {
		return {
			type: this.type,
			offset: this.offset,
			indent: this.indent,
			source: this.source
		};
	}
	*step() {
		const top = this.peek(1);
		if (this.type === "doc-end" && top?.type !== "doc-end") {
			while (this.stack.length > 0) yield* this.pop();
			this.stack.push({
				type: "doc-end",
				offset: this.offset,
				source: this.source
			});
			return;
		}
		if (!top) return yield* this.stream();
		switch (top.type) {
			case "document": return yield* this.document(top);
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar": return yield* this.scalar(top);
			case "block-scalar": return yield* this.blockScalar(top);
			case "block-map": return yield* this.blockMap(top);
			case "block-seq": return yield* this.blockSequence(top);
			case "flow-collection": return yield* this.flowCollection(top);
			case "doc-end": return yield* this.documentEnd(top);
		}
		/* istanbul ignore next should not happen */
		yield* this.pop();
	}
	peek(n) {
		return this.stack[this.stack.length - n];
	}
	*pop(error) {
		const token = error ?? this.stack.pop();
		/* istanbul ignore if should not happen */
		if (!token) yield {
			type: "error",
			offset: this.offset,
			source: "",
			message: "Tried to pop an empty stack"
		};
		else if (this.stack.length === 0) yield token;
		else {
			const top = this.peek(1);
			if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
			else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
			if (token.type === "flow-collection") fixFlowSeqItems(token);
			switch (top.type) {
				case "document":
					top.value = token;
					break;
				case "block-scalar":
					top.props.push(token);
					break;
				case "block-map": {
					const it = top.items[top.items.length - 1];
					if (it.value) {
						top.items.push({
							start: [],
							key: token,
							sep: []
						});
						this.onKeyLine = true;
						return;
					} else if (it.sep) it.value = token;
					else {
						Object.assign(it, {
							key: token,
							sep: []
						});
						this.onKeyLine = !it.explicitKey;
						return;
					}
					break;
				}
				case "block-seq": {
					const it = top.items[top.items.length - 1];
					if (it.value) top.items.push({
						start: [],
						value: token
					});
					else it.value = token;
					break;
				}
				case "flow-collection": {
					const it = top.items[top.items.length - 1];
					if (!it || it.value) top.items.push({
						start: [],
						key: token,
						sep: []
					});
					else if (it.sep) it.value = token;
					else Object.assign(it, {
						key: token,
						sep: []
					});
					return;
				}
				/* istanbul ignore next should not happen */
				default:
					yield* this.pop();
					yield* this.pop(token);
			}
			if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
				const last = token.items[token.items.length - 1];
				if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
					if (top.type === "document") top.end = last.start;
					else top.items.push({ start: last.start });
					token.items.splice(-1, 1);
				}
			}
		}
	}
	*stream() {
		switch (this.type) {
			case "directive-line":
				yield {
					type: "directive",
					offset: this.offset,
					source: this.source
				};
				return;
			case "byte-order-mark":
			case "space":
			case "comment":
			case "newline":
				yield this.sourceToken;
				return;
			case "doc-mode":
			case "doc-start": {
				const doc = {
					type: "document",
					offset: this.offset,
					start: []
				};
				if (this.type === "doc-start") doc.start.push(this.sourceToken);
				this.stack.push(doc);
				return;
			}
		}
		yield {
			type: "error",
			offset: this.offset,
			message: `Unexpected ${this.type} token in YAML stream`,
			source: this.source
		};
	}
	*document(doc) {
		if (doc.value) return yield* this.lineEnd(doc);
		switch (this.type) {
			case "doc-start":
				if (findNonEmptyIndex(doc.start) !== -1) {
					yield* this.pop();
					yield* this.step();
				} else doc.start.push(this.sourceToken);
				return;
			case "anchor":
			case "tag":
			case "space":
			case "comment":
			case "newline":
				doc.start.push(this.sourceToken);
				return;
		}
		const bv = this.startBlockValue(doc);
		if (bv) this.stack.push(bv);
		else yield {
			type: "error",
			offset: this.offset,
			message: `Unexpected ${this.type} token in YAML document`,
			source: this.source
		};
	}
	*scalar(scalar) {
		if (this.type === "map-value-ind") {
			const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
			let sep;
			if (scalar.end) {
				sep = scalar.end;
				sep.push(this.sourceToken);
				delete scalar.end;
			} else sep = [this.sourceToken];
			const map = {
				type: "block-map",
				offset: scalar.offset,
				indent: scalar.indent,
				items: [{
					start,
					key: scalar,
					sep
				}]
			};
			this.onKeyLine = true;
			this.stack[this.stack.length - 1] = map;
		} else yield* this.lineEnd(scalar);
	}
	*blockScalar(scalar) {
		switch (this.type) {
			case "space":
			case "comment":
			case "newline":
				scalar.props.push(this.sourceToken);
				return;
			case "scalar":
				scalar.source = this.source;
				this.atNewLine = true;
				this.indent = 0;
				if (this.onNewLine) {
					let nl = this.source.indexOf("\n") + 1;
					while (nl !== 0) {
						this.onNewLine(this.offset + nl);
						nl = this.source.indexOf("\n", nl) + 1;
					}
				}
				yield* this.pop();
				break;
			/* istanbul ignore next should not happen */
			default:
				yield* this.pop();
				yield* this.step();
		}
	}
	*blockMap(map) {
		const it = map.items[map.items.length - 1];
		switch (this.type) {
			case "newline":
				this.onKeyLine = false;
				if (it.value) {
					const end = "end" in it.value ? it.value.end : void 0;
					if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
					else map.items.push({ start: [this.sourceToken] });
				} else if (it.sep) it.sep.push(this.sourceToken);
				else it.start.push(this.sourceToken);
				return;
			case "space":
			case "comment":
				if (it.value) map.items.push({ start: [this.sourceToken] });
				else if (it.sep) it.sep.push(this.sourceToken);
				else {
					if (this.atIndentedComment(it.start, map.indent)) {
						const end = map.items[map.items.length - 2]?.value?.end;
						if (Array.isArray(end)) {
							arrayPushArray(end, it.start);
							end.push(this.sourceToken);
							map.items.pop();
							return;
						}
					}
					it.start.push(this.sourceToken);
				}
				return;
		}
		if (this.indent >= map.indent) {
			const atMapIndent = !this.onKeyLine && this.indent === map.indent;
			const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
			let start = [];
			if (atNextItem && it.sep && !it.value) {
				const nl = [];
				for (let i = 0; i < it.sep.length; ++i) {
					const st = it.sep[i];
					switch (st.type) {
						case "newline":
							nl.push(i);
							break;
						case "space": break;
						case "comment":
							if (st.indent > map.indent) nl.length = 0;
							break;
						default: nl.length = 0;
					}
				}
				if (nl.length >= 2) start = it.sep.splice(nl[1]);
			}
			switch (this.type) {
				case "anchor":
				case "tag":
					if (atNextItem || it.value) {
						start.push(this.sourceToken);
						map.items.push({ start });
						this.onKeyLine = true;
					} else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "explicit-key-ind":
					if (!it.sep && !it.explicitKey) {
						it.start.push(this.sourceToken);
						it.explicitKey = true;
					} else if (atNextItem || it.value) {
						start.push(this.sourceToken);
						map.items.push({
							start,
							explicitKey: true
						});
					} else this.stack.push({
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start: [this.sourceToken],
							explicitKey: true
						}]
					});
					this.onKeyLine = true;
					return;
				case "map-value-ind":
					if (it.explicitKey) {
						if (!it.sep) {
							if (includesToken(it.start, "newline")) Object.assign(it, {
								key: null,
								sep: [this.sourceToken]
							});
							else {
								const start = getFirstKeyStartProps(it.start);
								this.stack.push({
									type: "block-map",
									offset: this.offset,
									indent: this.indent,
									items: [{
										start,
										key: null,
										sep: [this.sourceToken]
									}]
								});
							}
						} else if (it.value) map.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start,
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
							const start = getFirstKeyStartProps(it.start);
							const key = it.key;
							const sep = it.sep;
							sep.push(this.sourceToken);
							delete it.key;
							delete it.sep;
							this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start,
									key,
									sep
								}]
							});
						} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
						else it.sep.push(this.sourceToken);
					} else if (!it.sep) Object.assign(it, {
						key: null,
						sep: [this.sourceToken]
					});
					else if (it.value || atNextItem) map.items.push({
						start,
						key: null,
						sep: [this.sourceToken]
					});
					else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start: [],
							key: null,
							sep: [this.sourceToken]
						}]
					});
					else it.sep.push(this.sourceToken);
					this.onKeyLine = true;
					return;
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": {
					const fs = this.flowScalar(this.type);
					if (atNextItem || it.value) {
						map.items.push({
							start,
							key: fs,
							sep: []
						});
						this.onKeyLine = true;
					} else if (it.sep) this.stack.push(fs);
					else {
						Object.assign(it, {
							key: fs,
							sep: []
						});
						this.onKeyLine = true;
					}
					return;
				}
				default: {
					const bv = this.startBlockValue(map);
					if (bv) {
						if (bv.type === "block-seq") {
							if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
								yield* this.pop({
									type: "error",
									offset: this.offset,
									message: "Unexpected block-seq-ind on same line with key",
									source: this.source
								});
								return;
							}
						} else if (atMapIndent) map.items.push({ start });
						this.stack.push(bv);
						return;
					}
				}
			}
		}
		yield* this.pop();
		yield* this.step();
	}
	*blockSequence(seq) {
		const it = seq.items[seq.items.length - 1];
		switch (this.type) {
			case "newline":
				if (it.value) {
					const end = "end" in it.value ? it.value.end : void 0;
					if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
					else seq.items.push({ start: [this.sourceToken] });
				} else it.start.push(this.sourceToken);
				return;
			case "space":
			case "comment":
				if (it.value) seq.items.push({ start: [this.sourceToken] });
				else {
					if (this.atIndentedComment(it.start, seq.indent)) {
						const end = seq.items[seq.items.length - 2]?.value?.end;
						if (Array.isArray(end)) {
							arrayPushArray(end, it.start);
							end.push(this.sourceToken);
							seq.items.pop();
							return;
						}
					}
					it.start.push(this.sourceToken);
				}
				return;
			case "anchor":
			case "tag":
				if (it.value || this.indent <= seq.indent) break;
				it.start.push(this.sourceToken);
				return;
			case "seq-item-ind":
				if (this.indent !== seq.indent) break;
				if (it.value || includesToken(it.start, "seq-item-ind")) seq.items.push({ start: [this.sourceToken] });
				else it.start.push(this.sourceToken);
				return;
		}
		if (this.indent > seq.indent) {
			const bv = this.startBlockValue(seq);
			if (bv) {
				this.stack.push(bv);
				return;
			}
		}
		yield* this.pop();
		yield* this.step();
	}
	*flowCollection(fc) {
		const it = fc.items[fc.items.length - 1];
		if (this.type === "flow-error-end") {
			let top;
			do {
				yield* this.pop();
				top = this.peek(1);
			} while (top?.type === "flow-collection");
		} else if (fc.end.length === 0) {
			switch (this.type) {
				case "comma":
				case "explicit-key-ind":
					if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
					else it.start.push(this.sourceToken);
					return;
				case "map-value-ind":
					if (!it || it.value) fc.items.push({
						start: [],
						key: null,
						sep: [this.sourceToken]
					});
					else if (it.sep) it.sep.push(this.sourceToken);
					else Object.assign(it, {
						key: null,
						sep: [this.sourceToken]
					});
					return;
				case "space":
				case "comment":
				case "newline":
				case "anchor":
				case "tag":
					if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
					else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": {
					const fs = this.flowScalar(this.type);
					if (!it || it.value) fc.items.push({
						start: [],
						key: fs,
						sep: []
					});
					else if (it.sep) this.stack.push(fs);
					else Object.assign(it, {
						key: fs,
						sep: []
					});
					return;
				}
				case "flow-map-end":
				case "flow-seq-end":
					fc.end.push(this.sourceToken);
					return;
			}
			const bv = this.startBlockValue(fc);
			/* istanbul ignore else should not happen */
			if (bv) this.stack.push(bv);
			else {
				yield* this.pop();
				yield* this.step();
			}
		} else {
			const parent = this.peek(2);
			if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
				yield* this.pop();
				yield* this.step();
			} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
				const start = getFirstKeyStartProps(getPrevProps(parent));
				fixFlowSeqItems(fc);
				const sep = fc.end.splice(1, fc.end.length);
				sep.push(this.sourceToken);
				const map = {
					type: "block-map",
					offset: fc.offset,
					indent: fc.indent,
					items: [{
						start,
						key: fc,
						sep
					}]
				};
				this.onKeyLine = true;
				this.stack[this.stack.length - 1] = map;
			} else yield* this.lineEnd(fc);
		}
	}
	flowScalar(type) {
		if (this.onNewLine) {
			let nl = this.source.indexOf("\n") + 1;
			while (nl !== 0) {
				this.onNewLine(this.offset + nl);
				nl = this.source.indexOf("\n", nl) + 1;
			}
		}
		return {
			type,
			offset: this.offset,
			indent: this.indent,
			source: this.source
		};
	}
	startBlockValue(parent) {
		switch (this.type) {
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar": return this.flowScalar(this.type);
			case "block-scalar-header": return {
				type: "block-scalar",
				offset: this.offset,
				indent: this.indent,
				props: [this.sourceToken],
				source: ""
			};
			case "flow-map-start":
			case "flow-seq-start": return {
				type: "flow-collection",
				offset: this.offset,
				indent: this.indent,
				start: this.sourceToken,
				items: [],
				end: []
			};
			case "seq-item-ind": return {
				type: "block-seq",
				offset: this.offset,
				indent: this.indent,
				items: [{ start: [this.sourceToken] }]
			};
			case "explicit-key-ind": {
				this.onKeyLine = true;
				const start = getFirstKeyStartProps(getPrevProps(parent));
				start.push(this.sourceToken);
				return {
					type: "block-map",
					offset: this.offset,
					indent: this.indent,
					items: [{
						start,
						explicitKey: true
					}]
				};
			}
			case "map-value-ind": {
				this.onKeyLine = true;
				const start = getFirstKeyStartProps(getPrevProps(parent));
				return {
					type: "block-map",
					offset: this.offset,
					indent: this.indent,
					items: [{
						start,
						key: null,
						sep: [this.sourceToken]
					}]
				};
			}
		}
		return null;
	}
	atIndentedComment(start, indent) {
		if (this.type !== "comment") return false;
		if (this.indent <= indent) return false;
		return start.every((st) => st.type === "newline" || st.type === "space");
	}
	*documentEnd(docEnd) {
		if (this.type !== "doc-mode") {
			if (docEnd.end) docEnd.end.push(this.sourceToken);
			else docEnd.end = [this.sourceToken];
			if (this.type === "newline") yield* this.pop();
		}
	}
	*lineEnd(token) {
		switch (this.type) {
			case "comma":
			case "doc-start":
			case "doc-end":
			case "flow-seq-end":
			case "flow-map-end":
			case "map-value-ind":
				yield* this.pop();
				yield* this.step();
				break;
			case "newline": this.onKeyLine = false;
			default:
				if (token.end) token.end.push(this.sourceToken);
				else token.end = [this.sourceToken];
				if (this.type === "newline") yield* this.pop();
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
	const prettyErrors = options.prettyErrors !== false;
	return {
		lineCounter: options.lineCounter || prettyErrors && new LineCounter() || null,
		prettyErrors
	};
}
/**
* Parse the input as a stream of YAML documents.
*
* Documents should be separated from each other by `...` or `---` marker lines.
*
* @returns If an empty `docs` array is returned, it will be of type
*   EmptyStream and contain additional stream information. In
*   TypeScript, you should use `'empty' in docs` as a type guard for it.
*/
function parseAllDocuments(source, options = {}) {
	const { lineCounter, prettyErrors } = parseOptions(options);
	const parser = new Parser(lineCounter?.addNewLine);
	const composer = new Composer(options);
	const docs = Array.from(composer.compose(parser.parse(source)));
	if (prettyErrors && lineCounter) for (const doc of docs) {
		doc.errors.forEach(prettifyError(source, lineCounter));
		doc.warnings.forEach(prettifyError(source, lineCounter));
	}
	if (docs.length > 0) return docs;
	return Object.assign([], { empty: true }, composer.streamInfo());
}
/** Parse an input string into a single YAML.Document */
function parseDocument(source, options = {}) {
	const { lineCounter, prettyErrors } = parseOptions(options);
	const parser = new Parser(lineCounter?.addNewLine);
	const composer = new Composer(options);
	let doc = null;
	for (const _doc of composer.compose(parser.parse(source), true, source.length)) if (!doc) doc = _doc;
	else if (doc.options.logLevel !== "silent") {
		doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
		break;
	}
	if (prettyErrors && lineCounter) {
		doc.errors.forEach(prettifyError(source, lineCounter));
		doc.warnings.forEach(prettifyError(source, lineCounter));
	}
	return doc;
}
function parse(src, reviver, options) {
	let _reviver = void 0;
	if (typeof reviver === "function") _reviver = reviver;
	else if (options === void 0 && reviver && typeof reviver === "object") options = reviver;
	const doc = parseDocument(src, options);
	if (!doc) return null;
	doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
	if (doc.errors.length > 0) {
		if (doc.options.logLevel !== "silent") throw doc.errors[0];
		else doc.errors = [];
	}
	return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
//#endregion
//#region ../../packages/core/dist/deploy/dockerignore.js
/** Go's path.Clean for `/`-separated paths. */
function dockerCleanPath(path) {
	if (path === "") return ".";
	const rooted = path.startsWith("/");
	const parts = [];
	for (const part of path.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
			else if (!rooted) parts.push("..");
			continue;
		}
		parts.push(part);
	}
	const joined = parts.join("/");
	if (rooted) return `/${joined}`;
	return joined === "" ? "." : joined;
}
var pass = (value) => ({
	ok: true,
	value
});
var refuse$2 = (reason) => ({
	ok: false,
	reason
});
/** C0 and C1 controls, and anything JavaScript counts as white space (NBSP, U+2028, U+3000...). */
function hasSpaceOrControl(text) {
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code < 32 || code >= 127 && code <= 159 || /\s/u.test(char)) return true;
	}
	return false;
}
/** A character as it can appear in a reason. */
function shown$1(char) {
	return char === "\"" ? `'"'` : `"${char}"`;
}
/**
* A Compose project name: lowercase letters, digits, dashes and underscores, starting with a
* letter or digit. The same rule keeps it safe as a folder name on the server.
*/
function validateStackName(input) {
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a name for the app.");
	if (input.length > 63) return refuse$2(`Keep the name to 63 characters or fewer.`);
	if (/[A-Z]/.test(input)) return refuse$2("Use lowercase letters. Compose project names can't have capitals.");
	if (!/^[a-z0-9]/.test(input)) return refuse$2("Start the name with a lowercase letter or a digit.");
	if (!/^[a-z0-9][a-z0-9_-]*$/.test(input)) return refuse$2("Use only lowercase letters, digits, dashes and underscores.");
	return pass(input);
}
var DOTTED_QUAD = /^[0-9]+(\.[0-9]+){3}$/;
/**
* A domain name, returned lowercased and in its ASCII form, so `bücher.de` comes back as
* `xn--bcher-kva.de`. International names are converted by the platform's URL parser, which
* applies IDNA mapping. That parser also quietly drops line breaks and tabs, decodes `%` escapes
* and lets `;`, braces and quotes through, so the input is checked before it sees it, and its
* output is checked again afterwards, since full-width punctuation maps to its ASCII twin.
*/
function validateDomain(input, options = {}) {
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a domain.");
	if (input.length > 1e3) return refuse$2("That is far too long to be a domain.");
	if (hasSpaceOrControl(input)) return refuse$2("A domain can't contain spaces or line breaks.");
	if (input.includes("/") || input.includes(":")) return refuse$2("Enter just the domain, without http://, a path or a port.");
	const stray = [...input].find((char) => char < "" && !/[A-Za-z0-9.*-]/.test(char));
	if (stray) return refuse$2(`${shown$1(stray)} isn't allowed in a domain. Use letters, digits, dots and hyphens.`);
	let name = input;
	let wildcard = "";
	if (input.includes("*")) {
		if (!options.allowWildcard) return refuse$2("Wildcards aren't allowed here.");
		if (!input.startsWith("*.") || input.slice(2).includes("*")) return refuse$2("A wildcard can only be the whole first part, as in *.example.com.");
		name = input.slice(2);
		wildcard = "*.";
	}
	if (DOTTED_QUAD.test(name)) return refuse$2("That's an IP address. Enter a domain name instead.");
	const ascii = [...name].some((char) => char > "") || /(^|\.)xn--/i.test(name) ? toAscii(name) : name.toLowerCase();
	if (ascii === null) return refuse$2("That isn't a valid international domain name.");
	const problem = domainProblem(ascii);
	return problem ? refuse$2(problem) : pass(wildcard + ascii);
}
function toAscii(name) {
	try {
		return new URL(`http://${name}/`).hostname;
	} catch {
		return null;
	}
}
/** The label rules, applied to the ASCII form (RFC 1035, RFC 1123, RFC 5891). */
function domainProblem(ascii) {
	if (DOTTED_QUAD.test(ascii)) return "That's an IP address. Enter a domain name instead.";
	if (ascii.endsWith(".")) return "Leave out the trailing dot.";
	if (ascii.startsWith(".")) return "A domain can't start with a dot.";
	const labels = ascii.split(".");
	if (labels.includes("")) return "A domain can't have two dots in a row.";
	if (labels.length < 2) return "Use a full domain, such as example.com.";
	if (ascii.length > 253) return "A domain can be at most 253 characters long, counting its ASCII form.";
	for (const label of labels) {
		if (!/^[a-z0-9-]+$/.test(label)) return "A domain can't contain punctuation other than dots and hyphens, in any width.";
		if (label.length > 63) return "Each part between the dots can be at most 63 characters long.";
		if (label.startsWith("-") || label.endsWith("-")) return "A part of a domain can't start or end with a hyphen.";
		if (label.slice(2, 4) === "--" && !label.startsWith("xn--")) return "Two hyphens in the third and fourth places are kept for international names (xn--).";
	}
	const tld = labels[labels.length - 1];
	if (!/^([a-z]{2,63}|xn--[a-z0-9-]+)$/.test(tld)) return "The last part of a domain is letters, like .com or .de.";
	return null;
}
/** A port from 1 to 65535, as a number or as decimal digits with no sign, spaces or leading zeros. */
function validatePort(input) {
	if (typeof input === "number") {
		if (!Number.isInteger(input)) return refuse$2("A port is a whole number from 1 to 65535.");
		return portInRange(input);
	}
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a port.");
	if (!/^[0-9]+$/.test(input)) return refuse$2("A port is a whole number from 1 to 65535.");
	if (input.length > 1 && input.startsWith("0")) return refuse$2("Leave out leading zeros.");
	if (input.length > 5) return refuse$2("Ports go from 1 to 65535.");
	return portInRange(Number(input));
}
function portInRange(port) {
	return port >= 1 && port <= 65535 ? pass(port) : refuse$2("Ports go from 1 to 65535.");
}
/** `8000-8010`, or a single port as a range of one. */
function validatePortRange(input) {
	if (typeof input === "number") {
		const port = validatePort(input);
		return port.ok ? pass({
			start: port.value,
			end: port.value
		}) : port;
	}
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a port or a range.");
	const parts = input.split("-");
	if (parts.length > 2) return refuse$2("A range has one dash, as in 8000-8010.");
	const start = validatePort(parts[0]);
	if (!start.ok) return start;
	const end = parts.length === 2 ? validatePort(parts[1]) : start;
	if (!end.ok) return end;
	if (start.value > end.value) return refuse$2("The first port of a range can't be higher than the last.");
	return pass({
		start: start.value,
		end: end.value
	});
}
/**
* An IPv4 or IPv6 address. IPv4 must be four plain decimal numbers (`010` is octal to some tools,
* so leading zeros are refused); IPv6 comes back in its canonical short form, without brackets
* or a zone.
*/
function validateIpAddress(input, options = {}) {
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter an IP address.");
	if (hasSpaceOrControl(input)) return refuse$2("An IP address can't contain spaces or line breaks.");
	const v6 = input.includes(":") || input.startsWith("[");
	if (options.version === 4 && v6) return refuse$2("Enter an IPv4 address, such as 192.0.2.10.");
	if (options.version === 6 && !v6) return refuse$2("Enter an IPv6 address, such as 2001:db8::10.");
	if (v6) {
		const groups = parseIpv6(input);
		return typeof groups === "string" ? refuse$2(groups) : pass({
			address: formatIpv6(groups),
			version: 6
		});
	}
	const octets = parseIpv4(input);
	return typeof octets === "string" ? refuse$2(octets) : pass({
		address: octets.join("."),
		version: 4
	});
}
function parseIpv4(input) {
	const parts = input.split(".");
	const shape = "An IPv4 address is four numbers from 0 to 255, separated by dots.";
	if (parts.length !== 4) return shape;
	const octets = [];
	for (const part of parts) {
		if (!/^[0-9]{1,3}$/.test(part)) return shape;
		if (part.length > 1 && part.startsWith("0")) return "Leave out leading zeros. Some tools read 010 as octal, which makes the address ambiguous.";
		const octet = Number(part);
		if (octet > 255) return "Each number in an IPv4 address goes from 0 to 255.";
		octets.push(octet);
	}
	return octets;
}
/** The eight 16-bit groups of an IPv6 address, or why it is not one. */
function parseIpv6(input) {
	const invalid = "That isn't a valid IPv6 address.";
	if (input.includes("%")) return "Leave out the zone (the part after %). It can't be used here.";
	if (input.includes("[") || input.includes("]")) return "Leave out the square brackets.";
	if (!/^[0-9A-Fa-f:.]+$/.test(input)) return invalid;
	const halves = input.split("::");
	if (halves.length > 2) return invalid;
	if (halves.length === 1) {
		const groups = ipv6Groups(halves[0], true);
		return groups?.length === 8 ? groups : invalid;
	}
	const left = ipv6Groups(halves[0], false);
	const right = ipv6Groups(halves[1], true);
	if (!left || !right) return invalid;
	const zeros = 8 - left.length - right.length;
	if (zeros < 1) return invalid;
	return [
		...left,
		...Array.from({ length: zeros }, () => 0),
		...right
	];
}
/** Colon-separated groups; an embedded IPv4 address may only be the very last part. */
function ipv6Groups(side, allowIpv4) {
	if (side === "") return [];
	const parts = side.split(":");
	const groups = [];
	for (const [index, part] of parts.entries()) {
		if (allowIpv4 && index === parts.length - 1 && part.includes(".")) {
			const octets = parseIpv4(part);
			if (typeof octets === "string") return null;
			groups.push(octets[0] * 256 + octets[1], octets[2] * 256 + octets[3]);
			continue;
		}
		if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return null;
		groups.push(Number.parseInt(part, 16));
	}
	return groups;
}
/** RFC 5952: lowercase, no leading zeros, the longest run of two or more zero groups as `::`. */
function formatIpv6(groups) {
	if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 65535) {
		const [high, low] = [groups[6], groups[7]];
		return `::ffff:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
	}
	let bestStart = -1;
	let bestLength = 1;
	for (let start = 0; start < 8;) {
		if (groups[start] !== 0) {
			start++;
			continue;
		}
		let end = start;
		while (end < 8 && groups[end] === 0) end++;
		if (end - start > bestLength) {
			bestStart = start;
			bestLength = end - start;
		}
		start = end;
	}
	const hex = groups.map((group) => group.toString(16));
	if (bestStart < 0) return hex.join(":");
	return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
}
/**
* A network in CIDR notation. Host bits must be clear: `10.0.0.5/24` is refused with the network
* that was probably meant, since firewalls and nginx would otherwise each guess differently.
*/
function validateCidr(input) {
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a network, such as 10.0.0.0/8.");
	const parts = input.split("/");
	if (parts.length === 1) return refuse$2("Add a / and a prefix length, as in 10.0.0.0/8.");
	if (parts.length > 2) return refuse$2("A network has one /, as in 10.0.0.0/8.");
	const address = validateIpAddress(parts[0]);
	if (!address.ok) return address;
	const { version } = address.value;
	const max = version === 4 ? 32 : 128;
	if (!/^(0|[1-9][0-9]{0,2})$/.test(parts[1]) || Number(parts[1]) > max) return refuse$2(`The prefix length is a number from 0 to ${max}.`);
	const prefix = Number(parts[1]);
	const network = maskAddress(address.value, prefix);
	if (network !== address.value.address) return refuse$2(`${address.value.address}/${prefix} has bits set past the prefix. The network is ${network}/${prefix}.`);
	return pass({
		network,
		prefix,
		version,
		value: `${network}/${prefix}`
	});
}
/** A CIDR network, or a bare address taken as a network of one host (/32 or /128). */
function validateIpOrCidr(input) {
	if (typeof input === "string" && input.includes("/")) return validateCidr(input);
	const address = validateIpAddress(input);
	if (!address.ok) return address;
	const { version } = address.value;
	const prefix = version === 4 ? 32 : 128;
	const network = address.value.address;
	return pass({
		network,
		prefix,
		version,
		value: `${network}/${prefix}`
	});
}
function maskAddress(address, prefix) {
	if (address.version === 4) return address.address.split(".").map(Number).map((octet, index) => octet & bitMask(prefix - index * 8, 8)).join(".");
	return formatIpv6(parseIpv6(address.address).map((group, index) => group & bitMask(prefix - index * 16, 16)));
}
/** The mask for one part of `width` bits when `bits` of it fall inside the prefix. */
function bitMask(bits, width) {
	const kept = Math.max(0, Math.min(width, bits));
	return (1 << width) - 1 & ~((1 << width - kept) - 1);
}
/**
* An environment variable name: a letter or underscore, then letters, digits, underscores, dots
* or dashes. That is what the Environments tab reads and what Compose's .env parser accepts;
* only names without dots or dashes can also be used as `${NAME}` in a compose file.
*/
function validateEnvKey(input) {
	if (typeof input !== "string" || input.length === 0) return refuse$2("Enter a key.");
	if (input.length > 255) return refuse$2(`Keep keys to 255 characters or fewer.`);
	if (!/^[A-Za-z_]/.test(input)) return refuse$2("Start a key with a letter or an underscore.");
	if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(input)) return refuse$2("Use only letters, digits, underscores, dots and dashes in a key.");
	return pass(input);
}
//#endregion
//#region ../../packages/core/dist/deploy/compose/ports.js
/** One entry may not fan out into more bindings than this. */
var MAX_PORTS_PER_ENTRY = 1e3;
var PROTOCOLS = /* @__PURE__ */ new Set([
	"tcp",
	"udp",
	"sctp"
]);
var UNRESOLVED = "uses ${...}, which only has a value once the environment is known.";
function shown(entry) {
	const text = JSON.stringify(entry) ?? String(entry);
	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
function exposureOf(hostIp) {
	if (hostIp === null || hostIp === "0.0.0.0" || hostIp === "::") return "all-interfaces";
	if (hostIp.startsWith("127.") || hostIp === "::1" || hostIp.startsWith("::ffff:127.")) return "loopback";
	return "specific";
}
/** A port or `start-end`, as nat.parsePortRange reads it, from 1 to 65535. */
function readRange(text) {
	const match = /^([0-9]+)(?:-([0-9]+))?$/.exec(text);
	if (!match) return `${JSON.stringify(text)} is not a port or a range of ports.`;
	const start = Number(match[1]);
	const end = match[2] === void 0 ? start : Number(match[2]);
	if (start < 1 || end < 1 || start > 65535 || end > 65535) return "Ports go from 1 to 65535.";
	if (end < start) return `The range ${text} runs backwards.`;
	return {
		start,
		end
	};
}
function readHostIp(raw) {
	const bracketed = raw.startsWith("[");
	if (bracketed && !raw.endsWith("]")) return { problem: `has the host address ${raw}, which isn't an IP address Docker can read.` };
	const address = validateIpAddress(bracketed ? raw.slice(1, -1) : raw);
	return address.ok ? address.value.address : { problem: `has the host address ${raw}, which isn't an IP address: ${address.reason}` };
}
function readProtocol(raw) {
	const protocol = raw === "" ? "tcp" : raw.toLowerCase();
	return PROTOCOLS.has(protocol) ? protocol : null;
}
function spec(target, published, hostIp, protocol, name = null, appProtocol = null) {
	return {
		hostIp,
		published,
		target,
		protocol,
		exposure: exposureOf(hostIp),
		name,
		appProtocol
	};
}
/** One entry of a service's `ports:` list, as the bindings Docker would create for it. */
function readComposePortEntry(entry, options = {}) {
	if (typeof entry === "number") return Number.isInteger(entry) && entry >= 1 && entry <= 65535 ? {
		ok: true,
		bindings: [spec(entry, null, null, "tcp")]
	} : {
		ok: false,
		reason: `${shown(entry)} is not a port.`
	};
	const interpolated = options.interpolated === true;
	const read = typeof entry === "string" ? readShort(entry, interpolated) : entry !== null && typeof entry === "object" && !Array.isArray(entry) ? readLong(entry, interpolated) : `${shown(entry)} is not a port mapping.`;
	return typeof read === "string" ? {
		ok: false,
		reason: read
	} : {
		ok: true,
		bindings: read
	};
}
function readShort(raw, interpolated) {
	if (!interpolated && raw.includes("$")) return `${shown(raw)} ${UNRESOLVED}`;
	const parts = raw.split(":");
	const count = parts.length;
	const ip = count > 2 ? parts.slice(0, count - 2).join(":") : "";
	const host = count > 1 ? parts[count - 2] : "";
	const slash = parts[count - 1].indexOf("/");
	const container = slash < 0 ? parts[count - 1] : parts[count - 1].slice(0, slash);
	if (container === "") return `${shown(raw)} has no container port.`;
	const protocol = readProtocol(slash < 0 ? "" : parts[count - 1].slice(slash + 1));
	if (!protocol) return `${shown(raw)} uses a protocol Docker cannot publish; use tcp, udp or sctp.`;
	let hostIp = null;
	if (ip !== "") {
		const read = readHostIp(ip);
		if (typeof read !== "string") return `${shown(raw)} ${read.problem}`;
		hostIp = read;
	}
	const targets = readRange(container);
	if (typeof targets === "string") return `${shown(raw)}: ${targets}`;
	let hosts = null;
	if (host !== "") {
		const read = readRange(host);
		if (typeof read === "string") return `${shown(raw)}: ${read}`;
		hosts = read;
	}
	const size = targets.end - targets.start + 1;
	if (hosts && hosts.end - hosts.start + 1 !== size && size !== 1) return `${shown(raw)}: the host and container ranges differ in size.`;
	if (size > 1e3) return `${shown(raw)} covers more than ${MAX_PORTS_PER_ENTRY} ports. Publish fewer, or use host networking on purpose.`;
	const bindings = [];
	for (let offset = 0; offset < size; offset++) {
		let published = null;
		if (hosts) published = size === 1 && hosts.start !== hosts.end ? `${hosts.start}-${hosts.end}` : String(hosts.start + offset);
		bindings.push(spec(targets.start + offset, published, hostIp, protocol));
	}
	return bindings;
}
function readLong(entry, interpolated) {
	const values = Object.values(entry);
	if (!interpolated && values.some((value) => typeof value === "string" && value.includes("$"))) return `${shown(entry)} ${UNRESOLVED}`;
	const { target, published, host_ip: rawIp, protocol: rawProtocol, name, app_protocol } = entry;
	let port;
	if (typeof target === "number" && Number.isInteger(target)) port = target;
	else if (typeof target === "string" && /^[0-9]+$/.test(target)) port = Number(target);
	else if (typeof target === "string" && target.includes("-")) return `${shown(entry)}: the long syntax takes one container port per entry.`;
	else return `${shown(entry)} has no target (container) port.`;
	if (port < 1 || port > 65535) return `${shown(entry)}: Ports go from 1 to 65535.`;
	let hostPort = null;
	if (typeof published === "number" || typeof published === "string" && published !== "") {
		const range = readRange(String(published));
		if (typeof range === "string") return `${shown(entry)}: ${range}`;
		hostPort = range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
	} else if (published !== void 0 && published !== null && published !== "") return `${shown(entry)} has a published port that is not a number.`;
	let hostIp = null;
	if (typeof rawIp === "string" && rawIp !== "") {
		const read = readHostIp(rawIp);
		if (typeof read !== "string") return `${shown(entry)} ${read.problem}`;
		hostIp = read;
	}
	const protocol = readProtocol(typeof rawProtocol === "string" ? rawProtocol : "");
	if (!protocol) return `${shown(entry)} uses a protocol Docker cannot publish; use tcp, udp or sctp.`;
	return [spec(port, hostPort, hostIp, protocol, typeof name === "string" ? name : null, typeof app_protocol === "string" ? app_protocol : null)];
}
/** The ports of every service in the project, in file order. */
function analyzeComposePorts(project) {
	return project.services.map(({ name, definition }) => {
		const result = {
			service: name,
			hostNetwork: definition.network_mode === "host",
			bindings: [],
			exposed: [],
			problems: []
		};
		const { ports, expose } = definition;
		if (Array.isArray(ports)) for (const [index, entry] of ports.entries()) {
			const read = readComposePortEntry(entry, { interpolated: project.interpolated });
			if (read.ok) result.bindings.push(...read.bindings.map((binding) => ({
				...binding,
				service: name,
				index
			})));
			else result.problems.push({
				index,
				reason: read.reason
			});
		}
		else if (ports !== void 0 && ports !== null) result.problems.push({
			index: -1,
			reason: `ports: of ${name} must be a list.`
		});
		if (Array.isArray(expose)) {
			for (const item of expose) if (typeof item === "string" || typeof item === "number") result.exposed.push(String(item));
		}
		return result;
	});
}
//#endregion
//#region ../../packages/core/dist/deploy/compose/lint.js
function risk(rule, severity, service, subject, message, advice) {
	return {
		id: subject === null ? `${rule}:${service ?? "-"}` : `${rule}:${service ?? "-"}:${subject}`,
		rule,
		severity,
		service,
		message,
		advice
	};
}
function isRecord$2(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
var asList = (value) => Array.isArray(value) ? value : value === void 0 ? [] : [value];
/** The checks that turn on one of the host's namespaces, in the order they are reported. */
var HOST_SETTINGS = [
	{
		key: "privileged",
		rule: "privileged",
		severity: "critical",
		message: (s) => `${s} runs privileged.`,
		advice: "A privileged container can do anything root can on the server: read every file, load kernel modules, reach every device. Grant only the capabilities it needs with cap_add instead."
	},
	{
		key: "pid",
		rule: "host-pid",
		severity: "critical",
		message: (s) => `${s} shares the server's process list (pid: host).`,
		advice: "It can see every process on the server and, as root, signal or trace them. Leave pid unset unless the tool truly needs it."
	},
	{
		key: "network_mode",
		rule: "host-network",
		severity: "high",
		message: (s) => `${s} uses the server's network directly (network_mode: host).`,
		advice: "Everything it listens on is reachable on all of the server's addresses, and neither the proxy nor a loopback binding can contain it. Publish the ports it needs instead."
	},
	{
		key: "ipc",
		rule: "host-ipc",
		severity: "high",
		message: (s) => `${s} shares the server's shared memory (ipc: host).`,
		advice: "It can read and disturb other processes' shared memory. Leave ipc unset."
	},
	{
		key: "userns_mode",
		rule: "host-userns",
		severity: "high",
		message: (s) => `${s} turns off user namespace remapping (userns_mode: host).`,
		advice: "Root in the container is then root on the server wherever the two meet. Leave userns_mode unset."
	},
	{
		key: "uts",
		rule: "host-uts",
		severity: "medium",
		message: (s) => `${s} shares the server's hostname (uts: host).`,
		advice: "It can change the server's hostname. Leave uts unset."
	},
	{
		key: "cgroup",
		rule: "host-cgroup",
		severity: "medium",
		message: (s) => `${s} uses the server's control groups (cgroup: host).`,
		advice: "It can see the server's control groups and the limits of other containers. Leave cgroup unset."
	}
];
/** Container runtime sockets, the folders that hold them, and /run, which holds them all. */
var SOCKET_PATHS = [
	"/run",
	"/var/run",
	"/run/docker.sock",
	"/var/run/docker.sock",
	"/run/docker",
	"/var/run/docker",
	"/run/containerd",
	"/var/run/containerd",
	"/run/podman",
	"/var/run/podman",
	"/run/crio",
	"/var/run/crio"
];
/** Where the AgentMate core keeps its binary, settings, data and socket. */
var CORE_PATHS = [
	"/var/lib/agentmate-core",
	"/etc/agentmate-core",
	"/opt/agentmate-core",
	"/run/agentmate-core"
];
/** System folders. A writable mount lets a container change the server; read-only, read secrets. */
var SENSITIVE_PATHS = [
	"/etc",
	"/proc",
	"/sys",
	"/dev",
	"/boot",
	"/root",
	"/home",
	"/usr",
	"/bin",
	"/sbin",
	"/lib",
	"/lib32",
	"/lib64",
	"/libx32",
	"/var/lib",
	"/var/log",
	"/var/spool"
];
/** Read-only mounts that images routinely ask for and that give nothing away. */
var HARMLESS_READ_ONLY = [
	"/etc/localtime",
	"/etc/timezone",
	"/usr/share/zoneinfo"
];
var within = (path, folder) => path === folder || path.startsWith(`${folder}/`);
/** What a host path reaches, worst first, or null when it is an ordinary folder. */
function classifyHostPath(source, readOnly) {
	if (source === "~" || source.startsWith("~/")) return {
		rule: "home-mount",
		severity: "high",
		path: source
	};
	if (!source.startsWith("/")) {
		const cleaned = dockerCleanPath(source);
		return cleaned === ".." || cleaned.startsWith("../") ? {
			rule: "outside-project",
			severity: "critical",
			path: cleaned
		} : null;
	}
	const path = dockerCleanPath(source);
	if (path === "/") return {
		rule: "host-root",
		severity: "critical",
		path
	};
	if (SOCKET_PATHS.some((socket) => within(path, socket))) return {
		rule: "docker-socket",
		severity: "critical",
		path
	};
	if (CORE_PATHS.some((core) => within(path, core) || within(core, path))) return {
		rule: "core-data",
		severity: "critical",
		path
	};
	if (readOnly && HARMLESS_READ_ONLY.some((harmless) => within(path, harmless))) return null;
	if (SENSITIVE_PATHS.some((folder) => within(path, folder))) return {
		rule: "sensitive-mount",
		severity: readOnly ? "high" : "critical",
		path
	};
	return null;
}
/** A named volume that the local driver turns into a bind mount of a host folder. */
function volumeDevice(data, name) {
	const volumes = data.volumes;
	if (!isRecord$2(volumes)) return null;
	const volume = volumes[name];
	if (!isRecord$2(volume) || !isRecord$2(volume.driver_opts)) return null;
	if (volume.driver !== void 0 && volume.driver !== "local") return null;
	const { o, device } = volume.driver_opts;
	if (typeof device !== "string" || !/(^|,)\s*r?bind\s*(,|$)/.test(String(o ?? ""))) return null;
	return device;
}
function serviceMounts(definition, data) {
	const mounts = [];
	const named = (name, readOnly) => {
		const device = volumeDevice(data, name);
		if (device) mounts.push({
			source: device,
			readOnly,
			labelled: true,
			volume: name
		});
	};
	for (const entry of asList(definition.volumes)) if (typeof entry === "string") {
		const parts = entry.split(":");
		if (parts.length < 2 || parts[0] === "") continue;
		const options = parts.length > 2 ? parts[2].split(",") : [];
		const readOnly = options.includes("ro");
		const source = parts[0];
		if (/^[/.~]/.test(source)) mounts.push({
			source,
			readOnly,
			labelled: options.includes("z") || options.includes("Z"),
			volume: null
		});
		else named(source, readOnly);
	} else if (isRecord$2(entry) && typeof entry.source === "string") {
		const readOnly = entry.read_only === true;
		if (entry.type === "bind") {
			const selinux = isRecord$2(entry.bind) ? entry.bind.selinux : void 0;
			mounts.push({
				source: entry.source,
				readOnly,
				labelled: selinux === "z" || selinux === "Z",
				volume: null
			});
		} else if (entry.type === "volume" || entry.type === void 0) named(entry.source, readOnly);
	}
	return mounts;
}
function mountRisk(service, mount) {
	const found = classifyHostPath(mount.source, mount.readOnly);
	if (!found) return null;
	const { rule, severity, path } = found;
	const through = mount.volume ? ` through the volume ${mount.volume}` : "";
	const [message, advice] = {
		"docker-socket": [`${service} mounts ${path}${through}, which reaches the Docker socket.`, "Whoever controls the container can then start a privileged one and take over the server. Read-only does not help, since the API is reached through the socket. Mount it only for tools you trust completely."],
		"host-root": [`${service} mounts the server's whole filesystem (/)${through}.`, "The container can read every file on the server, keys and passwords included, and change them unless the mount is read-only. Mount only the folders it needs."],
		"core-data": [`${service} mounts ${path}${through}, which holds AgentMate's own server files.`, "The core's database, keys and program live there, and a container that reaches them can take over the core. Mount a folder of the app's own instead."],
		"sensitive-mount": [`${service} mounts the server folder ${path}${mount.readOnly ? " read-only" : ""}${through}.`, mount.readOnly ? "Even read-only it can read the configuration and credentials kept there. Mount a narrower path, or copy what it needs into the project." : "A writable mount lets the container change the server itself. Mount a narrower path read-only, or copy what it needs into the project."],
		"outside-project": [`${service} mounts ${path}${through}, which leads outside the app's folder.`, "On the server the app's folder sits inside AgentMate's data, so a path with .. can reach the core's own files. Keep bind mounts inside the project."],
		"home-mount": [`${service} mounts ${path}${through} from a home folder.`, "On the server that is root's home, with its SSH keys. Use a path inside the project instead."]
	}[rule];
	return risk(rule, severity, service, path, message, advice);
}
/** The capabilities Docker grants every container anyway. */
var DEFAULT_CAPABILITIES = /* @__PURE__ */ new Set([
	"CHOWN",
	"DAC_OVERRIDE",
	"FSETID",
	"FOWNER",
	"MKNOD",
	"NET_RAW",
	"SETGID",
	"SETUID",
	"SETFCAP",
	"SETPCAP",
	"NET_BIND_SERVICE",
	"SYS_CHROOT",
	"KILL",
	"AUDIT_WRITE"
]);
/** Capabilities that are known ways out of a container. */
var ESCAPE_CAPABILITIES = /* @__PURE__ */ new Set([
	"ALL",
	"SYS_ADMIN",
	"SYS_MODULE",
	"SYS_RAWIO",
	"SYS_PTRACE",
	"SYS_BOOT",
	"DAC_READ_SEARCH",
	"MAC_ADMIN",
	"MAC_OVERRIDE",
	"BPF"
]);
/** Capabilities that change settings the whole server shares. */
var SERVER_CAPABILITIES = /* @__PURE__ */ new Set([
	"NET_ADMIN",
	"SYS_TIME",
	"SYSLOG",
	"SYS_RESOURCE",
	"LINUX_IMMUTABLE",
	"AUDIT_CONTROL",
	"AUDIT_READ",
	"IPC_OWNER",
	"WAKE_ALARM",
	"BLOCK_SUSPEND"
]);
function capabilityRisk(service, raw) {
	if (typeof raw !== "string" || raw === "") return null;
	const capability = raw.toUpperCase().replace(/^CAP_/, "");
	const message = capability === "ALL" ? `${service} adds every capability (cap_add: ALL).` : `${service} adds the capability ${capability}.`;
	if (ESCAPE_CAPABILITIES.has(capability)) return risk("cap-add", "critical", service, capability, message, "With it, root in the container can break out to the server. Remove it, or give the tool a server of its own.");
	if (SERVER_CAPABILITIES.has(capability)) return risk("cap-add", "high", service, capability, message, "It reaches past the container into settings the whole server shares. Keep it only if the service needs it.");
	if (DEFAULT_CAPABILITIES.has(capability)) return risk("cap-add", "low", service, capability, message, "Docker already grants it, so this line changes nothing and can go.");
	return risk("cap-add", "medium", service, capability, message, "Docker leaves it out by default for a reason. Keep it only if the service needs it.");
}
var UNCONFINED = {
	"seccomp=unconfined": ["turns off its system call filter (seccomp=unconfined)", "The filter blocks the kernel calls containers have no use for, which are the ones escapes rely on. Remove the option, or pass a custom profile."],
	"apparmor=unconfined": ["runs without an AppArmor profile (apparmor=unconfined)", "AppArmor keeps a compromised container away from the rest of the server. Remove the option."],
	"label=disable": ["turns off SELinux separation (label=disable)", "SELinux keeps a compromised container away from the rest of the server. Label its mounts with :z or :Z instead."],
	"label=type:spc_t": ["runs as a super privileged SELinux container (spc_t)", "That type is exempt from SELinux separation. Remove the option."],
	"systempaths=unconfined": ["can see all of /proc and /sys (systempaths=unconfined)", "Docker masks the parts of /proc and /sys that let a container change the kernel. Remove the option."]
};
/** `key:value` and `key=value` are the same option to Docker. */
function normalizeSecurityOption(option) {
	const separator = option.search(/[:=]/);
	return separator < 0 ? option : `${option.slice(0, separator)}=${option.slice(separator + 1)}`;
}
function portRisks(service, ports, proxied, add) {
	if (!proxied) for (const binding of ports.bindings) {
		if (binding.exposure === "loopback") continue;
		const where = binding.hostIp === null ? "every interface" : binding.hostIp;
		const as = binding.published === null ? "a port Docker picks" : `port ${binding.published}`;
		add(risk("public-port", "medium", service, `${binding.hostIp ?? "*"}:${binding.published ?? "any"}:${binding.target}/${binding.protocol}`, `${service} publishes ${binding.target}/${binding.protocol} on ${where} as ${as}.`, "Published ports skip the server's firewall. Put the service behind the proxy, which binds it to 127.0.0.1 only, or bind it to 127.0.0.1 yourself if nothing outside the server needs it."));
	}
	for (const problem of ports.problems) add(risk("unreadable-port", "medium", service, String(problem.index), `${service} has a port entry that could not be read. ${problem.reason}`, "Until it can be read there is no telling where it is published. Set the variables it uses, or write the port out."));
}
var REMOTE = /^([a-z][a-z0-9+.-]*:\/\/|git@|github\.com\/)/i;
var leavesProject = (path) => {
	if (path.startsWith("/") || path.startsWith("~")) return true;
	const cleaned = dockerCleanPath(path);
	return cleaned === ".." || cleaned.startsWith("../");
};
function fileRisks(service, definition, add) {
	for (const entry of asList(definition.env_file)) {
		const path = typeof entry === "string" ? entry : isRecord$2(entry) ? entry.path : void 0;
		if (typeof path === "string" && leavesProject(path)) add(risk("env-file-outside", "high", service, path, `${service} reads environment variables from ${path}.`, "That file is outside the project, so the container gets whatever it holds, such as the core's own settings. Keep env files in the project, or use the app's environment."));
	}
	const { extends: base } = definition;
	if (isRecord$2(base) && typeof base.file === "string") add(risk("extends-file", "medium", service, base.file, `${service} extends a service from ${base.file}.`, "Only the compose file, its .env and the build context are uploaded, so the server cannot read that file. Copy the service into this file."));
	const { build } = definition;
	const sources = [];
	if (typeof build === "string") sources.push(build);
	if (isRecord$2(build)) {
		if (typeof build.context === "string") sources.push(build.context);
		if (typeof build.dockerfile === "string") sources.push(build.dockerfile);
		if (isRecord$2(build.additional_contexts)) {
			for (const value of Object.values(build.additional_contexts)) if (typeof value === "string" && !/^(docker-image|oci-layout|service|target):/.test(value)) sources.push(value);
		}
	}
	for (const source of sources) if (REMOTE.test(source)) add(risk("remote-build", "medium", service, source, `${service} builds from ${source}.`, "The source is fetched at deploy time, so whoever controls it controls what runs. Build from the project instead."));
	else if (leavesProject(source)) add(risk("build-outside", "high", service, source, `${service} builds from ${source}, outside the project.`, "Docker would send that part of the server's disk to the builder. Keep the build context and Dockerfile inside the project."));
}
function imageRisks(service, definition, add) {
	const { image } = definition;
	if (typeof image === "string" && image !== "" && !image.includes("$") && !image.includes("@")) {
		const last = image.slice(image.lastIndexOf("/") + 1);
		const colon = last.lastIndexOf(":");
		const tag = colon < 0 ? null : last.slice(colon + 1);
		if (tag === null || tag === "latest") add(risk("latest-tag", "low", service, image, tag === null ? `${service} uses ${image} without a tag, so Docker pulls :latest.` : `${service} uses ${image}, which follows whatever was published last.`, "Each deploy may pull a different version, and a rollback cannot bring the old one back. Pin a version such as nginx:1.27, or a digest."));
	}
	const { restart, deploy } = definition;
	const policy = isRecord$2(deploy) && deploy.restart_policy !== void 0;
	if ((restart === void 0 || restart === "no") && !policy) add(risk("no-restart", "low", service, null, `${service} has no restart policy.`, "It stays down after a crash or a server reboot. Add restart: unless-stopped."));
	const { healthcheck } = definition;
	const test = isRecord$2(healthcheck) ? healthcheck.test : void 0;
	const none = Array.isArray(test) && test[0] === "NONE";
	if (!isRecord$2(healthcheck) || healthcheck.disable === true || none) add(risk("no-healthcheck", "low", service, null, `${service} has no healthcheck.`, "Unless its image defines one, a deploy cannot tell when the service is ready, and a hung service looks healthy. Add a healthcheck that tests what the service does."));
}
function lintService(service, definition, ports, data, options, add) {
	for (const setting of HOST_SETTINGS) {
		const value = definition[setting.key];
		if (setting.key === "privileged" ? value === true || value === "true" : value === "host") add(risk(setting.rule, setting.severity, service, null, setting.message(service), setting.advice));
	}
	for (const mount of serviceMounts(definition, data)) {
		const found = mountRisk(service, mount);
		if (found) add(found);
		if (options.selinux && mount.volume === null && !mount.labelled) {
			const path = dockerCleanPath(mount.source);
			add(risk("selinux-label", "low", service, path, `${service} bind-mounts ${path} without :z or :Z.`, "With SELinux enforcing, the container cannot read it. Add :z if other containers share the folder, or :Z if only this one uses it."));
		}
	}
	for (const capability of asList(definition.cap_add)) {
		const found = capabilityRisk(service, capability);
		if (found) add(found);
	}
	for (const device of asList(definition.devices)) {
		const path = typeof device === "string" ? device.split(":")[0] : isRecord$2(device) ? device.source : void 0;
		if (typeof path !== "string" || path === "") continue;
		add(risk("devices", "high", service, path, `${service} gets direct access to the device ${path}.`, "Through a device a container can often reach the kernel. Pass only the devices the service needs, such as one GPU."));
	}
	for (const rule of asList(definition.device_cgroup_rules)) {
		if (typeof rule !== "string") continue;
		add(risk("device-cgroup-rule", "high", service, rule, `${service} is allowed devices by the rule "${rule}".`, "Device rules let the container create and use device files. Remove the rule unless the service needs it."));
	}
	for (const option of asList(definition.security_opt)) {
		if (typeof option !== "string") continue;
		const normalized = normalizeSecurityOption(option);
		const found = UNCONFINED[normalized];
		if (found) add(risk("security-opt", "high", service, normalized, `${service} ${found[0]}.`, found[1]));
	}
	portRisks(service, ports, options.proxied, add);
	fileRisks(service, definition, add);
	imageRisks(service, definition, add);
}
function lintTopLevel(data, add) {
	for (const entry of asList(data.include)) {
		const paths = typeof entry === "string" ? [entry] : isRecord$2(entry) ? asList(entry.path) : [];
		for (const path of paths) {
			if (typeof path !== "string") continue;
			if (REMOTE.test(path) || path.startsWith("oci://")) add(risk("remote-include", "high", null, path, `The file includes ${path} from the network.`, "It is fetched at deploy time, so whoever controls it controls what runs. Copy it into this file."));
			else add(risk("include", "medium", null, path, `The file includes ${path}.`, "Only the compose file, its .env and the build context are uploaded, so the server cannot read included files. Merge it into this file."));
		}
	}
	for (const kind of ["secrets", "configs"]) {
		const section = data[kind];
		if (!isRecord$2(section)) continue;
		for (const [name, item] of Object.entries(section)) {
			if (!isRecord$2(item) || typeof item.file !== "string" || !leavesProject(item.file)) continue;
			const reach = classifyHostPath(item.file, true);
			add(risk("host-file", reach !== null && [
				"host-root",
				"docker-socket",
				"core-data"
			].includes(reach.rule) ? "critical" : "high", null, `${kind}.${name}:${item.file}`, `The ${kind === "secrets" ? "secret" : "config"} ${name} reads ${item.file} from the server.`, "Every container that uses it can read that file. Keep secret and config files inside the project."));
		}
	}
}
/** Every finding in the project, file-wide ones first, then service by service in file order. */
function lintComposeProject(project, options = {}) {
	const risks = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (found) => {
		if (seen.has(found.id)) return;
		seen.add(found.id);
		risks.push(found);
	};
	lintTopLevel(project.data, add);
	const proxied = new Set(options.proxiedServices ?? []);
	const ports = analyzeComposePorts(project);
	for (const [index, { name, definition }] of project.services.entries()) lintService(name, definition, ports[index], project.data, {
		proxied: proxied.has(name),
		selinux: options.selinuxEnforcing === true
	}, add);
	return risks;
}
/** The findings still waiting for an acknowledgment. */
function unacknowledgedRisks(risks, acknowledged) {
	const done = new Set(acknowledged);
	return risks.filter((found) => !done.has(found.id));
}
//#endregion
//#region ../../packages/core/dist/deploy/compose/interpolate.js
/**
* Variable substitution the way Docker Compose applies it to compose files (compose-go's
* template package): `$NAME` and `${NAME}`, the default forms `${NAME:-x}` and `${NAME-x}`,
* the presence forms `${NAME:+x}` and `${NAME+x}`, the required forms `${NAME:?message}` and
* `${NAME?message}`, defaults that hold variables of their own, and `$$` for a literal `$`.
* A `$` not followed by a name or a brace stays as it is; a broken `${...}` is an error, as it is
* for Compose. Names are case-insensitive letters, digits and underscores.
*/
var NAME = /^[_a-z][_a-z0-9]*/i;
/** What may sit between the braces. Compose's `(.*)` stops at a line break, so this does too. */
var BRACED = /^([_a-z][_a-z0-9]*)(?:(:?[-+?])([^\n]*))?$/i;
/** Defaults inside defaults deeper than this are refused rather than recursed into. */
var MAX_DEPTH = 50;
var TemplateError = class extends Error {};
/**
* Every string value in a parsed compose file, substituted. Keys are left as they are, as
* Compose leaves them, and so are numbers and booleans.
*/
function interpolateComposeTree(data, lookup) {
	const missing = /* @__PURE__ */ new Set();
	try {
		return {
			ok: true,
			value: walk$1(data, "", lookup, missing),
			missing: [...missing]
		};
	} catch (error) {
		if (error instanceof TemplateError) return {
			ok: false,
			reason: error.message
		};
		throw error;
	}
}
function walk$1(node, path, lookup, missing) {
	if (typeof node === "string") try {
		return substitute(node, lookup, missing, 0);
	} catch (error) {
		if (error instanceof TemplateError && path) throw new TemplateError(`${path}: ${error.message}`);
		throw error;
	}
	if (Array.isArray(node)) return node.map((item, index) => walk$1(item, `${path}[${index}]`, lookup, missing));
	if (node !== null && typeof node === "object") {
		const copy = {};
		for (const [key, value] of Object.entries(node)) Object.defineProperty(copy, key, {
			value: walk$1(value, path ? `${path}.${key}` : key, lookup, missing),
			enumerable: true,
			writable: true,
			configurable: true
		});
		return copy;
	}
	return node;
}
function substitute(template, lookup, missing, depth) {
	if (depth > MAX_DEPTH) throw new TemplateError("Defaults inside ${...} are nested too deeply.");
	let result = "";
	let at = 0;
	while (at < template.length) {
		const dollar = template.indexOf("$", at);
		if (dollar < 0) {
			result += template.slice(at);
			break;
		}
		result += template.slice(at, dollar);
		const next = template[dollar + 1];
		if (next === "$") {
			result += "$";
			at = dollar + 2;
			continue;
		}
		if (next === "{") {
			const close = closingBrace(template, dollar);
			const parts = close < 0 ? null : BRACED.exec(template.slice(dollar + 2, close));
			if (!parts) {
				const shown = template.slice(dollar, close < 0 ? dollar + 40 : close + 1);
				throw new TemplateError(`${JSON.stringify(shown)} isn't a valid \${...} expression.`);
			}
			result += braced(parts, lookup, missing, depth);
			at = close + 1;
			continue;
		}
		const named = NAME.exec(template.slice(dollar + 1));
		if (named) {
			const value = lookup(named[0]);
			if (value === void 0) missing.add(named[0]);
			result += value ?? "";
			at = dollar + 1 + named[0].length;
			continue;
		}
		result += "$";
		at = dollar + 1;
	}
	return result;
}
/**
* Where the `${` at `from` closes, counted the way compose-go's getFirstBraceClosingIndex counts,
* so a default may hold `${...}` of its own.
*/
function closingBrace(text, from) {
	let open = 0;
	for (let i = from; i < text.length; i++) {
		if (text[i] === "}") {
			open--;
			if (open === 0) return i;
		}
		if (text[i] === "{") {
			open++;
			i++;
		}
	}
	return -1;
}
function braced(parts, lookup, missing, depth) {
	const [, name, operator, rest = ""] = parts;
	const value = lookup(name);
	const inner = () => substitute(rest, lookup, missing, depth + 1);
	switch (operator) {
		case ":-": return value !== void 0 && value !== "" ? value : inner();
		case "-": return value !== void 0 ? value : inner();
		case ":+": return value !== void 0 && value !== "" ? inner() : value ?? "";
		case "+": return value !== void 0 ? inner() : "";
		case ":?":
			if (value === void 0 || value === "") throw required(name, inner());
			return value;
		case "?":
			if (value === void 0) throw required(name, inner());
			return value;
		default:
			if (value === void 0) missing.add(name);
			return value ?? "";
	}
}
function required(name, message) {
	return new TemplateError(message ? `${name} is required: ${message}` : `${name} is required.`);
}
//#endregion
//#region ../../packages/core/dist/deploy/compose/parse.js
/**
* Reads a compose file into plain data, the way Docker Compose would, without trusting it:
* one YAML document, at most 1 MB, aliases capped (so a few lines cannot expand into gigabytes),
* duplicate keys refused, merge keys (`<<`) followed, and no YAML tags other than Compose's own
* `!reset` (the value is dropped) and `!override` (read as a plain value). With an environment
* it also substitutes `${...}` the way Compose does; without one the values stay as written.
*
* `docker compose config` on the server stays the authority on whether a file is valid Compose.
* This reader is for what the app shows and decides before it sends anything: the services, the
* ports they publish, the risks they carry, and the loopback override.
*/
var MAX_COMPOSE_FILE_BYTES = 1048576;
/** How many alias expansions a file may need. Real compose files use a handful. */
var MAX_ALIAS_COUNT = 100;
var SERVICE_NAME = /^[a-zA-Z0-9._-]+$/;
var CORE_TAGS = new Set([
	"str",
	"int",
	"float",
	"bool",
	"null",
	"map",
	"seq"
].map(yamlTag));
function yamlTag(name) {
	return `tag:yaml.org,2002:${name}`;
}
var refuse$1 = (reason, line) => line === void 0 ? {
	ok: false,
	reason
} : {
	ok: false,
	reason,
	line
};
function isRecord$1(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** The first line of a YAML error, without the code frame that follows it. */
function firstLine(message) {
	return message.split("\n")[0].replace(/:$/, "");
}
function parseComposeFile(text, options = {}) {
	if (typeof text !== "string") return refuse$1("The compose file could not be read as text.");
	if (new TextEncoder().encode(text).length > 1048576) return refuse$1(`The compose file is larger than ${MAX_COMPOSE_FILE_BYTES / 1048576} MB.`);
	const lineCounter = new LineCounter();
	let documents;
	try {
		documents = parseAllDocuments(text, {
			lineCounter,
			merge: true,
			uniqueKeys: true
		});
	} catch (error) {
		if (error instanceof RangeError) return refuse$1("The compose file is nested too deeply to read.");
		throw error;
	}
	if (documents.length === 0 || documents.length === 1 && documents[0].contents === null) return refuse$1("The compose file is empty.");
	if (documents.length > 1) return refuse$1(`Put the whole compose file in one YAML document; this one has ${documents.length}.`);
	const [document] = documents;
	const lineOf = (node) => isNode(node) && node.range ? lineCounter.linePos(node.range[0]).line : void 0;
	const error = document.errors[0];
	if (error) return refuse$1(`The compose file is not valid YAML: ${firstLine(error.message)}.`, error.linePos?.[0].line);
	let problem = null;
	visit$1(document, {
		Pair(_, pair) {
			if (!isScalar(pair.key)) {
				problem = {
					reason: "The compose file uses a list or a map as a key.",
					line: lineOf(pair.key)
				};
				return visit$1.BREAK;
			}
		},
		Node(_, node) {
			const { tag } = node;
			if (tag === void 0 || tag === "!reset" || tag === "!override" || CORE_TAGS.has(tag)) return;
			problem = {
				reason: `The compose file uses the YAML tag ${tag.startsWith(yamlTag("")) ? `!!${tag.slice(yamlTag("").length)}` : tag}. Only !reset and !override mean anything to Compose.`,
				line: lineOf(node)
			};
			return visit$1.BREAK;
		}
	});
	if (problem) return refuse$1(problem.reason, problem.line);
	const warning = document.warnings.find((item) => item.code !== "TAG_RESOLVE_FAILED");
	if (warning) return refuse$1(`The compose file is not valid YAML: ${firstLine(warning.message)}.`, warning.linePos?.[0].line);
	visit$1(document, {
		Pair(_, pair) {
			if (isNode(pair.value) && pair.value.tag === "!reset") return visit$1.REMOVE;
		},
		Node(_, node, path) {
			if (node.tag === "!reset" && isSeq(path[path.length - 1])) return visit$1.REMOVE;
		}
	});
	let data;
	try {
		data = document.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
	} catch (error) {
		if (error instanceof ReferenceError && /alias/i.test(error.message)) return refuse$1("The compose file repeats YAML aliases so many times that reading it could exhaust memory.");
		if (error instanceof RangeError) return refuse$1("The compose file is nested too deeply to read.");
		throw error;
	}
	if (!isRecord$1(data)) return refuse$1("The top level of a compose file is a mapping, with services: under it.");
	let interpolated = false;
	let missingVariables = [];
	const { environment } = options;
	if (environment) {
		const result = interpolateComposeTree(data, (name) => Object.hasOwn(environment, name) ? environment[name] : void 0);
		if (!result.ok) return refuse$1(result.reason);
		if (!isRecord$1(result.value)) return refuse$1("The compose file could not be interpolated.");
		data = result.value;
		interpolated = true;
		missingVariables = result.missing;
	}
	const record = data;
	const services = [];
	const listed = record.services;
	if (listed !== void 0 && listed !== null) {
		if (!isRecord$1(listed)) return refuse$1("services: must be a mapping of service names to their settings.");
		for (const [name, definition] of Object.entries(listed)) {
			if (!SERVICE_NAME.test(name)) return refuse$1(`${JSON.stringify(name)} isn't a valid service name. Use letters, digits, dots, dashes and underscores.`);
			if (!isRecord$1(definition)) return refuse$1(`The service ${name} needs settings under it, such as image: or build:.`);
			services.push({
				name,
				definition
			});
		}
	}
	return {
		ok: true,
		project: {
			name: typeof record.name === "string" ? record.name : null,
			services,
			data: record,
			interpolated,
			missingVariables
		}
	};
}
//#endregion
//#region ../../packages/core/dist/env/dotenv.js
var ENVIRONMENT_KINDS = [
	"development",
	"test",
	"staging",
	"production",
	"custom"
];
var ENVIRONMENT_KIND_LABELS = {
	development: "Development",
	test: "Test",
	staging: "Staging",
	production: "Production",
	custom: "Custom"
};
/** The file name a new env file gets by default for each kind. */
var DEFAULT_ENV_FILE_NAMES = {
	development: ".env.development",
	test: ".env.test",
	staging: ".env.staging",
	production: ".env.production",
	custom: ".env"
};
/** Env files over this size are not something anyone keeps by hand, so they are refused. */
var MAX_ENV_FILE_BYTES = 1048576;
var KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
/**
* Reads a .env file the way dotenv and most frameworks do: `KEY=value` lines, `#` comments,
* an optional `export ` prefix, and single, double or backtick quoted values that may span
* lines. Lines that don't look like an assignment are skipped rather than rejected, since the
* point here is counting and listing keys, not refusing a file the project already uses.
*/
function parseDotenv(text) {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const entries = [];
	for (let index = 0; index < lines.length; index++) {
		const startLine = index + 1;
		let line = lines[index].trim();
		if (!line || line.startsWith("#")) continue;
		if (line.startsWith("export ")) line = line.slice(7).trimStart();
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		if (!KEY_PATTERN.test(key)) continue;
		let rest = line.slice(eq + 1).trimStart();
		const quote = rest[0];
		if (quote === "\"" || quote === "'" || quote === "`") {
			rest = rest.slice(1);
			let closing = findClosingQuote(rest, quote);
			while (closing < 0 && index + 1 < lines.length) {
				index++;
				rest += `\n${lines[index]}`;
				closing = findClosingQuote(rest, quote);
			}
			let value = closing < 0 ? rest : rest.slice(0, closing);
			if (quote === "\"") value = value.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
			entries.push({
				key,
				value,
				line: startLine
			});
			continue;
		}
		const comment = rest.search(/\s#/);
		const value = (comment >= 0 ? rest.slice(0, comment) : rest).trim();
		entries.push({
			key,
			value,
			line: startLine
		});
	}
	return entries;
}
function findClosingQuote(text, quote) {
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\\" && quote === "\"") {
			i++;
			continue;
		}
		if (text[i] === quote) return i;
	}
	return -1;
}
/** Number of distinct keys in a .env file. A key set twice counts once, like dotenv reads it. */
function countDotenvKeys(text) {
	return new Set(parseDotenv(text).map((entry) => entry.key)).size;
}
/**
* A bare file name in the `.env` family: `.env`, `.env.production`, `.env.local`, and so on.
* No folders, so a stored name can be joined onto a project folder without escaping it.
*/
function isEnvFileName(name) {
	return name.length <= 100 && /^\.env(\.[A-Za-z0-9_-]+)*$/.test(name);
}
//#endregion
//#region ../../packages/core/dist/deploy/env/composeEnv.js
/**
* Renders the .env file a stack deploys with, so that Docker Compose reads back exactly the
* values given, whether it uses the file to interpolate the compose file or as a service's
* env_file. Compose's own dotenv parser (compose-go, dotenv/parser.go) decides the rules:
*
* - every value is double-quoted, so `#`, `=`, quotes and spaces at either end stay part of it;
* - inside double quotes Compose expands `\\`, `\"`, `\n`, `\r`, `\t` and `\0` plus three octal
*   digits, so backslashes, quotes and control characters are written as those escapes, which
*   also keeps every entry on one line;
* - double-quoted values are interpolated, so every `$` is written as `$$`.
*
* Checked against the real `docker compose config` in composeEnv.compose.test.ts.
*/
var COMPOSE_ENV_HEADER = "# Written by AgentMate from the environment chosen for this app. Changes here are replaced on the next deploy.";
var ESCAPES = {
	"\\": "\\\\",
	"\"": "\\\"",
	$: "$$",
	"\n": "\\n",
	"\r": "\\r",
	"	": "\\t"
};
/** One value as Compose's dotenv parser needs to see it, quotes included. */
function quoteComposeEnvValue(value) {
	let quoted = "\"";
	for (const char of value) {
		const escaped = ESCAPES[char];
		if (escaped !== void 0) {
			quoted += escaped;
			continue;
		}
		const code = char.charCodeAt(0);
		quoted += code < 32 || code === 127 ? `\\0${code.toString(8).padStart(3, "0")}` : char;
	}
	return `${quoted}"`;
}
/** Why a value cannot go into an environment at all, or null when it can. */
function valueProblem(value) {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code === 0) return "has a NUL character, and an environment variable ends at the first one";
		if (code >= 55296 && code <= 56319) {
			const next = value.charCodeAt(i + 1);
			if (next >= 56320 && next <= 57343) {
				i++;
				continue;
			}
			return "has a broken Unicode character (half of a surrogate pair)";
		}
		if (code >= 56320 && code <= 57343) return "has a broken Unicode character (half of a surrogate pair)";
	}
	return null;
}
/**
* The .env text for these entries, or the first reason one of them cannot be written. A key
* listed twice keeps its last value, which is how dotenv reads a file that repeats a key.
*/
function renderComposeEnv(entries) {
	const values = /* @__PURE__ */ new Map();
	for (const { key, value } of entries) {
		const checked = validateEnvKey(key);
		if (!checked.ok) return {
			ok: false,
			key,
			reason: `The key ${JSON.stringify(key)} can't be used. ${checked.reason}`
		};
		const problem = valueProblem(value);
		if (problem) return {
			ok: false,
			key,
			reason: `The value of ${key} ${problem}.`
		};
		values.set(key, value);
	}
	let text = `${COMPOSE_ENV_HEADER}\n`;
	for (const [key, value] of values) text += `${key}=${quoteComposeEnvValue(value)}\n`;
	if (new TextEncoder().encode(text).length > 1048576) return {
		ok: false,
		reason: `The environment comes to more than ${MAX_ENV_FILE_BYTES / 1048576} MB, which is more than a .env file should hold.`
	};
	return {
		ok: true,
		text,
		keys: [...values.keys()]
	};
}
var DEFAULT_PASSWORD_OPTIONS = {
	length: 20,
	lowercase: true,
	uppercase: true,
	digits: true,
	symbols: true,
	avoidAmbiguous: false
};
var CHARACTER_SETS = {
	lowercase: "abcdefghijklmnopqrstuvwxyz",
	uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	digits: "0123456789",
	symbols: "!#$%&*+-./:;<=>?@^_~()[]{},|"
};
var AMBIGUOUS_CHARACTERS = "Il1O0o|";
var SET_NAMES = [
	"lowercase",
	"uppercase",
	"digits",
	"symbols"
];
var platformRandom$1 = (array) => globalThis.crypto.getRandomValues(array);
var TWO_POW_32 = 2 ** 32;
/**
* A uniform integer in [0, max). Draws that land in the uneven tail above the largest multiple
* of `max` are thrown away, because `x % max` on them would favor the small numbers.
*/
function randomInt(max, rng = platformRandom$1) {
	if (!Number.isInteger(max) || max < 1 || max > TWO_POW_32) throw new RangeError(`randomInt needs an integer max between 1 and 2^32, got ${max}`);
	const limit = TWO_POW_32 - TWO_POW_32 % max;
	const draw = /* @__PURE__ */ new Uint32Array(1);
	for (;;) {
		rng(draw);
		if (draw[0] < limit) return draw[0] % max;
	}
}
function selectedSets(options) {
	return SET_NAMES.filter((name) => options[name]).map((name) => options.avoidAmbiguous ? [...CHARACTER_SETS[name]].filter((c) => !AMBIGUOUS_CHARACTERS.includes(c)).join("") : CHARACTER_SETS[name]);
}
function passwordOptionsError(options) {
	if (!Number.isInteger(options.length) || options.length < 8 || options.length > 128) return `Length must be a whole number from 8 to 128.`;
	const sets = selectedSets(options);
	if (sets.length === 0) return "Pick at least one character set.";
	if (options.length < sets.length) return "Length is shorter than the number of character sets.";
	return null;
}
/**
* One character from every selected set so each shows up, the rest from the combined pool,
* then a Fisher-Yates shuffle so those guaranteed characters don't always sit up front.
*/
function generatePassword(options, rng = platformRandom$1) {
	const error = passwordOptionsError(options);
	if (error) throw new RangeError(error);
	const sets = selectedSets(options);
	const pool = sets.join("");
	const chars = sets.map((set) => set[randomInt(set.length, rng)]);
	while (chars.length < options.length) chars.push(pool[randomInt(pool.length, rng)]);
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1, rng);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join("");
}
/** Bits of entropy for a password made with these options, or 0 when they are invalid. */
function generatedEntropy(options) {
	if (passwordOptionsError(options)) return 0;
	const poolSize = selectedSets(options).reduce((sum, set) => sum + set.length, 0);
	return options.length * Math.log2(poolSize);
}
var LOWER = "abcdefghijklmnopqrstuvwxyz";
var UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var DIGITS = "0123456789";
var GENERATED = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var ACCEPTED = /^[A-Za-z0-9._~-]*$/;
var platformRandom = (array) => globalThis.crypto.getRandomValues(array);
function specProblem(spec) {
	const [min, max] = spec.kind === "password" ? [16, 128] : [16, 64];
	return Number.isInteger(spec.length) && spec.length >= min && spec.length <= max ? null : `${spec.key} needs a length from ${min} to ${max}, not ${spec.length}.`;
}
/** One fresh value for the spec. */
function generateCatalogSecret(spec, rng = platformRandom) {
	const problem = specProblem(spec);
	if (problem) throw new RangeError(problem);
	if (spec.kind === "hex") {
		let hex = "";
		for (let i = 0; i < spec.length; i++) hex += randomInt(256, rng).toString(16).padStart(2, "0");
		return hex;
	}
	const chars = [
		LOWER,
		UPPER,
		DIGITS
	].map((set) => set[randomInt(set.length, rng)]);
	while (chars.length < spec.length) chars.push(GENERATED[randomInt(62, rng)]);
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1, rng);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join("");
}
/** A fresh value for every spec, by env key. */
function generateCatalogSecrets(specs, rng = platformRandom) {
	const values = {};
	for (const spec of specs) values[spec.key] = generateCatalogSecret(spec, rng);
	return values;
}
/**
* Why a value cannot be used for the spec, or null when it can. The reason never repeats the
* value, so it is safe to show and to log.
*/
function checkCatalogSecret(spec, value) {
	if (typeof value !== "string" || value.length === 0) return `Enter a value for ${spec.label}.`;
	if (spec.kind === "hex") {
		const chars = spec.length * 2;
		return value.length === chars && /^[0-9a-fA-F]+$/.test(value) ? null : `${spec.label} must be ${chars} hex characters (0-9 and a-f).`;
	}
	if (value.length < 16) return `${spec.label} must be at least 16 characters long.`;
	if (value.length > 128) return `${spec.label} can be at most 128 characters long.`;
	if (!ACCEPTED.test(value)) return `${spec.label} can use letters, digits and . _ ~ - only, so it works in connection strings and URLs.`;
	if (!/[a-z]/.test(value)) return `${spec.label} needs at least one lowercase letter.`;
	if (!/[A-Z]/.test(value)) return `${spec.label} needs at least one capital letter.`;
	if (!/[0-9]/.test(value)) return `${spec.label} needs at least one digit.`;
	return null;
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/render.js
/**
* Turns a template and the choices made in the install sheet into the files a stack deploys
* with: the compose file and the .env beside it. The same inputs always give the same bytes, so a
* reinstall with stored parameters and secrets reproduces the files exactly.
*
* Every service gets the same baseline: the image pinned by tag and digest, restart:
* unless-stopped, no-new-privileges, a healthcheck, named volumes only, and its ports bound to
* 127.0.0.1 (public access goes through the proxy). Secrets never appear in the compose file. It
* reads them as `${KEY:?...}` from the .env, so Compose refuses to start without them rather than
* starting with an empty password.
*/
var CATALOG_MASKED_SECRET = "********";
var LOOPBACK = "127.0.0.1";
var refuse = (reason, field) => field === void 0 ? {
	ok: false,
	reason
} : {
	ok: false,
	reason,
	field
};
/** The reference Compose pulls: repository, tag and digest. */
function catalogImageReference(image) {
	return `${image.repository}:${image.tag}@${image.digest}`;
}
var secretReference = (key) => `\${${key}:?${key} is missing from the .env file}`;
/** Compose interpolates the file, so a literal `$` is written as `$$`. */
var literal = (text) => text.replaceAll("$", "$$$$");
function envValue(value, inUse) {
	if (typeof value === "string") return literal(value);
	if (!inUse(value.secret)) throw new Error(`The secret ${value.secret} is used but not declared as in use.`);
	return secretReference(value.secret);
}
function serviceYaml(name, spec, version, inUse) {
	const image = version.images[spec.image];
	if (!image) throw new Error(`${name} uses the image ${spec.image}, which ${version.id} lacks.`);
	const out = { image: catalogImageReference(image) };
	if (spec.hostname) out.hostname = spec.hostname;
	if (spec.user) out.user = spec.user;
	if (spec.command) out.command = [...spec.command];
	out.restart = "unless-stopped";
	out.security_opt = ["no-new-privileges:true"];
	if (spec.environment) out.environment = Object.fromEntries(Object.entries(spec.environment).map(([key, value]) => [key, envValue(value, inUse)]));
	if (spec.ports?.length) out.ports = spec.ports.map((port) => `${LOOPBACK}:${port.published}:${port.target}${port.protocol === "udp" ? "/udp" : ""}`);
	if (spec.volumes?.length) out.volumes = spec.volumes.map(({ volume, target }) => `${volume}:${target}`);
	if (spec.dependsOn?.length) out.depends_on = Object.fromEntries(spec.dependsOn.map((service) => [service, { condition: "service_healthy" }]));
	if (spec.externalNetworks?.length) out.networks = ["default", ...spec.externalNetworks];
	const { test, interval, timeout, retries, startPeriod } = spec.healthcheck;
	out.healthcheck = {
		test: [...test],
		interval: interval ?? "30s",
		timeout: timeout ?? "10s",
		retries: retries ?? 5,
		start_period: startPeriod ?? "30s"
	};
	if (spec.stopGracePeriod) out.stop_grace_period = spec.stopGracePeriod;
	if (spec.gpu) out.deploy = { resources: { reservations: { devices: [{
		driver: "nvidia",
		count: "all",
		capabilities: ["gpu"]
	}] } } };
	return out;
}
/**
* The top-level extension block that says what an install is: Compose keeps `x-` keys and does
* nothing with them. The parameters are never secrets, and strings are escaped like any other
* literal, since Compose interpolates extension values too.
*/
var CATALOG_EXTENSION_KEY = "x-agentmate";
function catalogBlock(templateId, versionId, params, publicUrl) {
	const kept = {};
	for (const [key, value] of Object.entries(params)) {
		if (value === void 0 || value === null) continue;
		kept[key] = typeof value === "string" ? literal(value) : value;
	}
	const catalog = {
		template: templateId,
		version: versionId,
		params: kept
	};
	if (publicUrl) catalog.domain = new URL(publicUrl).hostname;
	return { catalog };
}
function mask(value, secrets) {
	let masked = value;
	for (const secret of secrets) masked = masked.split(secret).join(CATALOG_MASKED_SECRET);
	return masked;
}
function renderCatalogApp(template, input) {
	const versionId = input.version ?? template.defaultVersion;
	const version = template.versions.find((candidate) => candidate.id === versionId);
	if (!version) return refuse(`${template.name} has no version ${JSON.stringify(versionId)}.`, "version");
	const parsed = template.parameters.safeParse(input.params ?? {});
	if (!parsed.success) {
		const [issue] = parsed.error.issues;
		const field = String(issue.path[0] ?? "");
		return refuse(`${template.fields[field]?.label ?? field}: ${issue.message}`, field);
	}
	const params = parsed.data;
	let publicUrl = null;
	if (input.domain !== void 0 && input.domain !== null && input.domain !== "") {
		const domain = validateDomain(input.domain);
		if (!domain.ok) return refuse(domain.reason, "domain");
		publicUrl = `https://${domain.value}`;
	}
	const inUse = (key) => template.secretInUse?.(key, params) ?? true;
	const env = {};
	for (const spec of template.secrets) {
		if (!inUse(spec.key)) continue;
		const value = input.secrets[spec.key];
		const problem = checkCatalogSecret(spec, value);
		if (problem) return refuse(problem, spec.key);
		env[spec.key] = value;
	}
	const build = template.build({
		version,
		params,
		publicUrl,
		secret: (key) => {
			if (!Object.hasOwn(env, key)) throw new Error(`The secret ${key} is not in use.`);
			return env[key];
		}
	});
	const services = {};
	const images = [];
	const ports = [];
	const volumes = [];
	const networks = {};
	for (const [name, spec] of Object.entries(build.services)) {
		const yaml = serviceYaml(name, spec, version, inUse);
		services[name] = yaml;
		images.push({
			service: name,
			role: spec.image,
			reference: yaml.image
		});
		for (const port of spec.ports ?? []) ports.push({
			service: name,
			label: port.label,
			hostIp: LOOPBACK,
			published: port.published,
			target: port.target,
			protocol: port.protocol ?? "tcp"
		});
		for (const { volume } of spec.volumes ?? []) if (!volumes.includes(volume)) volumes.push(volume);
		for (const network of spec.externalNetworks ?? []) networks[network] = {
			name: network,
			external: true
		};
	}
	const data = { services };
	if (volumes.length > 0) data.volumes = Object.fromEntries(volumes.map((name) => [name, {}]));
	if (Object.keys(networks).length > 0) data.networks = networks;
	data[CATALOG_EXTENSION_KEY] = catalogBlock(template.id, version.id, params, publicUrl);
	const document = new Document(data);
	document.commentBefore = [` Written by AgentMate from the ${template.name} template (${version.label}).`, " Passwords and keys are read from the .env file next to this one."].join("\n");
	const compose = document.toString({
		lineWidth: 0,
		defaultStringType: "QUOTE_DOUBLE",
		defaultKeyType: "PLAIN"
	});
	const dotenv = renderComposeEnv(Object.entries(env).map(([key, value]) => ({
		key,
		value
	})));
	if (!dotenv.ok) return refuse(dotenv.reason, dotenv.key);
	const project = parseComposeFile(compose, { environment: env });
	if (!project.ok) throw new Error(`${template.id} rendered a compose file that does not parse.`);
	const risks = lintComposeProject(project.project);
	const unacknowledged = unacknowledgedRisks(risks, template.acknowledgments.map((acknowledgment) => acknowledgment.id));
	const secretValues = Object.values(env);
	return {
		ok: true,
		render: {
			templateId: template.id,
			version,
			params,
			compose,
			env,
			envFile: dotenv.text,
			images,
			ports,
			volumes,
			web: build.web,
			publicUrl,
			facts: build.facts.map((fact) => ({
				...fact,
				masked: mask(fact.value, secretValues)
			})),
			risks,
			unacknowledged
		}
	};
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/installed.js
var NOT_CATALOG = "This app was not installed from the App Store.";
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Compose reads `$$` as `$`; the block is read raw, so it is undone here. */
var undoEscape = (value) => typeof value === "string" ? value.replaceAll("$$", "$") : value;
/** `repository:tag@sha256:...` as the renderer writes it. */
function splitReference(reference) {
	const match = /^[^@\s]+:([^:@/\s]+)@(sha256:[0-9a-f]{64})$/.exec(reference);
	return match ? {
		tag: match[1],
		digest: match[2]
	} : null;
}
/** Throwaway secrets, so a render can run without the real ones. Never shown. */
function standIns(template) {
	return generateCatalogSecrets(template.secrets);
}
function readCatalogInstall(compose, find = findCatalogTemplate) {
	let document;
	try {
		document = parse(compose);
	} catch {
		return {
			ok: false,
			reason: "The compose file is not valid YAML."
		};
	}
	if (!isRecord(document)) return {
		ok: false,
		reason: NOT_CATALOG,
		notCatalog: true
	};
	const block = document[CATALOG_EXTENSION_KEY];
	const catalog = isRecord(block) ? block.catalog : void 0;
	if (!isRecord(catalog)) return {
		ok: false,
		reason: NOT_CATALOG,
		notCatalog: true
	};
	const { template: id, version, params, domain } = catalog;
	if (typeof id !== "string" || typeof version !== "string" || !isRecord(params)) return {
		ok: false,
		reason: "The App Store block in the compose file is damaged."
	};
	const template = find(id);
	if (!template) return {
		ok: false,
		reason: `The App Store no longer has the app ${JSON.stringify(id)}.`
	};
	const read = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, undoEscape(value)]));
	const services = isRecord(document.services) ? document.services : {};
	const images = {};
	const pinned = template.versions.find((candidate) => candidate.id === version);
	const parsed = template.parameters.safeParse(read);
	if (!parsed.success) return {
		ok: false,
		reason: "The App Store block in the compose file is damaged."
	};
	if (pinned) {
		const secrets = standIns(template);
		const roles = template.build({
			version: pinned,
			params: parsed.data,
			publicUrl: typeof domain === "string" ? `https://${domain}` : null,
			secret: (key) => secrets[key] ?? ""
		}).services;
		for (const [service, spec] of Object.entries(roles)) {
			const running = services[service];
			const reference = isRecord(running) ? running.image : void 0;
			const split = typeof reference === "string" ? splitReference(reference) : null;
			if (split) images[spec.image] = split;
		}
	}
	return {
		ok: true,
		install: {
			template,
			version,
			params: read,
			domain: typeof domain === "string" && domain !== "" ? domain : null,
			installed: {
				version,
				images
			}
		}
	};
}
function renderInstall(install, version, secrets) {
	return renderCatalogApp(install.template, {
		version,
		params: install.params,
		secrets,
		domain: install.domain
	});
}
/**
* The install's facts. With the secrets (revealed from the server, or still held right after an
* install) every value is filled in; without them `value` is the masked text too, so nothing
* made up ever reaches the screen.
*/
function catalogInstallFacts(install, secrets) {
	const result = renderInstall(install, install.version, secrets ?? standIns(install.template));
	if (!result.ok) return {
		ok: false,
		reason: result.reason
	};
	const { render } = result;
	return {
		ok: true,
		facts: secrets ? render.facts : render.facts.map((fact) => ({
			...fact,
			value: fact.masked
		})),
		ports: render.ports,
		web: render.web,
		publicUrl: render.publicUrl
	};
}
//#endregion
//#region ../../packages/core/dist/deploy/catalog/index.js
var CATALOG_TEMPLATES = [
	mysql,
	mariadb,
	postgres,
	redis,
	mongodb,
	wordpress,
	ghost,
	ollama,
	n8n,
	uptimeKuma,
	adminer,
	phpmyadmin,
	gitea,
	grafana,
	prometheus,
	nextcloud,
	meilisearch,
	rabbitmq
];
function findCatalogTemplate(id) {
	return CATALOG_TEMPLATES.find((template) => template.id === id) ?? null;
}
[" Written by AgentMate: services behind the proxy publish their ports on 127.0.0.1 only.", " !override replaces their ports rather than adding to them (Docker Compose 2.24.4 or later)."].join("\n");
//#endregion
//#region ../../packages/core/dist/deploy/wordpress/protocol.js
/**
* The connector release bundled with this app (the plugin header's Version). A site running an
* older one still works while its protocol matches; the app just offers the newer zip.
*/
var WP_CONNECTOR_VERSION = "1.56.0";
/** Every route the plugin answers. The route string is what gets signed, whatever URL carried it. */
var WP_ROUTES = {
	hello: "/hello",
	pair: "/pair",
	siteInfo: "/site/info",
	itemsList: "/items/list",
	itemsManifest: "/items/manifest",
	filesRead: "/files/read",
	deployBegin: "/deploy/begin",
	deployUpload: "/deploy/upload",
	deployCommit: "/deploy/commit",
	deployVerify: "/deploy/verify",
	deployFinalize: "/deploy/finalize",
	deployRollback: "/deploy/rollback",
	deployAbort: "/deploy/abort",
	deployHistory: "/deploy/history",
	auditList: "/audit/list",
	connectionRevoke: "/connection/revoke",
	rescueStatus: "/rescue/status",
	rescueRollback: "/rescue/rollback"
};
new Set(Object.values(WP_ROUTES));
WP_ROUTES.deployBegin, WP_ROUTES.deployUpload, WP_ROUTES.deployCommit, WP_ROUTES.deployVerify, WP_ROUTES.deployFinalize, WP_ROUTES.deployRollback, WP_ROUTES.deployAbort, WP_ROUTES.rescueRollback;
WP_ROUTES.hello, WP_ROUTES.pair;
new TextEncoder();
var LOOKUP = Object.fromEntries([..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"].map((char, index) => [char, index]));
/**
* Strict base64url: no padding, no other alphabet, and the unused low bits of the last
* character must be zero, so every byte string has exactly one accepted spelling. Null otherwise.
*/
function wpBase64UrlDecode(text) {
	if (text.length % 4 === 1) return null;
	const values = [];
	for (const char of text) {
		const value = LOOKUP[char];
		if (value === void 0) return null;
		values.push(value);
	}
	const out = new Uint8Array(Math.floor(values.length * 3 / 4));
	let at = 0;
	let index = 0;
	for (; index + 3 < values.length; index += 4) {
		const chunk = values[index] << 18 | values[index + 1] << 12 | values[index + 2] << 6 | values[index + 3];
		out[at++] = chunk >> 16 & 255;
		out[at++] = chunk >> 8 & 255;
		out[at++] = chunk & 255;
	}
	const rest = values.length - index;
	if (rest === 2) {
		if ((values[index + 1] & 15) !== 0) return null;
		out[at++] = (values[index] << 2 | values[index + 1] >> 4) & 255;
	} else if (rest === 3) {
		if ((values[index + 2] & 3) !== 0) return null;
		const chunk = values[index] << 12 | values[index + 1] << 6 | values[index + 2];
		out[at++] = chunk >> 10 & 255;
		out[at++] = chunk >> 2 & 255;
	}
	return out;
}
/** base64url of exactly `length` bytes. */
function isWpBase64UrlBytes(text, length) {
	if (typeof text !== "string") return false;
	return wpBase64UrlDecode(text)?.length === length;
}
/**
* How a URL travels: HTTPS, plain HTTP to this computer (allowed for development), or plain HTTP
* over the network (refused unless the user opts in for that site). Anything that is not an
* http(s) URL counts as plain HTTP, the strictest answer.
*/
function wpTransportSecurity(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return "plain-http";
	}
	if (parsed.protocol === "https:") return "https";
	if (parsed.protocol !== "http:") return "plain-http";
	const host = parsed.hostname.toLowerCase();
	if (host === "localhost" || host.endsWith(".localhost") || host === "[::1]") return "local-http";
	if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return "local-http";
	return "plain-http";
}
/** The weakest of the key's three URLs, which is what the connection gets. */
function wpKeyTransportSecurity(key) {
	const all = [
		key.siteUrl,
		key.restUrl,
		key.ajaxUrl
	].map(wpTransportSecurity);
	if (all.includes("plain-http")) return "plain-http";
	if (all.includes("local-http")) return "local-http";
	return "https";
}
function isHttpUrl(value) {
	if (typeof value !== "string" || value.length > 2048) return false;
	try {
		const url = new URL(value);
		return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "";
	} catch {
		return false;
	}
}
var PAIRING_ID = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
/**
* Reads a pasted key. Whitespace anywhere is dropped first, since keys get wrapped and indented
* on the way from wp-admin to the clipboard.
*/
function parseWpConnectionKey(text, nowSeconds = Math.floor(Date.now() / 1e3)) {
	const compact = text.replace(/\s+/g, "");
	if (!compact.startsWith("amwp") || compact.length > 4096) return {
		ok: false,
		error: "format"
	};
	if (!compact.startsWith("amwp1.")) return {
		ok: false,
		error: "version"
	};
	const bytes = wpBase64UrlDecode(compact.slice(6));
	if (!bytes) return {
		ok: false,
		error: "format"
	};
	let value;
	try {
		value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		return {
			ok: false,
			error: "format"
		};
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {
		ok: false,
		error: "format"
	};
	const raw = value;
	if (raw.v !== 1) return {
		ok: false,
		error: "version"
	};
	if (typeof raw.i !== "string" || !PAIRING_ID.test(raw.i) || !isWpBase64UrlBytes(raw.s, 32) || !isWpBase64UrlBytes(raw.k, 32) || raw.c !== "read" && raw.c !== "write" || typeof raw.x !== "number" || !Number.isSafeInteger(raw.x) || raw.l !== void 0 && (typeof raw.l !== "string" || [...raw.l].length > 100)) return {
		ok: false,
		error: "fields"
	};
	if (!isHttpUrl(raw.u) || !isHttpUrl(raw.r) || !isHttpUrl(raw.a)) return {
		ok: false,
		error: "url"
	};
	if (raw.x <= nowSeconds) return {
		ok: false,
		error: "expired"
	};
	const key = {
		siteUrl: raw.u,
		restUrl: raw.r,
		ajaxUrl: raw.a,
		pairingId: raw.i,
		pairingSecret: raw.s,
		sitePublicKey: raw.k,
		scope: raw.c,
		expiresAt: raw.x
	};
	if (typeof raw.l === "string" && raw.l.trim() !== "") key.label = raw.l.trim();
	return {
		ok: true,
		key
	};
}
//#endregion
//#region ../../packages/core/dist/deploy/wordpress/pathPolicy.js
/**
* Which paths inside a theme, plugin or mu-plugin may travel between this computer and a site
* (E19), the same on both sides: the desktop never sends or writes anything this refuses, and the
* plugin refuses it again on its own. The order of the checks in validateWpItemPath is part of the
* contract, since the shared vectors pin the reason for every case.
*
* Three layers keep agent and AgentMate files on this computer:
* 1. Only the folders of linked items are walked, so anything at the project root (`.claude/`,
*    `AGENTS.md`, `.agentmate/`) is never even looked at.
* 2. The hard deny list below, matched against every path segment, without exceptions.
* 3. Ignore rules (see createWpIgnoreRules): a default list for files that never belong on a site
*    unless the site already has them, plus the user's own `.distignore` and `.agentmateignore`.
*/
/** Folders that hold agent settings, skills, AgentMate's own files, or version control. */
var WP_HARD_DENY_DIRS = [
	".agentmate",
	".claude",
	".agents",
	".codex",
	".cursor",
	".windsurf",
	".continue",
	".factory",
	".gemini",
	".opencode",
	".roo",
	".kiro",
	".amazonq",
	".junie",
	".clinerules",
	".github",
	".git",
	".svn",
	".hg",
	".worktrees"
];
/** Files by exact name: agent instructions, MCP config, secrets, PHP config, OS clutter. */
var WP_HARD_DENY_FILES = [
	"agents.md",
	"claude.md",
	"claude.local.md",
	"gemini.md",
	".mcp.json",
	"opencode.json",
	".cursorrules",
	".windsurfrules",
	".roomodes",
	".agentmateignore",
	".env",
	".envrc",
	".npmrc",
	"auth.json",
	".netrc",
	".git-credentials",
	".user.ini",
	"php.ini",
	".ds_store",
	"thumbs.db",
	"desktop.ini"
];
/** Name prefixes: Aider's files, `.env.local` and friends, SSH private keys. */
var WP_HARD_DENY_PREFIXES = [
	".aider",
	".env.",
	"id_rsa",
	"id_ed25519",
	"id_ecdsa"
];
[...WP_HARD_DENY_DIRS, ...WP_HARD_DENY_FILES];
var ROOTS = {
	theme: "wp-content/themes",
	plugin: "wp-content/plugins",
	"mu-plugin": "wp-content/mu-plugins"
};
/** The item's root inside a project folder, `/`-separated: `wp-content/themes/<slug>`. */
function wpItemRoot(item) {
	return `${ROOTS[item.kind]}/${item.slug}`;
}
/**
* Where a file of an item lives inside the project folder. A single-file item has one path,
* its slug, which maps to `wp-content/plugins/<slug>`.
*/
function wpMirrorPath(item, isFile, path) {
	if (isFile) {
		if (path !== item.slug) throw new Error("A single-file item has only one path: its own name.");
		return wpItemRoot(item);
	}
	return `${wpItemRoot(item)}/${path}`;
}
/** A stable key for an item: `theme:twentytwentyfive`. */
function wpItemKey(item) {
	return `${item.kind}:${item.slug}`;
}
//#endregion
//#region ../../packages/core/dist/grammar/languagetool.js
/**
* LanguageTool is the engine behind AgentMate's writing checks. Text goes to the
* public API by default. The desktop distribution the user drops into the app's
* tools folder speaks the same HTTP contract, so switching to it is only a
* change of base URL, which is why everything below is shared by both modes.
*/
var LANGUAGETOOL_TOOL_ID = "languagetool";
var LANGUAGETOOL_WEBSITE_URL = "https://languagetool.org/";
var LANGUAGETOOL_REPOSITORY_URL = "https://github.com/languagetool-org/languagetool";
/** The "stable" zip, which is the desktop/server bundle with all the language rules in it. */
var LANGUAGETOOL_DOWNLOAD_URL = "https://languagetool.org/download/LanguageTool-stable.zip";
var LANGUAGETOOL_DEFAULT_PORT = 8081;
/**
* Whether an issue is a mistake rather than a suggestion. "Fix all" only takes
* these, since a style rewrite is a matter of taste and should stay a decision.
*/
function isGrammarMistake(kind) {
	return kind === "spelling" || kind === "grammar" || kind === "punctuation";
}
var GRAMMAR_ISSUE_KIND_LABELS = {
	spelling: "Spelling",
	grammar: "Grammar",
	punctuation: "Punctuation",
	typography: "Typography",
	style: "Style",
	other: "Writing"
};
/** Languages worth offering in Settings; LanguageTool supports more, these are the ones with real rule sets. */
var GRAMMAR_LANGUAGES = [
	{
		value: "auto",
		label: "Auto-detect"
	},
	{
		value: "en-US",
		label: "English (US)"
	},
	{
		value: "en-GB",
		label: "English (UK)"
	},
	{
		value: "de-DE",
		label: "German"
	},
	{
		value: "fr-FR",
		label: "French"
	},
	{
		value: "es",
		label: "Spanish"
	},
	{
		value: "pt-PT",
		label: "Portuguese"
	},
	{
		value: "it",
		label: "Italian"
	},
	{
		value: "nl",
		label: "Dutch"
	},
	{
		value: "ru-RU",
		label: "Russian"
	},
	{
		value: "pl-PL",
		label: "Polish"
	},
	{
		value: "uk-UA",
		label: "Ukrainian"
	},
	{
		value: "ar",
		label: "Arabic"
	},
	{
		value: "zh-CN",
		label: "Chinese"
	}
];
/**
* Mother tongue turns on false-friend rules ("actually" for a German speaker,
* say). It has to be a language LanguageTool knows, so the list is the one
* above without the auto entry.
*/
var GRAMMAR_MOTHER_TONGUES = GRAMMAR_LANGUAGES.filter((entry) => entry.value !== "auto");
function defaultGrammarSettings() {
	return {
		enabled: true,
		liveCheck: true,
		source: "online",
		language: "auto",
		motherTongue: null,
		picky: false,
		localPort: LANGUAGETOOL_DEFAULT_PORT,
		ignoredRules: []
	};
}
var McpServerConfigSchema = object({
	transport: _enum([
		"stdio",
		"sse",
		"http"
	]).default("stdio"),
	/** Executable to run for stdio transport (e.g. "npx"). */
	command: string$1().optional(),
	args: array(string$1()).default([]),
	/** Default env vars bundled with the server; merged under keys in `requiredEnv`. */
	env: record(string$1(), string$1()).default({}),
	/** Endpoint for sse/http transport. */
	url: string$1().optional()
});
var McpServerSchema = object({
	id: string$1(),
	name: string$1(),
	description: string$1(),
	category: string$1(),
	tags: array(string$1()).default([]),
	author: string$1(),
	version: string$1(),
	/** Whether this server is maintained by the vendor/organization it integrates with, vs. a community project. */
	official: boolean().default(false),
	popularity: number$1().default(0),
	/** The server's own homepage/docs site, when distinct from its source repository. */
	websiteUrl: string$1().optional(),
	/** Source repository (e.g. GitHub) the server is published from. */
	repositoryUrl: string$1().optional(),
	/** Env var names the user must supply a value for at install time (e.g. API keys). */
	requiredEnv: array(string$1()).default([]),
	config: McpServerConfigSchema
});
var McpRepositoryIndexSchema = object({
	name: string$1(),
	description: string$1().optional(),
	servers: array(McpServerSchema)
});
//#endregion
//#region ../../packages/core/dist/mcp/bundledDirectory.js
/**
* Servers bundled from the Bowora MCP directory (https://bowora.com/mcp) as of 2026-07-19,
* fetched per-server from each server's own /mcp/{slug} detail page. Shipped with the app so
* the default marketplace listing works offline and never needs a network fetch. Entries
* without a parsed `command`/`url` had no machine-readable install instructions on the
* source page; they're still listed for discovery, but need manual setup.
*/
var BOWORA_MCP_REPOSITORY_ID = "bowora-directory";
McpRepositoryIndexSchema.parse({
	name: "Bowora MCP Directory",
	description: "Curated MCP servers, bundled with AgentMate for offline browsing and one-click install.",
	servers: [
		{
			id: "jscpd",
			name: "Jscpd",
			description: "Copy/paste detector for programming source code, supports 223 formats. AI-ready with token-efficient reporter, skill and MCP server.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "kucherenko",
			version: "latest",
			official: false,
			popularity: 5886,
			websiteUrl: "https://jscpd.dev/",
			repositoryUrl: "https://github.com/kucherenko/jscpd",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "mcp-atlassian",
			name: "MCP Atlassian",
			description: "MCP server for Atlassian tools (Confluence, Jira)",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "sooperset",
			version: "latest",
			official: false,
			popularity: 5573,
			websiteUrl: "https://mcp-atlassian.soomiles.com",
			repositoryUrl: "https://github.com/sooperset/mcp-atlassian",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "mobile-mcp",
			name: "Mobile MCP",
			description: "Model Context Protocol Server for Mobile Automation and Scraping (iOS, Android, Emulators, Simulators and Real Devices)",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "mobile-next",
			version: "latest",
			official: false,
			popularity: 5468,
			websiteUrl: "https://mobilenext.ai",
			repositoryUrl: "https://github.com/mobile-next/mobile-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "sandbox",
			name: "Sandbox",
			description: "All-in-One Sandbox for AI Agents that combines Browser, Shell, File, MCP and VSCode Server in a single Docker container.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "agent-infra",
			version: "latest",
			official: false,
			popularity: 5425,
			websiteUrl: "https://sandbox.agent-infra.com",
			repositoryUrl: "https://github.com/agent-infra/sandbox",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "5ire",
			name: "5ire",
			description: "5ire is a cross-platform desktop AI assistant, MCP client. It compatible with major service providers,  supports local knowledge base and  tools via model context protocol servers .",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "nanbingxyz",
			version: "latest",
			official: false,
			popularity: 5277,
			websiteUrl: "https://5ire.app",
			repositoryUrl: "https://github.com/nanbingxyz/5ire",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "rocketride-server",
			name: "Rocketride Server",
			description: "High-performance AI pipeline engine with a C++ core and 50+ Python-extensible nodes. Build, debug, and scale LLM workflows with 13+ model providers, 8+ vector databases, and agent orchestration, all from your IDE. Includes VS Code extension, TypeScript/Python SDKs, and Docker deployment.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "rocketride-org",
			version: "latest",
			official: false,
			popularity: 5209,
			repositoryUrl: "https://github.com/rocketride-org/rocketride-server",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "linear-mcp",
			name: "Linear MCP",
			description: "Lets agents create issues, search projects, and update Linear tickets while implementing features or triage work.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "linear",
			version: "latest",
			official: false,
			popularity: 5e3,
			websiteUrl: "https://linear.app",
			repositoryUrl: "https://github.com/linear/linear-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "awesome-mcp-zh",
			name: "Awesome MCP ZH",
			description: "MCP 资源精选， MCP指南，Claude MCP，MCP Servers, MCP Clients",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "yzfly",
			version: "latest",
			official: false,
			popularity: 7438,
			repositoryUrl: "https://github.com/yzfly/Awesome-MCP-ZH",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "sentry-mcp",
			name: "Sentry MCP",
			description: "Connects coding agents to Sentry so they can look up issues, stack traces, and project error context while debugging.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "getsentry",
			version: "latest",
			official: false,
			popularity: 7e3,
			websiteUrl: "https://sentry.io",
			repositoryUrl: "https://github.com/getsentry/sentry-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "firecrawl-mcp-server",
			name: "Firecrawl MCP Server",
			description: "🔥 Official Firecrawl MCP Server - Adds powerful web scraping and search to Cursor, Claude and any other LLM clients.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "firecrawl",
			version: "latest",
			official: false,
			popularity: 6960,
			websiteUrl: "https://firecrawl.dev",
			repositoryUrl: "https://github.com/firecrawl/firecrawl-mcp-server",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "mcp",
			name: "MCP",
			description: "Browser MCP is a Model Context Provider (MCP) server that allows AI applications to control your browser",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "BrowserMCP",
			version: "latest",
			official: false,
			popularity: 6831,
			websiteUrl: "https://browsermcp.io",
			repositoryUrl: "https://github.com/BrowserMCP/mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "notion-mcp",
			name: "Notion MCP",
			description: "Official-style Notion MCP integration for searching workspaces, reading pages, and updating docs from an agent workflow.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "makenotion",
			version: "latest",
			official: false,
			popularity: 6500,
			websiteUrl: "https://www.notion.com",
			repositoryUrl: "https://github.com/makenotion/notion-mcp-server",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "windows-mcp",
			name: "Windows MCP",
			description: "MCP Server for Computer Use in Windows",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "CursorTouch",
			version: "latest",
			official: false,
			popularity: 6434,
			repositoryUrl: "https://github.com/CursorTouch/Windows-MCP",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "xcodebuildmcp",
			name: "XcodeBuildMCP",
			description: "A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "getsentry",
			version: "latest",
			official: false,
			popularity: 6076,
			websiteUrl: "https://www.xcodebuildmcp.com",
			repositoryUrl: "https://github.com/getsentry/XcodeBuildMCP",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "whatsapp-mcp",
			name: "Whatsapp MCP",
			description: "WhatsApp MCP server",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "lharries",
			version: "latest",
			official: false,
			popularity: 5903,
			websiteUrl: "https://x.com/LukeHarries_/status/1905986562388635913",
			repositoryUrl: "https://github.com/lharries/whatsapp-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "activepieces",
			name: "Activepieces",
			description: "Open-source no-code automation platform with MCP-compatible integrations for building AI agent workflows.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "activepieces",
			version: "latest",
			official: false,
			popularity: 23273,
			websiteUrl: "https://www.activepieces.com",
			repositoryUrl: "https://github.com/activepieces/activepieces",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "mcp-toolbox",
			name: "MCP Toolbox",
			description: "MCP Toolbox for Databases is an open source MCP server for databases.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "googleapis",
			version: "latest",
			official: false,
			popularity: 15956,
			websiteUrl: "https://mcp-toolbox.dev/documentation/introduction/",
			repositoryUrl: "https://github.com/googleapis/mcp-toolbox",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "figma-context-mcp",
			name: "Figma Context MCP",
			description: "MCP server to provide Figma layout information to AI coding agents like Cursor",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "GLips",
			version: "latest",
			official: false,
			popularity: 15402,
			websiteUrl: "https://www.framelink.ai/",
			repositoryUrl: "https://github.com/GLips/Figma-Context-MCP",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "casdoor",
			name: "Casdoor",
			description: "An open-source Agent-first Identity and Access Management (IAM) /LLM MCP & agent gateway and auth server with web UI supporting OpenClaw, MCP, OAuth, OIDC, SAML, CAS, LDAP, SCIM, WebAuthn, TOTP, MFA, Face ID, Google Workspace, Azure AD",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "casdoor",
			version: "latest",
			official: false,
			popularity: 13946,
			websiteUrl: "https://casdoor.ai",
			repositoryUrl: "https://github.com/casdoor/casdoor",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "postgres-mcp",
			name: "PostgreSQL MCP",
			description: "A reliable Postgres MCP server for listing schemas, running read queries, and helping agents inspect relational data with explicit connection configuration.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: false,
			popularity: 12e3,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "hexstrike-ai",
			name: "Hexstrike Ai",
			description: "HexStrike AI MCP Agents is an advanced MCP server that lets AI agents (Claude, GPT, Copilot, etc.) autonomously run 150+ cybersecurity tools for automated pentesting, vulnerability discovery, bug bounty automation, and security research. Seamlessly bridge LLMs with real-world offensive security capabilities.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "0x4m4",
			version: "latest",
			official: false,
			popularity: 10321,
			websiteUrl: "https://www.hexstrike.com/",
			repositoryUrl: "https://github.com/0x4m4/hexstrike-ai",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "mcp-use",
			name: "MCP Use",
			description: "The fullstack MCP framework to develop MCP Apps for ChatGPT / Claude & MCP Servers for AI Agents.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "mcp-use",
			version: "latest",
			official: false,
			popularity: 10306,
			websiteUrl: "https://manufact.com",
			repositoryUrl: "https://github.com/mcp-use/mcp-use",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "supabase-mcp",
			name: "Supabase MCP",
			description: "A popular Supabase MCP server for database inspection, project management, and docs lookup during app development.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "supabase-community",
			version: "latest",
			official: false,
			popularity: 8500,
			websiteUrl: "https://supabase.com",
			repositoryUrl: "https://github.com/supabase-community/supabase-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "desktopcommandermcp",
			name: "DesktopCommanderMCP",
			description: "This is MCP server for Claude that gives it terminal control, file system search and diff file editing capabilities",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "wonderwhy-er",
			version: "latest",
			official: false,
			popularity: 8297,
			websiteUrl: "https://desktopcommander.app/",
			repositoryUrl: "https://github.com/wonderwhy-er/DesktopCommanderMCP",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "webiny-js",
			name: "Webiny Js",
			description: "Open-source, self-hosted CMS platform on AWS serverless (Lambda, DynamoDB, S3). TypeScript framework with multi-tenancy, lifecycle hooks, GraphQL API, and AI-assisted development via MCP server. Built for developers at large organizations.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "webiny",
			version: "latest",
			official: false,
			popularity: 8014,
			websiteUrl: "https://www.webiny.com",
			repositoryUrl: "https://github.com/webiny/webiny-js",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "puppeteer-mcp",
			name: "Puppeteer MCP",
			description: "Gives agents a Puppeteer-backed browser for navigating pages, capturing screenshots, and validating UI flows.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 1e4,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/puppeteer",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "brave-search-mcp",
			name: "Brave Search MCP",
			description: "Gives agents grounded web results through Brave Search so they can research docs, APIs, and current pages during a task.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 9e3,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "sequential-thinking-mcp",
			name: "Sequential Thinking MCP",
			description: "Helps agents break work into sequenced thoughts, revise earlier steps, and keep long reasoning traces organized.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 8e3,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "sqlite-mcp",
			name: "SQLite MCP",
			description: "Exposes SQLite query and schema tools so agents can inspect and modify local app databases with clear boundaries.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 7500,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/sqlite",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "registry",
			name: "Registry",
			description: "A community driven registry service for Model Context Protocol (MCP) servers.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 7019,
			websiteUrl: "https://github.com/modelcontextprotocol/registry/tree/main/docs",
			repositoryUrl: "https://github.com/modelcontextprotocol/registry",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "git-mcp",
			name: "Git MCP",
			description: "Useful Git MCP utilities for inspecting commits, diffs, and repository state while agents work on codebases.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 6800,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/git",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "awesome-mcp-servers",
			name: "Awesome MCP Servers",
			description: "A collection of MCP servers.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "punkpeye",
			version: "latest",
			official: false,
			popularity: 90809,
			websiteUrl: "https://glama.ai/mcp/servers",
			repositoryUrl: "https://github.com/punkpeye/awesome-mcp-servers",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "headroom",
			name: "Headroom",
			description: "Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding agents, 60-95% fewer tokens for JSON, same answers. Library, proxy, MCP server.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "headroomlabs-ai",
			version: "latest",
			official: false,
			popularity: 59284,
			websiteUrl: "https://headroom-docs.vercel.app/docs",
			repositoryUrl: "https://github.com/headroomlabs-ai/headroom",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "codebase-memory-mcp",
			name: "Codebase Memory MCP",
			description: "High-performance code intelligence MCP server. Indexes codebases into a persistent knowledge graph, with query times in milliseconds for the average repo. 158 languages, sub-ms queries, 99% fewer tokens. Single static binary, zero dependencies.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "DeusData",
			version: "latest",
			official: false,
			popularity: 31724,
			websiteUrl: "https://deusdata.github.io/codebase-memory-mcp/",
			repositoryUrl: "https://github.com/DeusData/codebase-memory-mcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "fastmcp",
			name: "Fastmcp",
			description: "🚀 The fast, Pythonic way to build MCP servers and clients.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "PrefectHQ",
			version: "latest",
			official: false,
			popularity: 26217,
			websiteUrl: "https://gofastmcp.com",
			repositoryUrl: "https://github.com/PrefectHQ/fastmcp",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "memory-mcp",
			name: "Memory MCP",
			description: "Stores entities and relations so coding agents can remember project facts across conversations without stuffing everything into the prompt.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 15e3,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "fetch-mcp",
			name: "Fetch MCP",
			description: "Retrieves URLs and returns readable content so agents can inspect documentation and web resources safely.",
			category: "Developer Tools",
			tags: ["Developer Tools", "AI & Automation"],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 11e3,
			repositoryUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "chrome-devtools-mcp",
			name: "Chrome DevTools MCP",
			description: "An MCP server from the Chrome DevTools team that gives coding agents page inspection, console, network, performance, and browser interaction capabilities.",
			category: "Developer Tools",
			tags: [
				"Developer Tools",
				"DevOps & Infrastructure",
				"Data & Analytics"
			],
			author: "ChromeDevTools",
			version: "latest",
			official: true,
			popularity: 45130,
			websiteUrl: "https://developer.chrome.com/docs/devtools",
			repositoryUrl: "https://github.com/ChromeDevTools/chrome-devtools-mcp",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "npx",
				args: ["-y", "chrome-devtools-mcp@latest"]
			}
		},
		{
			id: "netdata",
			name: "Netdata",
			description: "Netdata's MCP integration gives agents live observability context across systems, containers, services, and applications for investigation and troubleshooting.",
			category: "DevOps & Infrastructure",
			tags: [
				"DevOps & Infrastructure",
				"Data & Analytics",
				"AI & Automation"
			],
			author: "netdata",
			version: "latest",
			official: false,
			popularity: 79480,
			websiteUrl: "https://www.netdata.cloud",
			repositoryUrl: "https://github.com/netdata/netdata",
			requiredEnv: [],
			config: {
				transport: "http",
				url: "https://mcp.netdata.cloud/mcp"
			}
		},
		{
			id: "github-mcp-server",
			name: "GitHub MCP Server",
			description: "GitHub's official MCP server connects agents to repository context and common development workflows with configurable toolsets and read-only mode.",
			category: "Developer Tools",
			tags: [
				"Developer Tools",
				"DevOps & Infrastructure",
				"Communication"
			],
			author: "github",
			version: "latest",
			official: true,
			popularity: 39600,
			websiteUrl: "https://github.com",
			repositoryUrl: "https://github.com/github/github-mcp-server",
			requiredEnv: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
			config: {
				transport: "stdio",
				command: "docker",
				args: [
					"run",
					"-i",
					"--rm",
					"-e",
					"GITHUB_PERSONAL_ACCESS_TOKEN",
					"ghcr.io/github/github-mcp-server"
				]
			}
		},
		{
			id: "aws-mcp-servers",
			name: "AWS MCP Servers",
			description: "AWS Labs maintains a collection of MCP servers for architecture, documentation, cost analysis, CDK, Terraform, containers, databases, serverless, and operational workflows.",
			category: "DevOps & Infrastructure",
			tags: [
				"DevOps & Infrastructure",
				"Developer Tools",
				"Business & Finance"
			],
			author: "awslabs",
			version: "latest",
			official: true,
			popularity: 19700,
			websiteUrl: "https://aws.amazon.com",
			repositoryUrl: "https://github.com/awslabs/mcp",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "uvx",
				args: ["awslabs.aws-documentation-mcp-server@latest"]
			}
		},
		{
			id: "playwright-mcp",
			name: "Playwright MCP",
			description: "Microsoft's Playwright MCP server lets agents navigate, inspect, and interact with web pages using deterministic browser automation rather than screenshots alone.",
			category: "Developer Tools",
			tags: [
				"Developer Tools",
				"AI & Automation",
				"Productivity"
			],
			author: "microsoft",
			version: "latest",
			official: true,
			popularity: 45130,
			websiteUrl: "https://playwright.dev",
			repositoryUrl: "https://github.com/microsoft/playwright-mcp",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "npx",
				args: ["-y", "@playwright/mcp"]
			}
		},
		{
			id: "context7",
			name: "Context7",
			description: "Context7 resolves package identifiers and retrieves up-to-date documentation and code examples so coding agents can work from the right library version.",
			category: "Developer Tools",
			tags: [
				"Research & Knowledge",
				"Developer Tools",
				"AI & Automation"
			],
			author: "upstash",
			version: "latest",
			official: false,
			popularity: 58496,
			websiteUrl: "https://context7.com",
			repositoryUrl: "https://github.com/upstash/context7",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "npx",
				args: ["-y", "@upstash/context7-mcp"]
			}
		},
		{
			id: "cloudflare",
			name: "Cloudflare",
			description: "Cloudflare's remote MCP servers expose documentation, Workers builds, observability, Radar, browser rendering, and account resources to compatible AI clients.",
			category: "DevOps & Infrastructure",
			tags: [
				"DevOps & Infrastructure",
				"Developer Tools",
				"Security & Privacy"
			],
			author: "cloudflare",
			version: "latest",
			official: true,
			popularity: 22600,
			websiteUrl: "https://www.cloudflare.com",
			repositoryUrl: "https://github.com/cloudflare/mcp-server-cloudflare",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "npx",
				args: ["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"]
			}
		},
		{
			id: "markitdown",
			name: "MarkItDown",
			description: "Microsoft's MarkItDown project includes an MCP server for converting PDF, Office, image, audio, HTML, CSV, JSON, and archive files into LLM-friendly Markdown.",
			category: "Developer Tools",
			tags: [
				"Developer Tools",
				"Content & Writing",
				"Data & Analytics",
				"Research & Knowledge"
			],
			author: "microsoft",
			version: "latest",
			official: false,
			popularity: 162491,
			websiteUrl: "https://github.com/microsoft/markitdown",
			repositoryUrl: "https://github.com/microsoft/markitdown",
			requiredEnv: [],
			config: { transport: "stdio" }
		},
		{
			id: "filesystem",
			name: "Filesystem",
			description: "The official reference MCP server for controlled filesystem access, including reading, writing, moving, searching, and inspecting files inside explicitly allowed directories.",
			category: "Developer Tools",
			tags: [
				"Developer Tools",
				"Productivity",
				"Security & Privacy"
			],
			author: "modelcontextprotocol",
			version: "latest",
			official: true,
			popularity: 78400,
			websiteUrl: "https://modelcontextprotocol.io",
			repositoryUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
			requiredEnv: [],
			config: {
				transport: "stdio",
				command: "npx",
				args: [
					"-y",
					"@modelcontextprotocol/server-filesystem",
					"/path/to/allowed/directory"
				]
			}
		},
		{
			id: "stripe",
			name: "Stripe",
			description: "Stripe's agent toolkit includes an MCP server that lets agents inspect and operate Stripe resources while also searching Stripe's developer documentation.",
			category: "DevOps & Infrastructure",
			tags: [
				"Business & Finance",
				"Developer Tools",
				"AI & Automation"
			],
			author: "stripe",
			version: "latest",
			official: true,
			popularity: 11800,
			websiteUrl: "https://stripe.com",
			repositoryUrl: "https://github.com/stripe/agent-toolkit",
			requiredEnv: ["STRIPE_SECRET_KEY"],
			config: {
				transport: "stdio",
				command: "npx",
				args: [
					"-y",
					"@stripe/mcp",
					"--tools=all"
				]
			}
		}
	]
}).name;
({ ...AGENT_TYPE_LABELS });
var PROMPT_TYPE_PROFILES = {
	Frontend: {
		roleLabel: "senior frontend engineer",
		focusAreas: [
			"Component structure",
			"State management",
			"Responsive layout",
			"Accessibility"
		],
		requirements: ["Match existing component patterns", "Handle loading, empty, and error states"],
		bestPractices: ["Use semantic HTML and ARIA where relevant", "Avoid unnecessary re-renders"]
	},
	Backend: {
		roleLabel: "senior backend engineer",
		focusAreas: [
			"API contracts",
			"Data validation",
			"Error handling",
			"Scalability"
		],
		requirements: ["Validate all external input", "Return consistent, well-structured errors"],
		bestPractices: ["Keep business logic out of route handlers", "Log at appropriate levels"]
	},
	"Full Stack": {
		roleLabel: "senior full-stack engineer",
		focusAreas: [
			"End-to-end data flow",
			"API/UI contract alignment",
			"Consistency across layers"
		],
		requirements: ["Keep frontend and backend types in sync", "Cover the full request/response path"],
		bestPractices: ["Share types between client and server where possible"]
	},
	"UI Design": {
		roleLabel: "senior product/UI designer",
		focusAreas: [
			"Visual hierarchy",
			"Spacing and typography",
			"Consistency with design system"
		],
		requirements: ["Specify concrete layout, spacing, and color decisions", "Cover light and dark themes"],
		bestPractices: ["Reuse existing design tokens/components before introducing new ones"]
	},
	"UX Review": {
		roleLabel: "senior UX researcher",
		focusAreas: [
			"User flow friction",
			"Cognitive load",
			"Error recovery",
			"Onboarding clarity"
		],
		requirements: ["Identify concrete friction points, not just impressions", "Propose specific fixes"],
		bestPractices: ["Ground feedback in usability heuristics (Nielsen, etc.)"]
	},
	Product: {
		roleLabel: "senior product manager",
		focusAreas: [
			"User problem and target audience",
			"Scope and priority",
			"Success metrics",
			"Edge cases and rollout"
		],
		requirements: ["State the user problem before proposing a solution", "Define acceptance criteria that are testable"],
		bestPractices: ["Separate must-have from nice-to-have and say why", "Call out open questions instead of inventing requirements"]
	},
	API: {
		roleLabel: "senior API engineer",
		focusAreas: [
			"Resource modeling",
			"Versioning",
			"Error semantics",
			"Auth boundaries"
		],
		requirements: ["Define request/response schemas explicitly", "Cover pagination and error cases"],
		bestPractices: ["Follow REST/GraphQL conventions already used in this project"]
	},
	Database: {
		roleLabel: "senior database engineer",
		focusAreas: [
			"Schema design",
			"Indexing",
			"Migration safety",
			"Query performance"
		],
		requirements: ["Provide a migration path for existing data", "Avoid destructive schema changes without a plan"],
		bestPractices: ["Prefer additive migrations", "Consider lock/downtime impact on large tables"]
	},
	Testing: {
		roleLabel: "senior test engineer",
		focusAreas: [
			"Coverage of edge cases",
			"Test isolation",
			"Determinism"
		],
		requirements: ["Cover the happy path plus meaningful edge cases", "Avoid flaky or order-dependent tests"],
		bestPractices: ["Test behavior, not implementation details", "Use realistic fixtures over mocks where practical"]
	},
	Security: {
		roleLabel: "senior application security engineer",
		focusAreas: [
			"Input validation",
			"AuthN/AuthZ boundaries",
			"Secrets handling",
			"Common OWASP risks"
		],
		requirements: ["Call out any trust boundary the change crosses", "Do not weaken existing security controls"],
		bestPractices: ["Validate at the boundary, never trust client input", "Least privilege by default"]
	},
	Performance: {
		roleLabel: "senior performance engineer",
		focusAreas: [
			"Hot paths",
			"Algorithmic complexity",
			"Memory/CPU footprint",
			"I/O and network cost"
		],
		requirements: ["Identify the specific bottleneck before optimizing", "Preserve correctness while optimizing"],
		bestPractices: ["Measure before and after", "Prefer algorithmic fixes over micro-optimizations"]
	},
	DevOps: {
		roleLabel: "senior DevOps engineer",
		focusAreas: [
			"CI/CD pipeline",
			"Infrastructure as code",
			"Observability",
			"Rollback safety"
		],
		requirements: ["Ensure changes are reversible", "Keep environments (dev/stage/prod) consistent"],
		bestPractices: ["Automate repeatable operational steps", "Fail fast with clear diagnostics"]
	},
	Documentation: {
		roleLabel: "senior technical writer",
		focusAreas: [
			"Accuracy",
			"Discoverability",
			"Audience-appropriate depth"
		],
		requirements: ["Document the why, not just the what", "Keep examples runnable/copy-pastable"],
		bestPractices: ["Prefer concise, scannable structure with headers"]
	},
	Refactoring: {
		roleLabel: "senior software engineer focused on refactoring",
		focusAreas: [
			"Behavior preservation",
			"Reduced complexity",
			"Improved naming/structure"
		],
		requirements: ["Do not change external behavior unless explicitly requested", "Keep the diff reviewable"],
		bestPractices: ["Refactor in small, verifiable steps", "Add tests first if coverage is missing"]
	},
	"Bug Fix": {
		roleLabel: "senior debugging specialist",
		focusAreas: [
			"Root cause identification",
			"Regression risk",
			"Minimal blast radius"
		],
		requirements: ["Fix the root cause, not just the symptom", "Add a test that reproduces the bug"],
		bestPractices: ["Avoid unrelated changes in the same fix", "Explain the root cause in the summary"]
	},
	"Code Review": {
		roleLabel: "senior code reviewer",
		focusAreas: [
			"Correctness",
			"Security",
			"Readability",
			"Test coverage"
		],
		requirements: ["Flag concrete issues with file/line references", "Distinguish blocking issues from nits"],
		bestPractices: ["Prioritize correctness and security bugs over style preferences"]
	},
	Architecture: {
		roleLabel: "senior software architect",
		focusAreas: [
			"Module boundaries",
			"Scalability",
			"Extensibility",
			"Trade-off analysis"
		],
		requirements: ["Present trade-offs, not just a single answer", "Consider long-term maintenance cost"],
		bestPractices: ["Favor boring, proven patterns over novel ones unless justified"]
	},
	Mobile: {
		roleLabel: "senior mobile engineer",
		focusAreas: [
			"Platform conventions (iOS/Android)",
			"Offline behavior",
			"Battery/network efficiency"
		],
		requirements: ["Respect platform-specific UI conventions", "Handle offline and low-connectivity states"],
		bestPractices: ["Test on both small and large screen sizes"]
	},
	Electron: {
		roleLabel: "senior Electron engineer",
		focusAreas: [
			"Main/renderer/preload boundaries",
			"IPC security",
			"Native module compatibility"
		],
		requirements: ["Keep contextIsolation and sandboxing intact", "Never expose raw ipcRenderer.invoke passthrough"],
		bestPractices: ["Validate all data crossing the IPC boundary", "Keep Node-only APIs out of the renderer"]
	},
	React: {
		roleLabel: "senior React engineer",
		focusAreas: [
			"Component composition",
			"Hooks correctness",
			"Rendering performance"
		],
		requirements: ["Respect the rules of hooks", "Avoid prop drilling where context/state libraries fit better"],
		bestPractices: ["Keep components small and focused", "Memoize only where profiling shows it matters"]
	},
	"Next.js": {
		roleLabel: "senior Next.js engineer",
		focusAreas: [
			"App/Pages router conventions",
			"Server vs client components",
			"Data fetching strategy"
		],
		requirements: ["Use the correct rendering strategy (SSR/SSG/ISR/client) for the use case"],
		bestPractices: ["Keep server-only code out of client bundles"]
	},
	"Node.js": {
		roleLabel: "senior Node.js engineer",
		focusAreas: [
			"Async correctness",
			"Error propagation",
			"Process/resource lifecycle"
		],
		requirements: ["Handle promise rejections explicitly", "Avoid blocking the event loop"],
		bestPractices: ["Prefer async/await with explicit try/catch over unhandled promise chains"]
	},
	".NET": {
		roleLabel: "senior .NET engineer",
		focusAreas: [
			"C# idioms",
			"Dependency injection",
			"Async/await correctness"
		],
		requirements: ["Follow existing project DI and layering conventions"],
		bestPractices: ["Use nullable reference types deliberately", "Dispose IDisposable resources correctly"]
	},
	Flutter: {
		roleLabel: "senior Flutter engineer",
		focusAreas: [
			"Widget composition",
			"State management approach",
			"Platform-adaptive UI"
		],
		requirements: ["Keep widget rebuilds scoped", "Respect the project's state management pattern"],
		bestPractices: ["Prefer const constructors where possible"]
	},
	Python: {
		roleLabel: "senior Python engineer",
		focusAreas: [
			"Type hints",
			"Idiomatic Python",
			"Dependency management"
		],
		requirements: ["Add type hints for new public functions", "Follow PEP 8 conventions"],
		bestPractices: ["Prefer standard library solutions before adding dependencies"]
	},
	"AI Agent": {
		roleLabel: "senior AI agent engineer",
		focusAreas: [
			"Tool/function design",
			"Prompt structure",
			"Failure handling",
			"Context management"
		],
		requirements: ["Define clear tool boundaries and inputs/outputs", "Handle model failures/timeouts gracefully"],
		bestPractices: ["Keep tools narrow and composable", "Make agent behavior observable/debuggable"]
	},
	Custom: {
		roleLabel: "senior software engineer",
		focusAreas: [
			"Correctness",
			"Maintainability",
			"Clarity"
		],
		requirements: ["Solve the stated problem completely", "Keep the change scoped to what was asked"],
		bestPractices: ["Follow existing project conventions", "Prefer simple, readable solutions"]
	}
};
//#endregion
//#region ../../packages/core/dist/promptBuilder/templateEngine.js
function bulletList(items) {
	return items.map((item) => `- ${item}`).join("\n");
}
function generatePrompt({ rawInput, promptType, targetAI }) {
	const profile = PROMPT_TYPE_PROFILES[promptType];
	const trimmedInput = rawInput.trim();
	const aiNote = targetAINote(targetAI);
	return `# Task Request

## Role
Act as a ${profile.roleLabel}.

## Objective
${trimmedInput || "(describe the task here)"}

## Focus Areas
${bulletList(profile.focusAreas)}

## Requirements
${bulletList(profile.requirements)}

## Constraints
- Keep the change scoped to what was requested; do not add unrelated refactors.
- Preserve existing behavior unless the objective explicitly asks for a change.
- Flag any assumptions made due to missing information.

## Best Practices to Apply
${bulletList(profile.bestPractices)}

## Output Format
- Summarize the approach briefly before making changes.
- Make the changes.
- Summarize what changed and why, and note any follow-up work.

## Notes for ${targetAI}
${aiNote}
`;
}
/**
* Builds the request sent to the user's configured AI provider so *it* writes the final prompt,
* rather than filling a fixed local template. Only the (English) task description is inserted
* verbatim; promptType/targetAI are passed as guidance for the AI, not injected as boilerplate.
*/
function buildPromptGenerationRequest({ rawInput, promptType, targetAI }) {
	const profile = PROMPT_TYPE_PROFILES[promptType];
	const aiNote = targetAINote(targetAI);
	const trimmedInput = rawInput.trim();
	return `You are an expert prompt engineer. Write a single, complete, ready-to-use prompt that a developer can paste directly into ${targetAI} to accomplish the task described below.

Task category: ${promptType} (frame the request as if commissioning a ${profile.roleLabel}).
Category guidance. Focus areas: ${profile.focusAreas.join(", ")}. Requirements to satisfy: ${profile.requirements.join(", ")}. Best practices to apply: ${profile.bestPractices.join(", ")}.
Notes specific to ${targetAI}: ${aiNote}

Task description:
"""
${trimmedInput}
"""

Write the final prompt now, in clear English, structured for ${targetAI} (e.g. role, objective, requirements, constraints, output format as appropriate). Base it only on the task description above; do not invent unrelated requirements. Output ONLY the prompt text itself, with no preamble, explanation, or surrounding commentary.`;
}
//#endregion
//#region ../../packages/core/dist/security/codeql.js
/**
* CodeQL is the one scanner with no package manager behind it on most platforms: Homebrew has a
* cask for macOS, but there is no winget, chocolatey or apt package, so the documented install is
* "download a zip and put it on your PATH". That is a poor thing to ask of someone who just wants
* to scan a project, so AgentMate can fetch and unpack it into its own tools folder instead, the
* same place LanguageTool lives.
*
* Nothing here touches the filesystem or the network; it only works out the names and URLs, so the
* main process and the renderer can agree on them.
*/
var CODEQL_TOOL_ID = "codeql";
//#endregion
//#region ../../packages/core/dist/skills/securityAudit.js
/**
* Static security review for skills.
*
* A skill is plain markdown plus whatever support files ship with it, and an agent reads all of
* it as instructions. That makes a skill a code-execution surface: the text can tell the agent to
* exfiltrate a key, to run a piped installer, or to quietly rewrite the user's CLAUDE.md. These
* rules look for the shapes those attacks take, so a skill can be checked before it is trusted.
*
* Everything here is pure and line based, so it runs the same in the main process, in tests, and
* (if it ever needs to) in the renderer.
*/
/** Display order is worst-first, which is also the order the report lists categories in. */
var SKILL_RISK_CATEGORIES = [
	{
		id: "prompt-injection",
		label: "Prompt injection",
		description: "Text that tries to override the agent’s own instructions or hide what it does."
	},
	{
		id: "data-exfiltration",
		label: "Data exfiltration",
		description: "Sending your files, output, or environment to an outside endpoint."
	},
	{
		id: "credential-theft",
		label: "Credential theft",
		description: "Reading keys, tokens, cookies, or wallet files that belong to you."
	},
	{
		id: "privilege-escalation",
		label: "Privilege escalation",
		description: "Asking for admin rights, editing shell profiles, or installing services."
	},
	{
		id: "supply-chain",
		label: "Supply chain",
		description: "Pulling packages from unpinned, private, or non-standard sources."
	},
	{
		id: "remote-code-execution",
		label: "Remote code execution",
		description: "Downloading something and running it, or evaluating fetched text as code."
	},
	{
		id: "anti-refusal",
		label: "Anti-refusal",
		description: "Jailbreak framing that pushes the agent past its own safety rules."
	},
	{
		id: "system-prompt-leak",
		label: "System prompt leakage",
		description: "Asking the agent to reveal its system prompt, tools, or hidden context."
	},
	{
		id: "memory-poisoning",
		label: "Memory poisoning",
		description: "Writing lasting instructions into memory files, rules files, or agent settings."
	},
	{
		id: "unsafe-output",
		label: "Unsafe output handling",
		description: "Rendering or executing model output without escaping or review."
	},
	{
		id: "payment-funnel",
		label: "Dark-pattern payment funnel",
		description: "Upsells, urgency, or payment details pushed through the agent."
	},
	{
		id: "hidden-content",
		label: "Hidden content",
		description: "Invisible characters or encoded blobs carrying instructions you cannot read."
	},
	{
		id: "destructive-action",
		label: "Destructive actions",
		description: "Commands that delete, reset, or overwrite data without a way back."
	},
	{
		id: "overbroad-permissions",
		label: "Overbroad permissions",
		description: "Skipping approval prompts or claiming wildcard tool access."
	}
];
var CATEGORY_INFO_BY_ID = new Map(SKILL_RISK_CATEGORIES.map((c) => [c.id, c]));
function getSkillRiskCategory(id) {
	return CATEGORY_INFO_BY_ID.get(id);
}
var SKILL_AUDIT_SEVERITIES = [
	"critical",
	"high",
	"medium",
	"low"
];
var SEVERITY_ORDER = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3
};
function countFindingsByCategory(findings) {
	const byCategory = /* @__PURE__ */ new Map();
	for (const finding of findings) {
		const current = byCategory.get(finding.category);
		if (!current) {
			byCategory.set(finding.category, {
				count: 1,
				worst: finding.severity
			});
			continue;
		}
		current.count += 1;
		if (SEVERITY_ORDER[finding.severity] < SEVERITY_ORDER[current.worst]) current.worst = finding.severity;
	}
	return SKILL_RISK_CATEGORIES.filter((c) => byCategory.has(c.id)).map((c) => ({
		category: c.id,
		...byCategory.get(c.id)
	}));
}
function countFindingsBySeverity(findings) {
	const counts = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0
	};
	for (const finding of findings) counts[finding.severity] += 1;
	return counts;
}
var SKILL_AUDIT_VERDICT_LABEL = {
	safe: "Looks safe",
	caution: "Read before installing",
	risky: "Risky",
	dangerous: "Do not install"
};
new Set(SKILL_AUDIT_SEVERITIES);
String.raw`([\w.-]+)\/([\w.-]+?)(?:\.git)?`;
//#endregion
//#region ../../packages/core/dist/skills/types.js
var SkillFileSchema = object({
	path: string$1(),
	url: string$1()
});
var SkillSchema = object({
	id: string$1(),
	name: string$1(),
	description: string$1(),
	category: string$1(),
	tags: array(string$1()).default([]),
	author: string$1(),
	version: string$1(),
	popularity: number$1().default(0),
	dependencies: array(string$1()).default([]),
	compatibility: array(string$1()).default([]),
	documentationUrl: string$1().optional(),
	files: array(SkillFileSchema).min(1)
});
object({
	name: string$1(),
	description: string$1().optional(),
	skills: array(SkillSchema)
});
//#endregion
//#region ../../packages/core/dist/skills/uiUxProMax.js
/**
* UI UX Pro Max (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), a featured skill that
* AgentMate installs through the project's own `uipro` CLI instead of through a skill repository.
* The repo generates every platform's files from templates at install time, so copying files out
* of it would not produce a working install; the CLI is the supported path. Everything below
* mirrors the project's README (v2.x).
*/
var UI_UX_PRO_MAX_REPO = "nextlevelbuilder/ui-ux-pro-max-skill";
var UI_UX_PRO_MAX_SKILL_NAME = "ui-ux-pro-max";
/** `owner/repo/skillName`, matching how skills.sh entries are keyed in installed-skills.json. */
var UI_UX_PRO_MAX_SKILL_ID = `${UI_UX_PRO_MAX_REPO}/${UI_UX_PRO_MAX_SKILL_NAME}`;
var UI_UX_PRO_MAX_GITHUB_URL = `https://github.com/${UI_UX_PRO_MAX_REPO}`;
var UI_UX_PRO_MAX_HOMEPAGE = "https://uupm.cc";
var UI_UX_PRO_MAX_NPM_PACKAGE = "ui-ux-pro-max-cli";
var UI_UX_PRO_MAX_PYTHON_URL = "https://www.python.org/downloads/";
/**
* `repositoryId` stamped on InstalledSkillRecord entries for this skill, so removal knows to run
* `uipro uninstall` rather than deleting a folder AgentMate itself wrote. Same idea as
* SKILLS_SH_PSEUDO_REPOSITORY_ID: there is no matching entry in the SkillRepository store.
*/
var UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID = "ui-ux-pro-max-cli";
/**
* The `--ai` values the CLI accepts, in the README's own order. `all` is not listed here: it is a
* separate toggle in the wizard, since it means "every assistant" rather than one more target.
*/
var UI_UX_PRO_MAX_AI_TARGETS = [
	{
		value: "claude",
		label: "Claude Code",
		mode: "skill",
		skillDir: ".claude/skills"
	},
	{
		value: "cursor",
		label: "Cursor",
		mode: "skill",
		skillDir: ".cursor/skills"
	},
	{
		value: "windsurf",
		label: "Windsurf",
		mode: "skill",
		skillDir: ".windsurf/skills"
	},
	{
		value: "antigravity",
		label: "Antigravity",
		mode: "skill",
		skillDir: ".agents/skills"
	},
	{
		value: "copilot",
		label: "GitHub Copilot",
		mode: "workflow"
	},
	{
		value: "kiro",
		label: "Kiro",
		mode: "workflow"
	},
	{
		value: "codex",
		label: "Codex CLI",
		mode: "skill",
		skillDir: ".agents/skills"
	},
	{
		value: "qoder",
		label: "Qoder",
		mode: "skill"
	},
	{
		value: "roocode",
		label: "Roo Code",
		mode: "workflow"
	},
	{
		value: "gemini",
		label: "Gemini CLI",
		mode: "skill"
	},
	{
		value: "trae",
		label: "Trae",
		mode: "skill",
		note: "Switch Trae to SOLO mode first, then the skill activates on UI/UX requests."
	},
	{
		value: "opencode",
		label: "OpenCode",
		mode: "skill"
	},
	{
		value: "continue",
		label: "Continue",
		mode: "skill",
		skillDir: ".continue/skills"
	},
	{
		value: "codebuddy",
		label: "CodeBuddy",
		mode: "skill"
	},
	{
		value: "droid",
		label: "Droid (Factory)",
		mode: "skill",
		skillDir: ".factory/skills"
	},
	{
		value: "kilocode",
		label: "KiloCode",
		mode: "both"
	},
	{
		value: "warp",
		label: "Warp",
		mode: "skill"
	},
	{
		value: "augment",
		label: "Augment",
		mode: "skill"
	},
	{
		value: "codewhale",
		label: "CodeWhale",
		mode: "skill"
	},
	{
		value: "universal",
		label: "Universal (Agent Standard)",
		mode: "skill",
		skillDir: ".agents/skills",
		note: "Writes to the shared .agents/skills folder that agent-standard tools read."
	}
];
var KNOWN_AI_VALUES = /* @__PURE__ */ new Set([...UI_UX_PRO_MAX_AI_TARGETS.map((t) => t.value), "all"]);
/** Guards every value that reaches a shell command or a stored record. */
function isUiProAiTarget(value) {
	return KNOWN_AI_VALUES.has(value);
}
/** The two commands typed inside Claude Code itself to install via the plugin marketplace. */
var UI_UX_PRO_MAX_PLUGIN_COMMANDS = [`/plugin marketplace add ${UI_UX_PRO_MAX_REPO}`, `/plugin install ${UI_UX_PRO_MAX_SKILL_NAME}@ui-ux-pro-max-skill`];
function commandPrefix(method) {
	return method === "npx" ? `npx ${UI_UX_PRO_MAX_NPM_PACKAGE}` : "uipro";
}
function withGlobal(command, global) {
	return global ? `${command} --global` : command;
}
/**
* Builds the shell commands for an install. `claude-plugin` has no shell commands of its own
* (see UI_UX_PRO_MAX_PLUGIN_COMMANDS), so it returns an empty plan.
*/
function buildUiProCommandPlan(options) {
	if (options.method === "claude-plugin") return {
		setup: [],
		install: []
	};
	const agents = options.agents.filter(isUiProAiTarget);
	const prefix = commandPrefix(options.method);
	return {
		setup: options.method === "npm-global" ? [`npm install -g ${UI_UX_PRO_MAX_NPM_PACKAGE}`] : [],
		install: agents.map((agent) => withGlobal(`${prefix} init --ai ${agent}`, options.global))
	};
}
/** `uipro uninstall` per assistant. Removing a global install needs the `--global` flag too. */
function buildUiProUninstallCommands(options) {
	const prefix = commandPrefix(options.method === "npx" ? "npx" : "npm-global");
	const agents = options.agents.filter(isUiProAiTarget);
	if (agents.length === 0) return [withGlobal(`${prefix} uninstall`, options.global)];
	return agents.map((agent) => withGlobal(`${prefix} uninstall --ai ${agent}`, options.global));
}
/** `uipro update` refreshes the installed skill files from the CLI package. */
function buildUiProUpdateCommand(method, global) {
	return withGlobal(`${commandPrefix(method === "npx" ? "npx" : "npm-global")} update`, global);
}
/**
* Updating means two things: pulling the newest CLI from npm, then re-running `uipro update` so
* the installed skill files are regenerated from it. Like the install plan, `claude-plugin` has no
* shell commands (the plugin is updated from inside Claude Code).
*/
function buildUiProUpdatePlan(options) {
	if (options.method === "claude-plugin") return {
		setup: [],
		install: []
	};
	return {
		setup: options.method === "npm-global" ? [`npm install -g ${UI_UX_PRO_MAX_NPM_PACKAGE}@latest`] : [],
		install: [buildUiProUpdateCommand(options.method, options.global)]
	};
}
/**
* The design-system generator, invoked directly. The script path depends on which assistant the
* skill was installed for, hence the folder argument.
*/
function buildUiProDesignSystemCommand(skillDir, query, projectName) {
	return `python3 ${`${skillDir}/${UI_UX_PRO_MAX_SKILL_NAME}/scripts/search.py`} "${query}" --design-system${projectName ? ` -p "${projectName}"` : ""}`;
}
/** The headline numbers from the README, used on the skill card. */
var UI_UX_PRO_MAX_HIGHLIGHTS = [
	{
		count: "84",
		label: "UI styles",
		detail: "Glassmorphism, Claymorphism, Brutalism, Bento Grid, AI-Native UI, and more"
	},
	{
		count: "192",
		label: "Color palettes",
		detail: "Industry-specific palettes aligned 1:1 with the 192 product types"
	},
	{
		count: "74",
		label: "Font pairings",
		detail: "Curated typography combinations with Google Fonts imports"
	},
	{
		count: "161",
		label: "Reasoning rules",
		detail: "Industry-specific design system generation"
	},
	{
		count: "22",
		label: "Tech stacks",
		detail: "React, Next.js, Vue, SwiftUI, Flutter, Laravel…"
	},
	{
		count: "98",
		label: "UX guidelines",
		detail: "Best practices, anti-patterns, accessibility"
	}
];
/** The reasoning-rule categories table from the README. */
var UI_UX_PRO_MAX_RULE_CATEGORIES = [
	{
		category: "Tech & SaaS",
		examples: "SaaS, Micro SaaS, Developer Tool, AI/Chatbot, Cybersecurity"
	},
	{
		category: "Finance",
		examples: "Fintech/Crypto, Banking, Insurance, Invoice & Billing"
	},
	{
		category: "Healthcare",
		examples: "Clinic, Pharmacy, Dental, Veterinary, Mental Health"
	},
	{
		category: "E-commerce",
		examples: "General, Luxury, Marketplace, Subscription Box, Food Delivery"
	},
	{
		category: "Services",
		examples: "Beauty/Spa, Restaurant, Hotel, Legal, Home Services"
	},
	{
		category: "Creative",
		examples: "Portfolio, Agency, Photography, Gaming, Music Streaming"
	},
	{
		category: "Lifestyle",
		examples: "Habit Tracker, Recipe, Meditation, Weather, Mood Tracker"
	},
	{
		category: "Emerging Tech",
		examples: "Web3/NFT, Spatial Computing, Quantum, Drone Fleet"
	}
];
/** The supported-stacks table from the README. */
var UI_UX_PRO_MAX_STACK_GROUPS = [
	{
		group: "Web (HTML)",
		stacks: "HTML + Tailwind (default)"
	},
	{
		group: "React",
		stacks: "React, Next.js, shadcn/ui"
	},
	{
		group: "Vue",
		stacks: "Vue, Nuxt.js, Nuxt UI"
	},
	{
		group: "Other web",
		stacks: "Angular, Svelte, Astro, Three.js, Laravel"
	},
	{
		group: "Desktop",
		stacks: "JavaFX, WPF, WinUI 3, Avalonia, Uno Platform, UWP"
	},
	{
		group: "Mobile",
		stacks: "SwiftUI, Jetpack Compose, React Native, Flutter"
	}
];
/** Prompts the README gives as examples of what activates the skill. */
var UI_UX_PRO_MAX_EXAMPLE_PROMPTS = [
	"Build a landing page for my SaaS product",
	"Create a dashboard for healthcare analytics",
	"Design a portfolio website with dark mode",
	"Make a mobile app UI for e-commerce",
	"Build a fintech banking app with dark theme"
];
`${JSON.stringify("@@agentmate-jest ")}`;
`${JSON.stringify("@@agentmate-playwright ")}`;
//#endregion
//#region ../../packages/core/dist/testing/frameworks.js
var JS_DEFAULT = ["**/*.@(spec|test).?(c|m)[jt]s?(x)", "**/__tests__/**/*.?(c|m)[jt]s?(x)"];
var TEST_FRAMEWORKS = {
	vitest: {
		id: "vitest",
		label: "Vitest",
		language: "js",
		testFiles: JS_DEFAULT
	},
	jest: {
		id: "jest",
		label: "Jest",
		language: "js",
		testFiles: JS_DEFAULT
	},
	playwright: {
		id: "playwright",
		label: "Playwright",
		language: "js",
		testFiles: ["**/*.@(spec|test).?(c|m)[jt]s?(x)"]
	},
	mocha: {
		id: "mocha",
		label: "Mocha",
		language: "js",
		testFiles: ["test/**/*.?(c|m)[jt]s", "**/*.@(spec|test).?(c|m)[jt]s"]
	},
	pytest: {
		id: "pytest",
		label: "pytest",
		language: "python",
		testFiles: ["**/test_*.py", "**/*_test.py"]
	},
	unittest: {
		id: "unittest",
		label: "unittest",
		language: "python",
		testFiles: ["**/test*.py"]
	},
	go: {
		id: "go",
		label: "Go",
		language: "go",
		testFiles: ["**/*_test.go"]
	},
	cargo: {
		id: "cargo",
		label: "Cargo",
		language: "rust",
		testFiles: ["src/**/*.rs", "tests/**/*.rs"]
	},
	dotnet: {
		id: "dotnet",
		label: ".NET",
		language: "csharp",
		testFiles: ["**/*.cs"],
		ignore: ["bin", "obj"]
	},
	dart: {
		id: "dart",
		label: "Dart",
		language: "dart",
		testFiles: ["test/**/*_test.dart"]
	},
	flutter: {
		id: "flutter",
		label: "Flutter",
		language: "dart",
		testFiles: ["test/**/*_test.dart"]
	},
	phpunit: {
		id: "phpunit",
		label: "PHPUnit",
		language: "php",
		testFiles: ["tests/**/*Test.php"]
	},
	rspec: {
		id: "rspec",
		label: "RSpec",
		language: "ruby",
		testFiles: ["spec/**/*_spec.rb"]
	},
	gradle: {
		id: "gradle",
		label: "Gradle",
		language: "jvm",
		testFiles: ["**/src/test/**/*.java", "**/src/test/**/*.kt"]
	},
	maven: {
		id: "maven",
		label: "Maven",
		language: "jvm",
		testFiles: ["**/src/test/**/*.java", "**/src/test/**/*.kt"]
	}
};
function testNodeId(testProjectId, file, path) {
	return path.length === 0 ? `${testProjectId}::${file}` : `${testProjectId}::${file}::${path.join(" > ")}`;
}
//#endregion
//#region ../../packages/core/dist/testing/merge.js
/**
* Glue between what was discovered by reading files and what a runner reported: turning a picked
* node into something a runner can select, and matching each reported result back to its node.
*/
function walk(node, visit) {
	visit(node);
	for (const child of node.children) walk(child, visit);
}
function cloneNode(node) {
	return {
		...node,
		path: [...node.path],
		children: node.children.map(cloneNode)
	};
}
/**
* The tree with nodes added for results discovery did not know about. The input is not changed,
* and only the projects and files that gain a node are copied: everything else is handed back as
* the same object, so a panel redrawing on every batch of results can skip the rows that did not
* change.
*/
function attachResults(tree, results) {
	const known = /* @__PURE__ */ new Set();
	for (const project of tree) walk(project, (node) => known.add(node.id));
	const unknown = results.filter((result) => !known.has(result.id));
	if (unknown.length === 0) return [...tree];
	const touchedProjects = new Set(unknown.map((result) => result.testProjectId));
	const touchedFiles = new Set(unknown.map((result) => testNodeId(result.testProjectId, result.file ?? "", [])));
	const copy = tree.map((project) => touchedProjects.has(project.id) ? {
		...project,
		children: project.children.map((child) => touchedFiles.has(child.id) ? cloneNode(child) : child)
	} : project);
	for (const result of unknown) {
		if (known.has(result.id)) continue;
		const project = copy.find((node) => node.id === result.testProjectId);
		if (!project) continue;
		const fileKey = result.file ?? "";
		const fileId = testNodeId(project.id, fileKey, []);
		let fileNode = project.children.find((node) => node.id === fileId);
		if (!fileNode) {
			const sibling = project.children.find((node) => node.kind === "file" && node.file && node.file.endsWith(node.name));
			const prefix = sibling?.file ? sibling.file.slice(0, sibling.file.length - sibling.name.length) : "";
			fileNode = {
				id: fileId,
				kind: "file",
				name: fileKey ? prefix && fileKey.startsWith(prefix) ? fileKey.slice(prefix.length) : fileKey : "Other results",
				testProjectId: project.id,
				...result.file ? { file: result.file } : {},
				path: [],
				children: []
			};
			project.children.push(fileNode);
			known.add(fileId);
		}
		let parent = fileNode;
		result.path.forEach((segment, index) => {
			const path = result.path.slice(0, index + 1);
			const id = testNodeId(project.id, fileKey, path);
			let node = parent.children.find((entry) => entry.id === id);
			if (!node) {
				node = {
					id,
					kind: index === result.path.length - 1 ? "test" : "suite",
					name: segment,
					testProjectId: project.id,
					...result.file ? { file: result.file } : {},
					...index === result.path.length - 1 && result.line ? { line: result.line } : {},
					path,
					children: []
				};
				parent.children.push(node);
				known.add(id);
			}
			parent = node;
		});
	}
	return copy;
}
var PRECEDENCE = [
	"running",
	"queued",
	"failed",
	"passed",
	"skipped"
];
function combine(statuses) {
	return PRECEDENCE.find((status) => statuses.includes(status));
}
/** A status for every node that has one of its own or below it. */
function aggregateStatuses(tree, results) {
	const own = new Map(results.map((result) => [result.id, result.status]));
	const out = /* @__PURE__ */ new Map();
	const visit = (node) => {
		const status = combine([own.get(node.id), ...node.children.map(visit)]);
		if (status) out.set(node.id, status);
		return status;
	};
	for (const project of tree) visit(project);
	return out;
}
function countResults(results) {
	const counts = {
		passed: 0,
		failed: 0,
		skipped: 0,
		running: 0
	};
	for (const result of results) {
		if (result.path.length === 0) continue;
		if (result.status === "queued" || result.status === "running") counts.running += 1;
		else counts[result.status] += 1;
	}
	return counts;
}
//#endregion
//#region ../../packages/core/dist/tools/diffray.js
var DIFFRAY_TOOL_ID = "diffray";
var DIFFRAY_WEBSITE_URL = "https://diffray.ai/cli";
var DIFFRAY_GITHUB_APP_URL = "https://diffray.ai/integrations/github/";
var DIFFRAY_REPOSITORY_URL = "https://github.com/diffray/diffray";
var DIFFRAY_PROJECT_CONFIG_FILE = ".diffray.json";
var DIFFRAY_AGENTS = [
	{
		id: "general",
		label: "Quality",
		description: "Readability, simplicity, and code smells"
	},
	{
		id: "bug-hunter",
		label: "Bugs",
		description: "Logic errors, nulls, and edge cases"
	},
	{
		id: "security-scan",
		label: "Security",
		description: "Vulnerabilities and leaked secrets"
	},
	{
		id: "performance-check",
		label: "Performance",
		description: "Slow paths and memory leaks"
	},
	{
		id: "consistency-check",
		label: "Consistency",
		description: "Naming and pattern drift"
	}
];
var DIFFRAY_EXECUTORS = [
	{
		id: "claude-cli",
		label: "Claude Code",
		description: "Uses your Claude Code login"
	},
	{
		id: "cursor-agent-cli",
		label: "Cursor Agent",
		description: "Uses your Cursor subscription"
	},
	{
		id: "opencode-cli",
		label: "OpenCode",
		description: "Multi-provider OpenCode CLI"
	},
	{
		id: "codex-cli",
		label: "Codex",
		description: "OpenAI Codex CLI"
	}
];
var DIFFRAY_SEVERITIES = [
	"critical",
	"high",
	"medium",
	"low"
];
var EXECUTOR_DEFAULT = {
	value: "",
	label: "Executor default"
};
/** Model choices per executor, the executor's own default first. Names come from the catalog. */
var DIFFRAY_MODELS = {
	"claude-cli": [EXECUTOR_DEFAULT, ...DIFFRAY_EXECUTOR_MODELS["claude-cli"]],
	"cursor-agent-cli": [EXECUTOR_DEFAULT, ...DIFFRAY_EXECUTOR_MODELS["cursor-agent-cli"]],
	"opencode-cli": [EXECUTOR_DEFAULT, ...DIFFRAY_EXECUTOR_MODELS["opencode-cli"]],
	"codex-cli": [EXECUTOR_DEFAULT, ...DIFFRAY_EXECUTOR_MODELS["codex-cli"]]
};
/** The performance vs quality table from diffray's docs, shown as a hint on the engine step. */
var DIFFRAY_MODEL_TRADEOFFS = [
	{
		model: DIFFRAY_DOC_MODELS.haiku,
		speed: "fast",
		quality: "Good",
		cost: 1,
		costLabel: "Low",
		bestFor: "Daily development, large PRs"
	},
	{
		model: DIFFRAY_DOC_MODELS.sonnet,
		speed: "moderate",
		quality: "Excellent",
		cost: 2,
		costLabel: "Medium",
		bestFor: "Most use cases, balanced approach"
	},
	{
		model: DIFFRAY_DOC_MODELS.opus,
		speed: "fast",
		quality: "Outstanding",
		cost: 3,
		costLabel: "High",
		bestFor: "Optimal balance of speed and quality, security, critical bugs",
		recommended: true
	},
	{
		model: DIFFRAY_DOC_MODELS.codex,
		speed: "fast",
		quality: "Very Good",
		cost: 2,
		costLabel: "Medium",
		bestFor: "General purpose, cost-effective"
	},
	{
		model: DIFFRAY_DOC_MODELS.opencodeNano,
		speed: "fast",
		quality: "Good",
		cost: 1,
		costLabel: "Low",
		bestFor: "Quick reviews, prototyping"
	}
];
var DIFFRAY_DEFAULT_JSON_FILE = "diffray-report.json";
/**
* Extensions diffray can actually reason about. Data files, lockfiles, images, and binaries
* are left out: they burn context without producing findings.
*/
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([
	"astro",
	"bash",
	"c",
	"cc",
	"cjs",
	"clj",
	"cpp",
	"cs",
	"cts",
	"dart",
	"ex",
	"exs",
	"fs",
	"go",
	"groovy",
	"h",
	"hpp",
	"java",
	"js",
	"jsx",
	"kt",
	"kts",
	"lua",
	"m",
	"mjs",
	"mm",
	"mts",
	"php",
	"pl",
	"proto",
	"ps1",
	"psm1",
	"py",
	"r",
	"rb",
	"rs",
	"scala",
	"sh",
	"sql",
	"svelte",
	"swift",
	"ts",
	"tsx",
	"vb",
	"vue",
	"zsh"
]);
/** Directories nobody wants reviewed: dependencies, build output, and caches. */
var IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
	".cache",
	".git",
	".gradle",
	".next",
	".nuxt",
	".svelte-kit",
	".venv",
	"__pycache__",
	"bin",
	"build",
	"coverage",
	"dist",
	"node_modules",
	"obj",
	"out",
	"target",
	"vendor",
	"venv"
]);
var TEST_DIRECTORIES = /* @__PURE__ */ new Set([
	"__mocks__",
	"__tests__",
	"e2e",
	"spec",
	"test",
	"tests"
]);
/**
* npm installs diffray as a .cmd shim on Windows, so each command goes through cmd.exe and
* its 8191 character line limit. Leave room to spare.
*/
var MAX_COMMAND_CHARS = 6e3;
function toPosixPath(path) {
	return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
function normalizeFolder(folder) {
	return toPosixPath(folder?.trim() ?? "").replace(/^\/+|\/+$/g, "");
}
function isDiffrayTestFile(path) {
	const segments = toPosixPath(path).split("/");
	const name = segments.pop() ?? "";
	if (segments.some((segment) => TEST_DIRECTORIES.has(segment.toLowerCase()))) return true;
	return /\.(test|spec)\.[^.]+$/i.test(name);
}
/** True when diffray reviewing the whole file is likely to be worth the tokens. */
function isDiffraySourceFile(path) {
	const normalized = toPosixPath(path);
	if (!normalized || normalized.startsWith("../")) return false;
	const segments = normalized.split("/");
	const name = segments.pop() ?? "";
	if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) return false;
	if (name.endsWith(".d.ts") || /\.(min|bundle|generated)\./i.test(name)) return false;
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return false;
	return SOURCE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}
function filterDiffrayCodebaseFiles(paths, filter = {}) {
	const folder = normalizeFolder(filter.folder);
	const prefix = folder ? `${folder}/` : "";
	const matched = /* @__PURE__ */ new Set();
	for (const raw of paths) {
		const path = toPosixPath(raw);
		if (prefix && !path.startsWith(prefix)) continue;
		if (!isDiffraySourceFile(path)) continue;
		if (!filter.includeTests && isDiffrayTestFile(path)) continue;
		matched.add(path);
	}
	return [...matched].sort((a, b) => a.localeCompare(b));
}
/**
* Folders worth offering as a review target, with the file count each one holds. Only the top
* two levels: deeper than that the picker turns into a file tree, which is not the point here.
*/
function diffrayCodebaseFolders(paths, filter = {}, maxDepth = 2) {
	const counts = /* @__PURE__ */ new Map();
	for (const path of filterDiffrayCodebaseFiles(paths, filter)) {
		const segments = path.split("/");
		segments.pop();
		for (let depth = 1; depth <= Math.min(maxDepth, segments.length); depth += 1) {
			const folder = segments.slice(0, depth).join("/");
			counts.set(folder, (counts.get(folder) ?? 0) + 1);
		}
	}
	return [...counts.entries()].map(([path, fileCount]) => ({
		path,
		fileCount
	})).sort((a, b) => a.path.localeCompare(b.path));
}
/**
* Splits files into review passes. A pass ends at `filesPerPass` files or when the command
* would outgrow the shell's line limit, whichever comes first.
*/
function chunkDiffrayFiles(files, filesPerPass = 10, overheadChars = 120) {
	const perPass = Math.max(1, Math.min(40, Math.round(filesPerPass)));
	const budget = Math.max(200, MAX_COMMAND_CHARS - overheadChars);
	const batches = [];
	let batch = [];
	let length = 0;
	for (const file of files) {
		const cost = file.length + 1;
		if (batch.length > 0 && (batch.length >= perPass || length + cost > budget)) {
			batches.push(batch);
			batch = [];
			length = 0;
		}
		batch.push(file);
		length += cost;
	}
	if (batch.length > 0) batches.push(batch);
	return batches;
}
var ALL_AGENT_IDS = DIFFRAY_AGENTS.map((agent) => agent.id);
function quoteArg(value) {
	if (!/[\s"]/.test(value)) return value;
	return `"${value.replace(/"/g, "\\\"")}"`;
}
function isDiffrayExecutorId(value) {
	return DIFFRAY_EXECUTORS.some((executor) => executor.id === value);
}
function defaultDiffrayExecutorForAgentType(agentType) {
	if (agentType === "cursor") return "cursor-agent-cli";
	if (agentType === "opencode") return "opencode-cli";
	if (agentType === "codex") return "codex-cli";
	return "claude-cli";
}
function allDiffrayAgentIds() {
	return [...ALL_AGENT_IDS];
}
function allDiffraySeverities() {
	return [...DIFFRAY_SEVERITIES];
}
/**
* Builds the `diffray review` command for a wizard run. Flags that match defaults
* (every agent, every severity) are omitted so the command stays short.
*/
function buildDiffrayReviewCommand(input) {
	const parts = ["diffray", "review"];
	if (input.scope === "base-branch" && input.baseRef?.trim()) parts.push("--base", input.baseRef.trim());
	else if (input.scope === "last-commits") {
		const n = Math.max(1, Math.min(50, Math.round(input.commitCount ?? 3)));
		parts.push("--base", `HEAD~${n}`);
	} else if (input.scope === "files" && input.files && input.files.length > 0) {
		parts.push("--files", input.files.join(","));
		if (input.fullFiles) parts.push("--full");
	} else if (input.scope === "codebase" && input.files && input.files.length > 0) parts.push("--files", input.files.join(","), "--full");
	parts.push(...diffrayReviewFlags(input));
	return parts.map(quoteArg).join(" ");
}
/**
* Everything after the scope flags, unquoted. Kept separate from the command so the codebase
* runner script can splat the same flags around a file list it works out at run time.
*/
function diffrayReviewFlags(input) {
	const parts = [];
	const selectedAgents = input.agentIds.filter((id) => ALL_AGENT_IDS.includes(id));
	if (selectedAgents.length > 0 && selectedAgents.length < ALL_AGENT_IDS.length) parts.push("--agent", selectedAgents.join(","));
	if (input.executor.trim()) parts.push("--executor", input.executor.trim());
	const model = input.model?.trim();
	if (model) parts.push("--model", model);
	const selectedSeverities = input.severities.filter((severity) => DIFFRAY_SEVERITIES.includes(severity));
	if (selectedSeverities.length > 0 && selectedSeverities.length < DIFFRAY_SEVERITIES.length) parts.push("--severity", selectedSeverities.join(","));
	if (input.skipValidation) parts.push("--skip-validation");
	if (input.jsonOutput) parts.push("--json");
	else if (input.stream) parts.push("--stream");
	return parts;
}
/**
* Numbers the report file per pass, so a multi-pass codebase review does not overwrite
* itself: `diffray-report.json` becomes `diffray-report-2.json` for the second pass.
*/
function diffrayJsonFileForPass(fileName, pass, passCount) {
	const trimmed = fileName.trim() || "diffray-report.json";
	const withExtension = /\.json$/i.test(trimmed) ? trimmed : `${trimmed}.json`;
	if (passCount <= 1) return withExtension;
	return withExtension.replace(/\.json$/i, `-${pass}.json`);
}
function quotePowerShellLiteral(value) {
	return `'${value.replace(/'/g, "''")}'`;
}
/**
* Sends stdout to a file. Windows terminals open Windows PowerShell, where both `>` (UTF-16)
* and `Out-File -Encoding utf8` (UTF-8 with a BOM) produce a file that JSON parsers choke on,
* so the report is written through .NET instead.
*/
function redirectDiffrayCommandToFile(command, filePath, shell) {
	if (shell === "powershell") return `${command} | Out-String | ForEach-Object { [IO.File]::WriteAllText(${`(Join-Path $PWD ${quotePowerShellLiteral(filePath)})`}, $_) }`;
	return `${command} > ${quoteArg(filePath)}`;
}
/**
* How long everything around the file list is, so a batch can be sized against the real command
* rather than a guess. The probe uses a one character path and the widest report name a run can
* produce, which leaves the estimate a little pessimistic and never short.
*/
function diffrayPassOverheadChars(input, shell, jsonFileName) {
	const probe = buildDiffrayReviewCommand({
		...input,
		files: ["x"]
	});
	return (input.jsonOutput ? redirectDiffrayCommandToFile(probe, diffrayJsonFileForPass(jsonFileName, 999, 999), shell) : probe).length - 1;
}
/**
* Plans a run. Every scope but `codebase` is a single command; a codebase review is split into
* passes so no single invocation drowns the agents (or the shell) in files.
*/
function planDiffrayReview(input, options = {}) {
	const shell = options.shell ?? "posix";
	const fileName = options.jsonFileName?.trim() || "diffray-report.json";
	const batches = input.scope === "codebase" ? chunkDiffrayFiles(input.files ?? [], input.filesPerPass, diffrayPassOverheadChars(input, shell, fileName)) : [input.files ?? []];
	const commands = [];
	const reportFiles = [];
	batches.forEach((files, index) => {
		const command = buildDiffrayReviewCommand({
			...input,
			files
		});
		if (!input.jsonOutput) {
			commands.push(command);
			return;
		}
		const reportFile = diffrayJsonFileForPass(fileName, index + 1, batches.length);
		reportFiles.push(reportFile);
		commands.push(redirectDiffrayCommandToFile(command, reportFile, shell));
	});
	return {
		commands,
		reportFiles
	};
}
/** Chains passes into one line the user can run with a single Enter. */
function joinDiffrayCommands(commands) {
	return commands.join("; ");
}
function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function alternation(values) {
	return [...values].map(escapeRegex).join("|");
}
/**
* The same rules `isDiffraySourceFile` and `isDiffrayTestFile` apply, as regexes a shell can use.
* They are generated from the sets above rather than written out twice, so the script keeps
* matching what the wizard previewed.
*/
var DIFFRAY_FILE_PATTERNS = {
	source: `\\.(${alternation(SOURCE_EXTENSIONS)})$`,
	ignored: `(^|/)(${alternation(IGNORED_DIRECTORIES)})/`,
	test: `(^|/)(${alternation(TEST_DIRECTORIES)})/|\\.(test|spec)\\.[^.]+$`,
	generated: `\\.d\\.ts$|\\.(min|bundle|generated)\\.`
};
function quotePosixLiteral(value) {
	return `'${value.replace(/'/g, "'\\''")}'`;
}
function powerShellCodebaseScript(input, options, reportFile) {
	const ps = quotePowerShellLiteral;
	const flags = diffrayReviewFlags(input).map(ps).join(", ");
	const skip = (options.skipFiles ?? []).map(ps).join(", ");
	return `# diffray whole-file review for ${options.label?.trim() || "this project"}, written by AgentMate.
# The file list is worked out here instead of being pasted onto the prompt, so the command
# you run stays one line long. Ctrl+C stops the run.
$ErrorActionPreference = 'Continue'

$perPass = ${Math.max(1, Math.min(40, Math.round(input.filesPerPass ?? 10)))}
$maxChars = ${MAX_COMMAND_CHARS}
$folder = ${ps(normalizeFolder(options.folder))}
$includeTests = $${options.includeTests ? "true" : "false"}
$reportFile = ${ps(input.jsonOutput ? reportFile : "")}
$sourcePattern = ${ps(DIFFRAY_FILE_PATTERNS.source)}
$ignoredPattern = ${ps(DIFFRAY_FILE_PATTERNS.ignored)}
$testPattern = ${ps(DIFFRAY_FILE_PATTERNS.test)}
$generatedPattern = ${ps(DIFFRAY_FILE_PATTERNS.generated)}
$flags = @(${flags})
$skip = @(${skip})

$files = @(git -c core.quotepath=off ls-files --cached --others --exclude-standard |
  ForEach-Object { $_ -replace '\\\\', '/' } |
  Where-Object { $_ -match $sourcePattern } |
  Where-Object { $_ -notmatch $ignoredPattern -and $_ -notmatch $generatedPattern } |
  Where-Object { $includeTests -or $_ -notmatch $testPattern } |
  Where-Object { $folder -eq '' -or $_.StartsWith($folder + '/') } |
  Where-Object { $skip -notcontains $_ } |
  Sort-Object -Unique)

if ($files.Count -eq 0) {
  Write-Host 'No source files matched. Check the folder and the test filter.' -ForegroundColor Yellow
  exit 1
}

# One pass per batch: diffray goes through a .cmd shim on Windows, and cmd.exe refuses a
# command line past 8191 characters, so the batch is capped by length as well as by count.
$batches = New-Object System.Collections.ArrayList
$current = New-Object System.Collections.ArrayList
$length = 0
foreach ($file in $files) {
  if ($current.Count -gt 0 -and ($current.Count -ge $perPass -or ($length + $file.Length + 1) -gt $maxChars)) {
    [void]$batches.Add(($current -join ','))
    $current.Clear()
    $length = 0
  }
  [void]$current.Add($file)
  $length += $file.Length + 1
}
if ($current.Count -gt 0) { [void]$batches.Add(($current -join ',')) }

Write-Host ("diffray: {0} files in {1} passes" -f $files.Count, $batches.Count) -ForegroundColor Cyan
$failed = @()
$started = Get-Date
for ($i = 0; $i -lt $batches.Count; $i++) {
  $label = "pass {0}/{1}" -f ($i + 1), $batches.Count
  # Indexing has to happen before the call: PowerShell reads $batches[$i] in an argument list
  # as the array followed by a literal [$i].
  $batch = $batches[$i]
  Write-Host ''
  Write-Host "=== diffray $label ===" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  if ($reportFile -eq '') {
    diffray review --files $batch --full @flags
  } else {
    $name = if ($batches.Count -eq 1) { $reportFile } else { $reportFile -replace '\\.json$', ("-{0}.json" -f ($i + 1)) }
    $out = Join-Path $PWD $name
    # Both > and Out-File add a BOM or UTF-16 that JSON parsers choke on, hence .NET here.
    diffray review --files $batch --full @flags | Out-String | ForEach-Object { [IO.File]::WriteAllText($out, $_) }
    Write-Host "wrote $name"
  }
  if ($LASTEXITCODE -ne 0) {
    $failed += ($i + 1)
    Write-Host "$label exited with code $LASTEXITCODE" -ForegroundColor Yellow
  }
}

$elapsed = (Get-Date) - $started
Write-Host ''
if ($failed.Count -gt 0) {
  Write-Host ("Finished in {0:hh\\:mm\\:ss}. Failed passes: {1}" -f $elapsed, ($failed -join ', ')) -ForegroundColor Yellow
} else {
  Write-Host ("All {0} passes finished in {1:hh\\:mm\\:ss}." -f $batches.Count, $elapsed) -ForegroundColor Green
}
`;
}
function posixCodebaseScript(input, options, reportFile) {
	const sh = quotePosixLiteral;
	const flags = diffrayReviewFlags(input).map(sh).join(" ");
	const skip = (options.skipFiles ?? []).map(sh).join(" ");
	return `#!/usr/bin/env bash
# diffray whole-file review for ${options.label?.trim() || "this project"}, written by AgentMate.
# The file list is worked out here instead of being pasted onto the prompt, so the command
# you run stays one line long. Ctrl+C stops the run.

per_pass=${Math.max(1, Math.min(40, Math.round(input.filesPerPass ?? 10)))}
max_chars=${MAX_COMMAND_CHARS}
folder=${sh(normalizeFolder(options.folder))}
include_tests=${options.includeTests ? "1" : "0"}
report_file=${sh(input.jsonOutput ? reportFile : "")}
source_pattern=${sh(DIFFRAY_FILE_PATTERNS.source)}
ignored_pattern=${sh(DIFFRAY_FILE_PATTERNS.ignored)}
test_pattern=${sh(DIFFRAY_FILE_PATTERNS.test)}
generated_pattern=${sh(DIFFRAY_FILE_PATTERNS.generated)}
flags=(${flags})
skip=(${skip})

files=()
while IFS= read -r path; do
  files+=("$path")
done < <(
  git -c core.quotepath=off ls-files --cached --others --exclude-standard |
    tr '\\\\' '/' |
    grep -Ei "$source_pattern" |
    grep -Eiv "$ignored_pattern" |
    grep -Eiv "$generated_pattern" |
    { if [ "$include_tests" = "1" ]; then cat; else grep -Eiv "$test_pattern"; fi; } |
    { if [ -n "$folder" ]; then grep -E "^$folder/"; else cat; fi; } |
    { if [ \${#skip[@]} -gt 0 ]; then grep -Fxv -f <(printf '%s\\n' "\${skip[@]}"); else cat; fi; } |
    sort -u
)

if [ \${#files[@]} -eq 0 ]; then
  printf 'No source files matched. Check the folder and the test filter.\\n'
  exit 1
fi

# One pass per batch, capped by length as well as by count so a long file list cannot
# outgrow the shell's limit on a single command line.
batches=()
current=''
count=0
for file in "\${files[@]}"; do
  if [ $count -gt 0 ] && { [ $count -ge $per_pass ] || [ $(( \${#current} + \${#file} + 1 )) -gt $max_chars ]; }; then
    batches+=("$current")
    current=''
    count=0
  fi
  if [ -z "$current" ]; then current="$file"; else current="$current,$file"; fi
  count=$(( count + 1 ))
done
[ -n "$current" ] && batches+=("$current")

total=\${#batches[@]}
printf 'diffray: %d files in %d passes\\n' "\${#files[@]}" "$total"
failed=()
start=$SECONDS
for i in "\${!batches[@]}"; do
  printf '\\n=== diffray pass %d/%d ===\\n' "$(( i + 1 ))" "$total"
  status=0
  if [ -z "$report_file" ]; then
    diffray review --files "\${batches[$i]}" --full "\${flags[@]}" || status=$?
  else
    if [ "$total" -eq 1 ]; then name="$report_file"; else name="\${report_file%.json}-$(( i + 1 )).json"; fi
    diffray review --files "\${batches[$i]}" --full "\${flags[@]}" > "$name" || status=$?
    printf 'wrote %s\\n' "$name"
  fi
  if [ $status -ne 0 ]; then
    failed+=("$(( i + 1 ))")
    printf 'pass %d/%d exited with code %d\\n' "$(( i + 1 ))" "$total" "$status"
  fi
done

elapsed=$(( SECONDS - start ))
printf '\\n'
if [ \${#failed[@]} -gt 0 ]; then
  printf 'Finished in %dm %ds. Failed passes: %s\\n' "$(( elapsed / 60 ))" "$(( elapsed % 60 ))" "\${failed[*]}"
else
  printf 'All %d passes finished in %dm %ds.\\n' "$total" "$(( elapsed / 60 ))" "$(( elapsed % 60 ))"
fi
`;
}
/**
* A whole-codebase review as a script the terminal runs with one short command. The file list is
* resolved by the script at run time, so hundreds of paths never touch the prompt, and the passes
* are batched there too, which keeps every `diffray review` inside the shell's line limit.
*/
function buildDiffrayCodebaseScript(input, options = {}) {
	const shell = options.shell ?? "posix";
	const reportFile = diffrayJsonFileForPass(options.jsonFileName?.trim() || "diffray-report.json", 1, 1);
	const samplePassCommand = [
		"diffray",
		"review",
		"--files",
		`"<${Math.max(1, Math.min(40, Math.round(input.filesPerPass ?? 10)))} files>"`,
		"--full",
		...diffrayReviewFlags(input).map(quoteArg)
	].join(" ");
	const suffix = (options.scriptId ?? "").replace(/[^a-zA-Z0-9._-]/g, "");
	const stem = suffix ? `diffray-review-${suffix}` : "diffray-review";
	if (shell === "powershell") return {
		fileName: `${stem}.ps1`,
		content: powerShellCodebaseScript(input, options, reportFile),
		commandFor: (scriptPath) => `powershell -NoProfile -ExecutionPolicy Bypass -File ${quoteArg(scriptPath)}`,
		samplePassCommand
	};
	return {
		fileName: `${stem}.sh`,
		content: posixCodebaseScript(input, options, reportFile),
		commandFor: (scriptPath) => `bash ${quoteArg(scriptPath)}`,
		samplePassCommand
	};
}
function buildDiffrayProjectConfig(values) {
	const executor = String(values.executor || "claude-cli");
	const excludeTests = Boolean(values.excludeTests);
	const config = {
		executor: isDiffrayExecutorId(executor) ? executor : "claude-cli",
		concurrency: 6
	};
	if (excludeTests) config.excludePatterns = [
		"**/*.test.ts",
		"**/*.spec.ts",
		"**/*.test.js",
		"**/*.spec.js",
		"**/__tests__/**",
		"dist/**",
		"node_modules/**"
	];
	return {
		kind: "write-project-file",
		relativePath: DIFFRAY_PROJECT_CONFIG_FILE,
		content: `${JSON.stringify(config, null, 2)}\n`
	};
}
//#endregion
//#region ../../packages/core/dist/tools/registry.js
/**
* Curated agent-improvement tools (proxies, plugins, and indexers that reduce token spend or
* make agents write better code), distinct from the MCP/skills marketplaces, since none of
* these are MCP servers or skill packages. Researched from each project's own README/docs as of
* 2026-07-19 (OpenClaw and Hermes: 2026-07-24); re-check upstream before relying on exact flags,
* they may have changed since.
*/
/** Shared so the Tools page tab and the six scanner entries can never drift apart. */
var SECURITY_TOOL_CATEGORY = "Security & Code Scanning";
var AGENT_TOOL_REGISTRY = [
	{
		id: "9router",
		name: "9Router",
		description: "Proxy that routes coding-agent requests across 40+ model providers with automatic subscription → budget → free-tier fallback, plus RTK-style output compression to cut token spend. Ships a local dashboard for connecting providers and watching quota usage.",
		category: "Token & Cost Optimization",
		tags: [
			"proxy",
			"cost-saving",
			"model-routing"
		],
		author: "decolua",
		official: false,
		repositoryUrl: "https://github.com/decolua/9router",
		installKind: "shell",
		installCommand: {
			win32: "npm install -g 9router",
			darwin: "npm install -g 9router",
			linux: "npm install -g 9router"
		},
		updateCommand: {
			win32: "npm install -g 9router@latest",
			darwin: "npm install -g 9router@latest",
			linux: "npm install -g 9router@latest"
		},
		updateCheck: {
			type: "npm",
			package: "9router"
		},
		uninstallCommand: {
			win32: "npm uninstall -g 9router",
			darwin: "npm uninstall -g 9router",
			linux: "npm uninstall -g 9router"
		},
		detectCommand: {
			command: "9router",
			args: ["--version"]
		},
		docker: {
			image: "decolua/9router:latest",
			containerName: "agentmate-9router",
			runArgs: [
				"-p",
				"20128:20128",
				"-v",
				"${HOME}/.9router:/app/data"
			],
			dashboardUrl: "http://localhost:20128"
		},
		settingsFields: [{
			key: "port",
			label: "Dashboard port",
			type: "text",
			defaultValue: "20128"
		}, {
			key: "initialPassword",
			label: "Initial dashboard password",
			type: "text",
			defaultValue: "123456",
			description: "Change this after first login; 123456 is the published default."
		}],
		settingsScope: "global",
		buildSettingsAction: (values) => ({
			kind: "command",
			command: `docker run -d --name agentmate-9router -p ${values.port}:20128 -e INITIAL_PASSWORD=${values.initialPassword} -v \${HOME}/.9router:/app/data decolua/9router:latest`,
			cwd: "none"
		})
	},
	{
		id: "ponytail",
		name: "Ponytail",
		description: "Coding-agent plugin that enforces a \"necessity → reuse → stdlib → one-liner\" decision ladder so agents write minimal code instead of over-engineering, while never skipping validation, error handling, security, or accessibility.",
		category: "Agent Behavior & Prompting",
		tags: [
			"prompting",
			"code-minimalism",
			"plugin"
		],
		author: "DietrichGebert",
		official: false,
		repositoryUrl: "https://github.com/DietrichGebert/ponytail",
		installKind: "interactive",
		interactiveInstall: {
			launchCommand: {
				win32: "claude",
				darwin: "claude",
				linux: "claude"
			},
			pasteCommands: "/plugin marketplace add DietrichGebert/ponytail\n/plugin install ponytail@ponytail"
		},
		manualUninstallInstructions: "/plugin uninstall ponytail@ponytail",
		settingsFields: [{
			key: "mode",
			label: "Intensity",
			type: "select",
			options: [
				{
					value: "lite",
					label: "Lite"
				},
				{
					value: "full",
					label: "Full"
				},
				{
					value: "ultra",
					label: "Ultra"
				},
				{
					value: "off",
					label: "Off"
				}
			],
			defaultValue: "full"
		}],
		settingsScope: "global",
		buildSettingsAction: (values) => ({
			kind: "copy-text",
			content: JSON.stringify({ mode: values.mode }, null, 2),
			instructions: "Save as ~/.config/ponytail/config.json (all platforms)."
		})
	},
	{
		id: "rtk",
		name: "RTK (Rust Token Killer)",
		description: "Rust CLI proxy that transparently compresses git/npm/grep/etc. command output before it reaches the model context, cutting agent token usage 60-90% with zero workflow changes.",
		category: "Token & Cost Optimization",
		tags: [
			"proxy",
			"cost-saving",
			"cli"
		],
		author: "rtk-ai",
		official: false,
		websiteUrl: "https://www.rtk-ai.app/",
		repositoryUrl: "https://github.com/rtk-ai/rtk",
		installKind: "shell",
		installCommand: {
			darwin: "brew install rtk",
			linux: "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh",
			win32: "cargo install --git https://github.com/rtk-ai/rtk"
		},
		updateCommand: {
			darwin: "brew upgrade rtk",
			linux: "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh",
			win32: "cargo install --git https://github.com/rtk-ai/rtk --force"
		},
		updateCheck: {
			type: "github-release",
			package: "rtk-ai/rtk"
		},
		uninstallCommand: {
			win32: "rtk init -g --uninstall",
			darwin: "rtk init -g --uninstall",
			linux: "rtk init -g --uninstall"
		},
		detectCommand: {
			command: "rtk",
			args: ["--version"]
		},
		settingsFields: [
			{
				key: "agent",
				label: "Target agent",
				type: "select",
				options: [
					{
						value: "claude-code",
						label: "Claude Code (default)"
					},
					{
						value: "copilot",
						label: "GitHub Copilot"
					},
					{
						value: "gemini",
						label: "Gemini CLI"
					},
					{
						value: "codex",
						label: "Codex (OpenAI)"
					},
					{
						value: "opencode",
						label: "OpenCode"
					},
					{
						value: "cursor",
						label: "Cursor"
					},
					{
						value: "windsurf",
						label: "Windsurf"
					},
					{
						value: "cline",
						label: "Cline / Roo Code"
					},
					{
						value: "kilocode",
						label: "Kilo Code"
					},
					{
						value: "antigravity",
						label: "Google Antigravity"
					},
					{
						value: "pi",
						label: "Pi"
					},
					{
						value: "hermes",
						label: "Hermes"
					},
					{
						value: "droid",
						label: "Factory Droid"
					}
				],
				defaultValue: "claude-code"
			},
			{
				key: "global",
				label: "Install globally (-g)",
				type: "boolean",
				defaultValue: true
			},
			{
				key: "autoPatch",
				label: "Non-interactive (--auto-patch)",
				type: "boolean",
				defaultValue: false
			},
			{
				key: "hookOnly",
				label: "Hook only, skip RTK.md (--hook-only)",
				type: "boolean",
				defaultValue: false
			}
		],
		settingsScope: "project",
		buildSettingsAction: (values) => {
			const flagByAgent = {
				"claude-code": "",
				copilot: " --copilot",
				gemini: " --gemini",
				codex: " --codex",
				opencode: " --opencode",
				cursor: " --agent cursor",
				windsurf: " --agent windsurf",
				cline: " --agent cline",
				kilocode: " --agent kilocode",
				antigravity: " --agent antigravity",
				pi: " --agent pi",
				hermes: " --agent hermes",
				droid: " --agent droid"
			};
			let command = "rtk init";
			if (values.global) command += " -g";
			command += flagByAgent[String(values.agent)] ?? "";
			if (values.autoPatch) command += " --auto-patch";
			if (values.hookOnly) command += " --hook-only";
			return {
				kind: "command",
				command,
				cwd: "project"
			};
		}
	},
	{
		id: "codegraph",
		name: "CodeGraph",
		description: "Pre-indexes your codebase into a local knowledge graph (tree-sitter + SQLite), so symbol search, call-path tracing, and blast-radius checks are one query instead of a pile of grep/read calls. Re-syncs automatically on every file change.",
		category: "Code Intelligence",
		tags: [
			"mcp",
			"code-indexing",
			"context-efficiency"
		],
		author: "colbymchenry",
		official: false,
		repositoryUrl: "https://github.com/colbymchenry/codegraph",
		installKind: "shell",
		installCommand: {
			win32: "npm i -g @colbymchenry/codegraph && codegraph install",
			darwin: "npm i -g @colbymchenry/codegraph && codegraph install",
			linux: "npm i -g @colbymchenry/codegraph && codegraph install"
		},
		updateCommand: {
			win32: "npm i -g @colbymchenry/codegraph@latest && codegraph install",
			darwin: "npm i -g @colbymchenry/codegraph@latest && codegraph install",
			linux: "npm i -g @colbymchenry/codegraph@latest && codegraph install"
		},
		updateCheck: {
			type: "npm",
			package: "@colbymchenry/codegraph"
		},
		uninstallCommand: {
			win32: "codegraph uninstall",
			darwin: "codegraph uninstall",
			linux: "codegraph uninstall"
		},
		detectCommand: {
			command: "codegraph",
			args: ["--version"]
		},
		quickActions: [{
			id: "init",
			label: "Initialize in project",
			action: {
				kind: "command",
				command: "codegraph init",
				cwd: "project"
			}
		}],
		settingsFields: [{
			key: "exclude",
			label: "Extra exclude globs (comma-separated)",
			type: "text",
			defaultValue: ""
		}, {
			key: "include",
			label: "Force-include globs (comma-separated)",
			type: "text",
			defaultValue: ""
		}],
		settingsScope: "project",
		buildSettingsAction: (values) => {
			const toGlobs = (raw) => String(raw).split(",").map((s) => s.trim()).filter(Boolean);
			const exclude = toGlobs(values.exclude);
			const include = toGlobs(values.include);
			return {
				kind: "write-project-file",
				relativePath: "codegraph.json",
				content: JSON.stringify({
					...exclude.length && { exclude },
					...include.length && { include }
				}, null, 2)
			};
		}
	},
	{
		id: "openclaw",
		name: "OpenClaw",
		description: "Self-hosted personal AI assistant gateway that runs on your own machine and answers from a multi-channel inbox (WhatsApp, Telegram, Slack, Discord, and more), with voice, a live Canvas view, and a local web UI on port 18789.",
		category: "Agent Runtimes & Gateways",
		tags: [
			"gateway",
			"self-hosted",
			"multi-channel",
			"docker"
		],
		author: "openclaw",
		official: false,
		repositoryUrl: "https://github.com/openclaw/openclaw",
		installKind: "shell",
		installCommand: {
			win32: "npm install -g openclaw@latest",
			darwin: "npm install -g openclaw@latest",
			linux: "npm install -g openclaw@latest"
		},
		updateCheck: {
			type: "npm",
			package: "openclaw"
		},
		uninstallCommand: {
			win32: "npm uninstall -g openclaw",
			darwin: "npm uninstall -g openclaw",
			linux: "npm uninstall -g openclaw"
		},
		detectCommand: {
			command: "openclaw",
			args: ["--version"]
		},
		docker: {
			image: "ghcr.io/openclaw/openclaw:latest",
			containerName: "agentmate-openclaw",
			runArgs: [
				"-p",
				"18789:18789",
				"-v",
				"${HOME}/.openclaw:/home/node/.openclaw",
				"-v",
				"${HOME}/.config/openclaw:/home/node/.config/openclaw"
			],
			dashboardUrl: "http://127.0.0.1:18789/"
		},
		quickActions: [{
			id: "gateway",
			label: "Start gateway (foreground)",
			action: {
				kind: "command",
				command: "openclaw gateway --port 18789 --verbose",
				cwd: "none"
			}
		}],
		settingsFields: [
			{
				key: "port",
				label: "Gateway port",
				type: "text",
				defaultValue: "18789"
			},
			{
				key: "gatewayToken",
				label: "Gateway token",
				type: "text",
				defaultValue: "",
				description: "Shared secret the web UI and clients authenticate with. Leave blank to let OpenClaw generate one on first run."
			},
			{
				key: "sandbox",
				label: "Sandbox agent runs (mounts the Docker socket)",
				type: "boolean",
				defaultValue: false
			}
		],
		settingsScope: "global",
		buildSettingsAction: (values) => {
			const token = String(values.gatewayToken).trim();
			const sandbox = values.sandbox ? " -e OPENCLAW_SANDBOX=1 -v /var/run/docker.sock:/var/run/docker.sock" : "";
			return {
				kind: "command",
				command: `docker run -d --name agentmate-openclaw -p ${values.port}:18789 ` + (token ? `-e OPENCLAW_GATEWAY_TOKEN=${token} ` : "") + `-v \${HOME}/.openclaw:/home/node/.openclaw -v \${HOME}/.config/openclaw:/home/node/.config/openclaw${sandbox} ghcr.io/openclaw/openclaw:latest`,
				cwd: "none"
			};
		}
	},
	{
		id: "hermes",
		name: "Hermes Agent",
		description: "Self-improving agent from Nous Research that writes its own skills, keeps memory across sessions, and exposes an OpenAI-compatible gateway plus an optional web dashboard. Runs work on local, Docker, SSH, Modal, or Daytona backends.",
		category: "Agent Runtimes & Gateways",
		tags: [
			"agent",
			"self-hosted",
			"skills",
			"docker"
		],
		author: "Nous Research",
		official: false,
		websiteUrl: "https://hermes-agent.nousresearch.com",
		repositoryUrl: "https://github.com/NousResearch/hermes-agent",
		installKind: "shell",
		installCommand: {
			win32: "irm https://hermes-agent.nousresearch.com/install.ps1 | iex",
			darwin: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
			linux: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
		},
		updateCheck: {
			type: "github-release",
			package: "NousResearch/hermes-agent"
		},
		uninstallCommand: {
			win32: "hermes uninstall --yes",
			darwin: "hermes uninstall --yes",
			linux: "hermes uninstall --yes"
		},
		detectCommand: {
			command: "hermes",
			args: ["--version"]
		},
		docker: {
			image: "nousresearch/hermes-agent:latest",
			containerName: "agentmate-hermes",
			runArgs: [
				"-p",
				"8642:8642",
				"-p",
				"9119:9119",
				"-e",
				"HERMES_DASHBOARD=1",
				"-v",
				"${HOME}/.hermes:/opt/data"
			],
			imageArgs: ["gateway", "run"],
			dashboardUrl: "http://localhost:9119"
		},
		quickActions: [{
			id: "setup",
			label: "Run setup wizard",
			action: {
				kind: "command",
				command: "hermes setup",
				cwd: "none"
			}
		}, {
			id: "doctor",
			label: "Diagnose and fix",
			action: {
				kind: "command",
				command: "hermes doctor --fix",
				cwd: "none"
			}
		}],
		settingsFields: [
			{
				key: "gatewayPort",
				label: "Gateway port (OpenAI-compatible API)",
				type: "text",
				defaultValue: "8642"
			},
			{
				key: "dashboard",
				label: "Enable web dashboard",
				type: "boolean",
				defaultValue: true
			},
			{
				key: "dashboardPort",
				label: "Dashboard port",
				type: "text",
				defaultValue: "9119"
			}
		],
		settingsScope: "global",
		buildSettingsAction: (values) => {
			const dashboard = values.dashboard ? `-p ${values.dashboardPort}:9119 -e HERMES_DASHBOARD=1 ` : "";
			return {
				kind: "command",
				command: `docker run -d --name agentmate-hermes --restart unless-stopped -p ${values.gatewayPort}:8642 ${dashboard}-v \${HOME}/.hermes:/opt/data nousresearch/hermes-agent:latest gateway run`,
				cwd: "none"
			};
		}
	},
	{
		id: DIFFRAY_TOOL_ID,
		name: "diffray",
		description: "Free multi-agent code review CLI. Specialized agents (bugs, security, performance, consistency) review git diffs locally with Claude Code, Cursor Agent, OpenCode, or Codex. After install, each project gets a review wizard. Hosted PR reviews live at diffray.ai.",
		category: "Code Intelligence",
		tags: [
			"code-review",
			"multi-agent",
			"cli"
		],
		author: "diffray",
		official: false,
		websiteUrl: DIFFRAY_WEBSITE_URL,
		repositoryUrl: DIFFRAY_REPOSITORY_URL,
		installKind: "shell",
		installCommand: {
			win32: "npm install -g diffray",
			darwin: "npm install -g diffray",
			linux: "npm install -g diffray"
		},
		updateCommand: {
			win32: "npm install -g diffray@latest",
			darwin: "npm install -g diffray@latest",
			linux: "npm install -g diffray@latest"
		},
		updateCheck: {
			type: "npm",
			package: "diffray"
		},
		uninstallCommand: {
			win32: "npm uninstall -g diffray",
			darwin: "npm uninstall -g diffray",
			linux: "npm uninstall -g diffray"
		},
		detectCommand: {
			command: "diffray",
			args: ["--version"]
		},
		quickActions: [{
			id: "init",
			label: "Initialize in project",
			action: {
				kind: "command",
				command: "diffray config init",
				cwd: "project"
			}
		}, {
			id: "setup-command",
			label: "Install /diffray slash command",
			action: {
				kind: "command",
				command: "diffray setup-command",
				cwd: "none"
			}
		}],
		settingsFields: [{
			key: "executor",
			label: "Review executor",
			type: "select",
			options: DIFFRAY_EXECUTORS.map((executor) => ({
				value: executor.id,
				label: executor.label
			})),
			defaultValue: "claude-cli"
		}, {
			key: "excludeTests",
			label: "Skip tests and build output",
			type: "boolean",
			defaultValue: true,
			description: "Writes excludePatterns for test files, dist, and node_modules."
		}],
		settingsScope: "project",
		buildSettingsAction: buildDiffrayProjectConfig
	},
	{
		id: LANGUAGETOOL_TOOL_ID,
		name: "LanguageTool",
		description: "Grammar, spelling, and style checker behind AgentMate's writing checks. Install it here to run every check offline on this machine instead of sending text to LanguageTool's public API. Needs Java 17 or newer on PATH.",
		category: "Writing & Docs",
		tags: [
			"grammar",
			"offline",
			"java"
		],
		author: "LanguageTool",
		official: true,
		websiteUrl: LANGUAGETOOL_WEBSITE_URL,
		repositoryUrl: LANGUAGETOOL_REPOSITORY_URL,
		installKind: "manual",
		manualInstallInstructions: `1. Download ${LANGUAGETOOL_DOWNLOAD_URL}\n2. Extract it into AgentMate's tools folder (the "Open tools folder" button opens it).\n3. Turn on "Use local LanguageTool" in Settings > AI > Writing check.`
	},
	{
		id: "semgrep",
		name: "Semgrep",
		description: "Pattern-based static analysis for 30+ languages, with a large community ruleset. Fast enough to run on every project and the best first security scan to reach for. Runs the scan from a project’s Security tab. Installs through pip, which on Windows drops the executable into a Scripts folder that is usually not on PATH; AgentMate looks there itself, so the card picks it up when you press Refresh.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"sast",
			"static-analysis",
			"security"
		],
		author: "Semgrep",
		official: true,
		websiteUrl: "https://semgrep.dev",
		repositoryUrl: "https://github.com/semgrep/semgrep",
		installKind: "shell",
		installCommand: {
			win32: "pip install semgrep",
			darwin: "brew install semgrep",
			linux: "pip install semgrep"
		},
		updateCommand: {
			win32: "pip install --upgrade semgrep",
			darwin: "brew upgrade semgrep",
			linux: "pip install --upgrade semgrep"
		},
		updateCheck: {
			type: "pypi",
			package: "semgrep"
		},
		uninstallCommand: {
			win32: "pip uninstall -y semgrep",
			darwin: "brew uninstall semgrep",
			linux: "pip uninstall -y semgrep"
		},
		detectCommand: {
			command: "semgrep",
			args: ["--version"]
		},
		settingsFields: [{
			key: "ruleset",
			label: "Ruleset",
			type: "select",
			options: [
				{
					value: "auto",
					label: "Auto (fetches rules from semgrep.dev)"
				},
				{
					value: "p/security-audit",
					label: "Security audit"
				},
				{
					value: "p/owasp-top-ten",
					label: "OWASP Top 10"
				},
				{
					value: "p/default",
					label: "Default"
				}
			],
			defaultValue: "auto",
			description: "Auto downloads rules from semgrep.dev on every scan. Pick a p/ pack to stay offline."
		}],
		settingsScope: "global",
		buildSettingsAction: (values) => ({
			kind: "command",
			command: `semgrep scan --config ${values.ruleset} --metrics=off .`,
			cwd: "project"
		})
	},
	{
		id: "trivy",
		name: "Trivy",
		description: "Finds known CVEs in your dependencies, hardcoded secrets, and infrastructure-as-code misconfigurations in one pass. The fastest way to learn a project is shipping a vulnerable package.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"dependencies",
			"cve",
			"secrets",
			"iac"
		],
		author: "Aqua Security",
		official: true,
		websiteUrl: "https://trivy.dev",
		repositoryUrl: "https://github.com/aquasecurity/trivy",
		installKind: "shell",
		installCommand: {
			win32: "winget install -e --id AquaSecurity.Trivy",
			darwin: "brew install trivy",
			linux: "curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
		},
		updateCommand: {
			win32: "winget upgrade -e --id AquaSecurity.Trivy",
			darwin: "brew upgrade trivy",
			linux: "curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
		},
		updateCheck: {
			type: "github-release",
			package: "aquasecurity/trivy"
		},
		uninstallCommand: {
			win32: "winget uninstall -e --id AquaSecurity.Trivy",
			darwin: "brew uninstall trivy",
			linux: "sudo rm -f /usr/local/bin/trivy"
		},
		detectCommand: {
			command: "trivy",
			args: ["--version"]
		},
		quickActions: [{
			id: "trivy-db-update",
			label: "Update vulnerability DB",
			action: {
				kind: "command",
				command: "trivy image --download-db-only",
				cwd: "none"
			}
		}]
	},
	{
		id: "bearer",
		name: "Bearer",
		description: "Data-flow analysis that follows sensitive data (PII, tokens, credentials) through your code and flags where it leaks. Complements pattern scanners rather than repeating them. Bearer ships no Windows build at all (no npm, winget or chocolatey package exists either), so on Windows AgentMate runs it through Docker, with your project mounted read-only. Nothing else to install.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"sast",
			"privacy",
			"data-flow"
		],
		author: "Bearer (Cycode)",
		official: true,
		websiteUrl: "https://docs.bearer.com",
		repositoryUrl: "https://github.com/bearer/bearer",
		installKind: "shell",
		installCommand: {
			darwin: "brew install bearer/tap/bearer",
			linux: "curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
		},
		manualInstallInstructions: "Bearer publishes macOS and Linux builds only, and there is no npm, winget or chocolatey package for it. On Windows, run it through Docker: press \"Pull Docker image\" on this card, then scan from a project’s Security tab. AgentMate starts a container per scan with your project mounted read-only and removes it afterwards, so nothing else needs installing.",
		updateCommand: {
			darwin: "brew upgrade bearer",
			linux: "curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
		},
		updateCheck: {
			type: "github-release",
			package: "bearer/bearer"
		},
		uninstallCommand: {
			darwin: "brew uninstall bearer",
			linux: "sudo rm -f /usr/local/bin/bearer"
		},
		detectCommand: {
			command: "bearer",
			args: ["version"]
		},
		quickActions: [{
			id: "bearer-pull-image",
			label: "Pull Docker image",
			action: {
				kind: "command",
				command: "docker pull bearer/bearer:latest-amd64",
				cwd: "none"
			}
		}]
	},
	{
		id: "sonarqube",
		name: "SonarQube Community Build",
		description: "A self-hosted analysis server that tracks vulnerabilities, security hotspots, and code quality over time. Runs as a Docker container with its own dashboard on port 9000; the Security tab scans into it and pulls the findings back out.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"sast",
			"quality",
			"self-hosted",
			"docker"
		],
		author: "SonarSource",
		official: true,
		websiteUrl: "https://docs.sonarsource.com/sonarqube-community-build/",
		repositoryUrl: "https://github.com/SonarSource/sonarqube",
		installKind: "manual",
		manualInstallInstructions: "1. Press \"Docker install\" on this card to create the server container.\n2. Wait for http://localhost:9000 to come up (the first boot takes a couple of minutes) and log in with admin / admin.\n3. Change the password, then create a token under My Account > Security.\n4. Paste that token into the SonarQube setup in a project’s Security tab.",
		updateCheck: {
			type: "github-release",
			package: "SonarSource/sonarqube"
		},
		docker: {
			image: "sonarqube:community",
			containerName: "agentmate-sonarqube",
			runArgs: [
				"-p",
				"9000:9000",
				"-v",
				"agentmate-sonarqube-data:/opt/sonarqube/data",
				"-v",
				"agentmate-sonarqube-extensions:/opt/sonarqube/extensions",
				"-v",
				"agentmate-sonarqube-logs:/opt/sonarqube/logs"
			],
			dashboardUrl: "http://localhost:9000"
		}
	},
	{
		id: "codeql",
		name: "CodeQL CLI",
		description: "GitHub’s semantic analysis engine. It builds a queryable database of your code and traces untrusted input all the way to dangerous sinks, so it finds real exploitable paths that pattern matchers miss. Slow, and worth it. Free for open source; check the licence terms for private code.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"sast",
			"dataflow",
			"github"
		],
		author: "GitHub",
		official: true,
		websiteUrl: "https://codeql.github.com",
		repositoryUrl: "https://github.com/github/codeql-cli-binaries",
		installKind: "manual",
		manualInstallInstructions: "Press \"Download CodeQL\" on this card and AgentMate fetches the official release, checks it against the SHA-256 GitHub publishes beside it, and unpacks it into its own tools folder. Nothing goes on your PATH and nothing needs admin rights.\n\nIf you would rather install it yourself, download the bundle for your platform from https://github.com/github/codeql-cli-binaries/releases/latest, extract it somewhere permanent, and add that folder to your PATH. A codeql already on your PATH is always preferred over the downloaded copy.",
		updateCheck: {
			type: "github-release",
			package: "github/codeql-cli-binaries"
		},
		detectCommand: {
			command: "codeql",
			args: ["version", "--format=terse"]
		}
	},
	{
		id: "strix",
		name: "Strix",
		description: "An autonomous AI agent that runs your code in a sandbox and proves vulnerabilities with real working exploits, so what it reports has no false positives. Needs Docker and your own LLM API key, and a run costs tokens. Installs through pip, which on Windows drops the executable into a Scripts folder that is usually not on PATH; AgentMate looks there itself, so the card picks it up when you press Refresh.",
		category: SECURITY_TOOL_CATEGORY,
		tags: [
			"pentest",
			"ai-agent",
			"dast"
		],
		author: "Strix",
		official: true,
		websiteUrl: "https://usestrix.com",
		repositoryUrl: "https://github.com/usestrix/strix",
		installKind: "shell",
		installCommand: {
			win32: "pip install strix-agent",
			darwin: "pip install strix-agent",
			linux: "pip install strix-agent"
		},
		updateCommand: {
			win32: "pip install --upgrade strix-agent",
			darwin: "pip install --upgrade strix-agent",
			linux: "pip install --upgrade strix-agent"
		},
		updateCheck: {
			type: "pypi",
			package: "strix-agent"
		},
		uninstallCommand: {
			win32: "pip uninstall -y strix-agent",
			darwin: "pip uninstall -y strix-agent",
			linux: "pip uninstall -y strix-agent"
		},
		detectCommand: {
			command: "strix",
			args: ["--version"]
		},
		settingsFields: [{
			key: "model",
			label: "Model",
			type: "text",
			defaultValue: STRIX_DEFAULT_MODEL,
			description: "Passed as STRIX_LLM, in provider/model form."
		}, {
			key: "apiKey",
			label: "LLM API key",
			type: "text",
			defaultValue: "",
			description: "Passed as LLM_API_KEY. Set this in the project Security tab to store it."
		}],
		settingsScope: "global",
		buildSettingsAction: (values) => ({
			kind: "copy-text",
			content: `STRIX_LLM=${values.model}\nLLM_API_KEY=${values.apiKey}`,
			instructions: "Set these as environment variables, or store them in a project’s Security tab so AgentMate passes them for you."
		})
	}
];
//#endregion
//#region ../../packages/core/dist/usage/pricing.js
function priceForModel(model) {
	const id = model.toLowerCase();
	let best = null;
	for (const [key, price] of Object.entries(MODEL_PRICES)) if (id.includes(key) && (!best || key.length > best.key.length)) best = {
		key,
		price
	};
	return best?.price ?? null;
}
/** Per-1M-token price for `model`, or null when it isn't in the price map. */
function getModelPrice(model) {
	return priceForModel(model);
}
//#endregion
//#region ../../packages/core/dist/usage/types.js
/**
* Label for the weekly bucket that meters Claude's top model on top of the shared one. The model
* name comes from the catalog, so it follows when that model changes.
*/
var FABLE_WEEK_LABEL = `Weekly (${CLAUDE_WEEKLY_METERED_MODEL.family})`;
function clampWidgetBlurPercent(value) {
	if (typeof value !== "number" || !Number.isFinite(value)) return 50;
	return Math.min(100, Math.max(0, Math.round(value)));
}
function widgetAlwaysOnTop(widget) {
	return widget.alwaysOnTop !== false;
}
function widgetPeriod(widget) {
	return widget.period === "week" || widget.period === "month" ? widget.period : "day";
}
/** A 3- or 6-digit hex, or null when the widget should use the app theme. */
function widgetBackgroundColor(value) {
	if (value == null || typeof value !== "string") return null;
	const hex = value.trim();
	const six = /^#([0-9a-fA-F]{6})$/.exec(hex);
	if (six) return `#${six[1].toLowerCase()}`;
	const three = /^#([0-9a-fA-F]{3})$/.exec(hex);
	if (!three) return null;
	const [r, g, b] = three[1];
	return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}
function defaultUsageResetAlerts() {
	return {
		enabled: false,
		providerId: "claude-code",
		windows: ["session"],
		chatId: null
	};
}
/**
* A reset-alert block that is safe to read fields off. settings.json is written
* by whichever build ran last (and can be hand-edited), so a saved block may be
* missing pieces this one dereferences without asking: `windows` above all,
* which is filtered and mapped on sight. Anything unusable falls back to the
* default rather than reaching the UI as `undefined`.
*/
function normalizeUsageResetAlerts(alerts) {
	const defaults = defaultUsageResetAlerts();
	if (!alerts || typeof alerts !== "object") return defaults;
	return {
		enabled: alerts.enabled === true,
		providerId: alerts.providerId || defaults.providerId,
		windows: Array.isArray(alerts.windows) ? alerts.windows : defaults.windows,
		chatId: alerts.chatId ?? null
	};
}
function defaultUsageThresholdAlerts() {
	return {
		enabled: false,
		providerId: "claude-code",
		windows: ["session"],
		threshold: 90
	};
}
/**
* A threshold-alert block that is safe to read fields off, for the same
* reason `normalizeUsageResetAlerts` exists: settings.json can be hand-edited
* or written by an older build, so anything unusable falls back to the
* default rather than reaching the UI or the watcher as `undefined`.
*/
function normalizeUsageThresholdAlerts(alerts) {
	const defaults = defaultUsageThresholdAlerts();
	if (!alerts || typeof alerts !== "object") return defaults;
	const threshold = Number(alerts.threshold);
	return {
		enabled: alerts.enabled === true,
		providerId: alerts.providerId || defaults.providerId,
		windows: Array.isArray(alerts.windows) ? alerts.windows : defaults.windows,
		threshold: Number.isFinite(threshold) ? Math.min(100, Math.max(1, threshold)) : defaults.threshold
	};
}
/**
* Providers that can show their plan limits in the bottom status bar, in the
* order the bar and the Settings switches list them.
*/
var STATUS_BAR_USAGE_PROVIDERS = [
	"claude-code",
	"codex",
	"cursor"
];
function defaultStatusBarUsage() {
	return {
		"claude-code": true,
		codex: true,
		cursor: true
	};
}
/**
* Every provider gets an explicit on or off, and anything that isn't a plain
* `false` counts as on, so a provider added later shows up for everyone.
*/
function normalizeStatusBarUsage(value) {
	const saved = value && typeof value === "object" ? value : {};
	const next = defaultStatusBarUsage();
	for (const id of STATUS_BAR_USAGE_PROVIDERS) next[id] = saved[id] !== false;
	return next;
}
//#endregion
//#region ../../packages/core/dist/vault/entries.js
var VAULT_LIMITS = {
	entries: 2e4,
	id: 64,
	title: 200,
	shortText: 1024,
	url: 2048,
	urls: 20,
	tags: 20,
	tagLength: 40,
	customFields: 50,
	fieldLabel: 100,
	secret: 65536,
	notes: 65536,
	/** A 64px site icon as a data URL. Small on purpose: it lives inside the encrypted payload. */
	icon: 49152
};
var id = string$1().min(1).max(VAULT_LIMITS.id);
var timestamp = number$1().int().nonnegative();
var shortText = string$1().max(VAULT_LIMITS.shortText);
var secret = string$1().max(VAULT_LIMITS.secret);
var urls = array(string$1().min(1).max(VAULT_LIMITS.url)).max(VAULT_LIMITS.urls);
var icon = string$1().max(VAULT_LIMITS.icon).regex(/^data:image\/[a-z0-9.+-]+[;,]/i);
var baseShape = {
	id,
	title: string$1().min(1).max(VAULT_LIMITS.title),
	tags: array(string$1().min(1).max(VAULT_LIMITS.tagLength)).max(VAULT_LIMITS.tags),
	favorite: boolean(),
	notes: string$1().max(VAULT_LIMITS.notes),
	createdAt: timestamp,
	updatedAt: timestamp,
	lastUsedAt: timestamp.nullable(),
	/** The site's favicon, fetched once from the editor and kept here so listing never goes online. */
	icon: icon.optional()
};
var VaultCustomFieldSchema = object({
	id,
	label: string$1().min(1).max(VAULT_LIMITS.fieldLabel),
	value: secret,
	concealed: boolean()
});
var VaultEntrySchema = discriminatedUnion("type", [
	object({
		...baseShape,
		type: literal$1("login"),
		username: shortText,
		password: secret,
		urls,
		totpSecret: secret,
		passwordUpdatedAt: timestamp.nullable()
	}),
	object({
		...baseShape,
		type: literal$1("apiKey"),
		service: shortText,
		keyId: shortText,
		secret,
		urls,
		expiresAt: timestamp.nullable()
	}),
	object({
		...baseShape,
		type: literal$1("note")
	}),
	object({
		...baseShape,
		type: literal$1("custom"),
		fields: array(VaultCustomFieldSchema).max(VAULT_LIMITS.customFields)
	})
]);
object({
	schemaVersion: literal$1(1),
	createdAt: timestamp,
	entries: array(VaultEntrySchema).max(VAULT_LIMITS.entries)
});
/**
* What the editor sends back. A secret left `undefined` keeps the stored value, so the renderer
* never has to hold a password it didn't change. An empty string clears it.
*/
var saveBaseShape = {
	id: id.optional(),
	title: string$1().max(VAULT_LIMITS.title),
	tags: array(string$1().max(VAULT_LIMITS.tagLength)).max(VAULT_LIMITS.tags * 2),
	favorite: boolean(),
	notes: string$1().max(VAULT_LIMITS.notes).optional(),
	/** Undefined keeps the stored icon, null removes it. */
	icon: icon.nullable().optional()
};
discriminatedUnion("type", [
	object({
		...saveBaseShape,
		type: literal$1("login"),
		username: shortText.optional(),
		password: secret.optional(),
		urls: array(string$1().max(VAULT_LIMITS.url)).max(VAULT_LIMITS.urls * 2).optional(),
		totpSecret: secret.optional()
	}),
	object({
		...saveBaseShape,
		type: literal$1("apiKey"),
		service: shortText.optional(),
		keyId: shortText.optional(),
		secret: secret.optional(),
		urls: array(string$1().max(VAULT_LIMITS.url)).max(VAULT_LIMITS.urls * 2).optional(),
		expiresAt: timestamp.nullable().optional()
	}),
	object({
		...saveBaseShape,
		type: literal$1("note")
	}),
	object({
		...saveBaseShape,
		type: literal$1("custom"),
		fields: array(object({
			id: id.optional(),
			label: string$1().max(VAULT_LIMITS.fieldLabel),
			value: secret.optional(),
			concealed: boolean()
		})).max(VAULT_LIMITS.customFields)
	})
]);
union([_enum([
	"username",
	"password",
	"totpSecret",
	"secret",
	"keyId",
	"notes",
	"url"
]), object({ customFieldId: id })]);
//#endregion
//#region ../../packages/core/dist/vault/importers.js
var VAULT_IMPORT_FORMAT_LABELS = {
	agentmate: "AgentMate",
	chrome: "Chrome or Edge",
	firefox: "Firefox",
	bitwarden: "Bitwarden",
	onePassword: "1Password"
};
var GENERIC_COLUMN_TARGETS = [
	"title",
	"username",
	"password",
	"url",
	"notes",
	"tags",
	"totp",
	"favorite",
	"extra",
	"ignore"
];
//#endregion
//#region ../../packages/core/dist/vault/commonPasswords.js
/**
* The passwords that top every breach list, lowercased. Anything here (or one of these with
* a few digits or symbols tacked on) gets the lowest score no matter how the math works out.
*/
var COMMON_PASSWORDS = new Set(`123456 123456789 12345678 12345 1234567 1234567890 123123 111111 000000 654321 666666 121212
  112233 123321 7777777 987654321 1q2w3e4r 1qaz2wsx 1q2w3e4r5t qwerty qwertyuiop qwerty123
  asdfgh asdfghjkl zxcvbnm azerty password passw0rd p@ssw0rd password1 password123 pass pass123
  admin administrator root toor guest user test test123 demo changeme default welcome welcome1
  letmein iloveyou loveme lovely love trustno1 monkey dragon master shadow sunshine princess
  football baseball soccer hockey basketball superman batman spiderman starwars pokemon
  michael jennifer jordan jessica ashley daniel charlie thomas hunter ranger buster tigger
  harley andrew joshua matthew robert anthony william george summer winter autumn spring
  flower cookie cheese chocolate banana orange apple pepper ginger freedom whatever secret
  mustang ferrari corvette killer hello hello123 hellokitty computer internet google facebook
  instagram linkedin twitter youtube samsung iphone android microsoft windows linux ubuntu
  login access letmein1 abc123 abcd1234 abcdef abcdefg aa123456 a123456 qazwsx qweasd
  zaq12wsx 1234qwer qwer1234 q1w2e3r4 passport maggie ginger1 silver golden diamond
  purple yellow orange1 blue green red black white hannah amanda nicole jasmine
  matrix mercedes nirvana metallica slipknot liverpool chelsea arsenal barcelona realmadrid
  cowboys eagles yankees lakers raiders steelers packers dolphins donald trump biden
  qwerty1 111222 aaaaaa 11111111 22222222 88888888 99999999 00000000 696969 696969a
  zxcvbn asd123 qwe123 zxc123 iloveu iloveyou1 myspace friends family bailey sophie
  jesus christ angel angels heaven blessed faith grace god lucky lucky7 money cash
  business company office work school student teacher doctor nurse 1234abcd abc12345`.split(/\s+/).filter(Boolean));
//#endregion
//#region ../../packages/core/dist/vault/strength.js
var STRENGTH_LABELS = [
	"Very weak",
	"Weak",
	"Fair",
	"Strong",
	"Very strong"
];
function scoreForBits(bits) {
	if (bits < 28) return 0;
	if (bits < 36) return 1;
	if (bits < 60) return 2;
	if (bits < 80) return 3;
	return 4;
}
var KEYBOARD_ROWS = [
	"qwertyuiop",
	"asdfghjkl;",
	"zxcvbnm,./",
	"1234567890"
];
var COMMON_WARNING = "This is one of the most common passwords.";
/** How much a character that follows a repeat, sequence or pattern still counts. */
var PATTERN_WEIGHT = .2;
function poolSize(chars) {
	let size = 0;
	if (chars.some((c) => /[a-z]/.test(c))) size += 26;
	if (chars.some((c) => /[A-Z]/.test(c))) size += 26;
	if (chars.some((c) => /[0-9]/.test(c))) size += 10;
	if (chars.some((c) => /[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(c))) size += 33;
	if (chars.some((c) => (c.codePointAt(0) ?? 0) > 126)) size += 100;
	return size;
}
/** Lowers every weight in [start, end) except the first to `weight`. */
function discount(weights, start, end, weight) {
	for (let i = start + 1; i < end; i++) weights[i] = Math.min(weights[i], weight);
}
function stripDecorations(value) {
	return value.replace(/^[\d\W_]+/, "").replace(/[\d\W_]+$/, "");
}
function normalizedContext(value) {
	return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
/**
* A small, dependency-free estimate: character pool entropy, with characters that are part of
* a repeat, a run like "abcd" or "4321", a keyboard row, a year, a common password or the entry's
* own title or username counting for much less.
*/
function estimateStrength(password, context = []) {
	const chars = [...password];
	if (chars.length === 0) return {
		bits: 0,
		score: 0,
		label: STRENGTH_LABELS[0],
		warnings: []
	};
	let warnings = /* @__PURE__ */ new Set();
	const weights = chars.map(() => 1);
	const lower = password.toLowerCase();
	const indexOfUnit = (unit) => [...password.slice(0, unit)].length;
	let repeatRun = 1;
	let stepRun = 1;
	for (let i = 1; i < chars.length; i++) {
		const prev = chars[i - 1].codePointAt(0) ?? 0;
		const current = chars[i].codePointAt(0) ?? 0;
		const repeat = current === prev;
		const step = !repeat && Math.abs(current - prev) === 1 && /[\p{L}\p{N}]/u.test(chars[i]);
		repeatRun = repeat ? repeatRun + 1 : 1;
		stepRun = step ? stepRun + 1 : 1;
		if (repeat || step) weights[i] = PATTERN_WEIGHT;
		if (repeatRun >= 3) warnings.add("Repeated characters are easy to guess.");
		if (stepRun >= 3) warnings.add("Runs like \"abcd\" or \"1234\" are easy to guess.");
	}
	for (const row of KEYBOARD_ROWS) for (const line of [row, [...row].reverse().join("")]) for (let len = line.length; len >= 4; len--) for (let start = 0; start + len <= line.length; start++) {
		let at = lower.indexOf(line.slice(start, start + len));
		while (at !== -1) {
			discount(weights, indexOfUnit(at), indexOfUnit(at + len), PATTERN_WEIGHT);
			warnings.add("Keyboard patterns like \"qwerty\" are easy to guess.");
			at = lower.indexOf(line.slice(start, start + len), at + 1);
		}
	}
	for (const match of password.matchAll(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:19|20)\d{2}/g)) {
		const start = indexOfUnit(match.index ?? 0);
		discount(weights, start, start + match[0].length, 0);
		warnings.add("Years and dates are easy to guess.");
	}
	const contextWords = /* @__PURE__ */ new Set();
	for (const value of context) {
		const whole = normalizedContext(value);
		if (whole.length >= 3) contextWords.add(whole);
		for (const word of value.split(/[^\p{L}\p{N}]+/u)) if (word.length >= 3) contextWords.add(word.toLowerCase());
	}
	for (const word of contextWords) {
		let at = lower.indexOf(word);
		while (at !== -1) {
			discount(weights, indexOfUnit(at), indexOfUnit(at + word.length), 0);
			warnings.add("Avoid putting the title, username or site name in the password.");
			at = lower.indexOf(word, at + 1);
		}
	}
	let bits = weights.reduce((sum, w) => sum + w, 0) * Math.log2(poolSize(chars));
	if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(stripDecorations(lower))) {
		bits = Math.min(bits, 10);
		warnings = /* @__PURE__ */ new Set([COMMON_WARNING, ...warnings]);
	}
	const score = scoreForBits(bits);
	return {
		bits: Math.round(bits * 10) / 10,
		score,
		label: STRENGTH_LABELS[score],
		warnings: [...warnings]
	};
}
/** The same rule in the setup form and in main: at least 10 characters and a "Fair" score. */
function masterPasswordProblem(password) {
	if ([...password].length < 10) return `Use at least 10 characters.`;
	if (estimateStrength(password).score < 2) return "This password is too easy to guess. Try a longer phrase of unrelated words.";
	return null;
}
//#endregion
export { UI_UX_PRO_MAX_STACK_GROUPS as $, MENU_SEPARATOR as $n, cliLaunchOptions as $t, buildDiffrayProjectConfig as A, GEMINI_API_MODELS as An, WP_CONNECTOR_VERSION as At, TEST_FRAMEWORKS as B, isImageMime as Bn, generatePassword as Bt, DIFFRAY_MODELS as C, normalizeTargetAI as Cn, WP_HARD_DENY_FILES as Ct, allDiffrayAgentIds as D, DEFAULT_GEMINI_API_MODEL as Dn, wpMirrorPath as Dt, DIFFRAY_TOOL_ID as E, CLAUDE_WEEKLY_METERED_MODEL as En, wpItemRoot as Et, joinDiffrayCommands as F, catalogModelForApiId as Fn, renderCatalogApp as Ft, UI_UX_PRO_MAX_HOMEPAGE as G, LIST_OPTION as Gn, countDotenvKeys as Gt, UI_UX_PRO_MAX_EXAMPLE_PROMPTS as H, referencedAttachmentNames as Hn, DEFAULT_ENV_FILE_NAMES as Ht, planDiffrayReview as I, helpEmbeddingModel as In, checkCatalogSecret as It, UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID as J, MENU_CHECK_ITEM as Jn, validateIpOrCidr as Jt, UI_UX_PRO_MAX_NPM_PACKAGE as K, LIST_SEARCH as Kn, isEnvFileName as Kt, aggregateStatuses as L, BLUEPRINT_FILE_SCHEME as Ln, generateCatalogSecret as Lt, defaultDiffrayExecutorForAgentType as M, OPENAI_API_MODELS as Mn, findCatalogTemplate as Mt, diffrayCodebaseFolders as N, STRIX_DEFAULT_MODEL as Nn, catalogInstallFacts as Nt, allDiffraySeverities as O, DEFAULT_OPENAI_API_MODEL as On, parseWpConnectionKey as Ot, filterDiffrayCodebaseFiles as P, WHISPER_MODELS as Pn, readCatalogInstall as Pt, UI_UX_PRO_MAX_SKILL_NAME as Q, MENU_LABEL as Qn, buildAgentLaunchCommand as Qt, attachResults as R, blueprintFileMarkdown as Rn, generateCatalogSecrets as Rt, DIFFRAY_GITHUB_APP_URL as S, isTargetAI as Sn, WP_HARD_DENY_DIRS as St, DIFFRAY_PROJECT_CONFIG_FILE as T, targetAIForCliId as Tn, wpItemKey as Tt, UI_UX_PRO_MAX_GITHUB_URL as U, BLUEPRINT_STEPS as Un, ENVIRONMENT_KINDS as Ut, UI_UX_PRO_MAX_AI_TARGETS as V, isVideoMime as Vn, generatedEntropy as Vt, UI_UX_PRO_MAX_HIGHLIGHTS as W, blueprintStep as Wn, ENVIRONMENT_KIND_LABELS as Wt, UI_UX_PRO_MAX_RULE_CATEGORIES as X, MENU_ITEM as Xn, validatePortRange as Xt, UI_UX_PRO_MAX_PYTHON_URL as Y, MENU_INDICATOR as Yn, validatePort as Yt, UI_UX_PRO_MAX_SKILL_ID as Z, MENU_ITEM_DANGER as Zn, validateStackName as Zt, AGENT_TOOL_REGISTRY as _, CLI_REGISTRY as _n, LANGUAGETOOL_DEFAULT_PORT as _t, GENERIC_COLUMN_TARGETS as a, defaultEffortFor as an, SKILL_AUDIT_VERDICT_LABEL as at, DIFFRAY_DEFAULT_JSON_FILE as b, cliIdForTargetAI as bn, defaultGrammarSettings as bt, STATUS_BAR_USAGE_PROVIDERS as c, runChoiceArgs as cn, countFindingsBySeverity as ct, normalizeUsageResetAlerts as d, AGENT_TYPES as dn, buildPromptGenerationRequest as dt, launchDefaultArgs as en, MENU_SHORTCUT as er, buildUiProCommandPlan as et, normalizeUsageThresholdAlerts as f, AGENT_TYPE_CLI_ID as fn, generatePrompt as ft, getModelPrice as g, buildBlueprintPrompt as gn, GRAMMAR_MOTHER_TONGUES as gt, widgetPeriod as h, buildBlueprintGenerationRequest as hn, GRAMMAR_LANGUAGES as ht, scoreForBits as i, EFFORT_LABELS as in, SKILL_AUDIT_SEVERITIES as it, chunkDiffrayFiles as j, HELP_EMBEDDING_MODELS as jn, CATALOG_TEMPLATES as jt, buildDiffrayCodebaseScript as k, DEFAULT_WHISPER_MODEL as kn, wpKeyTransportSecurity as kt, clampWidgetBlurPercent as l, runProfileForTargetAI as ln, getSkillRiskCategory as lt, widgetBackgroundColor as m, targetAIForProject as mn, GRAMMAR_ISSUE_KIND_LABELS as mt, STRENGTH_LABELS as n, quoteForShell as nn, OVERLAY_MOTION as nr, buildUiProUninstallCommands as nt, VAULT_IMPORT_FORMAT_LABELS as o, recommendationFromAssessment as on, SKILL_RISK_CATEGORIES as ot, widgetAlwaysOnTop as p, AGENT_TYPE_LABELS as pn, BOWORA_MCP_REPOSITORY_ID as pt, UI_UX_PRO_MAX_PLUGIN_COMMANDS as q, MENU_CHECK_ICON as qn, validateDomain as qt, estimateStrength as r, shellKindFor as rn, OVERLAY_SURFACE as rr, buildUiProUpdatePlan as rt, FABLE_WEEK_LABEL as s, relativeCostLevel as sn, countFindingsByCategory as st, masterPasswordProblem as t, launchDefaultParts as tn, MENU_SUB_TRIGGER as tr, buildUiProDesignSystemCommand as tt, normalizeStatusBarUsage as u, formatFileMentions as un, CODEQL_TOOL_ID as ut, SECURITY_TOOL_CATEGORY as v, DEFAULT_TARGET_AI as vn, LANGUAGETOOL_DOWNLOAD_URL as vt, DIFFRAY_MODEL_TRADEOFFS as w, resolvePromptTargetAI as wn, WP_HARD_DENY_PREFIXES as wt, DIFFRAY_EXECUTORS as x, getCliDefinition as xn, isGrammarMistake as xt, DIFFRAY_AGENTS as y, TARGET_AIS as yn, LANGUAGETOOL_TOOL_ID as yt, countResults as z, blueprintFileUrl as zn, DEFAULT_PASSWORD_OPTIONS as zt };
