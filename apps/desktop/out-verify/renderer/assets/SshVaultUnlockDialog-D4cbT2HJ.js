import { Br as __toESM, F as Button, Fr as require_jsx_runtime, I as cn, Lr as require_react, Nt as Eye, Pt as EyeOff, gn as Lock, rr as Spinner } from "./tooltip-BbU-D7og.js";
import { r as Input } from "./input-yQ7bc-An.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as Label } from "./label-D49cSr88.js";
//#region src/renderer/src/components/ui/secret-input.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** A masked text input with an eye toggle, for passwords, API keys, and other secrets. */
var SecretInput = (0, import_react.forwardRef)(function SecretInput({ id, value, onChange, placeholder, className, trailing, ...rest }, ref) {
	const [visible, setVisible] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			ref,
			id,
			type: visible ? "text" : "password",
			value,
			onChange: (event) => onChange(event.target.value),
			placeholder,
			autoComplete: "off",
			spellCheck: false,
			...rest,
			className: cn(trailing ? "pr-16" : "pr-9", "font-mono placeholder:font-sans", className)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5",
			children: [trailing, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "ghost",
				size: "icon-sm",
				onClick: () => setVisible((current) => !current),
				"aria-label": visible ? "Hide value" : "Show value",
				children: visible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {})
			})]
		})]
	});
});
//#endregion
//#region src/renderer/src/components/remote/SshVaultUnlockDialog.tsx
function SshVaultUnlockDialog({ open, onOpenChange, mode, onUnlocked }) {
	const [passphrase, setPassphrase] = (0, import_react.useState)("");
	const [confirmPassphrase, setConfirmPassphrase] = (0, import_react.useState)("");
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setPassphrase("");
		setConfirmPassphrase("");
		setSubmitting(false);
		setError(null);
	}, [open]);
	const canSubmit = passphrase.length > 0 && (mode === "unlock" || passphrase === confirmPassphrase);
	async function handleSubmit() {
		if (!canSubmit || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			if (mode === "unlock") {
				if (!await window.agentmat.ssh.unlockVault(passphrase)) {
					setError("Wrong passkey.");
					return;
				}
			} else {
				const result = await window.agentmat.ssh.setPasskey(passphrase);
				if (!result.ok) {
					setError(result.error ?? "Could not set the passkey.");
					return;
				}
			}
			onOpenChange(false);
			onUnlocked();
		} finally {
			setSubmitting(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-sm",
			onKeyDown: (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					handleSubmit();
				}
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-4 w-4 text-primary" }), mode === "unlock" ? "Unlock the vault" : "Protect the vault with a passkey"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: mode === "unlock" ? "Enter your vault passkey to use saved servers and project environments this session." : "Encrypts saved server passwords, key passphrases and project environment secrets with this passkey instead of just the OS keychain. If you forget it, those secrets cannot be recovered." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "ssh-vault-passphrase",
								children: "Passkey"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecretInput, {
								id: "ssh-vault-passphrase",
								value: passphrase,
								onChange: setPassphrase
							})]
						}),
						mode === "set" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "ssh-vault-passphrase-confirm",
								children: "Confirm passkey"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecretInput, {
								id: "ssh-vault-passphrase-confirm",
								value: confirmPassphrase,
								onChange: setConfirmPassphrase
							})]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-destructive",
							children: error
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: () => onOpenChange(false),
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					disabled: !canSubmit || submitting,
					onClick: () => void handleSubmit(),
					children: [submitting && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-4 w-4 animate-spin" }), mode === "unlock" ? "Unlock" : "Set passkey"]
				})] })
			]
		})
	});
}
//#endregion
export { SecretInput as n, SshVaultUnlockDialog as t };
