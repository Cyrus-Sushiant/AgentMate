import { n as scanProviderLogs } from "./chunks/logParsers-uWENCq7D.mjs";
import { parentPort, workerData } from "node:worker_threads";
//#region src/main/usage/usageScanWorker.ts
var input = workerData;
scanProviderLogs(input.provider, input.cache, input.sinceMs).then((result) => {
	parentPort?.postMessage({
		ok: true,
		result
	});
}).catch((err) => {
	const error = err instanceof Error ? err.message : String(err);
	parentPort?.postMessage({
		ok: false,
		error
	});
});
//#endregion
export {};
