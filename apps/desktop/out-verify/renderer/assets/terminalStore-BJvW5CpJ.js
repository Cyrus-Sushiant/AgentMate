import { S as create, f as persist } from "./tooltip-BbU-D7og.js";
/** The shell a plain "new tab" starts, per platform. The tab is always called a terminal:
* naming it after the shell ("New zsh") confused people into thinking zsh itself was the app. */
function defaultNewSession() {
	const platform = window.agentmat.platform;
	if (platform === "win32") return {
		title: "Terminal",
		shell: "powershell.exe"
	};
	if (platform === "darwin") return {
		title: "Terminal",
		shell: "zsh"
	};
	return {
		title: "Terminal",
		shell: "bash"
	};
}
function withoutSession(state, id) {
	const remaining = state.sessions.filter((s) => s.id !== id);
	return {
		sessions: remaining,
		activeSessionId: state.activeSessionId === id ? remaining.at(-1)?.id ?? null : state.activeSessionId
	};
}
var useTerminalStore = create()(persist((set, get) => ({
	isOpen: false,
	drawerHeight: 288,
	isMaximized: false,
	sessions: [],
	activeSessionId: null,
	setMaximized: (maximized) => set({ isMaximized: maximized }),
	openDrawer: () => set({ isOpen: true }),
	closeDrawer: () => set({ isOpen: false }),
	toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
	setDrawerHeight: (height) => set({ drawerHeight: Math.max(160, Math.round(height)) }),
	openSession: (meta) => {
		const id = meta.id ?? crypto.randomUUID();
		const session = {
			id,
			title: meta.title,
			cwd: meta.cwd,
			shell: meta.shell,
			initialInput: meta.initialInput,
			projectId: meta.projectId,
			kind: meta.kind,
			sshServerId: meta.sshServerId,
			conversationId: meta.conversationId,
			run: meta.run
		};
		set((state) => ({
			sessions: [...state.sessions, session],
			activeSessionId: id,
			isOpen: true
		}));
		return id;
	},
	openDefaultSession: () => {
		const next = defaultNewSession();
		const count = get().sessions.filter((s) => s.shell === next.shell).length;
		return get().openSession({
			title: count === 0 ? next.title : `${next.title} ${count + 1}`,
			shell: next.shell
		});
	},
	openSshSession: (server, extras = {}) => get().openSession({
		title: extras.title ?? server.nickname,
		kind: "ssh",
		sshServerId: server.id,
		initialInput: extras.initialInput,
		conversationId: extras.conversationId
	}),
	findSshConversationTab: (serverId, conversationId) => get().sessions.find((s) => s.kind === "ssh" && s.sshServerId === serverId && s.conversationId === conversationId)?.id ?? null,
	closeSession: (id) => {
		(get().sessions.find((s) => s.id === id)?.kind === "ssh" ? window.agentmat.ssh : window.agentmat.terminal).kill(id);
		set((state) => withoutSession(state, id));
	},
	forgetSession: (id) => set((state) => withoutSession(state, id)),
	setActiveSession: (id) => set({ activeSessionId: id })
}), {
	name: "agentmate-terminal-sessions",
	partialize: (state) => ({
		isOpen: state.isOpen,
		drawerHeight: state.drawerHeight,
		activeSessionId: state.activeSessionId,
		sessions: state.sessions.filter((s) => s.kind !== "ssh").map(({ initialInput: _initialInput, ...rest }) => rest)
	}),
	merge: (persisted, current) => {
		const saved = persisted ?? {};
		const sessions = Array.isArray(saved.sessions) ? saved.sessions.map((session) => ({
			...session,
			restored: true
		})) : [];
		return {
			...current,
			isOpen: sessions.length > 0 && saved.isOpen === true,
			drawerHeight: typeof saved.drawerHeight === "number" ? saved.drawerHeight : current.drawerHeight,
			sessions,
			activeSessionId: sessions.some((s) => s.id === saved.activeSessionId) ? saved.activeSessionId ?? null : sessions.at(-1)?.id ?? null
		};
	}
}));
//#endregion
export { useTerminalStore as n, defaultNewSession as t };
