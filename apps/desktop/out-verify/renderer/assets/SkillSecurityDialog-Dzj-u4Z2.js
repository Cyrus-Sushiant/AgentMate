import { Ar as X, Br as __toESM, F as Button, Fr as require_jsx_runtime, I as cn, Lr as require_react, Pr as toast, Qn as Shield, hr as TriangleAlert, pt as CircleCheck, rr as Spinner, tr as Sparkles } from "./tooltip-BbU-D7og.js";
import { C as hashKey, I as Subscribable, M as shallowEqualObjects, N as shouldThrowError, O as noop, n as useQuery, p as useQueryClient, t as queryKeys, x as notifyManager } from "./queryKeys-D7Kl9rJx.js";
import { n as getDefaultState } from "./mutation-zcD5pFah.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as Label } from "./label-D49cSr88.js";
import { _n as CLI_REGISTRY, at as SKILL_AUDIT_VERDICT_LABEL, ct as countFindingsBySeverity, it as SKILL_AUDIT_SEVERITIES, lt as getSkillRiskCategory, ot as SKILL_RISK_CATEGORIES, st as countFindingsByCategory } from "./dist-BskwpHU1.js";
import { g as Chip } from "./pageKit-dgpHZ_9P.js";
import { t as Combobox } from "./combobox-CVynu8bc.js";
import { t as Switch } from "./switch-DmfrphOr.js";
import { t as Badge } from "./badge-C9TrFS3z.js";
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.101.4/node_modules/@tanstack/query-core/build/modern/mutationObserver.js
var MutationObserver = class extends Subscribable {
	#client;
	#currentResult = void 0;
	#currentMutation;
	#mutateOptions;
	constructor(client, options) {
		super();
		this.#client = client;
		this.setOptions(options);
		this.bindMethods();
		this.#updateResult();
	}
	bindMethods() {
		this.mutate = this.mutate.bind(this);
		this.reset = this.reset.bind(this);
	}
	setOptions(options) {
		const prevOptions = this.options;
		this.options = this.#client.defaultMutationOptions(options);
		if (!shallowEqualObjects(this.options, prevOptions)) this.#client.getMutationCache().notify({
			type: "observerOptionsUpdated",
			mutation: this.#currentMutation,
			observer: this
		});
		if (prevOptions?.mutationKey && this.options.mutationKey && hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)) this.reset();
		else if (this.#currentMutation?.state.status === "pending") this.#currentMutation.setOptions(this.options);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) this.#currentMutation?.removeObserver(this);
	}
	onMutationUpdate(action) {
		this.#updateResult();
		this.#notify(action);
	}
	getCurrentResult() {
		return this.#currentResult;
	}
	reset() {
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = void 0;
		this.#updateResult();
		this.#notify();
	}
	mutate(variables, options) {
		this.#mutateOptions = options;
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
		this.#currentMutation.addObserver(this);
		return this.#currentMutation.execute(variables);
	}
	#updateResult() {
		const state = this.#currentMutation?.state ?? getDefaultState();
		this.#currentResult = {
			...state,
			isPending: state.status === "pending",
			isSuccess: state.status === "success",
			isError: state.status === "error",
			isIdle: state.status === "idle",
			mutate: this.mutate,
			reset: this.reset
		};
	}
	#notify(action) {
		notifyManager.batch(() => {
			if (this.#mutateOptions && this.hasListeners()) {
				const variables = this.#currentResult.variables;
				const onMutateResult = this.#currentResult.context;
				const context = {
					client: this.#client,
					meta: this.options.meta,
					mutationKey: this.options.mutationKey
				};
				if (action?.type === "success") {
					try {
						this.#mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				} else if (action?.type === "error") {
					try {
						this.#mutateOptions.onError?.(action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(void 0, action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				}
			}
			this.listeners.forEach((listener) => {
				listener(this.#currentResult);
			});
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.101.4_react@19.2.8/node_modules/@tanstack/react-query/build/modern/useMutation.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function useMutation(options, queryClient) {
	const client = useQueryClient(queryClient);
	const [observer] = import_react.useState(() => new MutationObserver(client, options));
	import_react.useEffect(() => {
		observer.setOptions(options);
	}, [observer, options]);
	const result = import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange)), [observer]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	const mutate = import_react.useCallback((variables, mutateOptions) => {
		observer.mutate(variables, mutateOptions).catch(noop);
	}, [observer]);
	if (result.error && shouldThrowError(observer.options.throwOnError, [result.error])) throw result.error;
	return {
		...result,
		mutate,
		mutateAsync: result.mutate
	};
}
//#endregion
//#region src/renderer/src/components/ui/card.tsx
var import_jsx_runtime = require_jsx_runtime();
function trackSpotlight(event) {
	const rect = event.currentTarget.getBoundingClientRect();
	event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
	event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}
var Card = import_react.forwardRef(({ className, onMouseMove, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("card-spot rounded-lg border border-border bg-card text-card-foreground transition-colors", className),
	onMouseMove: (event) => {
		trackSpotlight(event);
		onMouseMove?.(event);
	},
	...props
}));
Card.displayName = "Card";
var CardHeader = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("relative flex flex-col gap-1.5 p-5", className),
	...props
}));
CardHeader.displayName = "CardHeader";
var CardTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
	ref,
	className: cn("text-sm font-semibold leading-none", className),
	...props
}));
CardTitle.displayName = "CardTitle";
var CardDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
CardDescription.displayName = "CardDescription";
var CardContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("relative p-5 pt-0", className),
	...props
}));
CardContent.displayName = "CardContent";
var CardFooter = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("relative flex items-center p-5 pt-0", className),
	...props
}));
CardFooter.displayName = "CardFooter";
//#endregion
//#region src/renderer/src/components/skills/SkillAuditReport.tsx
var VERDICT_STYLE = {
	safe: {
		badge: "success",
		frame: "ring-success/30 bg-success/10",
		blurb: "Nothing in this skill matched a known attack pattern."
	},
	caution: {
		badge: "warning",
		frame: "ring-warning/30 bg-warning/10",
		blurb: "A few things are worth reading before you trust this skill."
	},
	risky: {
		badge: "destructive",
		frame: "ring-destructive/30 bg-destructive/10",
		blurb: "This skill can do real damage if the findings below are what they look like."
	},
	dangerous: {
		badge: "destructive",
		frame: "ring-destructive/40 bg-destructive/15",
		blurb: "Several serious patterns matched. Do not install this without reading every finding."
	}
};
var SEVERITY_STYLE = {
	critical: {
		badge: "destructive",
		label: "Critical"
	},
	high: {
		badge: "destructive",
		label: "High"
	},
	medium: {
		badge: "warning",
		label: "Medium"
	},
	low: {
		badge: "secondary",
		label: "Low"
	}
};
function SkillAuditVerdictBadge({ verdict, score, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
		tone: VERDICT_STYLE[verdict].badge,
		className,
		children: [
			verdict === "safe" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {}),
			SKILL_AUDIT_VERDICT_LABEL[verdict],
			score !== void 0 ? ` · ${score}` : ""
		]
	});
}
function FindingRow({ finding }) {
	const style = SEVERITY_STYLE[finding.severity];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5 rounded-lg border border-border bg-card/60 px-3 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: style.badge,
						children: style.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium text-foreground",
						children: finding.title
					}),
					finding.origin === "ai" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						variant: "outline",
						className: "gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-3 w-3" }), " CLI review"]
					})
				]
			}),
			finding.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: finding.detail
			}),
			finding.excerpt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "overflow-x-auto rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground",
				children: finding.excerpt
			}),
			finding.file && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-[11px] text-muted-foreground",
				children: [finding.file, finding.line ? `:${finding.line}` : ""]
			})
		]
	});
}
function SkillAuditReport({ record }) {
	const severityCounts = (0, import_react.useMemo)(() => countFindingsBySeverity(record.findings), [record.findings]);
	const categoryCounts = (0, import_react.useMemo)(() => countFindingsByCategory(record.findings), [record.findings]);
	const flaggedCategories = new Set(categoryCounts.map((c) => c.category));
	const cleanCategories = SKILL_RISK_CATEGORIES.filter((c) => !flaggedCategories.has(c.id));
	const style = VERDICT_STYLE[record.verdict];
	const groups = (0, import_react.useMemo)(() => categoryCounts.map((entry) => ({
		info: getSkillRiskCategory(entry.category),
		findings: record.findings.filter((f) => f.category === entry.category)
	})), [categoryCounts, record.findings]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex items-center gap-4 rounded-lg px-4 py-3 ring-1 ring-inset", style.frame),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "h-7 w-7 shrink-0 text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-semibold text-foreground",
								children: SKILL_AUDIT_VERDICT_LABEL[record.verdict]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								variant: "outline",
								children: [
									"Score ",
									record.score,
									"/100"
								]
							}),
							record.deepReview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								variant: "outline",
								className: "gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-3 w-3" }), record.cliName ? `Reviewed by ${record.cliName}` : "Deep review"]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: style.blurb
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						record.filesScanned,
						" file",
						record.filesScanned === 1 ? "" : "s",
						" scanned"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate font-mono",
						children: record.sourceLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(record.createdAt).toLocaleString() })
				]
			}),
			record.findings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1.5",
				children: SKILL_AUDIT_SEVERITIES.filter((severity) => severityCounts[severity] > 0).map((severity) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: SEVERITY_STYLE[severity].badge,
					children: [
						severityCounts[severity],
						" ",
						SEVERITY_STYLE[severity].label.toLowerCase()
					]
				}, severity))
			}),
			record.aiSummary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1 rounded-lg border border-border bg-card/60 px-3 py-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-1.5 text-xs font-medium text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-3.5 w-3.5" }),
						record.cliName ?? "CLI",
						" summary"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "whitespace-pre-wrap text-xs text-muted-foreground",
					children: record.aiSummary
				})]
			}),
			record.aiError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-destructive",
				children: ["The deep review did not complete: ", record.aiError]
			}),
			groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted-foreground",
				children: [
					"The scan matched none of the ",
					SKILL_RISK_CATEGORIES.length,
					" risk categories. That is not a guarantee: it means nothing in the text looked like a known attack, so read the skill before trusting it with anything sensitive."
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-4",
				children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm font-medium text-foreground",
						children: [group.info.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1.5 text-xs font-normal text-muted-foreground",
							children: group.findings.length
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: group.info.description
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: group.findings.map((finding, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FindingRow, { finding }, `${finding.ruleId}-${index}`))
					})]
				}, group.info.id))
			}),
			cleanCategories.length > 0 && groups.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium text-muted-foreground",
					children: "Nothing found for"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1.5",
					children: cleanCategories.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "outline",
						children: category.label
					}, category.id))
				})]
			})
		]
	});
}
//#endregion
//#region src/renderer/src/components/skills/SkillDeepReviewOptions.tsx
/** Falls back to whatever Settings picked as the default CLI. */
var DEFAULT_CLI_VALUE = "__default__";
function deepReviewInput(enabled, cliId) {
	return {
		deepReview: enabled,
		cliId: cliId === "__default__" ? null : cliId
	};
}
/**
* The deep-review switch and CLI picker, shared by every place a check can start: one skill from
* a card, a whole location, or a project's skills. Setting it once next to the button that runs
* the batch is the point, since being asked per skill would be worse than not offering it.
*/
function SkillDeepReviewOptions({ enabled, onEnabledChange, cliId, onCliIdChange, disabled, batchHint }) {
	const cliQuery = useQuery({
		queryKey: queryKeys.cliStatus,
		queryFn: () => window.agentmat.cli.detectAll(),
		meta: { silentLoading: true }
	});
	const installedPromptClis = CLI_REGISTRY.filter((cli) => cli.promptCommand && cliQuery.data?.find((c) => c.id === cli.id)?.installed);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex cursor-pointer items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex min-w-0 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 text-sm font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-3.5 w-3.5" }), " Deep review with an agent CLI"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "Sends the skill's text to an installed CLI for a second opinion. Slower, and it can only make the verdict stricter."
					}),
					enabled && batchHint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 text-xs text-warning",
						children: batchHint
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
				checked: enabled,
				onCheckedChange: onEnabledChange,
				disabled,
				className: "mt-0.5 shrink-0"
			})]
		}), enabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-1.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "CLI" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Combobox, {
					className: "w-full",
					value: cliId,
					onChange: onCliIdChange,
					disabled,
					placeholder: "Choose a CLI",
					options: [{
						value: "__default__",
						label: "Default CLI (from Settings)"
					}, ...installedPromptClis.map((cli) => ({
						value: cli.id,
						label: cli.label
					}))]
				}),
				cliQuery.isFetched && installedPromptClis.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "No CLI with a non-interactive mode was detected. Install one from CLI Manager, or leave the deep review off and rely on the static scan."
				})
			]
		})]
	});
}
//#endregion
//#region src/renderer/src/components/skills/SkillSecurityDialog.tsx
/**
* A check can take minutes when a CLI review is on, and this dialog shows its own progress and a
* cancel button, so it must not raise the app-wide loading overlay over itself.
*/
var AUDIT_META = { silentLoading: true };
function SkillSecurityDialog({ subject, onOpenChange }) {
	const queryClient = useQueryClient();
	const [deepReview, setDeepReview] = (0, import_react.useState)(false);
	const [cliId, setCliId] = (0, import_react.useState)(DEFAULT_CLI_VALUE);
	const [requestId, setRequestId] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setResult(null);
		setRequestId(null);
	}, [subject?.skillId]);
	const historyQuery = useQuery({
		queryKey: queryKeys.skillAuditsFor(subject?.skillId ?? ""),
		queryFn: () => window.agentmat.skills.listAudits({
			skillId: subject.skillId,
			limit: 20
		}),
		enabled: !!subject
	});
	const auditMutation = useMutation({
		meta: AUDIT_META,
		mutationFn: async () => {
			if (!subject) throw new Error("Nothing to scan.");
			const id = crypto.randomUUID();
			setRequestId(id);
			return window.agentmat.skills.runAudit({
				target: subject.target,
				...deepReviewInput(deepReview, cliId),
				requestId: id
			});
		},
		onSettled: () => setRequestId(null),
		onSuccess: (response) => {
			if (response.cancelled) {
				toast.info("Security check cancelled.");
				return;
			}
			if (!response.ok || !response.record) {
				toast.error(response.error ?? "The security check could not run.");
				return;
			}
			setResult(response.record);
			queryClient.invalidateQueries({ queryKey: queryKeys.skillAudits });
			queryClient.invalidateQueries({ queryKey: queryKeys.skillAuditsLatest });
		},
		onError: (error) => toast.error(error.message)
	});
	const running = auditMutation.isPending;
	const shown = result ?? historyQuery.data?.[0] ?? null;
	const showingEarlierScan = !result && !!shown;
	const earlierChecks = (historyQuery.data ?? []).filter((entry) => entry.id !== shown?.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: !!subject,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "flex max-h-[85vh] max-w-2xl flex-col overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
					className: "flex items-center gap-2 pr-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "h-4 w-4" }),
						"Security check: ",
						subject?.skillName
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
					"Reads the skill's own files and looks for the ",
					SKILL_RISK_CATEGORIES.length,
					" risk patterns below. Nothing is installed or run to do this."
				] })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "-mx-1 -my-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-lg border border-border bg-card/60 px-3 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillDeepReviewOptions, {
								enabled: deepReview,
								onEnabledChange: setDeepReview,
								cliId,
								onCliIdChange: setCliId,
								disabled: running
							})
						}),
						running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-2 text-sm text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-4 w-4 animate-spin" }), deepReview ? "Scanning the files, then waiting on the CLI review. This can take a minute." : "Scanning the skill files…"]
						}),
						!running && shown && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [showingEarlierScan && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted-foreground",
								children: [
									"Showing the last check, from ",
									new Date(shown.createdAt).toLocaleString(),
									"."
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillAuditReport, { record: shown })]
						}),
						!running && !shown && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: "This skill has not been checked yet."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5",
								children: SKILL_RISK_CATEGORIES.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "outline",
									children: category.label
								}, category.id))
							})]
						}),
						earlierChecks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium text-muted-foreground",
								children: "Earlier checks"
							}), earlierChecks.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left text-xs hover:bg-card",
								onClick: () => setResult(entry),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [new Date(entry.createdAt).toLocaleString(), entry.deepReview ? ` · ${entry.cliName ?? "CLI"} review` : ""]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillAuditVerdictBadge, {
									verdict: entry.verdict,
									score: entry.score
								})]
							}, entry.id))]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "soft",
					onClick: () => {
						if (requestId) window.agentmat.skills.cancelAudit(requestId);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {}), " Cancel"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					disabled: !subject,
					onClick: () => auditMutation.mutate(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {}),
						" ",
						shown ? "Check again" : "Run security check"
					]
				}) })
			]
		})
	});
}
//#endregion
export { SkillAuditReport as a, CardContent as c, CardHeader as d, CardTitle as f, deepReviewInput as i, CardDescription as l, DEFAULT_CLI_VALUE as n, SkillAuditVerdictBadge as o, useMutation as p, SkillDeepReviewOptions as r, Card as s, SkillSecurityDialog as t, CardFooter as u };
