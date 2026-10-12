const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./tsMode-Dha899pW.js","./editor.api-CbvhafvX.js","./preload-helper-ARKYL6bp.js","./editor-DAtOmrYY.css","./workers-B1TcwpIX.js","./toggleHighContrast-D0XhZnmZ.js","./toggleHighContrast-DbzWByli.css"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./preload-helper-ARKYL6bp.js";
import { s as languages, t as Emitter } from "./editor.api-CbvhafvX.js";
//#region ../../node_modules/.pnpm/monaco-editor@0.56.0/node_modules/monaco-editor/esm/vs/languages/features/typescript/register.js
var LanguageServiceDefaultsImpl = class {
	constructor(compilerOptions, diagnosticsOptions, workerOptions, inlayHintsOptions, modeConfiguration) {
		this._onDidChange = new Emitter();
		this._onDidExtraLibsChange = new Emitter();
		this._extraLibs = /* @__PURE__ */ Object.create(null);
		this._removedExtraLibs = /* @__PURE__ */ Object.create(null);
		this._eagerModelSync = false;
		this.setCompilerOptions(compilerOptions);
		this.setDiagnosticsOptions(diagnosticsOptions);
		this.setWorkerOptions(workerOptions);
		this.setInlayHintsOptions(inlayHintsOptions);
		this.setModeConfiguration(modeConfiguration);
		this._onDidExtraLibsChangeTimeout = -1;
	}
	get onDidChange() {
		return this._onDidChange.event;
	}
	get onDidExtraLibsChange() {
		return this._onDidExtraLibsChange.event;
	}
	get modeConfiguration() {
		return this._modeConfiguration;
	}
	get workerOptions() {
		return this._workerOptions;
	}
	get inlayHintsOptions() {
		return this._inlayHintsOptions;
	}
	getExtraLibs() {
		return this._extraLibs;
	}
	addExtraLib(content, _filePath) {
		let filePath;
		if (typeof _filePath === "undefined") filePath = `ts:extralib-${Math.random().toString(36).substring(2, 15)}`;
		else filePath = _filePath;
		if (this._extraLibs[filePath] && this._extraLibs[filePath].content === content) return { dispose: () => {} };
		let myVersion = 1;
		if (this._removedExtraLibs[filePath]) myVersion = this._removedExtraLibs[filePath] + 1;
		if (this._extraLibs[filePath]) myVersion = this._extraLibs[filePath].version + 1;
		this._extraLibs[filePath] = {
			content,
			version: myVersion
		};
		this._fireOnDidExtraLibsChangeSoon();
		return { dispose: () => {
			let extraLib = this._extraLibs[filePath];
			if (!extraLib) return;
			if (extraLib.version !== myVersion) return;
			delete this._extraLibs[filePath];
			this._removedExtraLibs[filePath] = myVersion;
			this._fireOnDidExtraLibsChangeSoon();
		} };
	}
	setExtraLibs(libs) {
		for (const filePath in this._extraLibs) this._removedExtraLibs[filePath] = this._extraLibs[filePath].version;
		this._extraLibs = /* @__PURE__ */ Object.create(null);
		if (libs && libs.length > 0) for (const lib of libs) {
			const filePath = lib.filePath || `ts:extralib-${Math.random().toString(36).substring(2, 15)}`;
			const content = lib.content;
			let myVersion = 1;
			if (this._removedExtraLibs[filePath]) myVersion = this._removedExtraLibs[filePath] + 1;
			this._extraLibs[filePath] = {
				content,
				version: myVersion
			};
		}
		this._fireOnDidExtraLibsChangeSoon();
	}
	_fireOnDidExtraLibsChangeSoon() {
		if (this._onDidExtraLibsChangeTimeout !== -1) return;
		this._onDidExtraLibsChangeTimeout = window.setTimeout(() => {
			this._onDidExtraLibsChangeTimeout = -1;
			this._onDidExtraLibsChange.fire(void 0);
		}, 0);
	}
	getCompilerOptions() {
		return this._compilerOptions;
	}
	setCompilerOptions(options) {
		this._compilerOptions = options || /* @__PURE__ */ Object.create(null);
		this._onDidChange.fire(void 0);
	}
	getDiagnosticsOptions() {
		return this._diagnosticsOptions;
	}
	setDiagnosticsOptions(options) {
		this._diagnosticsOptions = options || /* @__PURE__ */ Object.create(null);
		this._onDidChange.fire(void 0);
	}
	setWorkerOptions(options) {
		this._workerOptions = options || /* @__PURE__ */ Object.create(null);
		this._onDidChange.fire(void 0);
	}
	setInlayHintsOptions(options) {
		this._inlayHintsOptions = options || /* @__PURE__ */ Object.create(null);
		this._onDidChange.fire(void 0);
	}
	setMaximumWorkerIdleTime(value) {}
	setEagerModelSync(value) {
		this._eagerModelSync = value;
	}
	getEagerModelSync() {
		return this._eagerModelSync;
	}
	setModeConfiguration(modeConfiguration) {
		this._modeConfiguration = modeConfiguration || /* @__PURE__ */ Object.create(null);
		this._onDidChange.fire(void 0);
	}
};
var modeConfigurationDefault = {
	completionItems: true,
	hovers: true,
	documentSymbols: true,
	definitions: true,
	references: true,
	documentHighlights: true,
	rename: true,
	diagnostics: true,
	documentRangeFormattingEdits: true,
	signatureHelp: true,
	onTypeFormattingEdits: true,
	codeActions: true,
	inlayHints: true
};
var typescriptDefaults = new LanguageServiceDefaultsImpl({
	allowNonTsExtensions: true,
	target: 99
}, {
	noSemanticValidation: false,
	noSyntaxValidation: false,
	onlyVisible: false
}, {}, {}, modeConfigurationDefault);
var javascriptDefaults = new LanguageServiceDefaultsImpl({
	allowNonTsExtensions: true,
	allowJs: true,
	target: 99
}, {
	noSemanticValidation: true,
	noSyntaxValidation: false,
	onlyVisible: false
}, {}, {}, modeConfigurationDefault);
function getMode() {
	return __vitePreload(() => import("./tsMode-Dha899pW.js"), __vite__mapDeps([0,1,2,3,4,5,6]), import.meta.url);
}
languages.onLanguage("typescript", () => {
	return getMode().then((mode) => mode.setupTypeScript(typescriptDefaults));
});
languages.onLanguage("javascript", () => {
	return getMode().then((mode) => mode.setupJavaScript(javascriptDefaults));
});
//#endregion
export { typescriptDefaults as t };
