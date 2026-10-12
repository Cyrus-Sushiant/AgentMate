import { Br as __toESM, Lr as require_react, S as create } from "./tooltip-BbU-D7og.js";
//#region src/renderer/src/stores/pageHeaderStore.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
var usePageHeaderStore = create((set) => ({
	title: "",
	subtitle: void 0,
	setHeader: (title, subtitle) => set({
		title,
		subtitle
	}),
	clearHeader: () => set({
		title: "",
		subtitle: void 0
	})
}));
function usePageHeader(title, subtitle) {
	const setHeader = usePageHeaderStore((s) => s.setHeader);
	const clearHeader = usePageHeaderStore((s) => s.clearHeader);
	(0, import_react.useEffect)(() => {
		setHeader(title, subtitle);
		return () => clearHeader();
	}, [
		title,
		subtitle,
		setHeader,
		clearHeader
	]);
}
//#endregion
export { usePageHeaderStore as n, usePageHeader as t };
