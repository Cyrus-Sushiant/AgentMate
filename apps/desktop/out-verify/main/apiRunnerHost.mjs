import { i as toCloneable, n as parseMainMessage, r as readyMessage } from "./chunks/hostProtocol-CTFDRB8Z.mjs";
import runtime from "postman-runtime";
import sdk from "postman-collection";
//#region src/main/apiClient/engine/responseShape.ts
/** "Application/JSON; charset=utf-8" to "application/json". */
function mediaType(contentType) {
	return (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}
var TEXT_SUBTYPES = /(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|yaml|csv|html)/;
/**
* Whether a body can travel as text. Anything that is not clearly text goes as base64 so bytes
* survive the trip to the renderer. With no content type at all, the bytes decide.
*/
function isTextMime(mime, body) {
	if (mime.startsWith("text/")) return true;
	if (mime) return TEXT_SUBTYPES.test(mime.split("/")[1] ?? "");
	const sample = body.subarray(0, 1024);
	if (sample.includes(0)) return false;
	return !sample.toString("utf-8").includes("�");
}
function gap(later, earlier) {
	if (later === void 0 || earlier === void 0) return 0;
	return Math.max(0, Math.round((later - earlier) * 100) / 100);
}
/**
* Turns the offsets into the phases the Timeline shows. A socket that was reused never looks up
* or connects, so those phases are 0 and the wait for the first byte starts at the socket.
*/
function phaseTimings(offsets, fallbackTotal = 0) {
	if (!offsets || offsets.end === void 0) return {
		dns: 0,
		tcp: 0,
		tls: 0,
		firstByte: 0,
		download: 0,
		total: fallbackTotal
	};
	const ready = offsets.secureConnect ?? offsets.connect ?? offsets.socket;
	return {
		dns: gap(offsets.lookup, offsets.socket),
		tcp: gap(offsets.connect, offsets.lookup),
		tls: gap(offsets.secureConnect, offsets.connect),
		firstByte: gap(offsets.response, ready),
		download: gap(offsets.end, offsets.response),
		total: Math.round(offsets.end * 100) / 100
	};
}
/** Console arguments as the strings the Console drawer prints. */
function consoleText(args) {
	return args.map((value) => {
		if (typeof value === "string") return value;
		if (value === void 0) return "undefined";
		try {
			return JSON.stringify(value) ?? String(value);
		} catch {
			return String(value);
		}
	});
}
//#endregion
//#region src/main/apiClient/engine/postmanEngine.ts
function toValues(variables) {
	return (variables ?? []).map((v) => ({
		key: v.key,
		value: v.value,
		type: v.type ?? "default",
		disabled: v.enabled === false
	}));
}
function fromValues(list) {
	return list.map((v) => ({
		key: v.key,
		value: v.value == null ? "" : typeof v.value === "string" ? v.value : JSON.stringify(v.value),
		type: v.type,
		enabled: v.disabled !== true
	}));
}
function withoutEvents(node) {
	const { event: _event, ...rest } = node;
	const copy = rest;
	if (Array.isArray(node.item)) copy.item = node.item.map((child) => withoutEvents(child));
	return copy;
}
/** Glob-style hosts from the proxy settings as the match patterns Postman's proxy list reads. */
function bypassPattern(host) {
	return `http+https://${host.trim()}/*`;
}
function proxyList(proxy) {
	if (!proxy) return void 0;
	const url = new URL(proxy.url);
	return new sdk.ProxyConfigList({}, [{
		match: "http+https://*/*",
		host: url.hostname,
		port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
		authenticate: Boolean(url.username),
		username: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		bypass: proxy.bypass.filter(Boolean).map(bypassPattern)
	}]);
}
function bodyBuffer(response) {
	const stream = response.stream;
	if (!stream) return Buffer.alloc(0);
	if (Buffer.isBuffer(stream)) return stream;
	return Buffer.from(stream.data);
}
function toResponse(response, history, maxInlineBytes) {
	const buffer = bodyBuffer(response);
	const mime = mediaType(response.headers.get("content-type"));
	const text = isTextMime(mime, buffer);
	const truncated = buffer.length > maxInlineBytes;
	const inline = truncated ? buffer.subarray(0, maxInlineBytes) : buffer;
	const size = response.size();
	return {
		status: response.code,
		statusText: response.status ?? "",
		headers: response.headers.all().map((h) => ({
			key: h.key,
			value: String(h.value)
		})),
		body: inline.toString(text ? "utf-8" : "base64"),
		bodyEncoding: text ? "utf8" : "base64",
		bodyTruncated: truncated,
		mime,
		size: {
			body: buffer.length,
			headers: size.header ?? 0
		},
		timings: phaseTimings(history?.timings?.offset, response.responseTime ?? 0),
		httpVersion: history?.response?.httpVersion ?? "1.1"
	};
}
function toSent(request, history) {
	if (!request && !history?.request) return null;
	const body = request?.body && request.body.mode ? request.body.toString() : "";
	return {
		method: history?.request?.method ?? request?.method ?? "GET",
		url: history?.request?.href ?? request?.url.toString() ?? "",
		headers: history?.request?.headers?.map((h) => ({
			key: h.key,
			value: String(h.value)
		})) ?? request?.headers.all().filter((h) => !h.disabled).map((h) => ({
			key: h.key,
			value: String(h.value)
		})) ?? [],
		body: body || null
	};
}
function toAssertions(results) {
	return results.map((r) => ({
		name: r.name ?? "",
		passed: r.passed === true,
		skipped: r.skipped === true,
		error: r.error ? r.error.message ?? String(r.error) : null
	}));
}
function messageOf(error) {
	if (!error) return "Unknown error";
	if (typeof error === "string") return error;
	const { message, code } = error;
	if (message && code && !message.includes(code)) return `${code}: ${message}`;
	return message ?? code ?? String(error);
}
var postmanEngine = { run(input, onEvent) {
	const { options } = input;
	const source = options.scriptsEnabled ? input.collection : withoutEvents(input.collection);
	const collection = new sdk.Collection(source);
	const environment = new sdk.VariableScope({ values: toValues(input.environment) });
	const globals = new sdk.VariableScope({ values: toValues(input.globals) });
	let handle = null;
	let cancelRequested = false;
	let cancelled = false;
	let currentItem = null;
	return {
		cancel() {
			cancelRequested = true;
			cancelled = true;
			handle?.abort();
		},
		done: new Promise((resolve) => {
			let settled = false;
			const finish = (error) => {
				if (settled) return;
				settled = true;
				resolve({
					error: error && !cancelled ? messageOf(error) : null,
					cancelled,
					environment: fromValues(environment.values.all()),
					globals: fromValues(globals.values.all()),
					collectionVariables: fromValues(collection.variables.all())
				});
			};
			new runtime.Runner().run(collection, {
				environment,
				globals,
				entrypoint: input.entrypoint ? { execute: input.entrypoint } : void 0,
				timeout: { request: options.timeoutMs },
				requester: {
					strictSSL: options.strictSSL,
					followRedirects: options.followRedirects,
					maxRedirects: options.maxRedirects,
					timings: true
				},
				proxies: proxyList(options.proxy)
			}, (error, run) => {
				if (error) {
					finish(error);
					return;
				}
				handle = run;
				run.start({
					beforeItem: (_error, _cursor, item) => {
						currentItem = item.id;
					},
					response: (responseError, _cursor, response, request, item, _cookies, history) => {
						const entries = history?.execution?.data ?? [];
						const last = entries[entries.length - 1];
						onEvent({
							type: "response",
							itemId: item?.id ?? currentItem ?? "",
							response: response ? toResponse(response, last, options.maxInlineBodyBytes) : null,
							sent: toSent(request, last),
							error: responseError ? messageOf(responseError) : null
						});
					},
					assertion: (_cursor, results) => {
						onEvent({
							type: "assertion",
							itemId: currentItem ?? "",
							results: toAssertions(results)
						});
					},
					console: (_cursor, level, ...args) => {
						onEvent({
							type: "console",
							itemId: currentItem,
							level,
							messages: consoleText(args)
						});
					},
					exception: (_cursor, exceptionError) => {
						onEvent({
							type: "exception",
							itemId: currentItem,
							message: messageOf(exceptionError)
						});
					},
					abort: () => {
						cancelled = true;
						finish(null);
					},
					done: (doneError) => finish(doneError)
				});
				if (cancelRequested) run.abort();
			});
		})
	};
} };
//#endregion
//#region src/main/apiClient/runnerHost.ts
/**
* Entry point of the utility process that runs API requests (see hostClient.ts for why it is a
* process of its own). It only relays: main sends runs and cancels, this answers with events and
* a summary per run.
*/
var port = process.parentPort;
var runs = /* @__PURE__ */ new Map();
function post(message) {
	try {
		port.postMessage(message);
	} catch {
		port.postMessage(toCloneable(message));
	}
}
port.on("message", (event) => {
	const message = parseMainMessage(event.data);
	if (!message) return;
	if (message.type === "cancel") {
		runs.get(message.runId)?.cancel();
		return;
	}
	const { runId, input } = message;
	try {
		const run = postmanEngine.run(input, (engineEvent) => post({
			type: "event",
			runId,
			event: engineEvent
		}));
		runs.set(runId, run);
		run.done.then((summary) => {
			runs.delete(runId);
			post({
				type: "done",
				runId,
				summary
			});
		});
	} catch (error) {
		post({
			type: "done",
			runId,
			summary: {
				error: error instanceof Error ? error.message : String(error),
				cancelled: false,
				environment: [],
				globals: [],
				collectionVariables: []
			}
		});
	}
});
process.on("uncaughtException", (error) => {
	post({
		type: "fatal",
		error: error.message
	});
});
post(readyMessage(runtime));
//#endregion
export {};
