import { a as encodeLine, i as createLineReader, o as ptyHostPaths, t as PtySessionManager } from "./chunks/sessionManager-DF_A_R6o.mjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { appendFileSync, chmodSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { connect, createServer } from "node:net";
//#region src/main/ptyHost/hostEntry.ts
/**
* Background terminal host. Runs as its own detached process (the Electron binary in plain
* Node mode) so the shells it owns outlive the app: quitting, restarting, or installing an
* update only drops the app's connection, and the next launch reattaches to the same shells.
*
* Started by hostLauncher.ts. Keep this entry free of `electron` imports; there is no
* Electron runtime in this process.
*/
/** Exit code telling the launcher another host already owns the endpoint. */
var EXIT_ENDPOINT_TAKEN = 3;
/** How long a host with no shells and no app connected lingers before exiting. */
var IDLE_EXIT_MS = 15e3;
/** A freshly started host gets longer, so a slow app start can still reach it. */
var STARTUP_IDLE_EXIT_MS = 6e4;
function argValue(name) {
	const index = process.argv.indexOf(name);
	return index === -1 ? void 0 : process.argv[index + 1];
}
var userDataDir = argValue("--user-data");
var appVersion = argValue("--app-version") ?? "unknown";
if (!userDataDir) process.exit(2);
var paths = ptyHostPaths(userDataDir);
mkdirSync(paths.runtimeDir, { recursive: true });
function log(message) {
	try {
		try {
			if (statSync(paths.logFile).size > 1048576) unlinkSync(paths.logFile);
		} catch {}
		appendFileSync(paths.logFile, `${(/* @__PURE__ */ new Date()).toISOString()} [${process.pid}] ${message}\n`);
	} catch {}
}
process.stdout?.on?.("error", () => void 0);
process.stderr?.on?.("error", () => void 0);
process.on("uncaughtException", (error) => log(`uncaught: ${error.stack ?? error}`));
process.on("unhandledRejection", (error) => log(`unhandled rejection: ${String(error)}`));
var token = randomBytes(32).toString("hex");
var clients = /* @__PURE__ */ new Set();
var idleTimer = null;
var server = null;
var manager = new PtySessionManager(() => scheduleIdleCheck(IDLE_EXIT_MS), (message) => log(`[pty] ${message}`));
function scheduleIdleCheck(delay) {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = null;
	if (clients.size > 0 || manager.size > 0) return;
	idleTimer = setTimeout(() => {
		if (clients.size === 0 && manager.size === 0) shutdown("idle");
	}, delay);
	idleTimer.unref?.();
}
function shutdown(reason) {
	log(`shutting down (${reason})`);
	manager.killAll();
	for (const socket of clients) socket.destroy();
	server?.close();
	setTimeout(() => process.exit(0), 200);
}
function tokensMatch(candidate) {
	if (typeof candidate !== "string") return false;
	const a = Buffer.from(candidate);
	const b = Buffer.from(token);
	return a.length === b.length && timingSafeEqual(a, b);
}
function handleConnection(socket) {
	let authenticated = false;
	let compatible = false;
	const send = (message) => {
		if (!socket.destroyed) socket.write(encodeLine(message));
	};
	const reply = (id, result) => {
		if (id !== void 0) send({
			kind: "response",
			id,
			ok: true,
			result
		});
	};
	const fail = (id, error) => {
		if (id !== void 0) send({
			kind: "response",
			id,
			ok: false,
			error
		});
	};
	const listener = {
		onData: (sessionId, data) => send({
			kind: "event",
			event: "data",
			sessionId,
			data
		}),
		onExit: (sessionId, exitCode) => send({
			kind: "event",
			event: "exit",
			sessionId,
			exitCode
		})
	};
	const handle = async (request) => {
		if (request.type === "hello") {
			if (!tokensMatch(request.token)) {
				fail(request.id, "unauthorized");
				socket.destroy();
				return;
			}
			authenticated = true;
			compatible = request.protocolVersion === 1;
			clients.add(socket);
			scheduleIdleCheck(IDLE_EXIT_MS);
			const result = {
				protocolVersion: 1,
				appVersion,
				pid: process.pid,
				sessionCount: manager.size
			};
			reply(request.id, result);
			return;
		}
		if (!authenticated) {
			socket.destroy();
			return;
		}
		if (request.type === "shutdown") {
			reply(request.id);
			if (request.payload.killSessions || manager.size === 0) shutdown("requested");
			return;
		}
		if (!compatible) {
			fail(request.id, "protocol mismatch");
			return;
		}
		switch (request.type) {
			case "createOrAttach":
				reply(request.id, await manager.createOrAttach(request.payload, listener));
				return;
			case "write":
				manager.write(request.payload.sessionId, request.payload.data);
				reply(request.id);
				return;
			case "resize":
				manager.resize(request.payload.sessionId, request.payload.cols, request.payload.rows);
				reply(request.id);
				return;
			case "kill":
				manager.kill(request.payload.sessionId);
				reply(request.id);
				return;
			case "list":
				reply(request.id, manager.list());
				return;
		}
	};
	const read = createLineReader((message) => {
		const request = message;
		handle(request).catch((error) => {
			log(`request ${request.type} failed: ${error instanceof Error ? error.stack : error}`);
			fail(request.id, error instanceof Error ? error.message : String(error));
		});
	}, () => socket.destroy());
	socket.setNoDelay(true);
	socket.on("data", read);
	socket.on("error", () => void 0);
	socket.on("close", () => {
		clients.delete(socket);
		manager.detachListener(listener);
		scheduleIdleCheck(IDLE_EXIT_MS);
	});
}
/** True when something is already answering on the endpoint. */
function endpointAlive(endpoint) {
	return new Promise((resolve) => {
		const probe = connect(endpoint);
		probe.once("connect", () => {
			probe.destroy();
			resolve(true);
		});
		probe.once("error", () => resolve(false));
	});
}
function listen(endpoint, retried = false) {
	const candidate = createServer(handleConnection);
	candidate.once("error", async (error) => {
		if (error.code === "EADDRINUSE" && !retried && process.platform !== "win32") {
			if (!await endpointAlive(endpoint)) {
				try {
					unlinkSync(endpoint);
				} catch {}
				listen(endpoint, true);
				return;
			}
		}
		log(`could not listen on ${endpoint}: ${error.message}`);
		process.send?.({
			type: "failed",
			code: error.code ?? "unknown"
		});
		process.exit(error.code === "EADDRINUSE" ? EXIT_ENDPOINT_TAKEN : 1);
	});
	candidate.listen(endpoint, () => {
		server = candidate;
		writeFileSync(paths.tokenFile, token, { mode: 384 });
		try {
			chmodSync(paths.tokenFile, 384);
		} catch {}
		log(`listening (app ${appVersion}, protocol 1)`);
		scheduleIdleCheck(STARTUP_IDLE_EXIT_MS);
		process.send?.({
			type: "ready",
			pid: process.pid
		});
	});
}
listen(paths.endpoint);
//#endregion
export {};
