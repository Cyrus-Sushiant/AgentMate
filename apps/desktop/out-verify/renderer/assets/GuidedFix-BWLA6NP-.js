import { F as Button, Fr as require_jsx_runtime, I as cn, Mt as ExternalLink, hr as TriangleAlert, sn as Key } from "./tooltip-BbU-D7og.js";
import { p as useQueryClient, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { t as Label } from "./label-D49cSr88.js";
import { a as SectionCard, l as Notice } from "./pageKit-dgpHZ_9P.js";
import { i as siCloudflare } from "./simple-icons-Dm7rcQrW.js";
import { i as sshErrorMessage, n as coreErrorMessage } from "./coreErrors-C93UH5Hm.js";
//#region src/shared/cloudflareErrors.ts
var import_jsx_runtime = require_jsx_runtime();
var CODES = /* @__PURE__ */ new Set([
	"missing-permission",
	"token-rejected",
	"no-token",
	"locked"
]);
var PERMISSIONS = /* @__PURE__ */ new Set([
	"zone",
	"dns",
	"zoneSettings",
	"cachePurge",
	"waf",
	"accessRules",
	"sslCertificates",
	"apiTokens"
]);
var TAG = /\[cloudflare:([a-z-]+)(?::([A-Za-z]+))?\]\s*/;
function tag(error) {
	return (error instanceof Error ? error.message : String(error)).match(TAG);
}
function cloudflareErrorCode(error) {
	const code = tag(error)?.[1];
	return code && CODES.has(code) ? code : null;
}
/** For a missing-permission error, the permission the token needs. */
function cloudflareErrorPermission(error) {
	const permission = tag(error)?.[2];
	return permission && PERMISSIONS.has(permission) ? permission : null;
}
/** The human part of the message, without Electron's wrapper or the code tag. */
function cloudflareErrorMessage(error) {
	return sshErrorMessage(error).replace(TAG, "");
}
//#endregion
//#region src/renderer/src/components/cloudflare/fields.tsx
/** Form pieces the Cloudflare page shares, in the look of the app's own inputs. */
function NativeSelect({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		...props,
		className: cn("field-surface flex h-9 w-full cursor-pointer rounded-full pl-3 pr-2 text-sm disabled:cursor-not-allowed", className)
	});
}
function Field({ label, htmlFor, hint, className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("min-w-0 space-y-1.5", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor,
				children: label
			}),
			children,
			hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function CloudflareCard({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
		flush: true,
		className: cn("flex min-w-0 flex-col", className),
		...props,
		children
	});
}
//#endregion
//#region src/shared/cloudflare/permissions.ts
var CLOUDFLARE_PERMISSIONS = [
	{
		id: "zone",
		label: "Zone > Zone > Read",
		purpose: "See your domains",
		action: "list your domains",
		template: {
			key: "zone",
			type: "read"
		},
		apiNames: ["Zone Read", "Zone Write"]
	},
	{
		id: "dns",
		label: "Zone > DNS > Edit",
		purpose: "Add, change and remove DNS records",
		action: "change DNS records",
		template: {
			key: "dns",
			type: "edit"
		},
		apiNames: ["DNS Write"]
	},
	{
		id: "zoneSettings",
		label: "Zone > Zone Settings > Edit",
		purpose: "Development mode, security level, SSL/TLS mode and Always Use HTTPS",
		action: "change zone settings",
		template: {
			key: "zone_settings",
			type: "edit"
		},
		apiNames: ["Zone Settings Write"]
	},
	{
		id: "cachePurge",
		label: "Zone > Cache Purge > Purge",
		purpose: "Purge cached files",
		action: "purge the cache",
		template: {
			key: "cache",
			type: "purge"
		},
		apiNames: ["Cache Purge"]
	},
	{
		id: "waf",
		label: "Zone > Zone WAF > Edit",
		purpose: "WAF custom rules",
		action: "change WAF custom rules",
		template: {
			key: "zone_waf",
			type: "edit"
		},
		apiNames: ["Zone WAF Write"]
	},
	{
		id: "accessRules",
		label: "Zone > Firewall Services > Edit",
		purpose: "IP access rules",
		action: "change IP access rules",
		template: {
			key: "firewall_services",
			type: "edit"
		},
		apiNames: ["Firewall Services Write"]
	}
];
/**
* Asked for only when a feature needs it, so the main token can stay without them: Origin CA
* certificates need SSL and Certificates, and making a server its own zone-scoped DNS token needs
* API Tokens (a user permission, which is why pasting a token made by hand is offered too).
*/
var CLOUDFLARE_EXTRA_PERMISSIONS = [{
	id: "sslCertificates",
	label: "Zone > SSL and Certificates > Edit",
	purpose: "Origin CA certificates for your servers",
	action: "create Origin CA certificates",
	template: {
		key: "ssl_and_certificates",
		type: "edit"
	},
	apiNames: ["SSL and Certificates Write"]
}, {
	id: "apiTokens",
	label: "User > API Tokens > Edit",
	purpose: "A separate DNS token for a server, for wildcard certificates",
	action: "create API tokens",
	template: {
		key: "api_tokens",
		type: "edit"
	},
	apiNames: ["API Tokens Write"]
}];
/** Cloudflare's page for creating and editing user API tokens. */
var TOKEN_PAGE = "https://dash.cloudflare.com/profile/api-tokens";
function cloudflarePermission(id) {
	const permission = [...CLOUDFLARE_PERMISSIONS, ...CLOUDFLARE_EXTRA_PERMISSIONS].find((candidate) => candidate.id === id);
	if (!permission) throw new Error(`Unknown Cloudflare permission: ${id}`);
	return permission;
}
/** The token page with AgentMate's permissions, all zones and a name filled in. */
function tokenTemplateUrl() {
	const keys = CLOUDFLARE_PERMISSIONS.map(({ template }) => ({
		key: template.key,
		type: template.type
	}));
	return `${TOKEN_PAGE}?${[
		`permissionGroupKeys=${encodeURIComponent(JSON.stringify(keys))}`,
		"accountId=*",
		"zoneId=all",
		"name=AgentMate"
	].join("&")}`;
}
/** What to add to the token on Cloudflare, in the order the token page lists them. */
function missingPermissionLabels(missing) {
	return CLOUDFLARE_PERMISSIONS.filter((permission) => missing.includes(permission.id)).map((permission) => permission.label);
}
var PRINTABLE = /^[\x21-\x7e]+$/;
var GLOBAL_API_KEY = /^[0-9a-f]{37}$/;
/**
* Why the pasted text cannot be a Cloudflare API token, or null when it might be one. Tokens are
* printable ASCII with no spaces, which also keeps them from breaking out of the request header.
*/
function tokenProblem(token) {
	if (token.length === 0) return "Paste the token Cloudflare showed you.";
	if (GLOBAL_API_KEY.test(token)) return "That looks like your Global API Key, which can do anything on your account. AgentMate needs an API token limited to the permissions listed here.";
	if (token.startsWith("v1.0-")) return "That looks like an Origin CA Key. AgentMate needs an API token from the same page.";
	if (/\s/.test(token)) return "A token has no spaces in it. Copy it again from Cloudflare.";
	if (token.length < 20) return "That is too short to be a Cloudflare API token.";
	if (token.length > 512) return "That is too long to be a Cloudflare API token.";
	return PRINTABLE.test(token) ? null : "That has characters a Cloudflare API token never has. Copy it again from Cloudflare.";
}
//#endregion
//#region src/renderer/src/components/cloudflare/CloudflareMark.tsx
/** Cloudflare's own mark, for the page header and the way in from Deploy. */
function CloudflareMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		fill: `#${siCloudflare.hex}`,
		className: cn("shrink-0", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: siCloudflare.path })
	});
}
//#endregion
//#region src/renderer/src/lib/deploy/sites/certificates.ts
/**
* A certificate in words: how long it has left, whether it renews by itself and how its last
* renewal went. Every state reads on its own, so a badge never leans on its colour alone.
*/
var DAY_MS = 864e5;
var SOON_DAYS = 14;
/** Whole days left; negative once it has run out. */
function daysLeft(certificate, now) {
	return Math.floor((certificate.notAfterUnixMs - now) / DAY_MS);
}
function formatDay(unixMs) {
	return new Date(unixMs).toLocaleDateString(void 0, {
		year: "numeric",
		month: "short",
		day: "numeric"
	});
}
function plural(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
function certificateBadge(certificate, now) {
	if (!certificate) return {
		label: "No SSL",
		tone: "warn",
		description: "Served over plain HTTP only."
	};
	if (certificate.state === "revoked") return {
		label: "Revoked",
		tone: "bad",
		description: "The certificate was revoked. Issue a new one."
	};
	const days = daysLeft(certificate, now);
	if (certificate.state === "expired" || days < 0) return {
		label: "Expired",
		tone: "bad",
		description: `The certificate ran out on ${formatDay(certificate.notAfterUnixMs)}.`
	};
	const staging = certificate.staging ? " It comes from the staging CA, so browsers will not trust it." : "";
	const label = days === 0 ? "SSL, last day" : `SSL, ${plural(days, "day")}`;
	const soon = certificate.state === "expiringSoon" || days <= SOON_DAYS;
	return {
		label: certificate.staging ? `${label} (staging)` : label,
		tone: soon || certificate.staging ? "warn" : "ok",
		description: `Valid until ${formatDay(certificate.notAfterUnixMs)}.${staging}`
	};
}
/** What the renewal service will do next, or why it is not doing anything. */
function renewalText(certificate, now) {
	if (certificate.source === "uploaded") return "Uploaded by hand, so it does not renew by itself. Upload a new one before it runs out.";
	if (certificate.source === "cloudflareOrigin") return "A Cloudflare Origin CA certificate: valid for years, trusted by Cloudflare only. Make a new one from here before it runs out.";
	if (!certificate.autoRenew) return "Automatic renewal is off.";
	if (certificate.failedAttempts > 0) {
		const next = certificate.nextAttemptAtUnixMs ? ` Next try ${relative(certificate.nextAttemptAtUnixMs, now)}.` : "";
		return `The last ${plural(certificate.failedAttempts, "renewal attempt")} failed.${next}`;
	}
	if (certificate.renewAtUnixMs) return certificate.renewAtUnixMs <= now ? "Renews automatically within the next few hours." : `Renews automatically around ${formatDay(certificate.renewAtUnixMs)}.`;
	return "Renews automatically before it runs out.";
}
/** "in 3 hours", "in 2 days", "5 minutes ago". */
function relative(unixMs, now) {
	const delta = unixMs - now;
	const minutes = Math.round(Math.abs(delta) / 6e4);
	const amount = minutes < 1 ? "less than a minute" : minutes < 60 ? plural(minutes, "minute") : minutes < 2880 ? plural(Math.round(minutes / 60), "hour") : plural(Math.round(minutes / 1440), "day");
	return delta >= 0 ? `in ${amount}` : `${amount} ago`;
}
//#endregion
//#region src/renderer/src/components/cloudflare/server/GuidedFix.tsx
/**
* What went wrong with a Cloudflare step, and when Cloudflare refused it for want of a
* permission, exactly what to add to the token and where (AC1): the permission as the token page
* names it, a button to that page, and, when there is one, another way (`alternative`).
*/
function GuidedFix({ error, alternative }) {
	const queryClient = useQueryClient();
	if (!error) return null;
	const permission = cloudflareErrorCode(error) === "missing-permission" ? cloudflareErrorPermission(error) : null;
	if (!permission) {
		const words = cloudflareErrorCode(error) ? cloudflareErrorMessage(error) : coreErrorMessage(error);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			role: "alert",
			className: "flex items-start gap-2 text-sm text-destructive",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: words })]
		});
	}
	const needed = cloudflarePermission(permission);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
		role: "alert",
		tone: "warning",
		icon: Key,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"The Cloudflare token cannot ",
					needed.action,
					" yet. On Cloudflare, edit the token and add",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: needed.label
					}),
					", then try again."
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					variant: "soft",
					onClick: () => {
						window.agentmat.shell.openExternal(TOKEN_PAGE);
						queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareStatus });
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " Open Cloudflare's token page"]
				}),
				alternative
			]
		})
	});
}
//#endregion
export { cloudflareErrorPermission as _, renewalText as a, TOKEN_PAGE as c, tokenTemplateUrl as d, CloudflareCard as f, cloudflareErrorMessage as g, cloudflareErrorCode as h, relative as i, missingPermissionLabels as l, NativeSelect as m, certificateBadge as n, CloudflareMark as o, Field as p, formatDay as r, CLOUDFLARE_PERMISSIONS as s, GuidedFix as t, tokenProblem as u };
