import { S as create, f as persist } from "./tooltip-BbU-D7og.js";
import "./dist-BskwpHU1.js";
//#region ../../packages/core/dist/types/index.js
var THEME_MODES = [
	"light",
	"dark",
	"system",
	"vscode-dark",
	"vs2026"
];
function isThemeMode(value) {
	return THEME_MODES.includes(value);
}
/**
* Where the main window opens. 'last' reopens the page the app was on when it closed; the rest
* are the sidebar's pages, so the list has to follow the sidebar when a page is added there.
*/
var STARTUP_PAGES = [
	"last",
	"/",
	"/usage",
	"/prompt-builder",
	"/projects",
	"/workspace",
	"/api-client",
	"/pipelines",
	"/deploy",
	"/skills",
	"/mcp",
	"/tools",
	"/docker",
	"/android",
	"/cli-manager",
	"/ask-ai",
	"/remote",
	"/vault",
	"/help",
	"/settings"
];
function isStartupPage(value) {
	return STARTUP_PAGES.includes(value);
}
var DESKTOP_PET_IDS = [
	"fandi",
	"claude",
	"gremlin",
	"opencode",
	"tide",
	"pip",
	"brick",
	"ember",
	"nori",
	"bolt",
	"moss",
	"cocoa",
	"hex"
];
/**
* Cleans up a nickname typed in Settings. Empty means the user has not named the
* pet, so callers fall back to the character's own name.
*/
function normalizeDesktopPetName(value) {
	if (typeof value !== "string") return "";
	return value.replace(/\s+/g, " ").trim().slice(0, 24);
}
function isDesktopPetId(value) {
	return DESKTOP_PET_IDS.includes(value);
}
function isCustomPetId(value) {
	return typeof value === "string" && value.startsWith("custom-") && value.length > 7;
}
function normalizeDesktopPetId(value, customIds = []) {
	if (isDesktopPetId(value)) return value;
	if (typeof value === "string" && customIds.includes(value)) return value;
	return "fandi";
}
function isAnimatedPetFile(fileName) {
	const ext = fileName.split(".").pop()?.toLowerCase();
	return ext === "gif" || ext === "webp";
}
function clampDesktopPetScale(value) {
	return Math.round(Math.min(160, Math.max(50, typeof value === "number" && Number.isFinite(value) ? value : 100)));
}
function petBoxSize(scalePercent) {
	return Math.round(120 * (clampDesktopPetScale(scalePercent) / 100));
}
function clampDesktopPetClickArea(value) {
	return Math.round(Math.min(100, Math.max(40, typeof value === "number" && Number.isFinite(value) ? value : 100)));
}
/**
* Clickable / card-anchor box inside the pet hit square. Sprites sit on the
* bottom of that square; `clickAreaPercent` then shrinks toward the sprite
* center so empty padding around the drawing is ignored.
*/
function petClickRect(actorX, actorY, box, spriteW, spriteH, clickAreaPercent) {
	const area = clampDesktopPetClickArea(clickAreaPercent) / 100;
	const fullW = Math.max(8, spriteW > 0 ? Math.min(spriteW, box) : box);
	const fullH = Math.max(8, spriteH > 0 ? Math.min(spriteH, box) : box);
	const w = Math.max(8, fullW * area);
	const h = Math.max(8, fullH * area);
	const spriteLeft = actorX + (box - fullW) / 2;
	const spriteTop = actorY + box - fullH;
	return {
		x: spriteLeft + (fullW - w) / 2,
		y: spriteTop + (fullH - h) / 2,
		w,
		h
	};
}
var DESKTOP_PET_CARD_VIEWS = [
	"tokens",
	"system",
	"network"
];
function normalizeDesktopPetCardView(value) {
	return DESKTOP_PET_CARD_VIEWS.includes(value) ? value : "tokens";
}
function clampDesktopPetSpeed(value) {
	return Math.round(Math.min(200, Math.max(40, typeof value === "number" && Number.isFinite(value) ? value : 100)));
}
function normalizeDesktopPetActionSpeeds(value) {
	const rec = value && typeof value === "object" ? value : {};
	return {
		walk: clampDesktopPetSpeed(rec.walk),
		climb: clampDesktopPetSpeed(rec.climb),
		descend: clampDesktopPetSpeed(rec.descend),
		parachute: clampDesktopPetSpeed(rec.parachute)
	};
}
/** Column counts a single dashboard row can be switched between. */
var DASHBOARD_COLUMN_OPTIONS = [
	1,
	2,
	3,
	4
];
/** Built-in Dashboard charts, movable and hideable like any other dashboard card. */
var DASHBOARD_CHART_IDS = [
	"cpu",
	"memory",
	"disk",
	"gpu",
	"network",
	"pings",
	"github",
	"github-actions"
];
/** Built-in Dashboard stat tiles, movable and hideable like any other dashboard card. */
var DASHBOARD_STAT_IDS = [
	"installed-clis",
	"active-projects",
	"skill-repos",
	"location"
];
/** Token Usage's aggregate summary tiles, pinnable to the dashboard from that page. */
var DASHBOARD_USAGE_SUMMARY_IDS = [
	"tokens-today",
	"tokens-week",
	"cost-today",
	"providers-tracked"
];
/** Where a notification hook delivers its message. */
function notificationHookChannel(kind) {
	return kind === "pet" ? "pet" : "telegram";
}
function configuredRunCommands(project) {
	return project.runCommands.filter((entry) => entry.command.trim().length > 0);
}
/** Label shown in pickers and tooltips: the environment name, or the command if unnamed. */
function projectRunCommandTitle(entry) {
	return entry.label.trim() || entry.command;
}
function projectRunCommandHint(entry) {
	const title = entry.label.trim();
	return title ? `${title}: ${entry.command}` : entry.command;
}
/**
* Colours are stored as hex, the one form the pickers produce and every consumer
* can drop straight into a style: `#rrggbb` when opaque, `#rrggbbaa` once the
* opacity slider has been moved. A fully opaque value keeps the short form so the
* two never disagree about the same colour. Anything else (a stray value in a
* backup, an older field) reads back as "no colour picked".
*/
/** The app's own tint, offered as the starting point once a custom terminal background is turned on. */
var DEFAULT_TERMINAL_BACKGROUND_COLOR = "#0a1210";
function normalizeProjectColor(value) {
	if (typeof value !== "string") return null;
	const hex = value.trim().toLowerCase();
	if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) return null;
	return hex.length === 9 && hex.endsWith("ff") ? hex.slice(0, 7) : hex;
}
//#endregion
//#region src/renderer/src/stores/themeStore.ts
function resolveTheme(theme, systemPrefersDark) {
	if (theme === "system") return systemPrefersDark ? "dark" : "light";
	return theme;
}
/** The `<html>` classes a resolved theme applies. `.dark` alone drives Tailwind's `dark:`
* variant and every existing boolean ("is this dark?") consumer; the second class only
* scopes the CSS variable overrides specific to that theme (see index.css). */
function themeClassName(resolved) {
	switch (resolved) {
		case "light": return "";
		case "dark": return "dark";
		case "vscode-dark": return "dark theme-vscode-dark";
		case "vs2026": return "dark theme-vs2026";
	}
}
function resolveIsDark(theme, systemPrefersDark) {
	return resolveTheme(theme, systemPrefersDark) !== "light";
}
function applyThemeClass(theme) {
	const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = resolveTheme(theme, systemPrefersDark);
	const root = document.documentElement;
	root.classList.remove("dark", "theme-vscode-dark", "theme-vs2026");
	const next = themeClassName(resolved);
	if (next) root.classList.add(...next.split(" "));
}
/**
* The theme main put on the main window's URL (see mainWindowQuery in src/main/windowGlass.ts).
* Other windows load without it.
*/
function themeFromSearch(search) {
	const theme = new URLSearchParams(search).get("theme");
	return isThemeMode(theme) ? theme : void 0;
}
/**
* Puts the theme class on <html> before React renders, so the first frame already matches the
* window's native tint. initTheme still runs afterwards and re-applies the same classes from
* settings, which changes nothing on screen.
*/
function applyInitialTheme(search) {
	const theme = themeFromSearch(search);
	if (!theme) return;
	applyThemeClass(theme);
	useThemeStore.setState({ theme });
}
/**
* Keeps the URL's theme in step with a change made here, so reloading the page (the error
* screen's Reload button) starts on the theme in use rather than the one the window opened with.
*/
function syncThemeInUrl(theme) {
	const url = new URL(window.location.href);
	if (!url.searchParams.has("theme")) return;
	url.searchParams.set("theme", theme);
	window.history.replaceState(window.history.state, "", url);
}
var useThemeStore = create((set) => ({
	theme: "system",
	setTheme: (theme) => {
		applyThemeClass(theme);
		syncThemeInUrl(theme);
		set({ theme });
		window.agentmat.settings.update({ theme });
	}
}));
async function initTheme() {
	const settings = await window.agentmat.settings.get();
	applyThemeClass(settings.theme);
	useThemeStore.setState({ theme: settings.theme });
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (useThemeStore.getState().theme === "system") applyThemeClass("system");
	});
}
//#endregion
//#region src/renderer/src/lib/shortcuts.ts
var DIGIT_CODE = /^Digit([1-9])$/;
/** The number a digit-row binding was pressed with, or null for any other key. */
function digitOf(code) {
	const match = DIGIT_CODE.exec(code);
	return match ? Number(match[1]) : null;
}
var SHORTCUT_COMMANDS = [
	{
		id: "terminal.toggle",
		label: "Toggle terminal",
		description: "Opens the terminal drawer, or closes it when it is already open.",
		group: "Terminal",
		scope: "global",
		defaults: [{
			code: "KeyT",
			mod: true
		}, {
			code: "Backquote",
			mod: true
		}]
	},
	{
		id: "terminal.new",
		label: "New terminal tab",
		description: "Starts another shell in the drawer.",
		group: "Terminal",
		scope: "global",
		defaults: [{
			code: "Backquote",
			mod: true,
			shift: true
		}]
	},
	{
		id: "terminal.stopRun",
		label: "Stop run",
		description: "Closes the project run's terminal and ends everything it started: the run open in the drawer, or else the newest run.",
		group: "Terminal",
		scope: "global",
		defaults: [{
			code: "F5",
			shift: true
		}]
	},
	{
		id: "nav.projects",
		label: "Go to Projects",
		description: "Opens the projects page.",
		group: "Navigation",
		scope: "global",
		defaults: [{
			code: "KeyP",
			mod: true
		}]
	},
	{
		id: "nav.help",
		label: "Open Help",
		description: "Opens the Help page, with search and the guide that answers questions about the app.",
		group: "Navigation",
		scope: "global",
		defaults: [{ code: "F1" }]
	},
	{
		id: "search.toggle",
		label: "Command palette",
		description: "Opens search across projects, pages and commands.",
		group: "Navigation",
		scope: "global",
		defaults: [{
			code: "KeyK",
			mod: true
		}]
	},
	{
		id: "prompt.generate",
		label: "Generate prompt",
		description: "Builds the prompt from your request.",
		group: "Prompt builder",
		scope: "prompt",
		defaults: [{
			code: "KeyG",
			mod: true
		}, {
			code: "Enter",
			mod: true
		}]
	},
	{
		id: "prompt.translate",
		label: "Translate request",
		description: "Rewrites your request in English without generating.",
		group: "Prompt builder",
		scope: "prompt",
		defaults: [{
			code: "KeyT",
			mod: true
		}]
	},
	{
		id: "prompt.copy",
		label: "Copy generated prompt",
		description: "Copies the result. Ignored while text is selected, so normal copy still works.",
		group: "Prompt builder",
		scope: "prompt",
		defaults: [{
			code: "KeyC",
			mod: true
		}]
	},
	{
		id: "workspace.newTab",
		label: "New tab",
		description: "Opens the agent and shell menu in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyT",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.buildPrompt",
		label: "Build a prompt",
		description: "Opens the prompt builder for the project on screen. \"Open in agent\" then runs it in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyG",
			mod: true
		}]
	},
	{
		id: "workspace.launchAgent",
		label: "Open agent 1 to 9",
		description: "Starts an agent in the focused pane by its place in the \"+\" menu, so 1 is the first one listed. Settings, Agent order sets the order. Press any number key to set the modifiers.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "Digit1",
			mod: true
		}],
		digitRow: true
	},
	{
		id: "workspace.newBrowser",
		label: "New browser tab",
		description: "Opens a browser tab in the focused pane, for your dev server or any site.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyB",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.pickElement",
		label: "Comment on a page element",
		description: "In a browser tab, picks an element on the page to leave a comment on for your agent.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyC",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.closeTab",
		label: "Close tab",
		description: "Closes the active tab in the focused pane and ends its shell.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyW",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.splitRight",
		label: "Split pane right",
		description: "Adds a pane to the right of the focused one.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyD",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.splitDown",
		label: "Split pane down",
		description: "Adds a pane below the focused one.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyE",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.focusLeft",
		label: "Focus pane on the left",
		description: "Moves keyboard focus to the pane on the left.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "ArrowLeft",
			mod: true,
			alt: true
		}]
	},
	{
		id: "workspace.focusRight",
		label: "Focus pane on the right",
		description: "Moves keyboard focus to the pane on the right.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "ArrowRight",
			mod: true,
			alt: true
		}]
	},
	{
		id: "workspace.focusUp",
		label: "Focus pane above",
		description: "Moves keyboard focus to the pane above.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "ArrowUp",
			mod: true,
			alt: true
		}]
	},
	{
		id: "workspace.focusDown",
		label: "Focus pane below",
		description: "Moves keyboard focus to the pane below.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "ArrowDown",
			mod: true,
			alt: true
		}]
	},
	{
		id: "workspace.nextTab",
		label: "Next tab",
		description: "Switches to the next tab in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "Tab",
			mod: true
		}, {
			code: "PageDown",
			mod: true
		}]
	},
	{
		id: "workspace.prevTab",
		label: "Previous tab",
		description: "Switches to the previous tab in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "Tab",
			mod: true,
			shift: true
		}, {
			code: "PageUp",
			mod: true
		}]
	},
	{
		id: "workspace.zoomPane",
		label: "Zoom pane",
		description: "Lets the focused pane fill the workspace, or puts it back.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "Enter",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.toggleGitPanel",
		label: "Toggle changes panel",
		description: "Shows or hides the git changes panel on the right.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyG",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.newWorktree",
		label: "New worktree",
		description: "Starts a git worktree of the project on screen: its own folder and branch, with its own terminals and agents.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyN",
			mod: true,
			shift: true
		}]
	},
	{
		id: "workspace.run",
		label: "Run project",
		description: "Does what the header's Run button does for the project on screen: starts its run command in the terminal, or asks which one when it has several.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{ code: "F5" }]
	},
	{
		id: "workspace.search",
		label: "Search files and code",
		description: "Finds files, types, members and text in the project on screen, with a preview. On the workspace it takes Ctrl+P from Go to Projects.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "KeyP",
			mod: true
		}]
	},
	{
		id: "workspace.goToTab",
		label: "Go to tab 1 to 9",
		description: "Picks a tab in the focused pane by its position. Press any number key to set the modifiers.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "Digit1",
			alt: true
		}],
		digitRow: true
	},
	{
		id: "workspace.nextChange",
		label: "Next change in diff",
		description: "Jumps to the next changed block of the diff in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{ code: "F7" }]
	},
	{
		id: "workspace.prevChange",
		label: "Previous change in diff",
		description: "Jumps to the previous changed block of the diff in the focused pane.",
		group: "Workspace",
		scope: "workspace",
		defaults: [{
			code: "F7",
			shift: true
		}]
	},
	{
		id: "commit.commit",
		label: "Commit",
		description: "Commits the staged changes (or stages everything first when nothing is staged).",
		group: "Changes panel",
		scope: "commit",
		defaults: [{
			code: "Enter",
			mod: true
		}]
	},
	{
		id: "commit.commitAndPush",
		label: "Commit and push",
		description: "Commits, then pushes the branch.",
		group: "Changes panel",
		scope: "commit",
		defaults: [{
			code: "Enter",
			mod: true,
			shift: true
		}]
	},
	{
		id: "vault.search",
		label: "Search the vault",
		description: "Puts the cursor in the Vault search box.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyF",
			mod: true
		}]
	},
	{
		id: "vault.new",
		label: "New entry",
		description: "Opens the editor for a new login, API key, note or custom entry.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyN",
			mod: true
		}]
	},
	{
		id: "vault.edit",
		label: "Edit entry",
		description: "Opens the selected entry in the editor.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyE",
			mod: true
		}]
	},
	{
		id: "vault.lock",
		label: "Lock the vault",
		description: "Locks the vault right away.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyL",
			mod: true
		}]
	},
	{
		id: "vault.copyPassword",
		label: "Copy password",
		description: "Copies the selected entry's password, or its secret for an API key.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyC",
			mod: true,
			shift: true
		}]
	},
	{
		id: "vault.copyUsername",
		label: "Copy username",
		description: "Copies the selected login's username.",
		group: "Vault",
		scope: "vault",
		defaults: [{
			code: "KeyB",
			mod: true,
			shift: true
		}]
	}
];
var SHORTCUT_GROUPS = [
	{
		name: "Terminal",
		scope: "global"
	},
	{
		name: "Navigation",
		scope: "global"
	},
	{
		name: "Prompt builder",
		scope: "prompt",
		hint: "Only while the prompt builder is open, where they beat the app-wide shortcuts."
	},
	{
		name: "Workspace",
		scope: "workspace",
		hint: "Only on the Workspace page, where they beat the app-wide shortcuts."
	},
	{
		name: "Changes panel",
		scope: "commit",
		hint: "Only while typing a commit message in the Workspace changes panel."
	},
	{
		name: "Vault",
		scope: "vault",
		hint: "Only on the Vault page while it is unlocked."
	}
];
var MODIFIER_CODES = /* @__PURE__ */ new Set([
	"ControlLeft",
	"ControlRight",
	"ShiftLeft",
	"ShiftRight",
	"AltLeft",
	"AltRight",
	"MetaLeft",
	"MetaRight",
	"CapsLock"
]);
function letterOf(code) {
	return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : null;
}
/** Reads a binding off a keypress. Null while only modifiers are held down. */
function shortcutFromEvent(event) {
	if (!event.code || MODIFIER_CODES.has(event.code)) return null;
	const shortcut = { code: event.code };
	if (event.ctrlKey || event.metaKey) shortcut.mod = true;
	if (event.shiftKey) shortcut.shift = true;
	if (event.altKey) shortcut.alt = true;
	return shortcut;
}
function matchesShortcut(event, shortcut, digitRow = false) {
	if ((event.ctrlKey || event.metaKey) !== Boolean(shortcut.mod)) return false;
	if (event.shiftKey !== Boolean(shortcut.shift)) return false;
	if (event.altKey !== Boolean(shortcut.alt)) return false;
	if (digitRow) return digitOf(event.code) !== null;
	if (event.code === shortcut.code) return true;
	const letter = letterOf(shortcut.code);
	return letter !== null && event.key.toLowerCase() === letter;
}
/** Stable string form, used for comparing and for React keys. */
function shortcutId(shortcut) {
	return [
		shortcut.mod ? "mod" : "",
		shortcut.alt ? "alt" : "",
		shortcut.shift ? "shift" : "",
		shortcut.code
	].filter(Boolean).join("+");
}
function sameShortcut(a, b) {
	return shortcutId(a) === shortcutId(b);
}
function hasModifier(shortcut) {
	return Boolean(shortcut.mod || shortcut.alt);
}
/** True when the binding cannot be mistaken for the user typing into a field. */
function isSafeWhileTyping(shortcut) {
	return hasModifier(shortcut) || /^F\d{1,2}$/.test(shortcut.code);
}
/**
* Why a binding cannot be accepted, or null when it is fine. Anything without
* Ctrl/Cmd/Alt would swallow ordinary typing, so only the function keys are
* allowed to stand on their own.
*/
function bindingProblem(shortcut) {
	return isSafeWhileTyping(shortcut) ? null : "Hold Ctrl, Cmd, or Alt, or use a function key.";
}
var KEY_LABELS = {
	Backquote: "`",
	Minus: "-",
	Equal: "=",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Semicolon: ";",
	Quote: "'",
	Comma: ",",
	Period: ".",
	Slash: "/",
	IntlBackslash: "\\",
	Space: "Space",
	Enter: "Enter",
	NumpadEnter: "Num Enter",
	Escape: "Esc",
	Tab: "Tab",
	Backspace: "Backspace",
	Delete: "Del",
	Insert: "Ins",
	Home: "Home",
	End: "End",
	PageUp: "PgUp",
	PageDown: "PgDn",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	NumpadAdd: "Num +",
	NumpadSubtract: "Num -",
	NumpadMultiply: "Num *",
	NumpadDivide: "Num /",
	NumpadDecimal: "Num ."
};
/** Human name for a physical key, independent of the active keyboard layout. */
function keyLabel(code) {
	const letter = letterOf(code);
	if (letter) return letter.toUpperCase();
	if (/^Digit\d$/.test(code)) return code.slice(5);
	if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
	if (/^F\d{1,2}$/.test(code)) return code;
	return KEY_LABELS[code] ?? code;
}
function isMacPlatform() {
	return typeof window !== "undefined" && window.agentmat?.platform === "darwin";
}
/** A binding as shown for its command: a digit-row one reads "Ctrl+1…9". */
function formatCommandShortcut(command, shortcut) {
	const text = formatShortcut(shortcut);
	return command.digitRow ? `${text.slice(0, -1)}1…9` : text;
}
function formatShortcut(shortcut) {
	const mac = isMacPlatform();
	const parts = [];
	if (shortcut.mod) parts.push(mac ? "⌘" : "Ctrl");
	if (shortcut.alt) parts.push(mac ? "⌥" : "Alt");
	if (shortcut.shift) parts.push(mac ? "⇧" : "Shift");
	parts.push(keyLabel(shortcut.code));
	return parts.join(mac ? "" : "+");
}
//#endregion
//#region src/renderer/src/stores/shortcutStore.ts
var useShortcutStore = create()(persist((set) => ({
	overrides: {},
	setBindings: (id, bindings) => set((state) => ({ overrides: {
		...state.overrides,
		[id]: bindings
	} })),
	resetCommand: (id) => set((state) => {
		const { [id]: _removed, ...rest } = state.overrides;
		return { overrides: rest };
	}),
	resetAll: () => set({ overrides: {} })
}), { name: "agentmate-shortcuts" }));
function commandById(id) {
	return SHORTCUT_COMMANDS.find((command) => command.id === id);
}
function bindingsFor(id, overrides) {
	return overrides[id] ?? commandById(id)?.defaults ?? [];
}
/** Both branches return a stable reference, so this is safe as a zustand selector. */
function useShortcutBindings(id) {
	return useShortcutStore((state) => bindingsFor(id, state.overrides));
}
/** The first binding rendered for labels and tooltips, or null when unbound. */
function useShortcutLabel(id) {
	const first = useShortcutBindings(id)[0];
	const command = commandById(id);
	if (!first) return null;
	return command ? formatCommandShortcut(command, first) : formatShortcut(first);
}
/** Every binding as one phrase, e.g. "Ctrl+G or Ctrl+Enter". Null when unbound. */
function useShortcutLabelList(id) {
	const bindings = useShortcutBindings(id);
	if (bindings.length === 0) return null;
	return bindings.map(formatShortcut).join(" or ");
}
/**
* The command a keypress triggers, or null. `requireModifier` drops bare-key
* bindings while the user is typing into a field, where they would swallow
* ordinary input.
*/
function commandForEvent(event, overrides, requireModifier = false, scope = "global") {
	for (const command of SHORTCUT_COMMANDS) {
		if (command.scope !== scope) continue;
		for (const binding of bindingsFor(command.id, overrides)) {
			if (requireModifier && !isSafeWhileTyping(binding)) continue;
			if (matchesShortcut(event, binding, command.digitRow)) return command.id;
		}
	}
	return null;
}
/**
* The command already using this binding, so the settings UI can refuse a
* duplicate. Only commands in the same scope can clash: the prompt builder is
* free to reuse a combination the shell also listens for.
*/
function conflictingCommand(shortcut, exceptId, overrides) {
	const scope = SHORTCUT_COMMANDS.find((command) => command.id === exceptId)?.scope;
	for (const command of SHORTCUT_COMMANDS) {
		if (command.id === exceptId || command.scope !== scope) continue;
		if (bindingsFor(command.id, overrides).some((binding) => command.digitRow || commandById(exceptId)?.digitRow ? digitOf(binding.code) !== null && digitOf(shortcut.code) !== null && sameShortcut({
			...binding,
			code: "Digit1"
		}, {
			...shortcut,
			code: "Digit1"
		}) : sameShortcut(binding, shortcut))) return command;
	}
	return null;
}
//#endregion
//#region src/renderer/src/stores/cliStore.ts
var useCliStore = create((set, get) => ({
	defaultCliId: null,
	cliArgs: {},
	cliLaunchDefaults: {},
	cliOrder: [],
	lastRunInfoByCli: {},
	setDefaultCliId: (cliId) => {
		set({ defaultCliId: cliId });
		window.agentmat.settings.update({ defaultCliId: cliId });
	},
	setCliArgs: (cliId, args) => {
		const next = { ...get().cliArgs };
		if (args.trim()) next[cliId] = args.trim();
		else delete next[cliId];
		set({ cliArgs: next });
		window.agentmat.settings.update({ cliArgs: next });
	},
	setCliLaunchDefault: (cliId, patch) => {
		const merged = {
			...get().cliLaunchDefaults[cliId],
			...patch
		};
		for (const key of Object.keys(merged)) if (!merged[key]) delete merged[key];
		const next = { ...get().cliLaunchDefaults };
		if (Object.keys(merged).length) next[cliId] = merged;
		else delete next[cliId];
		set({ cliLaunchDefaults: next });
		window.agentmat.settings.update({ cliLaunchDefaults: next });
	},
	clearCliLaunchDefault: (cliId) => {
		if (!get().cliLaunchDefaults[cliId]) return;
		const next = { ...get().cliLaunchDefaults };
		delete next[cliId];
		set({ cliLaunchDefaults: next });
		window.agentmat.settings.update({ cliLaunchDefaults: next });
	},
	setCliOrder: (order) => {
		set({ cliOrder: order });
		window.agentmat.settings.update({ cliOrder: order });
	},
	recordLastRun: (cliId, model, effort) => {
		if (!model) return;
		const current = get().lastRunInfoByCli[cliId];
		if (current?.model === model && current?.effort === effort) return;
		set({ lastRunInfoByCli: {
			...get().lastRunInfoByCli,
			[cliId]: {
				model,
				effort
			}
		} });
	}
}));
async function initDefaultCli() {
	const [settings, lastRunInfoByCli] = await Promise.all([window.agentmat.settings.get(), window.agentmat.agents.lastRunInfoByCli()]);
	useCliStore.setState({
		defaultCliId: settings.defaultCliId,
		cliArgs: settings.cliArgs ?? {},
		cliLaunchDefaults: settings.cliLaunchDefaults ?? {},
		cliOrder: settings.cliOrder ?? [],
		lastRunInfoByCli
	});
}
//#endregion
export { clampDesktopPetClickArea as A, normalizeDesktopPetName as B, themeClassName as C, DASHBOARD_STAT_IDS as D, DASHBOARD_COLUMN_OPTIONS as E, isCustomPetId as F, projectRunCommandHint as G, notificationHookChannel as H, isStartupPage as I, projectRunCommandTitle as K, normalizeDesktopPetActionSpeeds as L, clampDesktopPetSpeed as M, configuredRunCommands as N, DASHBOARD_USAGE_SUMMARY_IDS as O, isAnimatedPetFile as P, normalizeDesktopPetCardView as R, resolveIsDark as S, DASHBOARD_CHART_IDS as T, petBoxSize as U, normalizeProjectColor as V, petClickRect as W, sameShortcut as _, conflictingCommand as a, applyInitialTheme as b, useShortcutStore as c, bindingProblem as d, digitOf as f, matchesShortcut as g, isMacPlatform as h, commandForEvent as i, clampDesktopPetScale as j, DEFAULT_TERMINAL_BACKGROUND_COLOR as k, SHORTCUT_COMMANDS as l, formatShortcut as m, useCliStore as n, useShortcutLabel as o, formatCommandShortcut as p, bindingsFor as r, useShortcutLabelList as s, initDefaultCli as t, SHORTCUT_GROUPS as u, shortcutFromEvent as v, useThemeStore as w, initTheme as x, shortcutId as y, normalizeDesktopPetId as z };
