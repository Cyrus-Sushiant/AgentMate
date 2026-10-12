import { s as __toESM, t as require_adm_zip } from "./chunks/adm-zip-BDK65wv0.mjs";
import { parentPort, workerData } from "node:worker_threads";
//#region src/main/security/codeqlExtractWorker.ts
var import_adm_zip = /* @__PURE__ */ __toESM(require_adm_zip());
var input = workerData;
try {
	const zip = new import_adm_zip.default(input.zipPath);
	const entries = zip.getEntries();
	const total = entries.length;
	let done = 0;
	const step = Math.max(1, Math.floor(total / 100));
	for (const entry of entries) {
		if (!entry.isDirectory) zip.extractEntryTo(entry, input.destDir, true, true);
		done += 1;
		if (done % step === 0 || done === total) parentPort?.postMessage({
			kind: "progress",
			done,
			total
		});
	}
	parentPort?.postMessage({ kind: "done" });
} catch (err) {
	const error = err instanceof Error ? err.message : String(err);
	parentPort?.postMessage({
		kind: "error",
		error
	});
}
//#endregion
export {};
