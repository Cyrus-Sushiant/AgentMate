//#region src/shared/sshErrors.ts
var CODES$1 = /* @__PURE__ */ new Set([
	"host-key-changed",
	"sudo-password-required",
	"sudo-password-rejected",
	"vault-locked"
]);
var CODE$1 = /\[ssh:([a-z-]+)\]\s*/;
var REMOTE_PREFIX = /^Error invoking remote method '[^']+': (?:\w*Error: )?/;
function sshErrorCode(error) {
	const code = (error instanceof Error ? error.message : String(error)).match(CODE$1)?.[1];
	return code && CODES$1.has(code) ? code : null;
}
/** The human part of the message, without Electron's wrapper or the code tag. */
function sshErrorMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(REMOTE_PREFIX, "").replace(CODE$1, "");
}
//#endregion
//#region src/shared/coreErrors.ts
var CODES = /* @__PURE__ */ new Set([
	"challengeInvalid",
	"deviceUnknown",
	"deviceRevoked",
	"invalidCredentials",
	"lockedOut",
	"totpRequired",
	"totpInvalid",
	"sessionExpired",
	"sessionRevoked",
	"rateLimited",
	"enrollmentCodeInvalid",
	"keyInvalid",
	"notEnrolled",
	"stepUpRequired",
	"forbidden",
	"tlsPinMismatch"
]);
var CODE = /\[core:([A-Za-z]+)\]\s*/;
function coreErrorCode(error) {
	const code = (error instanceof Error ? error.message : String(error)).match(CODE)?.[1];
	return code && CODES.has(code) ? code : null;
}
/**
* The human part of the message, without Electron's wrapper or a code tag. A core call runs over
* SSH, so the tag can be an SSH one too.
*/
function coreErrorMessage(error) {
	return sshErrorMessage(error).replace(CODE, "");
}
//#endregion
export { sshErrorMessage as i, coreErrorMessage as n, sshErrorCode as r, coreErrorCode as t };
