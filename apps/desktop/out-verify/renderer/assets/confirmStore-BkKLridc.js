import { S as create } from "./tooltip-BbU-D7og.js";
//#region src/renderer/src/stores/confirmStore.ts
var initialState = {
	open: false,
	title: "",
	description: void 0,
	items: void 0,
	moreCount: void 0,
	warning: void 0,
	icon: void 0,
	confirmLabel: "Confirm",
	cancelLabel: "Cancel",
	variant: "default",
	typeToConfirm: void 0,
	resolve: null,
	typed: ""
};
var useConfirmStore = create(() => initialState);
/** Opens the shared confirmation modal and resolves once the user picks an option. */
function confirmDialog(options) {
	return new Promise((resolve) => {
		useConfirmStore.getState().resolve?.(false);
		useConfirmStore.setState({
			...initialState,
			...options,
			open: true,
			resolve
		});
	});
}
function resolveConfirm(value) {
	useConfirmStore.getState().resolve?.(value);
	useConfirmStore.setState({
		open: false,
		resolve: null
	});
}
function setConfirmTyped(typed) {
	useConfirmStore.setState({ typed });
}
//#endregion
export { useConfirmStore as i, resolveConfirm as n, setConfirmTyped as r, confirmDialog as t };
