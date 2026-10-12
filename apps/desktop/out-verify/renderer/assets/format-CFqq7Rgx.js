//#region src/renderer/src/lib/format.ts
/** A byte count with about three significant digits: "9.28 GB", "58.4 MB", "467 MB". */
function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = [
		"B",
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	if (value >= 999.5 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
	return `${value.toFixed(digits)} ${units[unit]}`;
}
/** A CPU share: "<0.1%" for a trace, one decimal under 10%, whole numbers above. */
function formatPercent(percent) {
	if (percent > 0 && percent < .1) return "<0.1%";
	if (percent < 10) return `${percent.toFixed(1)}%`;
	return `${Math.round(percent)}%`;
}
//#endregion
export { formatPercent as n, formatBytes as t };
