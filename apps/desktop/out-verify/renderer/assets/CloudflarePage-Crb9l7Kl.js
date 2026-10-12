import { Bn as RefreshCw, Br as __toESM, Cn as Minus, F as Button, Fr as require_jsx_runtime, I as cn, In as Plus, Lr as require_react, Mn as Pencil, Mt as ExternalLink, Pr as toast, Qn as Shield, Qt as Globe, X as Ban, Xn as Server, Zn as SettingsIcon, _ as SECTION_HEADING, et as Bolt, g as GLASS_PANEL, gn as Lock, gt as CircleX, h as GLASS_CARD, hr as TriangleAlert, ht as CircleQuestion, m as FOOTER_HAIRLINE, mr as Trash2, mt as CircleInfo, pt as CircleCheck, q as ArrowLeft, rr as Spinner, sn as Key, t as SimpleTooltip, v as SECTION_WELL } from "./tooltip-BbU-D7og.js";
import { n as useQuery, p as useQueryClient, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { n as Link, p as useSearchParams, u as useNavigate } from "./chunk-62JRHF6Z-B-4HXhjG.js";
import { r as Input } from "./input-yQ7bc-An.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as Label } from "./label-D49cSr88.js";
import { t as confirmDialog } from "./confirmStore-BkKLridc.js";
import { C as Skeleton, E as LayoutGroup, T as motion, b as usePanelWidth, g as Chip, l as Notice, m as EmptyState, o as SectionCardBody, u as Problem, w as useReducedMotion, x as ResizeHandle, y as PANEL_WIDTHS } from "./pageKit-dgpHZ_9P.js";
import { n as Textarea } from "./textarea-DVv9L3Er.js";
import { n as timeAgo } from "./time-CvQnz64z.js";
import { n as coreErrorMessage } from "./coreErrors-C93UH5Hm.js";
import { t as Switch } from "./switch-DmfrphOr.js";
import { n as SecretInput, t as SshVaultUnlockDialog } from "./SshVaultUnlockDialog-D4cbT2HJ.js";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CUlAg839.js";
import { t as usePageHeader } from "./pageHeaderStore-DyBygWgT.js";
import { _ as cloudflareErrorPermission, d as tokenTemplateUrl, f as CloudflareCard, g as cloudflareErrorMessage, h as cloudflareErrorCode, i as relative, l as missingPermissionLabels, m as NativeSelect, o as CloudflareMark, p as Field, s as CLOUDFLARE_PERMISSIONS, t as GuidedFix, u as tokenProblem } from "./GuidedFix-BWLA6NP-.js";
//#region src/renderer/src/components/cloudflare/PermissionList.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATE_TEXT = {
	granted: "Granted",
	missing: "Missing",
	unverified: "Checked when first used"
};
var STATE_TONE = {
	granted: "success",
	missing: "destructive",
	unverified: "neutral"
};
function StateChip({ state }) {
	const Icon = state === "granted" ? CircleCheck : state === "missing" ? CircleX : CircleQuestion;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
		tone: STATE_TONE[state],
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {}), STATE_TEXT[state]]
	});
}
/**
* The permissions AgentMate asks for, as the token page names them, with what each one is for.
* Given a check, each row also says (in words, with an icon) whether the token has it.
*/
function PermissionList({ checks }) {
	const stateOf = new Map(checks?.map((check) => [check.id, check.state]));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: cn(SECTION_WELL, "settings-rows p-0"),
		children: CLOUDFLARE_PERMISSIONS.map((permission) => {
			const state = stateOf.get(permission.id);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs text-foreground",
						children: permission.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: permission.purpose
					})]
				}), state && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateChip, { state })]
			}, permission.id);
		})
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/TokenSetupCard.tsx
function Step({ number, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": "true",
			className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20",
			children: number
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 flex-1 space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium text-foreground",
				children: title
			}), children]
		})]
	});
}
/**
* Connecting Cloudflare with a token limited to what AgentMate uses. The token page opens with
* those permissions chosen; the token pasted back goes to the main process once, to be checked
* and sealed, and the field is emptied right after.
*/
function TokenSetupCard({ onCancel, onSaved }) {
	const queryClient = useQueryClient();
	const fieldId = (0, import_react.useId)();
	const [token, setToken] = (0, import_react.useState)("");
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function save(event) {
		event.preventDefault();
		const pasted = token.trim();
		const local = tokenProblem(pasted);
		if (local) {
			setProblem(local);
			return;
		}
		setBusy(true);
		setProblem(null);
		try {
			const status = await window.agentmat.cloudflare.saveToken(pasted);
			setToken("");
			queryClient.setQueryData(queryKeys.cloudflareStatus, status);
			queryClient.removeQueries({ queryKey: queryKeys.cloudflareData });
			toast.success("Cloudflare is connected.");
			onSaved?.();
		} catch (error) {
			setProblem(cloudflareErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareMark, {}),
		title: "Connect Cloudflare",
		description: "AgentMate manages your domains with an API token that can only do what is listed below. The token stays on this computer, sealed like your server passwords, and is never shown again.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
			className: "space-y-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Step, {
				number: 1,
				title: "Create a token on Cloudflare",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "The page opens with these permissions already chosen. Under Zone Resources, include all zones or just the domains AgentMate should manage, then create the token and copy it."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionList, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "soft",
						size: "sm",
						onClick: () => void window.agentmat.shell.openExternal(tokenTemplateUrl()),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " Open Cloudflare's token page"]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Step, {
				number: 2,
				title: "Paste the token here",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: (event) => void save(event),
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: fieldId,
								children: "API token"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecretInput, {
								id: fieldId,
								value: token,
								onChange: (value) => {
									setToken(value);
									setProblem(null);
								},
								placeholder: "The token Cloudflare showed you"
							})]
						}),
						problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "text-sm text-destructive",
							children: problem
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								size: "sm",
								disabled: busy || token.trim() === "",
								children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), " Checking with Cloudflare…"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "h-3.5 w-3.5" }), " Save and check"] })
							}), onCancel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "soft",
								size: "sm",
								onClick: onCancel,
								children: "Keep the current token"
							})]
						})
					]
				})
			})]
		}) })
	});
}
//#endregion
//#region src/renderer/src/lib/cloudflare/feedback.ts
/**
* What to tell the user about a failed Cloudflare call. A refusal for want of a permission, a
* token Cloudflare no longer accepts, or a locked vault also changes what the token card should
* say, so its status is fetched again.
*/
function aboutTheToken(error) {
	const code = cloudflareErrorCode(error);
	return code === "missing-permission" || code === "token-rejected" || code === "locked";
}
/** For a failed change, in an event handler. */
function cloudflareFailureText(error, queryClient) {
	if (aboutTheToken(error)) queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareStatus });
	return cloudflareErrorMessage(error);
}
/**
* For a failed query, while rendering: the words to show, with the token status refreshed once
* per failure (from an effect, so rendering itself never starts a fetch).
*/
function useCloudflareError(error) {
	const queryClient = useQueryClient();
	(0, import_react.useEffect)(() => {
		if (error && aboutTheToken(error)) queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareStatus });
	}, [error, queryClient]);
	return error ? cloudflareErrorMessage(error) : null;
}
//#endregion
//#region src/renderer/src/components/cloudflare/TokenStatusCard.tsx
var NOT_CONFIGURED = {
	configured: false,
	locked: false,
	report: null
};
/**
* The saved token: whether Cloudflare still takes it, what it may do, and when something is
* missing, the exact permissions to add on Cloudflare (AC1) with a way to check again after.
* Editing a token's permissions keeps its value, so nothing needs pasting again.
*/
function TokenStatusCard({ status, onReplace }) {
	const queryClient = useQueryClient();
	const [checking, setChecking] = (0, import_react.useState)(false);
	const report = status.report;
	const missing = (report?.permissions ?? []).filter((check) => check.state === "missing").map((check) => check.id);
	const labels = missingPermissionLabels(missing);
	const zoneCount = report?.zoneCount ?? 0;
	const showFix = report !== null && (labels.length > 0 || zoneCount === 0);
	async function checkAgain() {
		setChecking(true);
		try {
			const next = await window.agentmat.cloudflare.checkToken();
			queryClient.setQueryData(queryKeys.cloudflareStatus, next);
			queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareData });
			toast.success("Checked the token again.");
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		} finally {
			setChecking(false);
		}
	}
	async function remove() {
		if (!await confirmDialog({
			title: "Remove the Cloudflare token?",
			description: "AgentMate forgets the token and stops managing your domains. The token keeps working on Cloudflare until you delete it there.",
			confirmLabel: "Remove the token",
			variant: "destructive"
		})) return;
		try {
			await window.agentmat.cloudflare.removeToken();
			queryClient.setQueryData(queryKeys.cloudflareStatus, NOT_CONFIGURED);
			queryClient.removeQueries({ queryKey: queryKeys.cloudflareData });
			toast.success("Removed the Cloudflare token.");
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		}
	}
	let badge;
	if (report && report.status !== "active") badge = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
		tone: "warning",
		dot: true,
		children: report.status === "expired" ? "Expired" : "Disabled"
	});
	else if (labels.length > 0) badge = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
		tone: "warning",
		dot: true,
		children: "Missing permissions"
	});
	else badge = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
		tone: "success",
		dot: true,
		children: "Active"
	});
	const checkButton = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		size: "sm",
		variant: "soft",
		disabled: checking,
		onClick: () => void checkAgain(),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("h-3.5 w-3.5", checking && "motion-safe:animate-spin") }), " Check again"]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareMark, {}),
		title: "Cloudflare token",
		extra: badge,
		description: report ? `Checked ${timeAgo(new Date(report.checkedAt).toISOString())}. It can see ${zoneCount} ${zoneCount === 1 ? "domain" : "domains"}. ${report.source === "policies" ? "Read from the token's own permissions." : "Checked by reading, which changes nothing, so edit access is confirmed the first time you make a change."}` : "Saved, but not checked yet.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			!showFix && checkButton,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "soft",
				onClick: onReplace,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "h-3.5 w-3.5" }), " Replace token"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "danger",
				onClick: () => void remove(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Remove token"]
			})
		] }),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCardBody, {
			className: "space-y-3",
			children: [showFix && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				"aria-label": "What to add to the token",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
					tone: "warning",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: labels.length > 0 ? "On Cloudflare, open My Profile > API Tokens, edit this token and add these permissions, then check again:" : "On Cloudflare, open My Profile > API Tokens and edit this token." }),
							labels.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "flex flex-wrap gap-1.5",
								children: labels.map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "rounded-md bg-background/60 px-2 py-0.5 font-mono text-xs text-foreground ring-1 ring-inset ring-foreground/[0.08]",
									children: label
								}, label))
							}),
							zoneCount === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground",
								children: "The token cannot see any domains. Under Zone Resources, include the domains AgentMate should manage."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: () => void window.agentmat.shell.openExternal("https://dash.cloudflare.com/profile/api-tokens"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " Edit the token on Cloudflare"]
								}), checkButton]
							})
						]
					})
				})
			}), report && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionList, { checks: report.permissions })]
		})
	});
}
//#endregion
//#region src/shared/cloudflare/ip.ts
/**
* IP addresses and ranges, checked by hand because this runs in the renderer as well as in the
* main process (no node:net there). IPv6 is written back the way RFC 5952 asks, which is how
* Cloudflare returns it, so an address typed one way still matches a record stored another way.
*/
var OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
var HEXTET = /^[0-9a-fA-F]{1,4}$/;
var PREFIX = /^(0|[1-9]\d{0,2})$/;
function parseIpv4(text) {
	const parts = text.split(".");
	if (parts.length !== 4 || !parts.every((part) => OCTET.test(part))) return null;
	return parts.map(Number);
}
function parseGroups(text) {
	if (text === "") return [];
	const groups = text.split(":");
	if (!groups.every((group) => HEXTET.test(group))) return null;
	return groups.map((group) => Number.parseInt(group, 16));
}
function parseIpv6(text) {
	let head = text;
	let tail = [];
	const lastColon = text.lastIndexOf(":");
	if (lastColon >= 0 && text.slice(lastColon + 1).includes(".")) {
		const v4 = parseIpv4(text.slice(lastColon + 1));
		if (!v4) return null;
		tail = [v4[0] << 8 | v4[1], v4[2] << 8 | v4[3]];
		head = text.slice(0, lastColon + 1);
		if (!head.endsWith("::")) head = head.slice(0, -1);
	}
	const halves = head.split("::");
	if (halves.length > 2) return null;
	const left = parseGroups(halves[0]);
	const right = halves.length === 2 ? parseGroups(halves[1]) : [];
	if (!left || !right) return null;
	const count = left.length + right.length + tail.length;
	if (halves.length === 1) return count === 8 ? [...left, ...tail] : null;
	if (count > 7) return null;
	return [
		...left,
		...new Array(8 - count).fill(0),
		...right,
		...tail
	];
}
function formatIpv6(groups) {
	let bestStart = -1;
	let bestLength = 0;
	for (let index = 0; index < groups.length;) {
		if (groups[index] !== 0) {
			index += 1;
			continue;
		}
		let end = index;
		while (end < groups.length && groups[end] === 0) end += 1;
		if (end - index > bestLength) {
			bestStart = index;
			bestLength = end - index;
		}
		index = end;
	}
	const hex = groups.map((group) => group.toString(16));
	if (bestLength < 2) return hex.join(":");
	return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
}
function ipVersion(text) {
	if (parseIpv4(text)) return 4;
	if (parseIpv6(text)) return 6;
	return null;
}
/** The address in the one spelling Cloudflare uses, or null when it is not an address. */
function canonicalIp(text) {
	const v4 = parseIpv4(text);
	if (v4) return v4.join(".");
	const v6 = parseIpv6(text);
	return v6 ? formatIpv6(v6) : null;
}
/** Clears the bits past `prefix`, in chunks of `bits` (8 for IPv4 octets, 16 for IPv6 groups). */
function mask(chunks, bits, prefix) {
	return chunks.map((value, index) => {
		const keep = Math.max(0, Math.min(bits, prefix - index * bits));
		return keep === 0 ? 0 : value & (65535 << bits - keep & (1 << bits) - 1);
	});
}
/** A range in CIDR notation, which has to start at its own first address. */
function checkCidr(text) {
	const notRange = {
		ok: false,
		problem: `${text} is not a range like 203.0.113.0/24.`
	};
	const slash = text.indexOf("/");
	if (slash < 0) return notRange;
	const address = text.slice(0, slash);
	const prefixText = text.slice(slash + 1);
	const v4 = parseIpv4(address);
	const v6 = v4 ? null : parseIpv6(address);
	if (!v4 && !v6 || !PREFIX.test(prefixText)) return notRange;
	const prefix = Number(prefixText);
	const version = v4 ? 4 : 6;
	if (prefix > (v4 ? 32 : 128)) return {
		ok: false,
		problem: `IPv${version} ranges go up to /${v4 ? 32 : 128}.`
	};
	const start = v4 ? mask(v4, 8, prefix).join(".") : formatIpv6(mask(v6 ?? [], 16, prefix));
	const written = v4 ? v4.join(".") : formatIpv6(v6 ?? []);
	const network = `${start}/${prefix}`;
	if (start !== written) return {
		ok: false,
		problem: `${text} is not the start of its range. Use ${network}.`
	};
	return {
		ok: true,
		version,
		prefix,
		network
	};
}
//#endregion
//#region src/shared/cloudflare/rules.ts
var COUNTRY = /^(T1|[A-Z]{2})$/;
var MAX_COUNTRIES = 250;
var MAX_ADDRESSES = 100;
var MAX_PATH = 512;
var MAX_DESCRIPTION = 120;
function countryCodes(list) {
	const codes = [...new Set(list.map((code) => code.trim().toUpperCase()))];
	if (codes.length === 0) return {
		ok: false,
		problem: "Pick at least one country."
	};
	if (codes.length > MAX_COUNTRIES) return {
		ok: false,
		problem: `A rule can list up to ${MAX_COUNTRIES} countries.`
	};
	const bad = codes.find((code) => !COUNTRY.test(code));
	return bad ? {
		ok: false,
		problem: `${bad} is not a two-letter country code, such as US or DE.`
	} : {
		ok: true,
		values: codes
	};
}
/** Why a path cannot go into a rule, or null when it can. */
function pathProblem(path) {
	if (!path.startsWith("/")) return "A path starts with a slash, like /wp-login.php.";
	if (path.length > MAX_PATH) return `Keep the path under ${MAX_PATH} characters.`;
	for (const character of path) {
		const code = character.charCodeAt(0);
		if (code <= 32 || code === 127 || character === "\"" || character === "\\") return "A path cannot hold spaces, quotes or backslashes.";
	}
	return null;
}
function addresses(list) {
	const values = [];
	for (const raw of list) {
		const text = raw.trim();
		const ip = canonicalIp(text);
		if (ip) {
			values.push(ip);
			continue;
		}
		if (!text.includes("/")) return {
			ok: false,
			problem: `${text} is not an IP address or a range like 203.0.113.0/24.`
		};
		const range = checkCidr(text);
		if (!range.ok) return range;
		values.push(range.network);
	}
	const unique = [...new Set(values)];
	if (unique.length === 0) return {
		ok: false,
		problem: "Add at least one IP address or range."
	};
	if (unique.length > MAX_ADDRESSES) return {
		ok: false,
		problem: `A rule can list up to ${MAX_ADDRESSES} addresses and ranges.`
	};
	return {
		ok: true,
		values: unique
	};
}
function buildRule(spec) {
	switch (spec.kind) {
		case "block-countries": {
			const codes = countryCodes(spec.countries);
			if (!codes.ok) return codes;
			return {
				ok: true,
				rule: {
					expression: `(ip.src.country in {${codes.values.map((code) => `"${code}"`).join(" ")}})`,
					action: "block",
					first: false
				}
			};
		}
		case "challenge-path": {
			const problem = pathProblem(spec.path);
			if (problem) return {
				ok: false,
				problem
			};
			return {
				ok: true,
				rule: {
					expression: spec.match === "prefix" ? `(starts_with(http.request.uri.path, "${spec.path}"))` : `(http.request.uri.path eq "${spec.path}")`,
					action: "managed_challenge",
					first: false
				}
			};
		}
		case "allow-ips": {
			const listed = addresses(spec.ips);
			if (!listed.ok) return listed;
			return {
				ok: true,
				rule: {
					expression: `(ip.src in {${listed.values.join(" ")}})`,
					action: "skip",
					actionParameters: { ruleset: "current" },
					first: true
				}
			};
		}
		default: return {
			ok: false,
			problem: "That is not a rule AgentMate can build."
		};
	}
}
/** A description to start from, saying what the rule does. */
function describeRule(spec) {
	let text;
	if (spec.kind === "block-countries") text = `Block ${[...new Set(spec.countries.map((code) => code.trim().toUpperCase()))].join(", ")}`;
	else if (spec.kind === "challenge-path") text = `Challenge ${spec.path}${spec.match === "prefix" ? " and below" : ""}`;
	else text = `Allow ${spec.ips.map((ip) => ip.trim()).join(", ")}`;
	return text.length > MAX_DESCRIPTION ? `${text.slice(0, 117)}...` : text;
}
var ACCESS_COUNTRY = /^(t1|[a-z]{2})$/i;
var ASN = /^AS(\d{1,10})$/i;
var RANGE_PREFIXES = {
	4: [16, 24],
	6: [
		32,
		48,
		64
	]
};
/** What an IP access rule's value is: an address, a range, a country or a network (ASN). */
function accessRuleTarget(value) {
	const text = value.trim();
	const version = ipVersion(text);
	if (version) return {
		ok: true,
		target: version === 4 ? "ip" : "ip6",
		value: canonicalIp(text) ?? text
	};
	if (text.includes("/")) {
		const range = checkCidr(text);
		if (!range.ok) return range;
		if (!RANGE_PREFIXES[range.version].includes(range.prefix)) return {
			ok: false,
			problem: "IP access rules take /16 or /24 ranges for IPv4, and /32, /48 or /64 for IPv6."
		};
		return {
			ok: true,
			target: "ip_range",
			value: range.network
		};
	}
	if (ACCESS_COUNTRY.test(text)) return {
		ok: true,
		target: "country",
		value: text.toUpperCase()
	};
	const asn = text.match(ASN);
	if (asn) return {
		ok: true,
		target: "asn",
		value: `AS${asn[1]}`
	};
	return {
		ok: false,
		problem: "Enter an IP address, a range like 203.0.113.0/24, a two-letter country code or an AS number like AS13335."
	};
}
//#endregion
//#region src/renderer/src/lib/cloudflare/labels.ts
/** The words the Cloudflare page uses for Cloudflare's values. */
var SECURITY_LEVEL_LABELS = {
	off: "Off",
	essentially_off: "Essentially off",
	low: "Low",
	medium: "Medium",
	high: "High",
	under_attack: "I'm Under Attack"
};
var SSL_MODE_LABELS = {
	off: "Off (no HTTPS)",
	flexible: "Flexible",
	full: "Full",
	strict: "Full (strict)",
	origin_pull: "Strict (SSL-only origin pull)"
};
var ACCESS_MODE_LABELS = {
	block: "Block",
	challenge: "Interactive challenge",
	js_challenge: "JavaScript challenge",
	managed_challenge: "Managed challenge",
	whitelist: "Allow"
};
var ACCESS_TARGET_LABELS = {
	ip: "IP address",
	ip6: "IPv6 address",
	ip_range: "IP range",
	country: "Country",
	asn: "Network (ASN)"
};
var RULE_ACTION_LABELS = {
	block: "Block",
	managed_challenge: "Managed challenge",
	challenge: "Interactive challenge",
	js_challenge: "JavaScript challenge",
	skip: "Allow (skip the other rules)",
	log: "Log"
};
function ruleActionLabel(action) {
	return RULE_ACTION_LABELS[action] ?? action;
}
function accessModeLabel(mode) {
	return ACCESS_MODE_LABELS[mode];
}
function accessTargetLabel(target) {
	return ACCESS_TARGET_LABELS[target];
}
var ACCESS_MODES = Object.keys(ACCESS_MODE_LABELS);
function ttlLabel(ttl) {
	if (ttl === 1) return "Auto";
	if (ttl % 86400 === 0) return ttl === 86400 ? "1 day" : `${ttl / 86400} days`;
	if (ttl % 3600 === 0) return `${ttl / 3600} hr`;
	if (ttl % 60 === 0) return `${ttl / 60} min`;
	return `${ttl} s`;
}
/** "@" for the zone itself, the label part for names inside it, anything else as it is. */
function relativeName(name, zoneName) {
	if (name === zoneName) return "@";
	return name.endsWith(`.${zoneName}`) ? name.slice(0, -(zoneName.length + 1)) : name;
}
/** "3 h left", "1 h 30 min left", or nothing once it has run out. */
function formatRemaining(seconds) {
	if (seconds <= 0) return "";
	const minutes = Math.ceil(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest} min left`;
	return rest === 0 ? `${hours} h left` : `${hours} h ${rest} min left`;
}
/** The entries of a list typed with commas, spaces or one per line. */
function splitList(text) {
	return text.split(/[\s,]+/).filter(Boolean);
}
//#endregion
//#region src/renderer/src/components/cloudflare/AccessRulesCard.tsx
/** Block reads as danger, a challenge as caution, and an allow as the safe one. */
var MODE_TONE = {
	block: "destructive",
	challenge: "warning",
	js_challenge: "warning",
	managed_challenge: "warning",
	whitelist: "success"
};
function article(word) {
	return /^[AEIOU]/.test(word) ? "an" : "a";
}
/**
* IP access rules (T4): block, challenge or allow one address, a range, a country or a network
* (ASN) for the whole zone. What the value is read as shows while typing.
*/
function AccessRulesCard({ zone }) {
	const queryClient = useQueryClient();
	const id = (0, import_react.useId)();
	const key = queryKeys.cloudflareAccessRules(zone.id);
	const rules = useQuery({
		queryKey: key,
		queryFn: () => window.agentmat.cloudflare.listAccessRules(zone.id)
	});
	const loadError = useCloudflareError(rules.error);
	const [value, setValue] = (0, import_react.useState)("");
	const [mode, setMode] = (0, import_react.useState)("block");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const target = value.trim() ? accessRuleTarget(value) : null;
	async function add(event) {
		event.preventDefault();
		if (!target?.ok) return;
		setBusy(true);
		try {
			const created = await window.agentmat.cloudflare.createAccessRule(zone.id, {
				mode,
				value: value.trim(),
				notes: notes.trim()
			});
			const label = accessModeLabel(mode);
			toast.success(`Added ${article(label)} ${label} rule for ${created.value}.`);
			setValue("");
			setNotes("");
			queryClient.invalidateQueries({ queryKey: key });
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(false);
		}
	}
	async function remove(rule) {
		if (!await confirmDialog({
			title: `Delete the rule for ${rule.value}?`,
			description: "Requests from it are treated like any other again.",
			confirmLabel: "Delete rule",
			variant: "destructive"
		})) return;
		try {
			await window.agentmat.cloudflare.deleteAccessRule(zone.id, rule.id);
			toast.success(`Deleted the rule for ${rule.value}.`);
			queryClient.invalidateQueries({ queryKey: key });
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		}
	}
	let list;
	if (rules.isPending) list = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		"aria-busy": "true",
		children: Array.from({ length: 2 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-14 rounded-full" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-32" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 flex-1" })
			]
		}, index))
	});
	else if (rules.isError) list = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, {
		className: "pt-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
			message: loadError ?? "",
			onRetry: () => void rules.refetch()
		})
	});
	else if (rules.data.length === 0) list = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: cn(FOOTER_HAIRLINE, "px-4 py-3 text-sm text-muted-foreground"),
		children: "No IP access rules yet."
	});
	else list = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		children: rules.data.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					tone: MODE_TONE[rule.mode] ?? "neutral",
					children: accessModeLabel(rule.mode)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: accessTargetLabel(rule.target)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-foreground",
					children: rule.value
				}),
				rule.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate text-xs text-muted-foreground",
					children: rule.notes
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Delete rule",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon-sm",
						variant: "ghost",
						className: "ml-auto hover:bg-destructive/10 hover:text-destructive",
						"aria-label": `Delete the rule for ${rule.value}`,
						onClick: () => void remove(rule),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
					})
				})
			]
		}, rule.id))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ban, {}),
		title: "IP access rules",
		description: `Block, challenge or allow an address, a range, a country or a network for all of ${zone.name}.`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: (event) => void add(event),
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Address, range, country or network",
						htmlFor: `${id}-value`,
						hint: target?.ok ? `Read as: ${accessTargetLabel(target.target)}` : void 0,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: `${id}-value`,
							value,
							placeholder: "203.0.113.0/24, DE or AS13335",
							autoComplete: "off",
							spellCheck: false,
							className: "font-mono",
							onChange: (event) => setValue(event.target.value)
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Action",
						htmlFor: `${id}-mode`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
							id: `${id}-mode`,
							value: mode,
							onChange: (event) => setMode(event.target.value),
							children: ACCESS_MODES.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: candidate,
								children: accessModeLabel(candidate)
							}, candidate))
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Notes",
					htmlFor: `${id}-notes`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `${id}-notes`,
						value: notes,
						maxLength: 500,
						placeholder: "Why this rule exists",
						onChange: (event) => setNotes(event.target.value)
					})
				}),
				target && !target.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "text-sm text-destructive",
					children: target.problem
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					size: "sm",
					disabled: !target?.ok || busy,
					children: [
						busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3.5 w-3.5" }),
						" ",
						"Add access rule"
					]
				})
			]
		}) }), list]
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/RuleBuilderDialog.tsx
var KINDS = [
	{
		kind: "block-countries",
		label: "Block countries",
		description: "Visitors from these countries get an error page."
	},
	{
		kind: "challenge-path",
		label: "Challenge a path",
		description: "Visitors to a page, such as a login, prove they are human first."
	},
	{
		kind: "allow-ips",
		label: "Allow IP addresses",
		description: "Requests from these addresses skip the other custom rules."
	}
];
/**
* Builds a WAF custom rule from a few plain choices and shows the expression Cloudflare will run,
* so nothing is added that the user has not seen. Every value is checked as it is typed; the
* main process checks it again before it reaches Cloudflare.
*/
function RuleBuilderDialog({ zone, open, onOpenChange }) {
	const queryClient = useQueryClient();
	const id = (0, import_react.useId)();
	const [kind, setKind] = (0, import_react.useState)("block-countries");
	const [countries, setCountries] = (0, import_react.useState)("");
	const [path, setPath] = (0, import_react.useState)("");
	const [match, setMatch] = (0, import_react.useState)("exact");
	const [ips, setIps] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)(null);
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	let spec;
	let filledIn;
	if (kind === "block-countries") {
		spec = {
			kind,
			countries: splitList(countries)
		};
		filledIn = countries.trim() !== "";
	} else if (kind === "challenge-path") {
		spec = {
			kind,
			path: path.trim(),
			match
		};
		filledIn = path.trim() !== "";
	} else {
		spec = {
			kind,
			ips: splitList(ips)
		};
		filledIn = ips.trim() !== "";
	}
	const built = buildRule(spec);
	const text = description ?? (filledIn ? describeRule(spec) : "");
	async function add(event) {
		event.preventDefault();
		if (!built.ok || text.trim() === "") return;
		setBusy(true);
		setProblem(null);
		try {
			const rules = await window.agentmat.cloudflare.createCustomRule(zone.id, {
				description: text.trim(),
				spec
			});
			queryClient.setQueryData(queryKeys.cloudflareCustomRules(zone.id), rules);
			toast.success(`Added the rule ${text.trim()}.`);
			onOpenChange(false);
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(false);
		}
	}
	const changed = (set) => (value) => {
		set(value);
		setProblem(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, {
			className: "max-w-xl",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => void add(event),
				className: "flex max-h-[calc(85vh-3rem)] min-h-0 flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Add a custom rule" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
						"Custom rules run for every request to ",
						zone.name,
						", before it reaches your server."
					] })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "-mx-1 min-h-0 space-y-4 overflow-y-auto px-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
								className: "grid gap-2 sm:grid-cols-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
									className: "sr-only",
									children: "Rule"
								}), KINDS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: cn("flex cursor-pointer flex-col gap-1 rounded-xl px-3 py-2 ring-1 ring-inset transition-colors focus-within:ring-2 focus-within:ring-ring", kind === option.kind ? "bg-primary/10 ring-primary/40" : "bg-foreground/[0.03] ring-foreground/[0.08] hover:bg-foreground/[0.06]"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-center gap-2 text-sm font-medium",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `${id}-kind`,
											value: option.kind,
											"aria-label": option.label,
											"aria-describedby": `${id}-${option.kind}`,
											checked: kind === option.kind,
											onChange: () => {
												changed(setKind)(option.kind);
												setDescription(null);
											},
											className: "accent-primary"
										}), option.label]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										id: `${id}-${option.kind}`,
										className: "text-xs text-muted-foreground",
										children: option.description
									})]
								}, option.kind))]
							}),
							kind === "block-countries" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Country codes",
								htmlFor: `${id}-countries`,
								hint: "Two-letter codes, separated by commas, such as CN, RU. T1 stands for Tor.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: `${id}-countries`,
									value: countries,
									autoComplete: "off",
									spellCheck: false,
									className: "font-mono",
									onChange: (event) => changed(setCountries)(event.target.value)
								})
							}),
							kind === "challenge-path" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Path",
									htmlFor: `${id}-path`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: `${id}-path`,
										value: path,
										placeholder: "/wp-login.php",
										autoComplete: "off",
										spellCheck: false,
										className: "font-mono",
										onChange: (event) => changed(setPath)(event.target.value)
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Match",
									htmlFor: `${id}-match`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										id: `${id}-match`,
										value: match,
										onChange: (event) => changed(setMatch)(event.target.value),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "exact",
											children: "Exactly this path"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "prefix",
											children: "This path and everything under it"
										})]
									})
								})]
							}),
							kind === "allow-ips" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Addresses and ranges",
								htmlFor: `${id}-ips`,
								hint: "One per line, or separated by commas, such as 203.0.113.10 or 2001:db8::/32.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: `${id}-ips`,
									value: ips,
									rows: 3,
									spellCheck: false,
									className: "font-mono text-xs",
									onChange: (event) => changed(setIps)(event.target.value)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Description",
								htmlFor: `${id}-description`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: `${id}-description`,
									value: text,
									maxLength: 500,
									onChange: (event) => changed(setDescription)(event.target.value)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 rounded-xl bg-foreground/[0.03] p-3 ring-1 ring-inset ring-foreground/[0.08]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium text-muted-foreground",
									children: "What Cloudflare will run"
								}), built.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
										"aria-label": "Expression",
										className: "whitespace-pre-wrap break-all font-mono text-xs text-foreground",
										children: built.rule.expression
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-foreground",
										children: ["Action: ", ruleActionLabel(built.rule.action)]
									}),
									built.rule.first && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: "This rule goes first, so the rules after it never see these addresses."
									})
								] }) : filledIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									role: "alert",
									className: "text-xs text-destructive",
									children: built.problem
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "Fill in the rule to see its expression."
								})]
							}),
							problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "text-sm text-destructive",
								children: problem
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "soft",
						onClick: () => onOpenChange(false),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						disabled: !built.ok || text.trim() === "" || busy,
						children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), " Add rule"]
					})] })
				]
			})
		})
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/CustomRulesCard.tsx
/** Block reads as danger, a challenge as caution, an allow as the safe one, and a log as neither. */
function actionTone(action) {
	if (action === "block") return "destructive";
	if (action === "skip") return "success";
	if (action === "log") return "neutral";
	return "warning";
}
function nameOf(rule) {
	return rule.description || "this rule";
}
/**
* The zone's WAF custom rules (T4), in the order Cloudflare runs them. Each can be switched off
* without losing it; a delete asks first. New rules come from the builder.
*/
function CustomRulesCard({ zone }) {
	const queryClient = useQueryClient();
	const key = queryKeys.cloudflareCustomRules(zone.id);
	const rules = useQuery({
		queryKey: key,
		queryFn: () => window.agentmat.cloudflare.listCustomRules(zone.id)
	});
	const loadError = useCloudflareError(rules.error);
	const [building, setBuilding] = (0, import_react.useState)(false);
	const [changing, setChanging] = (0, import_react.useState)(null);
	async function setEnabled(rule, enabled) {
		setChanging(rule.id);
		try {
			queryClient.setQueryData(key, await window.agentmat.cloudflare.setCustomRuleEnabled(zone.id, rule.id, enabled));
			toast.success(`${rule.description || "The rule"} is ${enabled ? "on" : "off"}.`);
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		} finally {
			setChanging(null);
		}
	}
	async function remove(rule) {
		if (!await confirmDialog({
			title: `Delete the rule ${nameOf(rule)}?`,
			description: "Requests it matched go through as if it was never there. To pause it instead, switch it off.",
			confirmLabel: "Delete rule",
			variant: "destructive"
		})) return;
		try {
			queryClient.setQueryData(key, await window.agentmat.cloudflare.deleteCustomRule(zone.id, rule.id));
			toast.success(`Deleted the rule ${nameOf(rule)}.`);
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		}
	}
	let body;
	if (rules.isPending) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		"aria-busy": "true",
		children: Array.from({ length: 2 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-3/4" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-9 rounded-full" })]
		}, index))
	});
	else if (rules.isError) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
		message: loadError ?? "",
		onRetry: () => void rules.refetch()
	}) });
	else if (rules.data.length === 0) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		size: "sm",
		icon: Shield,
		title: "No custom rules yet",
		description: "Add one to block countries, challenge a login page or let your office through.",
		className: FOOTER_HAIRLINE
	});
	else body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		children: rules.data.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex flex-wrap items-center gap-3 px-4 py-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex flex-wrap items-center gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-foreground",
						children: rule.description || "No description"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						tone: actionTone(rule.action),
						children: ruleActionLabel(rule.action)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: rule.expression.length > 60 ? rule.expression : null,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate font-mono text-xs text-muted-foreground",
						children: rule.expression
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-6 text-xs text-muted-foreground",
						children: rule.enabled ? "On" : "Off"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: rule.enabled,
						disabled: changing === rule.id,
						"aria-label": nameOf(rule),
						onCheckedChange: (checked) => void setEnabled(rule, checked)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "Delete rule",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "icon-sm",
							variant: "ghost",
							className: "hover:bg-destructive/10 hover:text-destructive",
							"aria-label": `Delete the rule ${nameOf(rule)}`,
							onClick: () => void remove(rule),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
						})
					})
				]
			})]
		}, rule.id))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {}),
		title: "WAF custom rules",
		description: "Cloudflare runs them top to bottom. An allow rule skips the ones below it.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			size: "sm",
			onClick: () => setBuilding(true),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3.5 w-3.5" }), " Add rule"]
		}),
		children: [body, building && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RuleBuilderDialog, {
			zone,
			open: true,
			onOpenChange: setBuilding
		})]
	});
}
var MAX_URL = 2048;
var STRICT_NEEDS = "Full (strict) needs a trusted certificate on the server, such as one from Let's Encrypt.";
/**
* What a proxied domain's SSL/TLS mode means for its visitors, and the mode to move to. The mode
* is zone wide and only applies to proxied records; DNS-only records reach the server directly.
*/
function sslAdvice(mode) {
	switch (mode) {
		case "strict":
		case "origin_pull": return {
			level: "ok",
			recommended: mode,
			message: "Cloudflare encrypts the connection to your server and checks the server's certificate. This is the safest mode."
		};
		case "full": return {
			level: "improve",
			recommended: "strict",
			message: `The connection to your server is encrypted, but its certificate is not checked, so anyone in between could pose as it. ${STRICT_NEEDS}`
		};
		case "flexible": return {
			level: "warning",
			recommended: "strict",
			message: `Cloudflare reaches your server over plain HTTP, and a server that redirects to HTTPS sends visitors round in a loop. ${STRICT_NEEDS}`
		};
		default: return {
			level: "warning",
			recommended: "strict",
			message: `Visitors get no HTTPS at all. ${STRICT_NEEDS}`
		};
	}
}
/** The URLs to purge, one per line, as full http or https addresses. */
function checkPurgeUrls(text) {
	const lines = [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
	if (lines.length === 0) return {
		ok: false,
		problem: "Enter at least one URL to purge."
	};
	if (lines.length > 30) return {
		ok: false,
		problem: `Cloudflare purges up to 30 URLs at a time.`
	};
	for (const line of lines) {
		let url = null;
		try {
			url = new URL(line);
		} catch {
			url = null;
		}
		if (!url || url.protocol !== "https:" && url.protocol !== "http:") return {
			ok: false,
			problem: `${line} is not a full web address. Start it with https://.`
		};
		if (line.length > MAX_URL) return {
			ok: false,
			problem: `Keep each URL under ${MAX_URL} characters.`
		};
	}
	return {
		ok: true,
		urls: lines
	};
}
//#endregion
//#region src/renderer/src/components/cloudflare/PointDomainDialog.tsx
var ACTION_TEXT = {
	create: "Add",
	update: "Change",
	delete: "Remove",
	keep: "Keep"
};
var ACTION_ICON = {
	create: Plus,
	update: Pencil,
	delete: Minus,
	keep: CircleCheck
};
function detail(change) {
	if (change.action === "delete") return `${change.content}: ${change.reason === "cname-conflict" ? "a CNAME cannot share a name with address records" : "it points somewhere else"}`;
	if (change.action === "update" && change.previous !== change.content) return `${change.previous} to ${change.content}`;
	if (change.action === "update") return `${change.content}, ${change.proxied ? "now proxied" : "now DNS only"}`;
	return change.content;
}
function SwitchRow({ id, label, description, checked, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.03] px-3 py-2 ring-1 ring-inset ring-foreground/[0.08]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				id,
				className: "text-sm font-medium",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: description
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			checked,
			"aria-labelledby": id,
			onCheckedChange: onChange
		})]
	});
}
/**
* Points a name in the zone (and its www) at one of the saved servers. The preview lists every
* record that would be added, changed or removed, so nothing happens that was not shown; applying
* runs as one batch on Cloudflare, and running it again finds nothing to change.
*/
function PointDomainDialog({ zone, open, onOpenChange }) {
	const queryClient = useQueryClient();
	const id = (0, import_react.useId)();
	const serversQuery = useQuery({
		queryKey: queryKeys.deployServers,
		queryFn: () => window.agentmat.deploy.listServers()
	});
	const servers = (serversQuery.data ?? []).filter((server) => !server.dev);
	const [serverId, setServerId] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("@");
	const [includeWww, setIncludeWww] = (0, import_react.useState)(true);
	const [proxied, setProxied] = (0, import_react.useState)(true);
	const [plan, setPlan] = (0, import_react.useState)(null);
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [done, setDone] = (0, import_react.useState)(null);
	const navigate = useNavigate();
	const server = servers.find((candidate) => candidate.id === serverId) ?? servers[0];
	const input = server ? {
		zoneId: zone.id,
		name: name.trim() || "@",
		serverId: server.id,
		includeWww,
		proxied
	} : null;
	const changing = plan?.changes.filter((change) => change.action !== "keep") ?? [];
	const settings = queryClient.getQueryData(queryKeys.cloudflareSettings(zone.id));
	const advice = proxied && settings ? sslAdvice(settings.ssl.value) : null;
	const reset = (set) => (value) => {
		set(value);
		setPlan(null);
		setProblem(null);
	};
	async function preview() {
		if (!input) return;
		setBusy("preview");
		setProblem(null);
		try {
			setPlan(await window.agentmat.cloudflare.planPointDomain(input));
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(null);
		}
	}
	async function apply() {
		if (!input || !plan || !server) return;
		setBusy("apply");
		setProblem(null);
		try {
			const result = await window.agentmat.cloudflare.pointDomain(input);
			toast.success(`${result.plan.names[0]} now points to ${server.nickname}.`);
			queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareRecords(zone.id) });
			setDone({
				names: result.plan.names,
				serverId: server.id,
				nickname: server.nickname
			});
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(null);
		}
	}
	function close(next) {
		if (!next) {
			setDone(null);
			setPlan(null);
		}
		onOpenChange(next);
	}
	/** The next step after the records: a site on the server for the same names (E14 T5). */
	function addWebsite() {
		if (!done) return;
		const params = new URLSearchParams({
			server: done.serverId,
			view: "websites",
			newSite: done.names.join(",")
		});
		close(false);
		navigate(`/deploy?${params.toString()}`);
	}
	if (done) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: close,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: [
				done.names[0],
				" points to ",
				done.nickname
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
				"The records are in place. To answer for ",
				done.names.join(" and "),
				", the server needs a website for them in nginx."
			] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "soft",
				onClick: () => close(false),
				children: "Close"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				onClick: addWebsite,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "h-3.5 w-3.5" }),
					" Add a website on ",
					done.nickname
				]
			})] })]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: close,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, {
			className: "max-w-xl",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex max-h-[calc(85vh-3rem)] min-h-0 flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Point a domain to a server" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Creates or updates the address records so the name reaches one of your saved servers, and nothing else. You see every change before it is made." })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "-mx-1 min-h-0 space-y-4 overflow-y-auto px-1",
						children: [
							serversQuery.isSuccess && servers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "flex items-start gap-2 text-sm text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleInfo, { className: "mt-0.5 h-4 w-4 shrink-0" }), " Save a server in Remote first, then point a domain to it."]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Server",
									htmlFor: `${id}-server`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
										id: `${id}-server`,
										value: server?.id ?? "",
										onChange: (event) => reset(setServerId)(event.target.value),
										children: servers.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: candidate.id,
											children: candidate.nickname
										}, candidate.id))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Name",
									htmlFor: `${id}-name`,
									hint: `Use @ for ${zone.name} itself, or a name inside it, like app.`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: `${id}-name`,
										value: name,
										autoComplete: "off",
										spellCheck: false,
										onChange: (event) => reset(setName)(event.target.value)
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
									id: `${id}-www`,
									label: "Also point www",
									description: "The same addresses for the www name.",
									checked: includeWww,
									onChange: reset(setIncludeWww)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
									id: `${id}-proxy`,
									label: "Proxy through Cloudflare",
									description: proxied ? "Visitors reach Cloudflare first." : "Visitors reach the server directly.",
									checked: proxied,
									onChange: reset(setProxied)
								})]
							}),
							plan && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted-foreground",
										children: [
											"Addresses for ",
											server?.nickname,
											":",
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono",
												children: [...plan.addresses.ipv4, ...plan.addresses.ipv6].join(", ")
											})
										]
									}),
									plan.upToDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "flex items-start gap-2 rounded-xl bg-success/[0.08] p-3 text-sm text-foreground ring-1 ring-inset ring-success/25",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-success" }),
											plan.names.join(" and "),
											" already point at ",
											server?.nickname,
											". Nothing to change."
										]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										"aria-label": "Changes",
										className: "settings-rows rounded-xl bg-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.08]",
										children: plan.changes.map((change) => {
											const Icon = ACTION_ICON[change.action];
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
												className: "flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: cn("flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium", change.action === "delete" ? "text-destructive" : "text-foreground"),
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-3 w-3" }), ACTION_TEXT[change.action]]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-mono text-xs text-foreground",
														children: [
															change.type,
															" ",
															change.name
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "min-w-0 flex-1 break-words text-xs text-muted-foreground",
														children: detail(change)
													})
												]
											}, `${change.action}-${change.type}-${change.name}-${change.content}`);
										})
									}),
									advice && advice.level !== "ok" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "flex items-start gap-2 rounded-xl bg-warning/[0.08] p-3 text-sm text-foreground ring-1 ring-inset ring-warning/30",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"SSL/TLS for proxied records: ",
											advice.message,
											" You can change it under Settings."
										] })]
									})
								]
							}),
							problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "text-sm text-destructive",
								children: problem
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "soft",
						onClick: () => onOpenChange(false),
						children: "Cancel"
					}), plan && !plan.upToDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						disabled: busy !== null,
						onClick: () => void apply(),
						children: [busy === "apply" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), `Apply ${changing.length} ${changing.length === 1 ? "change" : "changes"}`]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						disabled: !input || busy !== null,
						onClick: () => void preview(),
						children: [busy === "preview" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), "Preview changes"]
					})] })
				]
			})
		})
	});
}
//#endregion
//#region src/shared/cloudflare/dns.ts
/**
* DNS names and records as the page edits them. The renderer runs these checks as the user types
* and the main process runs them again before anything reaches Cloudflare.
*/
var CLOUDFLARE_RECORD_TYPES = [
	"A",
	"AAAA",
	"CNAME",
	"TXT",
	"MX",
	"CAA",
	"SRV"
];
/** Only these can go through Cloudflare's proxy (the orange cloud). */
var PROXIABLE_TYPES = /* @__PURE__ */ new Set([
	"A",
	"AAAA",
	"CNAME"
]);
/** The TTLs the editor offers, in seconds. 1 is Cloudflare's "Auto". */
var TTL_CHOICES = [
	1,
	60,
	120,
	300,
	600,
	900,
	1800,
	3600,
	7200,
	18e3,
	43200,
	86400
];
var LABEL = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;
var PRINTABLE_ASCII = /^[\x21-\x7e]*$/;
var NOT_IN_A_HOST = /[\s/?#@:[\]\\%]/;
var SRV_NAME = /^_[a-z0-9-]+\._[a-z0-9-]+\./;
var CAA_TAGS = /* @__PURE__ */ new Set([
	"issue",
	"issuewild",
	"iodef"
]);
function toAscii(name) {
	if (PRINTABLE_ASCII.test(name)) return name;
	if (NOT_IN_A_HOST.test(name)) return null;
	try {
		return new URL(`http://${name}`).hostname;
	} catch {
		return null;
	}
}
/**
* A DNS name in lowercase ASCII (Punycode for international names), without the trailing dot,
* or null when DNS cannot hold it. A leading `*` label is allowed only for record names.
*/
function normalizeHostname(text, options = {}) {
	const name = text.endsWith(".") ? text.slice(0, -1) : text;
	if (name === "") return null;
	const ascii = toAscii(name)?.toLowerCase();
	if (!ascii || ascii.length > 253) return null;
	return ascii.split(".").every((label, index) => LABEL.test(label) || index === 0 && label === "*" && options.wildcard) ? ascii : null;
}
/** The full name of a record from what the user typed: "@", "www", or a full name in the zone. */
function recordName(text, zoneName) {
	const typed = text.trim().toLowerCase();
	const zone = zoneName.toLowerCase();
	if (typed === "" || typed === "@") return zone;
	const name = typed.endsWith(".") ? typed.slice(0, -1) : typed;
	return normalizeHostname(name === zone || name.endsWith(`.${zone}`) ? name : `${name}.${zone}`, { wildcard: true });
}
function isWholeNumber(value, max) {
	return Number.isInteger(value) && value >= 0 && value <= max;
}
function isValidTtl(ttl) {
	return ttl === 1 || Number.isInteger(ttl) && ttl >= 60 && ttl <= 86400;
}
function contentProblem(input) {
	switch (input.type) {
		case "A": return ipVersion(input.content) === 4 ? null : "An A record needs an IPv4 address, like 203.0.113.10.";
		case "AAAA": return ipVersion(input.content) === 6 ? null : "An AAAA record needs an IPv6 address, like 2001:db8::10.";
		case "CNAME": return normalizeHostname(input.content) ? null : "A CNAME record points at another name, like app.example.net.";
		case "TXT":
			if (input.content.length === 0) return "Enter the text for the record.";
			return input.content.length > 2048 ? "TXT content can be up to 2048 characters." : null;
		case "MX":
			if (!normalizeHostname(input.content)) return "Enter the mail server's name, like mail.example.com.";
			return isWholeNumber(input.priority, 65535) ? null : "The priority is a whole number from 0 to 65535.";
		case "CAA":
			if (!isWholeNumber(input.caa.flags, 255)) return "The flags value is a number from 0 to 255, usually 0.";
			if (!CAA_TAGS.has(input.caa.tag)) return "Pick a tag: issue, issuewild or iodef.";
			return input.caa.value.length === 0 || input.caa.value.length > 255 || input.caa.value.includes("\"") ? "Enter a value such as letsencrypt.org, without quotes." : null;
		case "SRV": {
			if (!SRV_NAME.test(input.name.toLowerCase())) return "An SRV name starts with _service._protocol, like _sip._tcp.example.com.";
			const { priority, weight, port, target } = input.srv;
			if (![
				priority,
				weight,
				port
			].every((value) => isWholeNumber(value, 65535))) return "The priority, weight and port are whole numbers from 0 to 65535.";
			return target === "." || normalizeHostname(target) ? null : "Enter the target server's name, like sip.example.com.";
		}
		default: return "AgentMate edits A, AAAA, CNAME, TXT, MX, CAA and SRV records, not that type.";
	}
}
/** What is wrong with a record before it is sent, in words, or null when it can go. */
function recordProblem(input) {
	if (!normalizeHostname(input.name, { wildcard: true })) return "That name cannot be used in DNS. Use letters, digits and hyphens, like app or www.";
	if (!isValidTtl(input.ttl)) return "Pick a TTL: Auto, or from 1 minute to 1 day.";
	if (input.comment !== void 0 && input.comment.length > 500) return "Keep the comment under 500 characters.";
	return contentProblem(input);
}
//#endregion
//#region src/renderer/src/components/cloudflare/RecordDialog.tsx
var CONTENT_LABEL = {
	A: "IPv4 address",
	AAAA: "IPv6 address",
	CNAME: "Target",
	TXT: "Content",
	MX: "Mail server"
};
var CONTENT_PLACEHOLDER = {
	A: "203.0.113.10",
	AAAA: "2001:db8::10",
	CNAME: "app.example.net",
	TXT: "v=spf1 include:_spf.example.net -all",
	MX: "mail.example.com"
};
function emptyDraft() {
	return {
		type: "A",
		name: "@",
		content: "",
		proxied: true,
		ttl: 1,
		priority: "10",
		caaFlags: "0",
		caaTag: "issue",
		caaValue: "",
		srvPriority: "10",
		srvWeight: "5",
		srvPort: "",
		srvTarget: "",
		comment: ""
	};
}
function draftOf(record, zoneName) {
	const draft = emptyDraft();
	return {
		...draft,
		type: record.type,
		name: relativeName(record.name, zoneName),
		content: record.content,
		proxied: record.proxied,
		ttl: record.ttl,
		priority: String(record.priority ?? draft.priority),
		caaFlags: String(record.caa?.flags ?? 0),
		caaTag: record.caa?.tag ?? "issue",
		caaValue: record.caa?.value ?? "",
		srvPriority: String(record.srv?.priority ?? draft.srvPriority),
		srvWeight: String(record.srv?.weight ?? draft.srvWeight),
		srvPort: String(record.srv?.port ?? ""),
		srvTarget: record.srv?.target ?? "",
		comment: record.comment ?? ""
	};
}
/** The record the form describes, or what is wrong with it. */
function buildInput(draft, zoneName, hadComment) {
	const name = recordName(draft.name, zoneName);
	if (!name) return { problem: "That name cannot be used in DNS. Use letters, digits and hyphens, like app or www." };
	const comment = draft.comment.trim();
	const extra = comment || hadComment ? { comment } : {};
	const proxied = PROXIABLE_TYPES.has(draft.type) && draft.proxied;
	const ttl = proxied ? 1 : draft.ttl;
	let input;
	switch (draft.type) {
		case "A":
		case "AAAA":
		case "CNAME":
			input = {
				type: draft.type,
				name,
				content: draft.content.trim(),
				ttl,
				proxied,
				...extra
			};
			break;
		case "TXT":
			input = {
				type: "TXT",
				name,
				content: draft.content,
				ttl,
				...extra
			};
			break;
		case "MX":
			input = {
				type: "MX",
				name,
				content: draft.content.trim(),
				priority: Number(draft.priority),
				ttl,
				...extra
			};
			break;
		case "CAA":
			input = {
				type: "CAA",
				name,
				caa: {
					flags: Number(draft.caaFlags),
					tag: draft.caaTag,
					value: draft.caaValue.trim()
				},
				ttl,
				...extra
			};
			break;
		default: input = {
			type: "SRV",
			name,
			srv: {
				priority: Number(draft.srvPriority),
				weight: Number(draft.srvWeight),
				port: draft.srvPort === "" ? NaN : Number(draft.srvPort),
				target: draft.srvTarget.trim()
			},
			ttl,
			...extra
		};
	}
	const problem = recordProblem(input);
	return problem ? { problem } : { input };
}
/**
* Adding or editing one DNS record. The fields follow the type; names are typed inside the zone
* ("@", "www") and the full name is shown as it will be saved. Proxied records always use the
* automatic TTL, as Cloudflare requires.
*/
function RecordDialog({ zone, record, open, onOpenChange }) {
	const queryClient = useQueryClient();
	const id = (0, import_react.useId)();
	const [draft, setDraft] = (0, import_react.useState)(() => record ? draftOf(record, zone.name) : emptyDraft());
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setDraft(record ? draftOf(record, zone.name) : emptyDraft());
		setProblem(null);
	}, [
		open,
		record,
		zone.name
	]);
	const update = (change) => {
		setDraft((current) => ({
			...current,
			...change
		}));
		setProblem(null);
	};
	const proxiable = PROXIABLE_TYPES.has(draft.type);
	const proxied = proxiable && draft.proxied;
	const fullName = recordName(draft.name, zone.name);
	async function save(event) {
		event.preventDefault();
		const built = buildInput(draft, zone.name, Boolean(record?.comment));
		if ("problem" in built) {
			setProblem(built.problem);
			return;
		}
		setBusy(true);
		try {
			if (record) await window.agentmat.cloudflare.updateRecord(zone.id, record.id, built.input);
			else await window.agentmat.cloudflare.createRecord(zone.id, built.input);
			queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareRecords(zone.id) });
			toast.success(`Saved the ${built.input.type} record for ${built.input.name}.`);
			onOpenChange(false);
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(false);
		}
	}
	const field = (name) => `${id}-${name}`;
	const numberField = (key, label, placeholder) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
		label,
		htmlFor: field(key),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			id: field(key),
			type: "number",
			min: 0,
			value: draft[key],
			placeholder,
			onChange: (event) => update({ [key]: event.target.value })
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, {
			className: "max-w-xl",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => void save(event),
				className: "flex max-h-[calc(85vh-3rem)] min-h-0 flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: record ? `Edit the ${record.type} record` : "Add a DNS record" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Changes reach Cloudflare as soon as you save. Most resolvers see them within minutes." })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "-mx-1 min-h-0 space-y-4 overflow-y-auto px-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Type",
									htmlFor: field("type"),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
										id: field("type"),
										value: draft.type,
										disabled: Boolean(record),
										onChange: (event) => update({
											type: event.target.value,
											content: ""
										}),
										children: CLOUDFLARE_RECORD_TYPES.map((type) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: type,
											children: type
										}, type))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Name",
									htmlFor: field("name"),
									hint: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										"Saved as",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono",
											children: fullName ?? "a name DNS cannot hold"
										}),
										". Use @ for ",
										zone.name,
										" itself."
									] }),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: field("name"),
										value: draft.name,
										autoComplete: "off",
										spellCheck: false,
										onChange: (event) => update({ name: event.target.value })
									})
								})]
							}),
							draft.type === "TXT" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Content",
								htmlFor: field("content"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: field("content"),
									value: draft.content,
									rows: 3,
									spellCheck: false,
									placeholder: CONTENT_PLACEHOLDER.TXT,
									className: "font-mono text-xs",
									onChange: (event) => update({ content: event.target.value })
								})
							}),
							(proxiable || draft.type === "MX") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: CONTENT_LABEL[draft.type] ?? "Content",
								htmlFor: field("content"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: field("content"),
									value: draft.content,
									autoComplete: "off",
									spellCheck: false,
									placeholder: CONTENT_PLACEHOLDER[draft.type],
									className: "font-mono",
									onChange: (event) => update({ content: event.target.value })
								})
							}),
							draft.type === "MX" && numberField("priority", "Priority"),
							draft.type === "CAA" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-[6rem_9rem_minmax(0,1fr)]",
								children: [
									numberField("caaFlags", "Flags"),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Tag",
										htmlFor: field("caaTag"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
											id: field("caaTag"),
											value: draft.caaTag,
											onChange: (event) => update({ caaTag: event.target.value }),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "issue",
													children: "issue"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "issuewild",
													children: "issuewild"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "iodef",
													children: "iodef"
												})
											]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Value",
										htmlFor: field("caaValue"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: field("caaValue"),
											value: draft.caaValue,
											placeholder: "letsencrypt.org",
											className: "font-mono",
											onChange: (event) => update({ caaValue: event.target.value })
										})
									})
								]
							}),
							draft.type === "SRV" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-3",
								children: [
									numberField("srvPriority", "Priority"),
									numberField("srvWeight", "Weight"),
									numberField("srvPort", "Port", "5060"),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Target",
										htmlFor: field("srvTarget"),
										className: "sm:col-span-3",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: field("srvTarget"),
											value: draft.srvTarget,
											placeholder: "sip.example.com",
											className: "font-mono",
											onChange: (event) => update({ srvTarget: event.target.value })
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [proxiable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.03] px-3 py-2 ring-1 ring-inset ring-foreground/[0.08]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											id: field("proxyLabel"),
											className: "text-sm font-medium",
											children: "Proxy through Cloudflare"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-muted-foreground",
											children: proxied ? "Proxied: visitors reach Cloudflare first." : "DNS only: visitors reach the server directly."
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: proxied,
										"aria-labelledby": field("proxyLabel"),
										onCheckedChange: (checked) => update({ proxied: checked })
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "TTL",
									htmlFor: field("ttl"),
									hint: proxied ? "Proxied records always use Auto." : void 0,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
										id: field("ttl"),
										value: proxied ? 1 : draft.ttl,
										disabled: proxied,
										onChange: (event) => update({ ttl: Number(event.target.value) }),
										children: TTL_CHOICES.map((ttl) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: ttl,
											children: ttlLabel(ttl)
										}, ttl))
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Comment",
								htmlFor: field("comment"),
								hint: "Only you see it; DNS ignores it.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: field("comment"),
									value: draft.comment,
									maxLength: 500,
									onChange: (event) => update({ comment: event.target.value })
								})
							}),
							problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "text-sm text-destructive",
								children: problem
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "soft",
						onClick: () => onOpenChange(false),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						disabled: busy,
						children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), " Save record"]
					})] })
				]
			})
		})
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/DnsRecordsCard.tsx
var LONG_CONTENT = 40;
/** The hairline under the column headings. It sits on the cells, since a row paints no shadow. */
var HEADER_LINE = "shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)]";
/** The same record with the proxy turned on or off, and nothing else changed. */
function withProxy(record, proxied) {
	return {
		type: record.type,
		name: record.name,
		content: record.content,
		ttl: proxied ? 1 : record.ttl,
		proxied
	};
}
function RecordsSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		"aria-busy": "true",
		children: Array.from({ length: 4 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-4 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-12 rounded-full" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-24" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 flex-1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-16 rounded-full" })
			]
		}, index))
	});
}
/**
* A zone's DNS records (T2). The proxy is a switch with its state written next to it, record
* types the page does not edit are listed as read-only, and a delete asks first.
*/
function DnsRecordsCard({ zone }) {
	const queryClient = useQueryClient();
	const recordsKey = queryKeys.cloudflareRecords(zone.id);
	const records = useQuery({
		queryKey: recordsKey,
		queryFn: () => window.agentmat.cloudflare.listRecords(zone.id)
	});
	const loadError = useCloudflareError(records.error);
	const [editing, setEditing] = (0, import_react.useState)(void 0);
	const [pointing, setPointing] = (0, import_react.useState)(false);
	const [changing, setChanging] = (0, import_react.useState)(null);
	async function setProxy(record, proxied) {
		setChanging(record.id);
		try {
			await window.agentmat.cloudflare.updateRecord(zone.id, record.id, withProxy(record, proxied));
			toast.success(`${record.name} is ${proxied ? "proxied" : "DNS only"} now.`);
			await queryClient.invalidateQueries({ queryKey: recordsKey });
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		} finally {
			setChanging(null);
		}
	}
	async function remove(record) {
		const what = `the ${record.type} record for ${record.name}`;
		if (!await confirmDialog({
			title: `Delete ${what}?`,
			description: `${record.name} stops answering with ${record.content}. Anything that relies on it, a website or mail, stops working once resolvers notice.`,
			confirmLabel: "Delete record",
			variant: "destructive"
		})) return;
		try {
			await window.agentmat.cloudflare.deleteRecord(zone.id, record.id);
			toast.success(`Deleted ${what}.`);
			await queryClient.invalidateQueries({ queryKey: recordsKey });
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		}
	}
	let body;
	if (records.isPending) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecordsSkeleton, {});
	else if (records.isError) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
		message: loadError ?? "",
		onRetry: () => void records.refetch()
	}) });
	else if (records.data.length === 0) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		size: "sm",
		icon: Globe,
		title: "No DNS records yet",
		description: "Add one, or point the domain to one of your servers.",
		className: FOOTER_HAIRLINE
	});
	else body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(FOOTER_HAIRLINE, "overflow-x-auto"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full border-collapse text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "text-left",
				children: [[
					"Type",
					"Name",
					"Content",
					"Proxy",
					"TTL"
				].map((heading) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: cn(SECTION_HEADING, HEADER_LINE, "px-3 py-2 first:pl-4"),
					children: heading
				}, heading)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: cn(HEADER_LINE, "px-3 py-2 pr-4"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: "Actions"
					})
				})]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "settings-rows",
				children: records.data.map((record) => {
					const what = `the ${record.type} record for ${record.name}`;
					const content = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block max-w-[18rem] truncate font-mono text-xs",
						children: record.content
					});
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "transition-colors hover:bg-foreground/[0.03]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pl-4 pr-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "primary",
									className: "font-mono",
									children: record.type
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "max-w-[14rem] truncate px-3 py-2 font-mono text-xs",
								children: relativeName(record.name, zone.name)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: record.content.length > LONG_CONTENT ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
									label: record.content,
									children: content
								}) : content
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2",
									children: [record.proxiable && record.editable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: record.proxied,
										disabled: changing === record.id,
										"aria-label": `Proxy ${record.name} through Cloudflare`,
										onCheckedChange: (checked) => void setProxy(record, checked)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
										tone: record.proxied ? "warning" : "neutral",
										children: record.proxied ? "Proxied" : "DNS only"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "whitespace-nowrap px-3 py-2 text-xs text-muted-foreground",
								children: ttlLabel(record.ttl)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pl-3 pr-3",
								children: record.editable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex justify-end gap-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
										label: "Edit record",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "icon-sm",
											variant: "ghost",
											"aria-label": `Edit ${what}`,
											onClick: () => setEditing(record),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, {})
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
										label: "Delete record",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "icon-sm",
											variant: "ghost",
											className: "hover:bg-destructive/10 hover:text-destructive",
											"aria-label": `Delete ${what}`,
											onClick: () => void remove(record),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
										})
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block whitespace-nowrap pr-1 text-right text-xs text-muted-foreground",
									children: "Edit on Cloudflare"
								})
							})
						]
					}, record.id);
				})
			})]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {}),
		title: "DNS records",
		description: records.data ? `${records.data.length} ${records.data.length === 1 ? "record" : "records"} in ${zone.name}.` : `The records in ${zone.name}.`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			size: "sm",
			variant: "soft",
			onClick: () => setPointing(true),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Server, { className: "h-3.5 w-3.5" }), " Point domain to a server"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			size: "sm",
			onClick: () => setEditing(null),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3.5 w-3.5" }), " Add record"]
		})] }),
		children: [
			body,
			editing !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecordDialog, {
				zone,
				record: editing ?? void 0,
				open: true,
				onOpenChange: (open) => {
					if (!open) setEditing(void 0);
				}
			}, editing?.id ?? "new"),
			pointing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PointDomainDialog, {
				zone,
				open: true,
				onOpenChange: setPointing
			})
		]
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/PurgeCard.tsx
/** A full purge, behind typing the domain's name (the ResetVaultDialog pattern). */
function PurgeEverythingDialog({ zone, open, onOpenChange }) {
	const queryClient = useQueryClient();
	const inputId = (0, import_react.useId)();
	const [typed, setTyped] = (0, import_react.useState)("");
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function purge() {
		setBusy(true);
		setProblem(null);
		try {
			await window.agentmat.cloudflare.purgeCache(zone.id, { everything: true });
			toast.success(`Purged everything for ${zone.name}.`);
			setTyped("");
			onOpenChange(false);
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (next) => {
			if (!next) {
				setTyped("");
				setProblem(null);
			}
			onOpenChange(next);
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: [
					"Purge everything for ",
					zone.name,
					"?"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Every cached file goes at once, so the next visits all reach your server until the cache fills again. That can slow the site down or strain the server for a while." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: inputId,
						className: "text-sm font-normal",
						children: [
							"Type ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono font-semibold",
								children: zone.name
							}),
							" to confirm"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: inputId,
						value: typed,
						autoComplete: "off",
						spellCheck: false,
						onChange: (event) => setTyped(event.target.value)
					})]
				}),
				problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "text-sm text-destructive",
					children: problem
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "soft",
					onClick: () => onOpenChange(false),
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "destructive",
					disabled: typed.trim() !== zone.name || busy,
					onClick: () => void purge(),
					children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), " Purge everything"]
				})] })
			]
		})
	});
}
/**
* Cache purges (T3): the listed URLs straight away, or everything after typing the domain's
* name, since a full purge sends every next request to the server.
*/
function PurgeCard({ zone }) {
	const queryClient = useQueryClient();
	const fieldId = (0, import_react.useId)();
	const [urls, setUrls] = (0, import_react.useState)("");
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [confirming, setConfirming] = (0, import_react.useState)(false);
	async function purgeUrls() {
		const checked = checkPurgeUrls(urls);
		if (!checked.ok) {
			setProblem(checked.problem);
			return;
		}
		setBusy(true);
		setProblem(null);
		try {
			await window.agentmat.cloudflare.purgeCache(zone.id, { urls: checked.urls });
			const count = checked.urls.length;
			toast.success(`Purged ${count} ${count === 1 ? "URL" : "URLs"} from the cache.`);
			setUrls("");
		} catch (error) {
			setProblem(cloudflareFailureText(error, queryClient));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bolt, {}),
		title: "Cache",
		description: "Cloudflare keeps copies of your files close to visitors. Purge them when a change does not show up.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCardBody, {
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: fieldId,
							children: "URLs to purge"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: fieldId,
							value: urls,
							rows: 3,
							spellCheck: false,
							placeholder: `https://${zone.name}/styles.css`,
							className: "font-mono text-xs",
							onChange: (event) => {
								setUrls(event.target.value);
								setProblem(null);
							}
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"One full URL per line, up to ",
								30,
								" at a time."
							]
						})
					]
				}),
				problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "text-sm text-destructive",
					children: problem
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						disabled: busy || urls.trim() === "",
						onClick: () => void purgeUrls(),
						children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), " Purge these URLs"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "danger",
						onClick: () => setConfirming(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Purge everything"]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PurgeEverythingDialog, {
			zone,
			open: confirming,
			onOpenChange: setConfirming
		})]
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/server/DnsTokensCard.tsx
/**
* DNS-01 for this zone (E14 T7): which servers hold a DNS token for it, so they can get wildcard
* certificates and certificates for names behind the proxy. The app makes a token that can edit
* this zone's DNS and nothing else, or takes one the user made; either way the account token
* stays in the app, and the server never shows the token again.
*/
function ServerRow({ server, zone }) {
	const id = (0, import_react.useId)();
	const queryClient = useQueryClient();
	const key = queryKeys.cloudflareDnsTokens(server.id);
	const tokens = useQuery({
		queryKey: key,
		queryFn: () => window.agentmat.cloudflareServer.dnsTokens(server.id),
		retry: false
	});
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [pasting, setPasting] = (0, import_react.useState)(false);
	const [token, setToken] = (0, import_react.useState)("");
	const held = tokens.data?.find((item) => item.zone === zone.name);
	async function run(kind, work, done) {
		setBusy(kind);
		setError(null);
		try {
			await work();
			toast.success(done);
			setPasting(false);
			setToken("");
			queryClient.invalidateQueries({ queryKey: key });
		} catch (failure) {
			setError(failure);
		} finally {
			setBusy(null);
		}
	}
	async function remove() {
		const made = Boolean(held?.tokenId);
		if (!await confirmDialog({
			title: `Remove the DNS token from ${server.nickname}?`,
			description: made ? "The server forgets it, and the token AgentMate made is deleted at Cloudflare. Wildcard certificates there stop renewing until it has a token again." : "The server forgets it. The token itself stays on Cloudflare; delete it there if nothing else uses it.",
			confirmLabel: "Remove the token",
			variant: "destructive"
		})) return;
		await run("remove", () => window.agentmat.cloudflareServer.removeDnsToken({
			serverId: server.id,
			zone: zone.name,
			deleteAtCloudflare: made
		}), `${server.nickname} no longer holds a DNS token for ${zone.name}.`);
	}
	const cannotMint = cloudflareErrorPermission(error) === "apiTokens";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "space-y-2 px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-x-3 gap-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex min-w-0 items-center gap-2 text-sm font-medium text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Server, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
						" ",
						server.nickname
					]
				}), tokens.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-40" }) : tokens.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: coreErrorMessage(tokens.error)
				}) : held ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					tone: "success",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {}),
						" Holds a DNS token",
						held.lastUsedAtUnixMs ? `, last used ${relative(held.lastUsedAtUnixMs, Date.now())}` : ", not used yet"
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, { children: ["No DNS token for ", zone.name] })]
			}),
			held?.lastError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-warning",
				children: held.lastError
			}),
			tokens.isSuccess && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: held ? "soft" : "default",
						disabled: busy !== null,
						onClick: () => void run("mint", () => window.agentmat.cloudflareServer.provisionDnsToken({
							serverId: server.id,
							zoneId: zone.id,
							mode: "mint"
						}), `${server.nickname} has a DNS token for ${zone.name}.`),
						children: [busy === "mint" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "h-3.5 w-3.5" }), held ? "Make a new token" : "Make a DNS token"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "soft",
						disabled: busy !== null,
						onClick: () => setPasting((open) => !open),
						children: "Paste a token"
					}),
					held && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "danger",
						disabled: busy !== null,
						onClick: () => void remove(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), " Remove"]
					})
				]
			}),
			pasting && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-wrap items-end gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					run("paste", () => window.agentmat.cloudflareServer.provisionDnsToken({
						serverId: server.id,
						zoneId: zone.id,
						mode: "paste",
						token
					}), `${server.nickname} has a DNS token for ${zone.name}.`);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1 space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `${id}-token`,
						children: ["DNS token for ", zone.name]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `${id}-token`,
						type: "password",
						autoComplete: "off",
						spellCheck: false,
						value: token,
						onChange: (event) => setToken(event.target.value),
						placeholder: "A token with Zone > DNS > Edit on this zone only"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					size: "sm",
					disabled: busy !== null || token.trim().length === 0,
					children: [busy === "paste" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), "Check and send"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuidedFix, {
				error,
				alternative: cannotMint ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"Or make a token yourself on Cloudflare with only Zone > DNS > Edit on",
						" ",
						zone.name,
						", and paste it here with Paste a token."
					]
				}) : void 0
			})
		]
	});
}
function DnsTokensCard({ zone }) {
	const servers = useQuery({
		queryKey: queryKeys.deployServers,
		queryFn: () => window.agentmat.deploy.listServers()
	});
	const withCore = (servers.data ?? []).filter((server) => server.core);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, {}),
		title: "DNS tokens on your servers",
		description: `A server with a DNS token for ${zone.name} can get wildcard certificates and certificates for names behind the proxy (DNS-01). Each token edits this zone's DNS and nothing else.`,
		children: servers.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(FOOTER_HAIRLINE, "space-y-2 px-4 py-3"),
			"aria-busy": "true",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-48" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-7 w-56 rounded-full" })]
		}) : withCore.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			size: "sm",
			icon: Server,
			title: "No server core yet",
			description: "Install the server core on a server in Deploy first."
		}) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			"aria-label": "Servers",
			className: cn(FOOTER_HAIRLINE, "settings-rows"),
			children: withCore.map((server) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerRow, {
				server,
				zone
			}, server.id))
		})
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/ZoneRail.tsx
/** What a zone's state means, in words. */
function zoneStateText(zone) {
	if (zone.paused) return "Paused";
	switch (zone.status) {
		case "active": return "Active";
		case "pending": return "Waiting for name servers";
		case "initializing": return "Setting up";
		case "moved": return "Moved away";
		default: return zone.status;
	}
}
function isLive(zone) {
	return zone.status === "active" && !zone.paused;
}
/**
* One domain in the rail: the main menu's row with a second line for the zone's state, so a zone
* waiting for its name servers stands out before it is opened.
*/
function ZoneRow({ zone, selected, onSelect }) {
	const reduceMotion = useReducedMotion();
	const live = isLive(zone);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"aria-current": selected ? "true" : void 0,
		onClick: onSelect,
		className: cn("relative isolate flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg py-1.5 pl-2.5 pr-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "text-primary" : "text-foreground/85 hover:bg-foreground/[0.06]"),
		children: [
			selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
				"aria-hidden": true,
				layoutId: "cloudflare-zone-active",
				transition: reduceMotion ? { duration: 0 } : {
					type: "spring",
					stiffness: 420,
					damping: 32
				},
				className: "absolute inset-0 -z-10 rounded-lg bg-primary/12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : live ? "text-foreground/70" : "text-muted-foreground") }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("block truncate text-[13px]", selected ? "font-medium text-primary" : "text-foreground"),
					children: zone.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						"aria-hidden": true,
						className: cn("h-1.5 w-1.5 shrink-0 rounded-full", live ? "bg-success" : "bg-warning")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: zoneStateText(zone)
					})]
				})]
			})
		]
	});
}
/** Every zone the token can see, so the one being managed is always in view. */
function ZoneRail({ zones, error, selectedId, onSelect, onRetry }) {
	let content;
	if (error) content = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "px-1",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
			message: error,
			onRetry
		})
	});
	else if (!zones) content = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-1 px-1",
		children: Array.from({ length: 3 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2.5 px-1.5 py-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-3.5 rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-3/4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-2.5 w-1/2" })]
			})]
		}, index))
	});
	else if (zones.length === 0) content = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		size: "sm",
		icon: Globe,
		title: "No domains yet",
		description: "This token cannot see any domains yet. Add a domain on Cloudflare, or include it under Zone Resources on the token."
	});
	else content = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex flex-col gap-px",
		children: zones.map((zone) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoneRow, {
			zone,
			selected: zone.id === selectedId,
			onSelect: () => onSelect(zone.id)
		}) }, zone.id))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
		"aria-label": "Zones",
		"aria-busy": !zones && !error ? "true" : void 0,
		className: "flex min-h-0 flex-1 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-10 shrink-0 items-center gap-2 pl-3.5 pr-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: cn(SECTION_HEADING, "min-w-0 flex-1 truncate"),
				children: "Domains"
			}), zones && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-foreground/[0.06] px-1.5 text-[10px] leading-4 tabular-nums text-muted-foreground",
				children: zones.length
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rail-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2",
			children: content
		})]
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/ZoneSettingsCard.tsx
var SECURITY_LEVELS = Object.keys(SECURITY_LEVEL_LABELS);
var SETTABLE_SSL_MODES = [
	"off",
	"flexible",
	"full",
	"strict"
];
function Row({ title, titleId, htmlFor, description, children, below }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2 px-4 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [htmlFor ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor,
					className: "text-sm font-medium text-foreground",
					children: title
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					id: titleId,
					className: "text-sm font-medium text-foreground",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: description
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex shrink-0 items-center gap-2",
				children
			})]
		}), below]
	});
}
function SettingsSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(FOOTER_HAIRLINE, "settings-rows"),
		"aria-busy": "true",
		children: Array.from({ length: 4 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-4 py-3.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-36" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-3/5" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-40 rounded-full" })]
		}, index))
	});
}
/**
* The zone settings an operator reaches for most (T3): development mode, the security level up to
* "I'm Under Attack", the SSL/TLS mode with the suggestion for proxied domains, and Always Use
* HTTPS. Every state is written out, not only shown by a switch's colour.
*/
function ZoneSettingsCard({ zone }) {
	const queryClient = useQueryClient();
	const id = (0, import_react.useId)();
	const key = queryKeys.cloudflareSettings(zone.id);
	const settings = useQuery({
		queryKey: key,
		queryFn: () => window.agentmat.cloudflare.zoneSettings(zone.id)
	});
	const loadError = useCloudflareError(settings.error);
	const [saving, setSaving] = (0, import_react.useState)(null);
	async function change(next, done) {
		setSaving(next.setting);
		try {
			queryClient.setQueryData(key, await window.agentmat.cloudflare.changeSetting(zone.id, next));
			toast.success(done);
		} catch (error) {
			toast.error(cloudflareFailureText(error, queryClient));
		} finally {
			setSaving(null);
		}
	}
	let body;
	if (settings.isPending) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsSkeleton, {});
	else if (settings.isError) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCardBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
		message: loadError ?? "",
		onRetry: () => void settings.refetch()
	}) });
	else {
		const { developmentMode, securityLevel, ssl, alwaysUseHttps } = settings.data;
		const advice = sslAdvice(ssl.value);
		const developmentOn = developmentMode.value === "on";
		const httpsOn = alwaysUseHttps.value === "on";
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(FOOTER_HAIRLINE, "settings-rows"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
					title: "Development mode",
					titleId: `${id}-development`,
					description: "Skips the cache for three hours, so changes to the site show at once.",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						tone: developmentOn ? "warning" : "neutral",
						children: developmentOn ? `On, ${formatRemaining(developmentMode.secondsRemaining)}` : "Off"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: developmentOn,
						disabled: !developmentMode.editable || saving === "developmentMode",
						"aria-labelledby": `${id}-development`,
						onCheckedChange: (checked) => void change({
							setting: "developmentMode",
							value: checked ? "on" : "off"
						}, checked ? "Development mode is on for three hours." : "Development mode is off.")
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					title: "Security level",
					htmlFor: `${id}-security`,
					description: "How suspicious a visitor has to look before Cloudflare checks them.",
					below: securityLevel.value === "under_attack" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
						tone: "warning",
						size: "sm",
						children: "I'm Under Attack is on: every visitor sees a short check before the site loads. Turn it back down once the attack is over."
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
						id: `${id}-security`,
						className: "w-48",
						value: securityLevel.value,
						disabled: !securityLevel.editable || saving === "securityLevel",
						onChange: (event) => {
							const value = event.target.value;
							change({
								setting: "securityLevel",
								value
							}, `Security level is ${SECURITY_LEVEL_LABELS[value]} now.`);
						},
						children: SECURITY_LEVELS.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: level,
							children: SECURITY_LEVEL_LABELS[level]
						}, level))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
					title: "SSL/TLS mode",
					htmlFor: `${id}-ssl`,
					description: "How Cloudflare connects to your server for proxied records.",
					below: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
						size: "sm",
						tone: advice.level === "ok" ? "success" : advice.level === "improve" ? "neutral" : "warning",
						className: "items-center",
						action: advice.recommended !== ssl.value && ssl.editable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "soft",
							disabled: saving === "ssl",
							onClick: () => void change({
								setting: "ssl",
								value: "strict"
							}, "SSL/TLS mode is Full (strict) now."),
							children: "Use Full (strict)"
						}),
						children: advice.message
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
						id: `${id}-ssl`,
						className: "w-48",
						value: ssl.value,
						disabled: !ssl.editable || saving === "ssl",
						onChange: (event) => {
							const value = event.target.value;
							change({
								setting: "ssl",
								value
							}, `SSL/TLS mode is ${SSL_MODE_LABELS[value]} now.`);
						},
						children: [ssl.value === "origin_pull" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "origin_pull",
							children: SSL_MODE_LABELS.origin_pull
						}), SETTABLE_SSL_MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: mode,
							children: SSL_MODE_LABELS[mode]
						}, mode))]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
					title: "Always Use HTTPS",
					titleId: `${id}-https`,
					description: "Sends visitors who ask for http:// to the https:// address.",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						tone: httpsOn ? "success" : "neutral",
						children: httpsOn ? "On" : "Off"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: httpsOn,
						disabled: !alwaysUseHttps.editable || saving === "alwaysUseHttps",
						"aria-labelledby": `${id}-https`,
						onCheckedChange: (checked) => void change({
							setting: "alwaysUseHttps",
							value: checked ? "on" : "off"
						}, checked ? "Always Use HTTPS is on." : "Always Use HTTPS is off.")
					})]
				})
			]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflareCard, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsIcon, {}),
		title: "Settings",
		description: `For everything in ${zone.name}. Changes apply within seconds.`,
		children: body
	});
}
//#endregion
//#region src/renderer/src/components/cloudflare/ZonePanel.tsx
function isZoneTab(value) {
	return value === "dns" || value === "settings" || value === "security" || value === "servers";
}
var TABS = [
	{
		value: "dns",
		label: "DNS"
	},
	{
		value: "settings",
		label: "Settings"
	},
	{
		value: "security",
		label: "Security"
	},
	{
		value: "servers",
		label: "Servers"
	}
];
/** The tab content sits straight under the header card, spaced like every other card. */
var CONTENT = "mt-0 flex flex-col gap-2 focus-visible:ring-offset-0";
/**
* One zone: its state and, by tab, its DNS records, its settings and cache, its rules, and the
* DNS tokens its servers hold for DNS-01.
*/
function ZonePanel({ zone, tab, onTabChange }) {
	const reduceMotion = useReducedMotion();
	const active = zone.status === "active" && !zone.paused;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		value: tab,
		onValueChange: (value) => onTabChange(value),
		className: "flex min-w-0 flex-col gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: GLASS_CARD,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-[0_0_24px_-10px_hsl(var(--primary)/0.7)]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "h-4 w-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "truncate text-base font-semibold tracking-tight text-foreground",
									children: zone.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: active ? "success" : "warning",
									dot: true,
									children: zoneStateText(zone)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-xs text-muted-foreground",
								children: zone.plan || "Cloudflare zone"
							})]
						})]
					}),
					zone.status === "pending" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 pb-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Notice, {
							tone: "warning",
							children: [
								"Cloudflare is waiting for your registrar to use its name servers:",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono",
									children: zone.nameServers.join(", ")
								}),
								". Until then, changes here do not reach visitors."
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn(FOOTER_HAIRLINE, "px-3 py-2"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGroup, {
							id: "cloudflare-zone-tabs",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsList, {
								containerClassName: "border-b-0",
								className: "search-pill mb-0 h-auto w-auto max-w-full gap-0.5 rounded-full p-0.5",
								children: TABS.map((item) => {
									const selected = tab === item.value;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
										value: item.value,
										className: cn("relative h-7 rounded-full border-b-0 px-3 text-xs focus-visible:ring-ring/60", selected ? "text-primary data-[state=active]:text-primary" : "text-muted-foreground hover:bg-foreground/[0.06]"),
										children: [selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
											"aria-hidden": true,
											layoutId: "cloudflare-zone-tab-active",
											transition: reduceMotion ? { duration: 0 } : {
												type: "spring",
												stiffness: 420,
												damping: 32
											},
											className: "absolute inset-0 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "relative",
											children: item.label
										})]
									}, item.value);
								})
							})
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "dns",
				className: CONTENT,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DnsRecordsCard, { zone })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "settings",
				className: CONTENT,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoneSettingsCard, { zone }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PurgeCard, { zone })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "security",
				className: CONTENT,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomRulesCard, { zone }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccessRulesCard, { zone })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "servers",
				className: CONTENT,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DnsTokensCard, { zone })
			})
		]
	});
}
//#endregion
//#region src/renderer/src/pages/CloudflarePage.tsx
function BackToDeploy({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		asChild: true,
		variant: "soft",
		size: "sm",
		className,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/deploy",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-3.5 w-3.5" }), " Back to Deploy"]
		})
	});
}
/** The cards the page will show, shimmering in their own places while the status loads. */
function CloudflarePageSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-col gap-2 p-2",
		"aria-busy": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-36 rounded-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(GLASS_CARD, "space-y-3 p-4"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-8 rounded-xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-3/4" })]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-32 w-full rounded-xl" })]
		})]
	});
}
/**
* The Cloudflare page (T8). Cloudflare accounts are not tied to one server, so it lives beside
* the server rail rather than under a server: first the token, then the zones it can see, and for
* the picked zone its DNS records, settings and security rules. The zone and tab are kept in the
* address, so going back and forth (and the next launch) lands in the same place.
*/
function CloudflarePage() {
	usePageHeader("Cloudflare", "Your domains on Cloudflare: DNS, settings and security rules.");
	const queryClient = useQueryClient();
	const [params, setParams] = useSearchParams();
	const [replacing, setReplacing] = (0, import_react.useState)(false);
	const [unlockOpen, setUnlockOpen] = (0, import_react.useState)(false);
	const [railWidth, setRailWidth] = usePanelWidth("cloudflareRail");
	const statusQuery = useQuery({
		queryKey: queryKeys.cloudflareStatus,
		queryFn: () => window.agentmat.cloudflare.status()
	});
	const status = statusQuery.data;
	const ready = Boolean(status?.configured && !status.locked) && !replacing;
	const zonesQuery = useQuery({
		queryKey: queryKeys.cloudflareZones,
		queryFn: () => window.agentmat.cloudflare.listZones(),
		enabled: ready
	});
	const zonesError = useCloudflareError(zonesQuery.error);
	if (statusQuery.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudflarePageSkeleton, {});
	if (statusQuery.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-col items-start gap-2 p-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackToDeploy, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "w-full",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
				message: cloudflareErrorMessage(statusQuery.error),
				onRetry: () => void statusQuery.refetch()
			})
		})]
	});
	const current = statusQuery.data;
	const zones = zonesQuery.data;
	const selected = zones?.find((zone) => zone.id === params.get("zone")) ?? zones?.[0];
	const requestedTab = params.get("tab");
	const tab = isZoneTab(requestedTab) ? requestedTab : "dns";
	const unlockDialog = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SshVaultUnlockDialog, {
		open: unlockOpen,
		onOpenChange: setUnlockOpen,
		mode: "unlock",
		onUnlocked: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
			queryClient.invalidateQueries({ queryKey: ["cloudflare"] });
		}
	});
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-col items-stretch gap-2 p-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackToDeploy, { className: "self-start" }),
			current.locked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("glass rounded-[calc(var(--radius)+2px)]", "p-1.5"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
					tone: "warning",
					icon: Lock,
					className: "items-center",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => setUnlockOpen(true),
						children: "Unlock"
					}),
					children: "Your saved servers are locked with a passkey, and the Cloudflare token with them. Unlock them to manage your domains."
				})
			}),
			!current.configured || replacing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TokenSetupCard, {
				onCancel: current.configured ? () => setReplacing(false) : void 0,
				onSaved: () => setReplacing(false)
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TokenStatusCard, {
				status: current,
				onReplace: () => setReplacing(true)
			}),
			unlockDialog
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 overflow-hidden p-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				"aria-label": "Cloudflare domains",
				style: {
					width: railWidth,
					maxWidth: "40%"
				},
				className: cn(GLASS_PANEL, "shrink-0"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoneRail, {
					zones,
					error: zonesError,
					selectedId: selected?.id ?? null,
					onSelect: (zoneId) => setParams({
						zone: zoneId,
						tab
					}, { replace: true }),
					onRetry: () => void zonesQuery.refetch()
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn(FOOTER_HAIRLINE, "shrink-0 p-2"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackToDeploy, { className: "w-full" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizeHandle, {
				orientation: "vertical",
				label: "Resize domains",
				size: railWidth,
				min: PANEL_WIDTHS.cloudflareRail.min,
				max: PANEL_WIDTHS.cloudflareRail.max,
				defaultSize: PANEL_WIDTHS.cloudflareRail.default,
				onSizeChange: setRailWidth,
				quiet: true,
				className: "w-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rail-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TokenStatusCard, {
					status: current,
					onReplace: () => setReplacing(true)
				}), selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZonePanel, {
					zone: selected,
					tab,
					onTabChange: (next) => setParams({
						zone: selected.id,
						tab: next
					}, { replace: true })
				}, selected.id)]
			}),
			unlockDialog
		]
	});
}
//#endregion
export { CloudflarePage as default };
