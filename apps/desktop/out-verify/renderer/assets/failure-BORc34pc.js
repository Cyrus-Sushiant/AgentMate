import { Bn as RefreshCw, Br as __toESM, Et as Crosshair, F as Button, Fr as require_jsx_runtime, I as cn, J as ArrowRight, Jn as Search, Lr as require_react, Pn as Play, Pr as toast, S as create, Vn as Robot, dt as ChevronUp, hr as TriangleAlert, ht as CircleQuestion, lt as ChevronDown, or as StopCircle, pr as TerminalSquare, pt as CircleCheck, q as ArrowLeft, rn as History, t as SimpleTooltip, wt as Copy } from "./tooltip-BbU-D7og.js";
import { n as useQuery, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { d as useNavigationType, l as useLocation, u as useNavigate } from "./chunk-62JRHF6Z-B-4HXhjG.js";
import { i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle } from "./label-D49cSr88.js";
import { o as useShortcutLabel } from "./cliStore-BEVHhLcE.js";
import { n as useIsDarkMode } from "./chartColors-Dx8eDP1h.js";
import { n as useTerminalStore } from "./terminalStore-BJvW5CpJ.js";
import { n as app_icon_default, t as app_icon_light_default } from "./app-icon-light-CRZz1UiP.js";
//#region src/renderer/src/stores/searchStore.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var useSearchStore = create((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
	toggle: () => set((s) => ({ open: !s.open }))
}));
//#endregion
//#region src/renderer/src/stores/sshAgentStore.ts
var useSshAgentStore = create((set) => ({
	sessions: {},
	lastMode: "approve-all",
	lastAi: void 0,
	clear: (sessionId) => set((state) => {
		if (!(sessionId in state.sessions)) return state;
		const sessions = { ...state.sessions };
		delete sessions[sessionId];
		return { sessions };
	})
}));
function useSshAgentSession(sessionId) {
	return useSshAgentStore((s) => sessionId ? s.sessions[sessionId] : void 0);
}
/** True while the run can't go on until the user does something. */
function isSshAgentWaitingOnUser(state) {
	if (!state) return false;
	return state.phase === "proposed" || state.phase === "needs-input" || state.phase === "needs-password" || state.phase === "error" && state.canContinue === true;
}
async function startSshAgentTask(input) {
	const { sessionId, mode } = input;
	useSshAgentStore.setState((state) => ({
		lastMode: mode,
		lastAi: {
			cliId: input.cliId ?? null,
			modelId: input.modelId ?? null,
			effort: input.effort ?? null
		},
		sessions: {
			...state.sessions,
			[sessionId]: {
				mode,
				phase: "thinking",
				step: 0
			}
		}
	}));
	try {
		await window.agentmat.sshAgent.start(input);
	} catch (error) {
		useSshAgentStore.getState().clear(sessionId);
		throw error;
	}
}
function approveSshAgentCommand(sessionId) {
	window.agentmat.sshAgent.approveCommand(sessionId);
}
function skipSshAgentCommand(sessionId) {
	window.agentmat.sshAgent.skipCommand(sessionId);
}
function answerSshAgentInput(sessionId, answer) {
	window.agentmat.sshAgent.answerNeedsInput(sessionId, answer);
}
function answerSshAgentPassword(sessionId, approved) {
	window.agentmat.sshAgent.answerPassword(sessionId, approved);
}
function stopSshAgentTask(sessionId) {
	window.agentmat.sshAgent.stop(sessionId);
}
function continueSshAgentTask(sessionId) {
	window.agentmat.sshAgent.continueTask(sessionId);
}
/**
* Whether the user can see this terminal right now: AgentMate is the focused app, the terminal
* panel is open, and this is the tab it shows.
*/
function isWatchingSession(sessionId) {
	const terminal = useTerminalStore.getState();
	return document.hasFocus() && document.visibilityState === "visible" && terminal.isOpen && terminal.activeSessionId === sessionId;
}
var started = false;
/** Starts following AI-task progress for every SSH session, for the whole app's lifetime. */
function initSshAgentStatus() {
	if (started) return;
	started = true;
	window.agentmat.sshAgent.onProgress((progress) => {
		useSshAgentStore.setState((state) => {
			const existing = state.sessions[progress.sessionId];
			const next = {
				mode: existing?.mode ?? state.lastMode,
				phase: progress.phase,
				step: progress.step,
				command: progress.command ?? existing?.command,
				message: progress.message,
				hasSavedPassword: progress.hasSavedPassword,
				canContinue: progress.canContinue
			};
			return { sessions: {
				...state.sessions,
				[progress.sessionId]: next
			} };
		});
		const now = useSshAgentStore.getState().sessions[progress.sessionId];
		if (isSshAgentWaitingOnUser(now) && !isWatchingSession(progress.sessionId)) {
			const title = useTerminalStore.getState().sessions.find((s) => s.id === progress.sessionId)?.title ?? "";
			window.agentmat.sshAgent.notifyWaiting(progress.sessionId, title);
		}
	});
}
//#endregion
//#region src/renderer/src/components/terminal/SshAgentHistoryDialog.tsx
/** Output taller than this starts folded, so one noisy command doesn't bury the rest. */
var FOLDED_OUTPUT_LINES = 12;
function clockTime(at) {
	return new Date(at).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function dayAndTime(at) {
	const date = new Date(at);
	const today = /* @__PURE__ */ new Date();
	return date.toDateString() === today.toDateString() ? clockTime(at) : `${date.toLocaleDateString([], {
		month: "short",
		day: "numeric"
	})}, ${clockTime(at)}`;
}
function duration(run) {
	const ms = (run.endedAt ?? Date.now()) - run.startedAt;
	const seconds = Math.max(1, Math.round(ms / 1e3));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function stepCount(run) {
	return run.entries.filter((entry) => entry.kind === "command" || entry.kind === "action").length;
}
var STATUS_LABELS = {
	running: "Running",
	paused: "Paused",
	finished: "Done",
	error: "Failed",
	stopped: "Stopped"
};
function StatusDot({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("h-2 w-2 shrink-0 rounded-full", status === "running" && "animate-pulse bg-primary shadow-[0_0_6px_hsl(var(--primary))]", status === "paused" && "bg-amber-400", status === "finished" && "bg-success", status === "error" && "bg-destructive", status === "stopped" && "bg-muted-foreground/50") });
}
/** The whole run as plain text, for pasting into an issue or a chat. */
function runAsText(run) {
	const lines = [
		`Task: ${run.prompt}`,
		`AI: ${run.aiLabel || "AI"}`,
		""
	];
	for (const entry of run.entries) switch (entry.kind) {
		case "command":
			lines.push(`$ ${entry.command}${entry.exitCode !== null ? `  [exit ${entry.exitCode}]` : ""}`);
			if (entry.output) lines.push(entry.output);
			lines.push("");
			break;
		case "action":
			lines.push(`> ${entry.action}  [${entry.ok ? "ok" : "failed"}]`);
			if (entry.outcome) lines.push(entry.outcome);
			lines.push("");
			break;
		case "skipped":
			lines.push("command" in entry ? `$ ${entry.command}  [skipped]` : `> ${entry.action}  [skipped]`, "");
			break;
		case "question":
			lines.push(`AI asked: ${entry.text}`);
			break;
		case "answer":
			lines.push(`You answered: ${entry.text || "(nothing)"}`, "");
			break;
		case "error":
			lines.push(entry.text);
			break;
		case "continued":
			lines.push("You continued the task.", "");
			break;
		case "finished":
			lines.push(`Finished: ${entry.text}`);
			break;
		case "stopped": lines.push(`Stopped: ${entry.text}`);
	}
	return lines.join("\n").trim();
}
function copy(text, what) {
	navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error(`Couldn't copy the ${what.toLowerCase()}`));
}
function ExitBadge({ entry }) {
	const [label, tone] = entry.exitCode === 0 ? ["OK", "border-success/30 bg-success/10 text-success"] : entry.exitCode !== null ? [`Exit ${entry.exitCode}`, "border-destructive/30 bg-destructive/10 text-destructive"] : entry.timedOut ? ["Timed out", "border-amber-400/30 bg-amber-400/10 text-amber-400"] : ["Ended", "border-white/15 bg-white/5 text-zinc-400"];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("shrink-0 rounded-full border px-2 py-px text-[10px] font-medium uppercase tracking-wide", tone),
		children: label
	});
}
function CommandEntry({ entry }) {
	const lines = entry.output ? entry.output.split("\n") : [];
	const foldable = lines.length > FOLDED_OUTPUT_LINES;
	const [expanded, setExpanded] = (0, import_react.useState)(false);
	const shown = foldable && !expanded ? lines.slice(0, FOLDED_OUTPUT_LINES) : lines;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-lg border border-white/10 bg-[#0a1210] shadow-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 border-b border-white/10 px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSquare, { className: "h-3.5 w-3.5 shrink-0 text-primary" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
					className: "min-w-0 flex-1 truncate font-mono text-xs text-zinc-100",
					children: entry.command
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExitBadge, { entry }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[10px] tabular-nums text-zinc-500",
					children: clockTime(entry.at)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: "Copy command",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Copy command",
						onClick: () => copy(entry.command, "Command"),
						className: "flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-100",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3 w-3" })
					})
				})
			]
		}), lines.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "max-h-96 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300",
			children: shown.join("\n")
		}), foldable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setExpanded((v) => !v),
			className: "flex w-full items-center justify-center gap-1 border-t border-white/10 py-1 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
			children: expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "h-3 w-3" }), " Show less"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3 w-3" }),
				" Show all ",
				lines.length,
				" lines"
			] })
		})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 py-2 text-[11px] italic text-zinc-500",
			children: "No output"
		})]
	});
}
/** One mouse or keyboard action the AI took on a remote desktop, and how it went. */
function ActionEntry({ entry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "h-3.5 w-3.5 shrink-0 text-primary" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
					className: "min-w-0 flex-1 truncate font-mono text-xs text-foreground",
					children: entry.action
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("shrink-0 rounded-full border px-2 py-px text-[10px] font-medium uppercase tracking-wide", entry.ok ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"),
					children: entry.ok ? "OK" : "Failed"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[10px] tabular-nums text-muted-foreground",
					children: clockTime(entry.at)
				})
			]
		}), entry.outcome && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "border-t border-border/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
			children: entry.outcome
		})]
	});
}
/** A chat bubble: the user's words sit on the right, the AI's on the left. */
function Bubble({ from, at, children, tone = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-1", from === "you" ? "items-end" : "items-start"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm", from === "you" ? "rounded-br-md bg-primary/15 text-foreground" : tone === "question" ? "rounded-bl-md border border-amber-400/30 bg-amber-400/10 text-foreground" : "rounded-bl-md bg-foreground/5 text-foreground"),
			children
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "px-1 text-[10px] text-muted-foreground",
			children: [
				from === "you" ? "You" : "AI",
				" · ",
				clockTime(at)
			]
		})]
	});
}
function Note({ icon, tone, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs", tone === "error" && "bg-destructive/10 text-destructive", tone === "muted" && "text-muted-foreground", tone === "success" && "border border-success/25 bg-success/10 text-foreground"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-px shrink-0",
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "min-w-0 flex-1 break-words",
			children
		})]
	});
}
function Entry({ entry }) {
	switch (entry.kind) {
		case "command": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandEntry, { entry });
		case "action": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionEntry, { entry });
		case "skipped": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Note, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StopCircle, { className: "h-3.5 w-3.5" }),
			tone: "muted",
			children: [
				"You skipped",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
					className: "rounded bg-black/30 px-1 font-mono",
					children: "command" in entry ? entry.command : entry.action
				})
			]
		});
		case "question": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Bubble, {
			from: "ai",
			at: entry.at,
			tone: "question",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-400",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestion, { className: "h-3 w-3" }), " Question"]
			}), entry.text]
		});
		case "answer": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, {
			from: "you",
			at: entry.at,
			children: entry.text || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "italic text-muted-foreground",
				children: "(no answer)"
			})
		});
		case "error": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Note, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3.5 w-3.5" }),
			tone: "error",
			children: entry.text
		});
		case "continued": return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 text-[11px] text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-3 w-3" }),
						" You continued at ",
						clockTime(entry.at)
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" })
			]
		});
		case "finished": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Note, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5 text-success" }),
			tone: "success",
			children: entry.text
		});
		case "stopped": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Note, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StopCircle, { className: "h-3.5 w-3.5" }),
			tone: "muted",
			children: entry.text
		});
	}
}
function RunTimeline({ run }) {
	const scrollRef = (0, import_react.useRef)(null);
	const stickToBottom = (0, import_react.useRef)(true);
	(0, import_react.useLayoutEffect)(() => {
		const el = scrollRef.current;
		if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: scrollRef,
		onScroll: (e) => {
			const el = e.currentTarget;
			stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
		},
		className: "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, {
				from: "you",
				at: run.startedAt,
				children: run.prompt
			}),
			run.entries.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Entry, { entry }, index)),
			run.status === "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 px-1 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Robot, { className: "h-3.5 w-3.5 animate-pulse text-primary" }), "Working…"]
			})
		]
	});
}
function SshAgentHistoryDialog({ sessionId, sessionTitle, open, onOpenChange, source }) {
	const sshLiveState = useSshAgentSession(sessionId);
	const liveState = source ? source.live : sshLiveState;
	const desktop = source?.kind === "rdp";
	const historyQuery = useQuery({
		queryKey: source?.queryKey ?? queryKeys.sshAgentHistory(sessionId),
		queryFn: source?.load ?? (() => window.agentmat.sshAgent.history(sessionId)),
		enabled: open,
		meta: { silentLoading: true }
	});
	const { refetch } = historyQuery;
	const runs = historyQuery.data ?? [];
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const selected = runs.find((run) => run.id === selectedId) ?? runs[0] ?? null;
	(0, import_react.useEffect)(() => {
		if (open && liveState) refetch();
	}, [
		open,
		liveState,
		refetch
	]);
	(0, import_react.useEffect)(() => {
		if (open) setSelectedId(null);
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "flex h-[80vh] max-w-5xl flex-col gap-0 overflow-hidden p-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
				className: "border-b border-border/70 px-5 py-4 pr-14",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
					className: "flex items-center gap-2 text-base",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "h-4 w-4 text-primary" }), "AI task history"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
					className: "truncate",
					children: desktop ? `Every task the AI ran in ${sessionTitle || "this desktop"}, with each action, how it went, and what you answered. Kept until AgentMate closes.` : `Every task the AI ran in ${sessionTitle || "this terminal"}, with each command, its output, and what you answered. Kept until AgentMate closes.`
				})]
			}), runs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Robot, { className: "h-5 w-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "No AI tasks here yet"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-sm text-xs leading-relaxed text-muted-foreground",
						children: historyQuery.isLoading ? "Loading…" : desktop ? "Start one with Ask AI in the toolbar. Everything it does shows up here." : "Start one with the robot button in the terminal bar. Everything it does shows up here."
					})]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					"aria-label": "Tasks",
					className: "flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/70 p-2",
					children: runs.map((run) => {
						const active = run.id === selected?.id;
						const count = stepCount(run);
						const noun = desktop ? "action" : "command";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-current": active ? "true" : void 0,
							onClick: () => setSelectedId(run.id),
							className: cn("flex flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary/10" : "hover:bg-foreground/5"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status: run.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "line-clamp-2 min-w-0 flex-1 text-xs font-medium text-foreground",
									children: run.prompt
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "pl-4 text-[10px] text-muted-foreground",
								children: [
									dayAndTime(run.startedAt),
									" · ",
									count,
									" ",
									noun,
									count === 1 ? "" : "s"
								]
							})]
						}, run.id);
					})
				}), selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex min-w-0 flex-1 flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status: selected.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: STATUS_LABELS[selected.status]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: selected.aiLabel || "AI" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: duration(selected) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "flex-1" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								className: "gap-1.5",
								onClick: () => copy(runAsText(selected), "Transcript"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3 w-3" }), "Copy transcript"]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunTimeline, { run: selected }, selected.id)]
				})]
			})]
		})
	});
}
//#endregion
//#region src/renderer/src/lib/titleBar.ts
/** Anything in a title bar that has its own click behaviour. */
var CONTROLS = "button, a, input, textarea, select, [role=\"button\"], [role=\"tab\"], [data-search-anchor]";
/**
* Whether a double click landed on the title bar's empty space, which is the only place it should
* maximize or restore the window. A quick double click on a control (the back and forward arrows
* most of all) bubbles up as a dblclick too, and toggling the window then would move the control
* out from under the second click.
*/
function isTitleBarBlankDoubleClick(event) {
	const target = event.target;
	if (!(target instanceof Element)) return true;
	return target.closest(CONTROLS) === null;
}
//#endregion
//#region src/renderer/src/components/layout/HistoryNav.tsx
/**
* React Router's history stamps an `idx` on `window.history.state` for every
* entry, which is the only way to tell where we sit in the stack. A PUSH
* truncates anything ahead of it, so the furthest index we've seen since the
* last push tells us whether "forward" has somewhere to go.
*/
function currentIndex() {
	const idx = window.history.state?.idx;
	return typeof idx === "number" ? idx : 0;
}
function HistoryNav() {
	const navigate = useNavigate();
	const location = useLocation();
	const navigationType = useNavigationType();
	const [{ index, maxIndex }, setStack] = (0, import_react.useState)(() => {
		const idx = currentIndex();
		return {
			index: idx,
			maxIndex: idx
		};
	});
	(0, import_react.useEffect)(() => {
		const idx = currentIndex();
		setStack((prev) => navigationType === "PUSH" ? {
			index: idx,
			maxIndex: idx
		} : {
			index: idx,
			maxIndex: Math.max(prev.maxIndex, idx)
		});
	}, [location.key, navigationType]);
	const canGoBack = index > 0;
	const canGoForward = index < maxIndex;
	const goBack = (0, import_react.useCallback)(() => {
		if (canGoBack) navigate(-1);
	}, [canGoBack, navigate]);
	const goForward = (0, import_react.useCallback)(() => {
		if (canGoForward) navigate(1);
	}, [canGoForward, navigate]);
	(0, import_react.useEffect)(() => {
		const isMac = window.agentmat.platform === "darwin";
		function onKeyDown(e) {
			const back = e.altKey && e.key === "ArrowLeft" || isMac && e.metaKey && (e.code === "BracketLeft" || e.key === "[");
			const forward = e.altKey && e.key === "ArrowRight" || isMac && e.metaKey && (e.code === "BracketRight" || e.key === "]");
			if (!back && !forward) return;
			e.preventDefault();
			if (back) goBack();
			else goForward();
		}
		function onMouseUp(e) {
			if (e.button !== 3 && e.button !== 4) return;
			e.preventDefault();
			if (e.button === 3) goBack();
			else goForward();
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [goBack, goForward]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
			label: "Back",
			side: "bottom",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				size: "icon-sm",
				onClick: goBack,
				disabled: !canGoBack,
				"aria-label": "Go back",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
			label: "Forward",
			side: "bottom",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				size: "icon-sm",
				onClick: goForward,
				disabled: !canGoForward,
				"aria-label": "Go forward",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {})
			})
		})]
	});
}
//#endregion
//#region src/renderer/src/components/layout/TitleBar.tsx
/**
* Keeps the title bar clear for macOS's own traffic lights. The window hides only its title bar
* (see titleBarFrameOptions in the main process), so the OS draws the real buttons over this
* space, with their native look, hover glyphs and grey inactive state.
*/
function MacTrafficLightsSpace() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"aria-hidden": "true",
		"data-traffic-lights-space": "",
		className: "h-full shrink-0",
		style: { width: 60 }
	});
}
var GLYPH = {
	minimize: "",
	maximize: "",
	restore: "",
	close: ""
};
function NativeCaptionButtons({ isMaximized, onMinimize, onMaximizeToggle, onClose }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-11 items-stretch [-webkit-app-region:no-drag]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: "Minimize",
				side: "bottom",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onMinimize,
					className: "flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "caption-glyph",
						"aria-hidden": "true",
						children: GLYPH.minimize
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: isMaximized ? "Restore" : "Maximize",
				side: "bottom",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onMaximizeToggle,
					className: "flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "caption-glyph",
						"aria-hidden": "true",
						children: isMaximized ? GLYPH.restore : GLYPH.maximize
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: "Close",
				side: "bottom",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: "flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-[#c42b1c] hover:text-white",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "caption-glyph",
						"aria-hidden": "true",
						children: GLYPH.close
					})
				})
			})
		]
	});
}
function SearchTrigger() {
	const openSearch = useSearchStore((s) => s.setOpen);
	const searchOpen = useSearchStore((s) => s.open);
	const searchShortcut = useShortcutLabel("search.toggle");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"data-search-anchor": "",
		onClick: () => openSearch(true),
		className: cn("search-pill flex h-8 w-full cursor-pointer items-center gap-2 rounded-full pl-3.5 pr-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground", searchOpen && "invisible"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 shrink-0" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex-1 truncate text-left",
				children: "Search projects, history, skills…"
			}),
			searchShortcut ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
				className: "hidden shrink-0 items-center gap-0.5 rounded-full bg-foreground/[0.07] px-2 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex",
				children: searchShortcut
			}) : null
		]
	});
}
function TitleBar() {
	const [isMaximized, setIsMaximized] = (0, import_react.useState)(false);
	const isMac = window.agentmat.platform === "darwin";
	const isDark = useIsDarkMode();
	(0, import_react.useEffect)(() => {
		window.agentmat.window.isMaximized().then(setIsMaximized);
		return window.agentmat.window.onMaximizedChange(setIsMaximized);
	}, []);
	const controlProps = {
		isMaximized,
		onMinimize: () => void window.agentmat.window.minimize(),
		onMaximizeToggle: () => void window.agentmat.window.maximizeToggle(),
		onClose: () => void window.agentmat.window.close()
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex h-11 shrink-0 items-center justify-between border-b border-border/80 pl-4 [-webkit-app-region:drag] glass:border-b-0",
		onDoubleClick: (e) => {
			if (isTitleBarBlankDoubleClick(e)) window.agentmat.window.maximizeToggle();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [isMac && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MacTrafficLightsSpace, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: isDark ? app_icon_default : app_icon_light_default,
						alt: "",
						className: "h-6 w-6"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-semibold tracking-tight text-foreground",
						children: "AgentMate"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute left-1/2 top-1/2 flex w-full max-w-xl -translate-x-1/2 -translate-y-1/2 items-center gap-1 px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1 [-webkit-app-region:no-drag]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchTrigger, {})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("flex items-center gap-1 [-webkit-app-region:no-drag]", isMac && "pr-3"),
				children: !isMac && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeCaptionButtons, { ...controlProps })
			})
		]
	});
}
//#endregion
//#region src/renderer/src/components/rdp/RdpFailureCard.tsx
/** What goes on the clipboard for a bug report: the three plain parts and the technical reason. */
function failureReport(failure) {
	return [
		failure.title,
		failure.message,
		failure.detail && `Technical details: ${failure.detail}`
	].filter(Boolean).join("\n");
}
/**
* The technical reason for a failure, folded away. It is for support and bug reports, so it has
* a copy button, and it only ever holds text without source locations (see `cleanTlsDetail`).
*/
function RdpTechnicalDetails({ failure }) {
	if (!failure.detail) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "group w-full text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
			className: "cursor-pointer select-none rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
			children: "Technical details"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 flex items-start gap-2 rounded-lg bg-foreground/[0.05] p-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "min-w-0 flex-1 select-text break-words font-mono text-[11px] leading-relaxed text-muted-foreground",
				children: failure.detail
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
				label: "Copy for a bug report",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "icon-xs",
					variant: "ghost",
					"aria-label": "Copy technical details",
					onClick: () => void navigator.clipboard.writeText(failureReport(failure)).then(() => toast.success("Copied"), () => toast.error("Couldn't copy")),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {})
				})
			})]
		})]
	});
}
/** What you can try, as a short list under the sentence. */
function Hints({ hints }) {
	if (hints.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full rounded-lg bg-foreground/[0.04] px-4 py-3 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
			children: "What you can try"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground",
			children: hints.map((hint) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: hint }, hint))
		})]
	});
}
/** The words of a failure: what happened, what to try, and the folded technical reason. */
function RdpFailureBody({ failure, align = "center" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex w-full flex-col gap-3", align === "center" ? "items-center text-center" : "items-start text-left"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-base font-semibold leading-snug",
					children: failure.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm leading-relaxed text-muted-foreground",
					children: failure.message
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hints, { hints: failure.hints }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RdpTechnicalDetails, { failure })
		]
	});
}
/**
* The screen a session window shows when it could not connect. A changed certificate leads with
* "Review certificate", since reconnecting alone would only fail the same way.
*/
function RdpFailureCard({ failure, onClose, onReconnect, onReviewCertificate }) {
	const certificateChanged = failure.code === "certificate-changed";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "m-auto flex max-w-md flex-col items-center gap-5 px-6 py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-5 w-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RdpFailureBody, { failure }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: onClose,
						children: "Close"
					}),
					certificateChanged && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: onReviewCertificate,
						children: "Review certificate"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: certificateChanged ? "soft" : "default",
						onClick: onReconnect,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3.5 w-3.5" }), " Reconnect"]
					})
				]
			})
		]
	});
}
//#endregion
//#region src/renderer/src/lib/rdp/failure.ts
var ADVICE = {
	"host-not-found": {
		title: "Can't find the server",
		hints: ["Check the computer name or IP address in this server's settings.", "Make sure this computer is online."]
	},
	refused: {
		title: "The server refused the connection",
		hints: [
			"Check that Remote Desktop is turned on for the server.",
			"Check the port. Remote Desktop uses 3389 unless it was changed.",
			"Check that the server's firewall allows Remote Desktop."
		]
	},
	timeout: {
		title: "The server didn't answer",
		hints: [
			"Check that the server is on and connected to the network.",
			"A firewall may be dropping the connection. Remote Desktop uses port 3389 unless it was changed.",
			"If the server was just restarted or reinstalled, give it a minute to start."
		]
	},
	unreachable: {
		title: "Can't reach the server",
		hints: ["Check the address and your network or VPN connection."]
	},
	closed: {
		title: "The server closed the connection",
		hints: ["The server may be restarting. Wait a moment and reconnect.", "Check that Remote Desktop is turned on and allows connections."]
	},
	"not-rdp": {
		title: "That doesn't look like a Remote Desktop server",
		hints: ["Check the port in this server's settings."]
	},
	"tls-failed": {
		title: "Couldn't set up a secure connection",
		hints: ["The server's security settings may not match what AgentMate supports. Try again in a moment.", "If the server was just reinstalled, restart Remote Desktop Services on it."]
	},
	"tls-key-usage": {
		title: "The server's certificate can't be used",
		hints: ["Windows made this certificate for Remote Desktop, and it only allows an older kind of encryption that the server then turned down.", "On the server, turn the RSA cipher suites back on in its TLS settings, or give Remote Desktop a certificate that allows digital signatures."]
	},
	"certificate-changed": {
		title: "The server's certificate changed",
		hints: ["This is expected after the server was reinstalled or its certificate was renewed.", "If neither happened, don't trust it."]
	},
	"proxy-failed": {
		title: "Couldn't connect through the proxy",
		hints: [
			"Check the proxy in Settings, under Network. Test connection there shows whether it works.",
			"Many HTTP proxies only allow port 443, and Remote Desktop uses 3389. A SOCKS5 proxy usually allows it.",
			"To skip the proxy for this server, add its address to the proxy's Skip the proxy for list."
		]
	},
	other: {
		title: "Couldn't connect",
		hints: ["Check the address and port, then try again."]
	},
	"sign-in": {
		title: "Sign-in failed",
		hints: ["Edit this server and check the username, password and domain.", "For a domain account, enter the username as DOMAIN\\user."]
	},
	"access-denied": {
		title: "This account can't sign in",
		hints: ["On the server, add the account to the Remote Desktop Users group."]
	},
	"security-settings": {
		title: "Security settings don't match",
		hints: ["Edit this server and switch Network Level Authentication (under Display and sharing), then try again."]
	},
	engine: {
		title: "Couldn't connect",
		hints: []
	}
};
/** The failure to show for something the proxy reported. */
function describeProxyFailure(failure) {
	const advice = ADVICE[failure.code] ?? ADVICE.other;
	return {
		code: failure.code,
		title: advice.title,
		message: failure.message,
		hints: advice.hints,
		detail: failure.detail
	};
}
/** A failure with the heading and hints for `code` from the table, around the given sentence. */
function describeFailure(code, message, extra = {}) {
	const advice = ADVICE[code];
	return {
		code,
		title: advice.title,
		message,
		hints: extra.hints ?? advice.hints,
		detail: extra.detail
	};
}
//#endregion
export { startSshAgentTask as _, MacTrafficLightsSpace as a, useSshAgentStore as b, isTitleBarBlankDoubleClick as c, answerSshAgentPassword as d, approveSshAgentCommand as f, skipSshAgentCommand as g, isSshAgentWaitingOnUser as h, RdpFailureCard as i, SshAgentHistoryDialog as l, initSshAgentStatus as m, describeProxyFailure as n, NativeCaptionButtons as o, continueSshAgentTask as p, RdpFailureBody as r, TitleBar as s, describeFailure as t, answerSshAgentInput as u, stopSshAgentTask as v, useSearchStore as x, useSshAgentSession as y };
