//#region src/main/apiClient/hostProtocol.ts
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isId(value) {
	return typeof value === "string" && value.length > 0;
}
function isRunInput(value) {
	if (!isRecord(value) || !isRecord(value.collection) || !isRecord(value.options)) return false;
	return Array.isArray(value.collection.item) && typeof value.options.timeoutMs === "number";
}
var EVENT_TYPES = /* @__PURE__ */ new Set([
	"request",
	"response",
	"assertion",
	"console",
	"exception"
]);
function isEvent(value) {
	return isRecord(value) && typeof value.type === "string" && EVENT_TYPES.has(value.type);
}
function isSummary(value) {
	return isRecord(value) && (value.error === null || typeof value.error === "string") && typeof value.cancelled === "boolean" && Array.isArray(value.environment) && Array.isArray(value.globals) && Array.isArray(value.collectionVariables);
}
/**
* The host's "ready" message. Postman's runtime exposes its version as a function returning an
* object, and anything that is not plain data makes postMessage throw, so only the string goes.
*/
function readyMessage(runtime) {
	let version = runtime.version;
	try {
		if (typeof version === "function") version = version();
	} catch {
		version = void 0;
	}
	if (isRecord(version)) version = version.version;
	return {
		type: "ready",
		runtimeVersion: typeof version === "string" ? version : "unknown"
	};
}
/**
* A copy that postMessage can always carry. Events are built from plain data, but a value from a
* script (a Date, a function) must not be able to stop a whole run from reporting back.
*/
function toCloneable(value) {
	return JSON.parse(JSON.stringify(value));
}
function parseMainMessage(value) {
	if (!isRecord(value) || !isId(value.runId)) return null;
	if (value.type === "run" && isRunInput(value.input)) return {
		type: "run",
		runId: value.runId,
		input: value.input
	};
	if (value.type === "cancel") return {
		type: "cancel",
		runId: value.runId
	};
	return null;
}
function parseHostMessage(value) {
	if (!isRecord(value)) return null;
	switch (value.type) {
		case "ready": return typeof value.runtimeVersion === "string" ? {
			type: "ready",
			runtimeVersion: value.runtimeVersion
		} : null;
		case "event": return isId(value.runId) && isEvent(value.event) ? {
			type: "event",
			runId: value.runId,
			event: value.event
		} : null;
		case "done": return isId(value.runId) && isSummary(value.summary) ? {
			type: "done",
			runId: value.runId,
			summary: value.summary
		} : null;
		case "fatal": return typeof value.error === "string" ? {
			type: "fatal",
			error: value.error
		} : null;
		default: return null;
	}
}
//#endregion
export { toCloneable as i, parseMainMessage as n, readyMessage as r, parseHostMessage as t };
