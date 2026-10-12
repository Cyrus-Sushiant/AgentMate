import { n as app_icon_default, t as app_icon_light_default } from "./app-icon-light-CRZz1UiP.js";
//#region src/renderer/src/splash/splashParams.ts
/**
* Reads what src/main/splashWindow.ts put on the splash URL. Anything missing
* or unexpected falls back to the dark, CSS-drawn variant, which reads fine on
* any desktop.
*/
function readSplashParams(search, year) {
	const params = new URLSearchParams(search);
	const version = params.get("version");
	const build = !version ? "" : version === "dev" ? "Dev build" : `v${version}`;
	return {
		theme: params.get("theme") === "light" ? "light" : "dark",
		glass: params.get("glass") === "native" ? "native" : "css",
		credit: [`© ${year} SmartClouds`, build].filter(Boolean).join(" · ")
	};
}
//#endregion
//#region src/renderer/src/splash/main.ts
var view = readSplashParams(window.location.search, (/* @__PURE__ */ new Date()).getFullYear());
var root = document.documentElement;
root.dataset.theme = view.theme;
root.dataset.glass = view.glass;
var logo = document.getElementById("logo");
logo.src = view.theme === "dark" ? app_icon_default : app_icon_light_default;
var credit = document.getElementById("credit");
if (credit) credit.textContent = view.credit;
var status = document.getElementById("status");
window.agentmat.splash.onStatus((text) => {
	if (status) status.textContent = text;
});
window.agentmat.splash.onClose(() => {
	document.body.classList.add("closing");
});
logo.decode().catch(() => void 0).then(() => requestAnimationFrame(() => document.body.classList.add("ready")));
//#endregion
