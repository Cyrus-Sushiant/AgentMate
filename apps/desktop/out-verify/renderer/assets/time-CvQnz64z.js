//#region src/renderer/src/lib/time.ts
function timeAgo(iso) {
	const diffMs = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diffMs / 6e4);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}
/** How long ago a moment in ms was, in the largest whole unit: "40s", "12m", "15h", "43d". */
function shortAge(sinceMs, now = Date.now()) {
	const seconds = Math.max(0, Math.floor((now - sinceMs) / 1e3));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
//#endregion
export { timeAgo as n, shortAge as t };
