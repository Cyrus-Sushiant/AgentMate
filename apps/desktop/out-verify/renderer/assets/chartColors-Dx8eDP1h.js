import { Br as __toESM, Lr as require_react } from "./tooltip-BbU-D7og.js";
import { S as resolveIsDark, w as useThemeStore } from "./cliStore-BEVHhLcE.js";
//#region src/renderer/src/lib/chartColors.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
var CATEGORICAL_LIGHT = [
	"#00994d",
	"#2a78d6",
	"#e87ba4",
	"#eda100",
	"#1baf7a",
	"#eb6834",
	"#4a3aa7",
	"#e34948"
];
var CATEGORICAL_DARK = [
	"#00ad57",
	"#3987e5",
	"#d55181",
	"#c98500",
	"#199e70",
	"#d95926",
	"#9085e9",
	"#e66767"
];
function useIsDarkMode() {
	const theme = useThemeStore((s) => s.theme);
	const [systemDark, setSystemDark] = (0, import_react.useState)(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
	(0, import_react.useEffect)(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (event) => setSystemDark(event.matches);
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);
	return resolveIsDark(theme, systemDark);
}
function useChartColors() {
	const categorical = useIsDarkMode() ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
	return {
		green: categorical[0],
		blue: categorical[1],
		categorical
	};
}
/** The card the accents sit on, per mode: hsl(var(--card)) from index.css. */
var SURFACE_DARK = "#1c1c1c";
var SURFACE_LIGHT = "#e8e8e8";
var MIN_CONTRAST = 4.5;
function parseHex(hex) {
	const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
	if (!match) return null;
	const digits = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
	const value = Number.parseInt(digits, 16);
	return {
		r: (value >> 16 & 255) / 255,
		g: (value >> 8 & 255) / 255,
		b: (value & 255) / 255
	};
}
function toHex({ r, g, b }) {
	const channel = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
	return `#${channel(r)}${channel(g)}${channel(b)}`;
}
var toLinear = (v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
var toGamma = (v) => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055;
function relativeLuminance({ r, g, b }) {
	return .2126 * toLinear(r) + .7152 * toLinear(g) + .0722 * toLinear(b);
}
function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
}
/** sRGB → OKLCH (lightness 0-1, chroma, hue in radians). */
function toOklch({ r, g, b }) {
	const lr = toLinear(r);
	const lg = toLinear(g);
	const lb = toLinear(b);
	const l = Math.cbrt(.4122214708 * lr + .5363325363 * lg + .0514459929 * lb);
	const m = Math.cbrt(.2119034982 * lr + .6806995451 * lg + .1073969566 * lb);
	const s = Math.cbrt(.0883024619 * lr + .2817188376 * lg + .6299787005 * lb);
	const okL = .2104542553 * l + .793617785 * m - .0040720468 * s;
	const okA = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s;
	const okB = .0259040371 * l + .7827717662 * m - .808675766 * s;
	return {
		l: okL,
		c: Math.hypot(okA, okB),
		h: Math.atan2(okB, okA)
	};
}
function fromOklch(l, c, h) {
	const a = Math.cos(h) * c;
	const b = Math.sin(h) * c;
	const lc = (l + .3963377774 * a + .2158037573 * b) ** 3;
	const mc = (l - .1055613458 * a - .0638541728 * b) ** 3;
	const sc = (l - .0894841775 * a - 1.291485548 * b) ** 3;
	const lr = 4.0767416621 * lc - 3.3077115913 * mc + .2309699292 * sc;
	const lg = -1.2684380046 * lc + 2.6097574011 * mc - .3413193965 * sc;
	const lb = -.0041960863 * lc - .7034186147 * mc + 1.707614701 * sc;
	const inGamut = [
		lr,
		lg,
		lb
	].every((v) => v >= -.001 && v <= 1.001);
	return {
		rgb: {
			r: toGamma(lr),
			g: toGamma(lg),
			b: toGamma(lb)
		},
		inGamut
	};
}
/** Same hue at a new lightness, desaturating only as far as the gamut forces. */
function atLightness(l, c, h) {
	let chroma = c;
	for (let i = 0; i < 24; i++) {
		const { rgb, inGamut } = fromOklch(l, chroma, h);
		if (inGamut || chroma <= .001) return rgb;
		chroma *= .9;
	}
	return fromOklch(l, 0, h).rgb;
}
var accentCache = /* @__PURE__ */ new Map();
/**
* A provider's brand accent, adjusted to stay legible in the given theme:
* lightened in dark mode, darkened in light mode, and left alone whenever the
* brand color already reads against that mode's card.
*/
function readableAccent(hex, isDark) {
	const cacheKey = `${hex}|${isDark ? "d" : "l"}`;
	const cached = accentCache.get(cacheKey);
	if (cached) return cached;
	const rgb = parseHex(hex);
	const surface = parseHex(isDark ? SURFACE_DARK : SURFACE_LIGHT);
	if (!rgb || !surface) return hex;
	let result = hex;
	if (contrastRatio(rgb, surface) < MIN_CONTRAST) {
		const { l, c, h } = toOklch(rgb);
		const step = isDark ? .02 : -.02;
		for (let i = 1; i <= 50; i++) {
			const nextL = Math.min(1, Math.max(0, l + step * i));
			const candidate = atLightness(nextL, c, h);
			result = toHex(candidate);
			if (contrastRatio(candidate, surface) >= MIN_CONTRAST) break;
			if (nextL <= 0 || nextL >= 1) break;
		}
	}
	accentCache.set(cacheKey, result);
	return result;
}
/** `readableAccent` for the theme currently on screen. */
function useReadableAccent(hex) {
	return readableAccent(hex, useIsDarkMode());
}
//#endregion
export { useIsDarkMode as n, useReadableAccent as r, useChartColors as t };
