import { Br as __toESM, F as Button, Fr as require_jsx_runtime, I as cn, Lr as require_react, Pr as toast, S as create, _ as SECTION_HEADING, f as persist, t as SimpleTooltip } from "./tooltip-BbU-D7og.js";
import { C as hashKey, D as matchQuery, E as matchMutation, F as focusManager, I as Subscribable, O as noop, P as skipToken, S as functionalUpdate, b as onlineManager, h as Query, j as resolveStaleTime, k as partialMatchKey, n as useQuery, p as useQueryClient, t as queryKeys, w as hashQueryKeyByOptions, x as notifyManager } from "./queryKeys-D7Kl9rJx.js";
import { t as Mutation } from "./mutation-zcD5pFah.js";
import "./dist-BskwpHU1.js";
import { n as useCliStore } from "./cliStore-BEVHhLcE.js";
import { n as baseName } from "./editorRevealStore-DlPbqWPZ.js";
import { G as parseScopeId, Y as findGroup, Z as findNeighborGroup, g as useWorkspaceStore, l as projectCliId, n as launchAgentTab, o as launchShellTab } from "./launch-OTu6P7aE.js";
import { E as LayoutGroup, T as motion, w as useReducedMotion } from "./pageKit-dgpHZ_9P.js";
import { n as sortAgentChoices, r as emitBrowserShortcut } from "./agentChoices-Dc9UzfdM.js";
import { r as isImagePath } from "./ImageView-DlvJOhY-.js";
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.101.4/node_modules/@tanstack/query-core/build/modern/mutationCache.js
var MutationCache = class extends Subscribable {
	constructor(config = {}) {
		super();
		this.config = config;
		this.#mutations = /* @__PURE__ */ new Set();
		this.#scopes = /* @__PURE__ */ new Map();
		this.#mutationId = 0;
	}
	#mutations;
	#scopes;
	#mutationId;
	build(client, options, state) {
		const mutation = new Mutation({
			client,
			mutationCache: this,
			mutationId: ++this.#mutationId,
			options: client.defaultMutationOptions(options),
			state
		});
		this.add(mutation);
		return mutation;
	}
	add(mutation) {
		this.#mutations.add(mutation);
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const scopedMutations = this.#scopes.get(scope);
			if (scopedMutations) scopedMutations.push(mutation);
			else this.#scopes.set(scope, [mutation]);
		}
		this.notify({
			type: "added",
			mutation
		});
	}
	remove(mutation) {
		if (this.#mutations.delete(mutation)) {
			const scope = scopeFor(mutation);
			if (typeof scope === "string") {
				const scopedMutations = this.#scopes.get(scope);
				if (scopedMutations) {
					if (scopedMutations.length > 1) {
						const index = scopedMutations.indexOf(mutation);
						if (index !== -1) scopedMutations.splice(index, 1);
					} else if (scopedMutations[0] === mutation) this.#scopes.delete(scope);
				}
			}
		}
		this.notify({
			type: "removed",
			mutation
		});
	}
	canRun(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const firstPendingMutation = this.#scopes.get(scope)?.find((m) => m.state.status === "pending");
			return !firstPendingMutation || firstPendingMutation === mutation;
		} else return true;
	}
	runNext(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") return (this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused))?.continue() ?? Promise.resolve();
		else return Promise.resolve();
	}
	clear() {
		notifyManager.batch(() => {
			this.#mutations.forEach((mutation) => {
				this.notify({
					type: "removed",
					mutation
				});
			});
			this.#mutations.clear();
			this.#scopes.clear();
		});
	}
	getAll() {
		return Array.from(this.#mutations);
	}
	find(filters) {
		const defaultedFilters = {
			exact: true,
			...filters
		};
		return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
	}
	findAll(filters = {}) {
		return this.getAll().filter((mutation) => matchMutation(filters, mutation));
	}
	notify(event) {
		notifyManager.batch(() => {
			this.listeners.forEach((listener) => {
				listener(event);
			});
		});
	}
	resumePausedMutations() {
		const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
		return notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))));
	}
};
function scopeFor(mutation) {
	return mutation.options.scope?.id;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.101.4/node_modules/@tanstack/query-core/build/modern/queryCache.js
var QueryCache = class extends Subscribable {
	constructor(config = {}) {
		super();
		this.config = config;
		this.#queries = /* @__PURE__ */ new Map();
	}
	#queries;
	build(client, options, state) {
		const queryKey = options.queryKey;
		const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
		let query = this.get(queryHash);
		if (!query) {
			query = new Query({
				client,
				queryKey,
				queryHash,
				options: client.defaultQueryOptions(options),
				state,
				defaultOptions: client.getQueryDefaults(queryKey)
			});
			this.add(query);
		}
		return query;
	}
	add(query) {
		if (!this.#queries.has(query.queryHash)) {
			this.#queries.set(query.queryHash, query);
			this.notify({
				type: "added",
				query
			});
		}
	}
	remove(query) {
		const queryInMap = this.#queries.get(query.queryHash);
		if (queryInMap) {
			query.destroy();
			if (queryInMap === query) this.#queries.delete(query.queryHash);
			this.notify({
				type: "removed",
				query
			});
		}
	}
	clear() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				this.remove(query);
			});
		});
	}
	get(queryHash) {
		return this.#queries.get(queryHash);
	}
	getAll() {
		return [...this.#queries.values()];
	}
	find(filters) {
		const defaultedFilters = {
			exact: true,
			...filters
		};
		return this.getAll().find((query) => matchQuery(defaultedFilters, query));
	}
	findAll(filters = {}) {
		const queries = this.getAll();
		return Object.keys(filters).length > 0 ? queries.filter((query) => matchQuery(filters, query)) : queries;
	}
	notify(event) {
		notifyManager.batch(() => {
			this.listeners.forEach((listener) => {
				listener(event);
			});
		});
	}
	onFocus() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				query.onFocus();
			});
		});
	}
	onOnline() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				query.onOnline();
			});
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.101.4/node_modules/@tanstack/query-core/build/modern/queryClient.js
var QueryClient = class {
	#queryCache;
	#mutationCache;
	#defaultOptions;
	#queryDefaults;
	#mutationDefaults;
	#mountCount;
	#unsubscribeFocus;
	#unsubscribeOnline;
	constructor(config = {}) {
		this.#queryCache = config.queryCache || new QueryCache();
		this.#mutationCache = config.mutationCache || new MutationCache();
		this.#defaultOptions = config.defaultOptions || {};
		this.#queryDefaults = /* @__PURE__ */ new Map();
		this.#mutationDefaults = /* @__PURE__ */ new Map();
		this.#mountCount = 0;
	}
	mount() {
		this.#mountCount++;
		if (this.#mountCount !== 1) return;
		this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
			if (focused) {
				await this.resumePausedMutations();
				this.#queryCache.onFocus();
			}
		});
		this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
			if (online) {
				await this.resumePausedMutations();
				this.#queryCache.onOnline();
			}
		});
	}
	unmount() {
		this.#mountCount--;
		if (this.#mountCount !== 0) return;
		this.#unsubscribeFocus?.();
		this.#unsubscribeFocus = void 0;
		this.#unsubscribeOnline?.();
		this.#unsubscribeOnline = void 0;
	}
	isFetching(filters) {
		return this.#queryCache.findAll({
			...filters,
			fetchStatus: "fetching"
		}).length;
	}
	isMutating(filters) {
		return this.#mutationCache.findAll({
			...filters,
			status: "pending"
		}).length;
	}
	/**
	* Imperative (non-reactive) way to retrieve data for a QueryKey.
	* Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
	*
	* Hint: Do not use this function inside a component, because it won't receive updates.
	* Use `useQuery` to create a `QueryObserver` that subscribes to changes.
	*/
	getQueryData(queryKey) {
		const options = this.defaultQueryOptions({ queryKey });
		return this.#queryCache.get(options.queryHash)?.state.data;
	}
	ensureQueryData(options) {
		const defaultedOptions = this.defaultQueryOptions(options);
		const query = this.#queryCache.build(this, defaultedOptions);
		const cachedData = query.state.data;
		if (cachedData === void 0) return this.fetchQuery(options);
		if (options.revalidateIfStale && query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query))) this.prefetchQuery(defaultedOptions);
		return Promise.resolve(cachedData);
	}
	getQueriesData(filters) {
		return this.#queryCache.findAll(filters).map(({ queryKey, state }) => {
			return [queryKey, state.data];
		});
	}
	setQueryData(queryKey, updater, options) {
		const defaultedOptions = this.defaultQueryOptions({ queryKey });
		const prevData = this.#queryCache.get(defaultedOptions.queryHash)?.state.data;
		const data = functionalUpdate(updater, prevData);
		if (data === void 0) return;
		return this.#queryCache.build(this, defaultedOptions).setData(data, {
			...options,
			manual: true
		});
	}
	setQueriesData(filters, updater, options) {
		return notifyManager.batch(() => this.#queryCache.findAll(filters).map(({ queryKey }) => [queryKey, this.setQueryData(queryKey, updater, options)]));
	}
	getQueryState(queryKey) {
		const options = this.defaultQueryOptions({ queryKey });
		return this.#queryCache.get(options.queryHash)?.state;
	}
	removeQueries(filters) {
		const queryCache = this.#queryCache;
		notifyManager.batch(() => {
			queryCache.findAll(filters).forEach((query) => {
				queryCache.remove(query);
			});
		});
	}
	resetQueries(filters, options) {
		const queryCache = this.#queryCache;
		return notifyManager.batch(() => {
			queryCache.findAll(filters).forEach((query) => {
				query.reset();
			});
			return this.refetchQueries({
				type: "active",
				...filters
			}, options);
		});
	}
	cancelQueries(filters, cancelOptions = {}) {
		const defaultedCancelOptions = {
			revert: true,
			...cancelOptions
		};
		const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)));
		return Promise.all(promises).then(noop).catch(noop);
	}
	invalidateQueries(filters, options = {}) {
		return notifyManager.batch(() => {
			this.#queryCache.findAll(filters).forEach((query) => {
				query.invalidate();
			});
			if (filters?.refetchType === "none") return Promise.resolve();
			return this.refetchQueries({
				...filters,
				type: filters?.refetchType ?? filters?.type ?? "active"
			}, options);
		});
	}
	refetchQueries(filters, options = {}) {
		const fetchOptions = {
			...options,
			cancelRefetch: options.cancelRefetch ?? true
		};
		const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).filter((query) => !query.isDisabled() && !query.isStatic()).map((query) => {
			let promise = query.fetch(void 0, fetchOptions);
			if (!fetchOptions.throwOnError) promise = promise.catch(noop);
			return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
		}));
		return Promise.all(promises).then(noop);
	}
	fetchQuery(options) {
		const defaultedOptions = this.defaultQueryOptions(options);
		if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
		const query = this.#queryCache.build(this, defaultedOptions);
		return query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query)) ? query.fetch(defaultedOptions) : Promise.resolve(query.state.data);
	}
	prefetchQuery(options) {
		return this.fetchQuery(options).then(noop).catch(noop);
	}
	fetchInfiniteQuery(options) {
		options._type = "infinite";
		return this.fetchQuery(options);
	}
	prefetchInfiniteQuery(options) {
		return this.fetchInfiniteQuery(options).then(noop).catch(noop);
	}
	ensureInfiniteQueryData(options) {
		options._type = "infinite";
		return this.ensureQueryData(options);
	}
	resumePausedMutations() {
		if (onlineManager.isOnline()) return this.#mutationCache.resumePausedMutations();
		return Promise.resolve();
	}
	getQueryCache() {
		return this.#queryCache;
	}
	getMutationCache() {
		return this.#mutationCache;
	}
	getDefaultOptions() {
		return this.#defaultOptions;
	}
	setDefaultOptions(options) {
		this.#defaultOptions = options;
	}
	setQueryDefaults(queryKey, options) {
		this.#queryDefaults.set(hashKey(queryKey), {
			queryKey,
			defaultOptions: options
		});
	}
	getQueryDefaults(queryKey) {
		const defaults = [...this.#queryDefaults.values()];
		const result = {};
		defaults.forEach((queryDefault) => {
			if (partialMatchKey(queryKey, queryDefault.queryKey)) Object.assign(result, queryDefault.defaultOptions);
		});
		return result;
	}
	setMutationDefaults(mutationKey, options) {
		this.#mutationDefaults.set(hashKey(mutationKey), {
			mutationKey,
			defaultOptions: options
		});
	}
	getMutationDefaults(mutationKey) {
		const defaults = [...this.#mutationDefaults.values()];
		const result = {};
		defaults.forEach((queryDefault) => {
			if (partialMatchKey(mutationKey, queryDefault.mutationKey)) Object.assign(result, queryDefault.defaultOptions);
		});
		return result;
	}
	defaultQueryOptions(options) {
		if (options._defaulted) return options;
		const defaultedOptions = {
			...this.#defaultOptions.queries,
			...this.getQueryDefaults(options.queryKey),
			...options,
			_defaulted: true
		};
		if (!defaultedOptions.queryHash) defaultedOptions.queryHash = hashQueryKeyByOptions(defaultedOptions.queryKey, defaultedOptions);
		if (defaultedOptions.refetchOnReconnect === void 0) defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
		if (defaultedOptions.throwOnError === void 0) defaultedOptions.throwOnError = !!defaultedOptions.suspense;
		if (!defaultedOptions.networkMode && defaultedOptions.persister) defaultedOptions.networkMode = "offlineFirst";
		if (defaultedOptions.queryFn === skipToken) defaultedOptions.enabled = false;
		return defaultedOptions;
	}
	defaultMutationOptions(options) {
		if (options?._defaulted) return options;
		return {
			...this.#defaultOptions.mutations,
			...options?.mutationKey && this.getMutationDefaults(options.mutationKey),
			...options,
			_defaulted: true
		};
	}
	clear() {
		this.#queryCache.clear();
		this.#mutationCache.clear();
	}
};
//#endregion
//#region ../../packages/core/dist/git/pullRequest.js
/**
* Pull request data as the app uses it, parsed from `gh pr view --json` and the GitHub GraphQL
* API, plus the prompts that hand a PR to an agent. Everything here is pure so it can be tested
* against captured gh output.
*/
/** PR comments that ask a review bot to look at the pull request. Editable in Settings. */
var DEFAULT_REVIEW_COMMANDS = [
	"@claude review",
	"/gemini review",
	"@coderabbitai review",
	"@codex review"
];
/** Same buckets as the pipeline run tone, so checks and runs read alike. */
function checkBucket(check) {
	if (check.status !== "completed") return "running";
	if (check.conclusion === "success") return "passed";
	if (check.conclusion === "failure" || check.conclusion === "timed_out" || check.conclusion === "startup_failure" || check.conclusion === "action_required") return "failed";
	return "other";
}
function summarizeChecks(checks) {
	const summary = {
		total: checks.length,
		failed: 0,
		running: 0,
		passed: 0,
		other: 0
	};
	for (const check of checks) summary[checkBucket(check)] += 1;
	return summary;
}
var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Why the PR can't be merged yet, in the order worth fixing them. Empty means it can. */
function mergeBlockers(pr) {
	if (pr.state !== "OPEN") return [{
		kind: "not-open",
		message: `This pull request is ${pr.state.toLowerCase()}.`
	}];
	const blockers = [];
	if (pr.isDraft) blockers.push({
		kind: "draft",
		message: "It is still a draft. Mark it ready for review."
	});
	if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY") blockers.push({
		kind: "conflicts",
		message: `It has conflicts with ${pr.base}.`
	});
	const summary = summarizeChecks(pr.checks);
	if (summary.failed > 0) blockers.push({
		kind: "failing-checks",
		message: `${plural(summary.failed, "check")} failed.`
	});
	if (summary.running > 0) blockers.push({
		kind: "running-checks",
		message: `${plural(summary.running, "check")} still running.`
	});
	if (pr.reviewDecision === "CHANGES_REQUESTED") blockers.push({
		kind: "changes-requested",
		message: "A reviewer requested changes."
	});
	else if (pr.reviewDecision === "REVIEW_REQUIRED") blockers.push({
		kind: "review-required",
		message: "It needs an approving review."
	});
	const unresolved = pr.threads.filter((thread) => !thread.isResolved).length;
	if (unresolved > 0 && pr.mergeStateStatus === "BLOCKED") blockers.push({
		kind: "unresolved-threads",
		message: `${plural(unresolved, "review thread")} still open.`
	});
	return blockers;
}
/** Hands the unresolved review comments to an agent to fix in the working tree. */
function buildReviewFixPrompt(pr, threads) {
	const open = threads.filter((thread) => !thread.isResolved);
	const lines = [
		`Pull request #${pr.number} "${pr.title}" (${pr.head} into ${pr.base}) has review comments to address.`,
		"",
		"Work through each comment below in this repository. Make the change the reviewer asks for, or, when you disagree, leave the code as it is and say why. Keep each change focused on its comment, run the relevant checks afterwards, and finish with a short list saying what you did for each comment.",
		""
	];
	open.forEach((thread, index) => {
		const where = thread.line ? `${thread.path}:${thread.line}` : thread.path;
		lines.push(`${index + 1}. ${where}${thread.isOutdated ? " (on an older version of the file)" : ""}`);
		for (const comment of thread.comments) lines.push(`   @${comment.author}: ${comment.body.trim().replace(/\n/g, "\n   ")}`);
		lines.push("");
	});
	return lines.join("\n").trimEnd();
}
//#endregion
//#region src/renderer/src/stores/worktreeDialogStore.ts
var useWorktreeDialogStore = create((set) => ({
	create: null,
	remove: null,
	openCreate: (request) => set({ create: request }),
	openRemove: (request) => set({ remove: request }),
	closeCreate: () => set({ create: null }),
	closeRemove: () => set({ remove: null })
}));
//#endregion
//#region src/renderer/src/lib/workspace/scope.ts
function asWorkspaceProject(project, worktree = null) {
	if (!worktree) return {
		...project,
		parentId: project.id,
		worktree: null
	};
	return {
		...project,
		id: `${project.id}~${worktree.id}`,
		folderPath: worktree.path,
		parentId: project.id,
		worktree
	};
}
/** The workspace for a project id or scope id, or null until what it needs has loaded. */
function resolveWorkspaceProject(projects, worktreesByProject, scopeId) {
	if (!scopeId) return null;
	const { projectId, worktreeId } = parseScopeId(scopeId);
	const project = projects.find((p) => p.id === projectId);
	if (!project) return null;
	if (!worktreeId) return asWorkspaceProject(project);
	const worktree = worktreesByProject[projectId]?.find((w) => w.id === worktreeId);
	return worktree ? asWorkspaceProject(project, worktree) : null;
}
/** What a worktree is called in the UI: its branch, or its folder while detached. */
function worktreeLabel(worktree) {
	return worktree.branch ?? baseName(worktree.path);
}
/**
* Two letters for a worktree's rail tile. The type prefix (`feat/`) is the same on most
* branches, so the letters come from what follows it.
*/
function worktreeInitials(label) {
	const words = (label.split("/").pop() ?? "").split(/[-_.\s]+/).filter(Boolean);
	if (words.length >= 2) return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
	const word = words[0] ?? "";
	if (!word) return "?";
	if (word.length === 1) return word.toUpperCase();
	return `${word[0]?.toUpperCase() ?? ""}${word[1] ?? ""}`;
}
//#endregion
//#region src/renderer/src/queryClient.ts
var queryClient = new QueryClient({ defaultOptions: { queries: {
	staleTime: 3e4,
	refetchOnWindowFocus: false,
	retry: 1
} } });
//#endregion
//#region src/renderer/src/stores/workspaceSearchStore.ts
/**
* The workspace search dialog: whether it is open and for which project, and what it keeps
* between openings (the last query per project, the text options, the preview's size), the
* way Visual Studio's Go to All picks up where it was left.
*/
var PREVIEW_MIN = .25;
var PREVIEW_MAX = .75;
var PREVIEW_DEFAULT = .45;
var useWorkspaceSearchStore = create()(persist((set, get) => ({
	open: false,
	projectId: null,
	queries: {},
	options: {
		matchCase: false,
		wholeWord: false,
		regex: false
	},
	preview: {
		visible: true,
		ratio: PREVIEW_DEFAULT,
		images: true
	},
	openSearch: (projectId, seed) => set((state) => ({
		open: true,
		projectId,
		queries: seed === void 0 ? state.queries : {
			...state.queries,
			[projectId]: seed
		}
	})),
	close: () => set({ open: false }),
	toggle: (projectId) => {
		const { open, projectId: current } = get();
		if (open && current === projectId) set({ open: false });
		else get().openSearch(projectId);
	},
	setQuery: (projectId, query) => set((state) => ({ queries: {
		...state.queries,
		[projectId]: query
	} })),
	setOption: (option, value) => set((state) => ({ options: {
		...state.options,
		[option]: value
	} })),
	setPreview: (patch) => set((state) => {
		const next = {
			...state.preview,
			...patch
		};
		next.ratio = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, next.ratio));
		return { preview: next };
	})
}), {
	name: "agentmate-workspace-search",
	version: 1,
	partialize: (state) => ({
		queries: state.queries,
		options: state.options,
		preview: state.preview
	}),
	merge: (persisted, current) => {
		const saved = persisted ?? {};
		return {
			...current,
			...saved,
			preview: {
				...current.preview,
				...saved.preview
			}
		};
	}
}));
//#endregion
//#region src/renderer/src/lib/workspace/commands.ts
/** Lets a keyboard shortcut open the same launcher menu the "+" button does. */
var useLauncherStore = create((set) => ({
	openForGroupId: null,
	setOpenFor: (groupId) => set({ openForGroupId: groupId })
}));
var usePromptDialogStore = create((set) => ({
	projectId: null,
	groupId: null,
	open: (projectId, groupId) => set({
		projectId,
		groupId
	}),
	close: () => set({
		projectId: null,
		groupId: null
	})
}));
/** Window event the focused diff tab listens for; `detail` is `'next'` or `'previous'`. */
var DIFF_CHANGE_EVENT = "agentmate:diff-change";
/** Window event the header's Run button listens for, so a shortcut presses it. */
var RUN_PROJECT_EVENT = "agentmate:run-project";
function isWorkspacePath(pathname) {
	return pathname === "/workspace" || pathname.startsWith("/workspace/");
}
/** The project on screen, pointed at the worktree when a worktree's workspace is showing. */
function activeProject() {
	const scopeId = useWorkspaceStore.getState().activeProjectId;
	if (!scopeId) return null;
	const { projectId } = parseScopeId(scopeId);
	const projects = queryClient.getQueryData(queryKeys.projects) ?? [];
	const worktrees = queryClient.getQueryData(queryKeys.worktrees(projectId));
	return resolveWorkspaceProject(projects, { [projectId]: worktrees }, scopeId);
}
function activeWorkspace() {
	const state = useWorkspaceStore.getState();
	const projectId = state.activeProjectId;
	const workspace = projectId ? state.workspaces[projectId] : void 0;
	return projectId && workspace ? {
		projectId,
		workspace
	} : null;
}
/** Where each pane group currently sits on screen, for moving focus by direction. */
function groupRects() {
	const rects = {};
	for (const el of document.querySelectorAll("[data-pane-group-id]")) {
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;
		const id = el.dataset.paneGroupId;
		if (id) rects[id] = {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height
		};
	}
	return rects;
}
var workspaceCommands = {
	openLauncher() {
		const current = activeWorkspace();
		if (current) useLauncherStore.getState().setOpenFor(current.workspace.focusedGroupId);
	},
	newShell() {
		const project = activeProject();
		const current = activeWorkspace();
		if (project && current) launchShellTab(project, void 0, current.workspace.focusedGroupId);
	},
	/**
	* Starts the agent at this position of the "+" menu (1 is the first) in the focused pane.
	* Positions past the installed agents do nothing, the way going to a missing tab does.
	*/
	async launchAgent(position) {
		const project = activeProject();
		const current = activeWorkspace();
		if (!project || !current) return;
		const groupId = current.workspace.focusedGroupId;
		const statuses = await queryClient.ensureQueryData({
			queryKey: queryKeys.cliStatus,
			queryFn: () => window.agentmat.cli.detectAll()
		});
		const { installed } = sortAgentChoices(statuses, useCliStore.getState().cliOrder, projectCliId(project));
		const choice = installed[position - 1];
		if (!choice) return;
		useLauncherStore.getState().setOpenFor(null);
		launchAgentTab(project, choice.cli.id, groupId);
	},
	/** Opens Build Prompt for the project on screen, so "Open in agent" lands in the focused pane. */
	buildPrompt() {
		const current = activeWorkspace();
		if (!current) return;
		useLauncherStore.getState().setOpenFor(null);
		usePromptDialogStore.getState().open(current.projectId, current.workspace.focusedGroupId);
	},
	newBrowser() {
		const current = activeWorkspace();
		if (!current) return;
		useWorkspaceStore.getState().openBrowser(current.projectId, { groupId: current.workspace.focusedGroupId });
	},
	/** Starts commenting on a page element, when the focused pane shows a browser tab. */
	pickElement() {
		const current = activeWorkspace();
		if (!current) return;
		const group = findGroup(current.workspace.root, current.workspace.focusedGroupId);
		const tab = group?.activeTabId ? current.workspace.tabs[group.activeTabId] : void 0;
		if (tab?.kind === "browser" && tab.url) emitBrowserShortcut(tab.id, "pick");
	},
	closeActiveTab() {
		const current = activeWorkspace();
		if (!current) return;
		const group = findGroup(current.workspace.root, current.workspace.focusedGroupId);
		if (group?.activeTabId) useWorkspaceStore.getState().closeTab(current.projectId, group.activeTabId);
	},
	split(direction) {
		const current = activeWorkspace();
		if (!current) return;
		const groupId = useWorkspaceStore.getState().splitGroup(current.projectId, current.workspace.focusedGroupId, direction);
		useLauncherStore.getState().setOpenFor(groupId);
	},
	focusPane(direction) {
		const current = activeWorkspace();
		if (!current) return;
		const next = findNeighborGroup(groupRects(), current.workspace.focusedGroupId, direction);
		if (next) useWorkspaceStore.getState().focusGroup(current.projectId, next);
	},
	cycleTab(step) {
		const current = activeWorkspace();
		if (!current) return;
		const group = findGroup(current.workspace.root, current.workspace.focusedGroupId);
		if (!group || group.tabIds.length < 2) return;
		const index = group.activeTabId ? group.tabIds.indexOf(group.activeTabId) : 0;
		const next = group.tabIds[(index + step + group.tabIds.length) % group.tabIds.length];
		if (next) useWorkspaceStore.getState().activateTab(current.projectId, next);
	},
	goToTab(position) {
		const current = activeWorkspace();
		if (!current) return;
		const tabId = findGroup(current.workspace.root, current.workspace.focusedGroupId)?.tabIds[position - 1];
		if (tabId) useWorkspaceStore.getState().activateTab(current.projectId, tabId);
	},
	toggleZoom() {
		const current = activeWorkspace();
		if (current) useWorkspaceStore.getState().toggleZoom(current.projectId, current.workspace.focusedGroupId);
	},
	focusedTabIsDiff() {
		const current = activeWorkspace();
		if (!current) return false;
		const group = findGroup(current.workspace.root, current.workspace.focusedGroupId);
		return (group?.activeTabId ? current.workspace.tabs[group.activeTabId] : void 0)?.kind === "diff";
	},
	/** Moves the diff in the focused pane to its next or previous change. */
	diffChange(direction) {
		window.dispatchEvent(new CustomEvent(DIFF_CHANGE_EVENT, { detail: direction }));
	},
	toggleGitPanel() {
		const { gitPanel, setGitPanel } = useWorkspaceStore.getState();
		setGitPanel({ collapsed: !gitPanel.collapsed });
	},
	/** Presses the header's Run button for the project on screen. */
	runProject() {
		window.dispatchEvent(new CustomEvent(RUN_PROJECT_EVENT));
	},
	/** Opens the search dialog on the project on screen, or closes it when it is already up. */
	openSearch() {
		const scopeId = useWorkspaceStore.getState().activeProjectId;
		if (scopeId) useWorkspaceSearchStore.getState().toggle(scopeId);
	},
	/** New worktree of the project on screen, whether its checkout or one of its worktrees is up. */
	newWorktree() {
		const scopeId = useWorkspaceStore.getState().activeProjectId;
		if (!scopeId) return;
		useWorktreeDialogStore.getState().openCreate({ projectId: parseScopeId(scopeId).projectId });
	}
};
//#endregion
//#region src/renderer/src/lib/git.ts
var import_jsx_runtime = require_jsx_runtime();
/** Splits a repo path into its folder (with the trailing slash) and file name. */
function splitGitPath(path) {
	const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	if (i < 0) return {
		dir: "",
		name: path
	};
	return {
		dir: path.slice(0, i + 1),
		name: path.slice(i + 1)
	};
}
/**
* The repository root on disk, worked out from the project folder and where that folder sits
* inside the repository (WorkspaceGitState.projectPrefix).
*/
function repoRootPath(folderPath, projectPrefix) {
	const folder = folderPath.replace(/[\\/]+$/, "");
	const depth = projectPrefix ? projectPrefix.split("/").filter(Boolean).length : 0;
	const parts = folder.split(/[\\/]/);
	const separator = folder.includes("\\") ? "\\" : "/";
	return depth > 0 ? parts.slice(0, parts.length - depth).join(separator) : folder;
}
/** A repo-relative path as an absolute path, written with the folder's own separator. */
function repoFileAbsolutePath(folderPath, projectPrefix, repoPath) {
	const root = repoRootPath(folderPath, projectPrefix);
	const separator = root.includes("\\") ? "\\" : "/";
	return `${root}${separator}${repoPath.replaceAll("/", separator)}`;
}
/**
* A repo-relative path as an absolute path inside the project folder, in the same form the
* explorer uses, or null when the file lives in the repository but outside the project.
*/
function projectFilePath(folderPath, projectPrefix, repoPath) {
	const prefix = projectPrefix ? `${projectPrefix}/` : "";
	if (prefix && !repoPath.startsWith(prefix)) return null;
	const folder = folderPath.replace(/[\\/]+$/, "");
	const separator = folder.includes("\\") ? "\\" : "/";
	return `${folder}${separator}${repoPath.slice(prefix.length).replaceAll("/", separator)}`;
}
/** A CLI's suggested commit message, without the code fences and quotes models like to add. */
function sanitizeCommitMessage(text) {
	return text.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim().replace(/^["']|["']$/g, "").trim();
}
var STATUS_META = {
	M: {
		letter: "M",
		label: "Modified",
		className: "text-warning"
	},
	A: {
		letter: "A",
		label: "Added",
		className: "text-success"
	},
	D: {
		letter: "D",
		label: "Deleted",
		className: "text-destructive"
	},
	R: {
		letter: "R",
		label: "Renamed",
		className: "text-sky-400"
	},
	C: {
		letter: "C",
		label: "Copied",
		className: "text-sky-400"
	},
	T: {
		letter: "T",
		label: "Type changed",
		className: "text-warning"
	},
	U: {
		letter: "!",
		label: "Conflict",
		className: "text-destructive"
	},
	"?": {
		letter: "U",
		label: "Untracked",
		className: "text-success/80"
	}
};
function changeStatusMeta(status) {
	return STATUS_META[status];
}
var EMPTY_DIFF_STAT = {
	files: 0,
	additions: 0,
	deletions: 0,
	uncounted: 0
};
/** Adds up the line counts on a list of changed files. */
function diffStat(entries) {
	let additions = 0;
	let deletions = 0;
	let uncounted = 0;
	for (const entry of entries) {
		if (entry.binary || entry.additions === void 0 && entry.deletions === void 0) {
			uncounted += 1;
			continue;
		}
		additions += entry.additions ?? 0;
		deletions += entry.deletions ?? 0;
	}
	return {
		files: entries.length,
		additions,
		deletions,
		uncounted
	};
}
function sumDiffStats(stats) {
	return stats.reduce((total, stat) => ({
		files: total.files + stat.files,
		additions: total.additions + stat.additions,
		deletions: total.deletions + stat.deletions,
		uncounted: total.uncounted + stat.uncounted
	}), EMPTY_DIFF_STAT);
}
/** Short enough for the panel: exact under ten thousand, then 12.3k and 1.2M. */
function formatLineCount(value) {
	if (value < 1e4) return value.toLocaleString();
	if (value < 1e6) return `${(value / 1e3).toFixed(value < 1e5 ? 1 : 0)}k`;
	return `${(value / 1e6).toFixed(1)}M`;
}
/**
* How the five blocks of a diff bar are coloured: green for additions, red for deletions,
* split by share of the change. A side with any lines at all keeps at least one block.
*/
function diffBarBlocks(additions, deletions) {
	const total = additions + deletions;
	if (total === 0) return Array.from({ length: 5 }, () => "none");
	let added = Math.round(additions / total * 5);
	if (additions > 0 && added === 0) added = 1;
	if (deletions > 0 && added === 5) added = 4;
	return Array.from({ length: 5 }, (_, i) => i < added ? "add" : "del");
}
//#endregion
//#region src/renderer/src/components/workspace/git/PanelTabs.tsx
/**
* The hairline under a strip in the panel, drawn as an inset shadow like the API Client's tab
* strip, so the app's global border colour can't repaint it.
*/
var HAIRLINE_BELOW = "shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]";
function TabButton({ tab, active, onSelect, onKeyDown }) {
	const Icon = tab.icon;
	const reduceMotion = useReducedMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label: tab.title,
		side: "bottom",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			role: "tab",
			id: `panel-tab-${tab.id}`,
			"aria-selected": active,
			"aria-controls": `panel-panel-${tab.id}`,
			"aria-label": tab.title,
			tabIndex: active ? 0 : -1,
			onClick: onSelect,
			onKeyDown,
			className: cn("relative flex h-6 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60", active ? "text-primary" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"),
			children: [
				active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
					"aria-hidden": true,
					layoutId: "panel-tabs-active",
					transition: reduceMotion ? { duration: 0 } : {
						type: "spring",
						stiffness: 420,
						damping: 32
					},
					className: "absolute inset-0 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "relative h-3.5 w-3.5" }),
				tab.count ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("relative min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 tabular-nums", tab.countTone === "destructive" ? "bg-destructive/15 text-destructive" : active ? "bg-primary/15 text-primary" : "bg-foreground/[0.07] text-muted-foreground"),
					children: tab.count > 99 ? "99+" : tab.count
				}) : null
			]
		})
	});
}
/**
* The right-hand panel's tab strip and its open tab. Only the open tab renders, so the
* sections that fetch (commits, pipelines, sessions) stay quiet until they are looked at.
*/
function PanelTabs({ tabs, trailing }) {
	const stored = useWorkspaceStore((s) => s.gitPanel.activeSection);
	const setGitPanel = useWorkspaceStore((s) => s.setGitPanel);
	const active = tabs.find((tab) => tab.id === stored) ?? tabs[0];
	const move = (event, from) => {
		const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		const next = tabs[(tabs.findIndex((tab) => tab.id === from) + step + tabs.length) % tabs.length];
		if (!next) return;
		setGitPanel({ activeSection: next.id });
		document.getElementById(`panel-tab-${next.id}`)?.focus();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex h-10 shrink-0 items-center gap-1 pl-2 pr-1.5", HAIRLINE_BELOW),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex min-w-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGroup, {
						id: "panel-tabs",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							role: "tablist",
							"aria-label": "Panel sections",
							className: "search-pill flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
							children: tabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								tab,
								active: tab.id === active?.id,
								onSelect: () => setGitPanel({ activeSection: tab.id }),
								onKeyDown: (event) => move(event, tab.id)
							}, tab.id))
						})
					})
				}),
				active?.actions && active.toolbarTitle === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex shrink-0 items-center gap-0.5",
					children: active.actions
				}) : null,
				trailing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex shrink-0 items-center gap-0.5",
					children: trailing
				}) : null
			]
		}),
		active?.actions && active.toolbarTitle !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex h-8 shrink-0 items-center gap-1 pl-3.5 pr-1.5", HAIRLINE_BELOW),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn(SECTION_HEADING, "min-w-0 flex-1 truncate"),
				children: active.toolbarTitle
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex shrink-0 items-center gap-0.5",
				children: active.actions
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "tabpanel",
			id: `panel-panel-${active?.id}`,
			"aria-labelledby": `panel-tab-${active?.id}`,
			className: "flex min-h-0 flex-1 flex-col",
			children: active?.render()
		})
	] });
}
function PanelIconButton({ label, onClick, children, disabled, active }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label,
		wrapTrigger: disabled,
		side: "bottom",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: active ? "tint" : "ghost",
			size: "icon-xs",
			"aria-label": label,
			...active === void 0 ? {} : { "aria-pressed": active },
			onClick: (event) => {
				event.stopPropagation();
				onClick();
			},
			disabled,
			children
		})
	});
}
//#endregion
//#region src/renderer/src/components/workspace/git/StatusLetter.tsx
/**
* The theme colour a change status is tinted with, the same buckets the Project detail Git tab
* uses: added is green, modified amber, deleted and conflicted red, renamed and copied primary.
*/
function statusTone(status) {
	switch (status) {
		case "A":
		case "?": return "success";
		case "D":
		case "U": return "destructive";
		case "R":
		case "C": return "primary";
		default: return "warning";
	}
}
var LETTER_TONE = {
	neutral: "bg-foreground/[0.06] text-muted-foreground",
	primary: "bg-primary/12 text-primary",
	success: "bg-success/12 text-success",
	warning: "bg-warning/12 text-warning",
	destructive: "bg-destructive/12 text-destructive"
};
var TEXT_TONE = {
	neutral: "text-muted-foreground",
	primary: "text-primary",
	success: "text-success",
	warning: "text-warning",
	destructive: "text-destructive"
};
/** The text colour for a file name that carries this status, as in the explorer tree. */
function statusTextClass(status) {
	return TEXT_TONE[statusTone(status)];
}
/**
* A change status as a small tinted letter chip (M, A, D, U, !). It is named for screen
* readers, since the letter alone says little.
*/
function StatusLetter({ status, className }) {
	const meta = changeStatusMeta(status);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		role: "img",
		"aria-label": meta.label,
		className: cn("inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[5px] px-0.5 font-mono text-[10px] font-semibold leading-none", LETTER_TONE[statusTone(status)], className),
		children: meta.letter
	});
}
//#endregion
//#region src/renderer/src/components/workspace/git/pr/usePullRequest.ts
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* The last merge made from the tab, per project. Cleanup switches to the default branch, which
* turns the tab into its "start from a branch" state; this keeps the outcome on screen there.
*/
var useRecentMerges = create((set) => ({
	byProject: {},
	record: (projectId, merge) => set((state) => ({ byProject: {
		...state.byProject,
		[projectId]: merge
	} })),
	dismiss: (projectId) => set((state) => {
		const { [projectId]: _gone, ...rest } = state.byProject;
		return { byProject: rest };
	})
}));
var FAST_POLL_MS = 15e3;
var SLOW_POLL_MS = 6e4;
/**
* How often to ask GitHub again. Running checks change by the minute, so they are watched
* closely; nothing is polled when there is no PR GitHub could still change.
*/
function pullRequestRefetchInterval(status) {
	if (!status?.cliAvailable || !status.authenticated || !status.github) return false;
	if (!status.branch || status.onDefaultBranch) return false;
	if (!status.pr) return SLOW_POLL_MS;
	if (status.pr.state !== "OPEN") return false;
	return summarizeChecks(status.pr.checks).running > 0 ? FAST_POLL_MS : SLOW_POLL_MS;
}
/**
* What happened on GitHub between two reads of the same open PR, worth a toast: checks that
* finished, a review decision, new review comments. Merges and closes are left out, the merge
* card already says so when it's done from here.
*/
function pullRequestProgress(prev, next) {
	const before = prev?.pr;
	const after = next?.pr;
	if (!before || !after || before.number !== after.number) return [];
	if (before.state !== "OPEN" || after.state !== "OPEN") return [];
	const notes = [];
	const was = summarizeChecks(before.checks);
	const now = summarizeChecks(after.checks);
	if (was.running > 0 && now.running === 0 && now.total > 0) notes.push(now.failed > 0 ? {
		tone: "error",
		title: `Checks failed on #${after.number}`,
		description: `${now.failed} of ${now.total} ${now.total === 1 ? "check" : "checks"} failed.`
	} : {
		tone: "success",
		title: `Checks passed on #${after.number}`,
		description: `All ${now.total} ${now.total === 1 ? "check" : "checks"} passed.`
	});
	if (after.reviewDecision !== before.reviewDecision) {
		if (after.reviewDecision === "APPROVED") notes.push({
			tone: "success",
			title: `#${after.number} was approved`
		});
		else if (after.reviewDecision === "CHANGES_REQUESTED") notes.push({
			tone: "warning",
			title: `Changes requested on #${after.number}`
		});
	}
	const openBefore = before.threads.filter((thread) => !thread.isResolved).length;
	const openAfter = after.threads.filter((thread) => !thread.isResolved).length;
	if (openAfter > openBefore) {
		const added = openAfter - openBefore;
		notes.push({
			tone: "info",
			title: `${added} new review ${added === 1 ? "comment" : "comments"} on #${after.number}`
		});
	}
	return notes;
}
function openPullRequestSection() {
	useWorkspaceStore.getState().revealPanelSection("pullRequest");
}
/**
* Says the branch is on GitHub and, when it could have a pull request but has none yet,
* offers to open one. Reads the last known PR status, so it never waits on gh.
*/
function announcePublishedBranch(queryClient, projectId, branch, title = "Branch published") {
	queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
	const status = queryClient.getQueryData(queryKeys.pullRequest(projectId));
	const canOpenPr = status?.github && status.authenticated && !status.onDefaultBranch && !status.pr;
	toast.success(title, {
		description: canOpenPr ? `${branch ?? "The branch"} is on GitHub. Open a pull request to get it reviewed.` : void 0,
		action: canOpenPr ? {
			label: "Create pull request",
			onClick: openPullRequestSection
		} : void 0
	});
}
function usePullRequest(projectId, watch) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.pullRequest(projectId),
		queryFn: () => window.agentmat.pullRequests.status(projectId),
		enabled: watch.visible,
		refetchInterval: (q) => watch.visible ? pullRequestRefetchInterval(q.state.data) : false,
		meta: { silentLoading: true }
	});
	const lastSeen = (0, import_react.useRef)(query.data);
	(0, import_react.useEffect)(() => {
		const prev = lastSeen.current;
		lastSeen.current = query.data;
		for (const note of pullRequestProgress(prev, query.data)) toast[note.tone](note.title, {
			description: note.description,
			action: {
				label: "View",
				onClick: openPullRequestSection
			}
		});
	}, [query.data]);
	const fingerprint = `${watch.branch ?? ""}|${watch.head ?? ""}|${watch.ahead ?? ""}|${watch.upstream ?? ""}`;
	const seen = (0, import_react.useRef)(fingerprint);
	(0, import_react.useEffect)(() => {
		if (seen.current === fingerprint) return;
		seen.current = fingerprint;
		if (watch.visible) queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
	}, [
		fingerprint,
		projectId,
		queryClient,
		watch.visible
	]);
	const mismatchRetried = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!watch.visible || !watch.branch || !query.data?.branch || query.isFetching) return;
		if (watch.branch === query.data.branch) return;
		const key = `${watch.branch}|${query.data.branch}`;
		if (mismatchRetried.current === key) return;
		mismatchRetried.current = key;
		queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
	}, [
		watch.visible,
		watch.branch,
		query.data,
		query.isFetching,
		projectId,
		queryClient
	]);
	return query;
}
function patchThreads(queryClient, projectId, threadId, resolved) {
	queryClient.setQueryData(queryKeys.pullRequest(projectId), (status) => status?.pr ? {
		...status,
		pr: {
			...status.pr,
			threads: status.pr.threads.map((thread) => thread.id === threadId ? {
				...thread,
				isResolved: resolved
			} : thread)
		}
	} : status);
}
function usePullRequestActions(projectId) {
	const queryClient = useQueryClient();
	return (0, import_react.useMemo)(() => {
		const api = window.agentmat.pullRequests;
		const refresh = () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
		};
		const settle = (result) => {
			if (!result.ok) toast.error(result.error ?? "GitHub did not accept that.");
			refresh();
			return result.ok;
		};
		const afterMerge = (result) => {
			refresh();
			queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(projectId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.gitBranchHistories(projectId) });
			return result;
		};
		return {
			refresh,
			comment: async (number, body) => settle(await api.comment({
				projectId,
				number,
				body
			})),
			reply: async (threadId, body) => settle(await api.replyThread({
				projectId,
				threadId,
				body
			})),
			resolveThread: async (threadId, resolved) => {
				patchThreads(queryClient, projectId, threadId, resolved);
				const result = await api.resolveThread({
					projectId,
					threadId,
					resolved
				});
				if (!result.ok) patchThreads(queryClient, projectId, threadId, !resolved);
				return settle(result);
			},
			markReady: async (number) => settle(await api.markReady(projectId, number)),
			merge: async (input) => afterMerge(await api.merge({
				projectId,
				...input
			})),
			cleanup: async (base, head) => afterMerge(await api.cleanup({
				projectId,
				base,
				head
			}))
		};
	}, [projectId, queryClient]);
}
//#endregion
//#region src/renderer/src/components/workspace/git/useWorkspaceGit.ts
/**
* The workspace changes panel's state for a project. While `watching`, main watches the
* working tree and pushes every change, so this never polls.
*/
function useWorkspaceGitState(projectId, watching) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.gitWorkspaceState(projectId),
		queryFn: () => window.agentmat.git.workspaceState(projectId),
		meta: { silentLoading: true },
		staleTime: Number.POSITIVE_INFINITY
	});
	(0, import_react.useEffect)(() => {
		return window.agentmat.git.onWorkspaceState((id, state) => {
			if (id !== projectId) return;
			queryClient.setQueryData(queryKeys.gitWorkspaceState(projectId), state);
			queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiffs(projectId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
			queryClient.invalidateQueries({ queryKey: ["workspace-explorer", projectId] });
		});
	}, [projectId, queryClient]);
	(0, import_react.useEffect)(() => {
		if (!watching) return;
		window.agentmat.git.watchWorkingTree(projectId);
		return () => {
			window.agentmat.git.unwatchWorkingTree(projectId);
		};
	}, [projectId, watching]);
	return query;
}
/**
* Opens a changed file in a tab next to the terminals: an image in the viewer, anything else in
* the editor. Another binary file, or one that sits in the repository but outside the project
* folder (the app only reads inside projects), goes to its default app instead.
*/
function openChangedFile(project, projectPrefix, repoPath, binary) {
	const inProject = !binary || isImagePath(repoPath) ? projectFilePath(project.folderPath, projectPrefix, repoPath) : null;
	if (inProject) {
		useWorkspaceStore.getState().openFile(project.id, inProject, { pin: true });
		return;
	}
	window.agentmat.shell.openPath(repoFileAbsolutePath(project.folderPath, projectPrefix, repoPath));
}
/**
* AI conflict runs still going, keyed by project and path, holding the id that stops each one.
* Kept outside React so closing the panel or the diff tab doesn't lose track of a run.
*/
var useAiResolves = create(() => ({}));
function aiResolveKey(projectId, path) {
	return `${projectId}\n${path}`;
}
/** Whether an AI CLI is working on this conflicted file right now. */
function useAiResolving(projectId, path) {
	return useAiResolves((s) => aiResolveKey(projectId, path) in s);
}
/** The same for a whole list of rows, which can't each call a hook. */
function useAiResolvingPaths(projectId) {
	const runs = useAiResolves();
	return (path) => aiResolveKey(projectId, path) in runs;
}
function without(entries, paths) {
	return entries.filter((entry) => !paths.has(entry.path));
}
/** Moves rows between sections straight away; the state main pushes back settles the details. */
function optimistic(queryClient, projectId, change) {
	queryClient.setQueryData(queryKeys.gitWorkspaceState(projectId), (state) => state ? change(state) : state);
}
function useGitActions(projectId) {
	const queryClient = useQueryClient();
	return (0, import_react.useMemo)(() => {
		const git = window.agentmat.git;
		const resync = () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(projectId) });
		};
		const undoableToast = (result, description) => {
			const token = result.undoToken;
			toast.success(result.message, {
				description,
				action: token ? {
					label: "Undo",
					onClick: () => {
						git.undoDiscard(projectId, token).then((undo) => {
							if (!undo.ok) toast.error("Could not undo", { description: undo.message });
						});
					}
				} : void 0
			});
		};
		return {
			stage: async (paths) => {
				const set = new Set(paths);
				optimistic(queryClient, projectId, (state) => {
					const moved = [
						...state.unstaged,
						...state.untracked,
						...state.conflicts
					].filter((entry) => set.has(entry.path) && !state.staged.some((s) => s.path === entry.path)).map((entry) => ({
						path: entry.path,
						status: entry.status === "?" ? "A" : entry.status === "U" ? "M" : entry.status,
						additions: entry.additions,
						deletions: entry.deletions
					}));
					return {
						...state,
						staged: [...state.staged, ...moved].sort((a, b) => a.path.localeCompare(b.path)),
						unstaged: without(state.unstaged, set),
						untracked: without(state.untracked, set),
						conflicts: without(state.conflicts, set)
					};
				});
				const result = await git.stage(projectId, paths);
				if (!result.ok) {
					toast.error("Could not stage", { description: result.message });
					resync();
				}
			},
			unstage: async (paths) => {
				const set = new Set(paths);
				optimistic(queryClient, projectId, (state) => {
					const leaving = state.staged.filter((entry) => set.has(entry.path));
					const toUntracked = leaving.filter((entry) => entry.status === "A").map((entry) => ({
						path: entry.path,
						status: "?"
					}));
					const toUnstaged = leaving.filter((entry) => entry.status !== "A" && !state.unstaged.some((u) => u.path === entry.path)).map((entry) => ({
						...entry,
						origPath: void 0
					}));
					const byPath = (a, b) => a.path.localeCompare(b.path);
					return {
						...state,
						staged: without(state.staged, set),
						unstaged: [...state.unstaged, ...toUnstaged].sort(byPath),
						untracked: [...state.untracked, ...toUntracked].sort(byPath)
					};
				});
				const result = await git.unstage(projectId, paths);
				if (!result.ok) {
					toast.error("Could not unstage", { description: result.message });
					resync();
				}
			},
			discard: async (paths, side) => {
				const set = new Set(paths);
				optimistic(queryClient, projectId, (state) => side === "untracked" ? {
					...state,
					untracked: without(state.untracked, set)
				} : {
					...state,
					unstaged: without(state.unstaged, set)
				});
				const result = await git.discard(projectId, paths, side);
				if (!result.ok) {
					toast.error("Could not discard", { description: result.message });
					resync();
					return;
				}
				undoableToast(result);
			},
			applyLines: async (input) => {
				const result = await git.applyLines({
					...input,
					projectId
				});
				if (!result.ok) {
					const title = input.action === "stage" ? "Could not stage those lines" : input.action === "unstage" ? "Could not unstage those lines" : "Could not discard those lines";
					toast.error(title, { description: result.message });
					resync();
					return;
				}
				if (input.action === "discard") undoableToast(result);
			},
			resolve: async (path, pick) => {
				const result = await git.resolveConflict(projectId, path, pick);
				if (result.ok) toast.success(result.message);
				else toast.error("Could not resolve the conflict", { description: result.message });
			},
			resolveWithAi: async (path) => {
				const key = aiResolveKey(projectId, path);
				const running = useAiResolves.getState()[key];
				if (running) {
					git.cancelResolveConflictWithAi(running);
					return;
				}
				const requestId = crypto.randomUUID();
				useAiResolves.setState({ [key]: requestId });
				try {
					const result = await git.resolveConflictWithAi(projectId, path, requestId);
					if (result.cancelled) return;
					if (result.ok) undoableToast(result, result.summary);
					else toast.error("AI could not resolve the conflict", { description: result.message });
				} finally {
					useAiResolves.setState((s) => {
						if (s[key] !== requestId) return s;
						const { [key]: _done, ...rest } = s;
						return rest;
					}, true);
				}
			},
			abort: async () => {
				const result = await git.abortOperation(projectId);
				if (result.ok) toast.success(result.message);
				else toast.error("Could not abort", { description: result.message });
			},
			commit: async (message, push) => {
				const before = queryClient.getQueryData(queryKeys.gitWorkspaceState(projectId));
				const publishing = push && Boolean(before?.branch && !before.upstream);
				const result = await git.commitStaged(projectId, message, push);
				if (!result.ok) {
					toast.error(push ? "Commit and push failed" : "Commit failed", { description: result.message });
					return false;
				}
				if (publishing) {
					announcePublishedBranch(queryClient, projectId, before?.branch, "Committed and published");
					return true;
				}
				const firstLine = message.split("\n")[0];
				toast.success(push ? "Committed and pushed" : "Committed", { description: firstLine });
				return true;
			}
		};
	}, [projectId, queryClient]);
}
//#endregion
export { PREVIEW_DEFAULT as A, DEFAULT_REVIEW_COMMANDS as B, sumDiffStats as C, useLauncherStore as D, isWorkspacePath as E, asWorkspaceProject as F, checkBucket as H, resolveWorkspaceProject as I, worktreeInitials as L, PREVIEW_MIN as M, useWorkspaceSearchStore as N, usePromptDialogStore as O, queryClient as P, worktreeLabel as R, splitGitPath as S, RUN_PROJECT_EVENT as T, mergeBlockers as U, buildReviewFixPrompt as V, summarizeChecks as W, diffStat as _, useWorkspaceGitState as a, repoFileAbsolutePath as b, usePullRequestActions as c, statusTextClass as d, HAIRLINE_BELOW as f, diffBarBlocks as g, changeStatusMeta as h, useGitActions as i, PREVIEW_MAX as j, workspaceCommands as k, useRecentMerges as l, PanelTabs as m, useAiResolving as n, announcePublishedBranch as o, PanelIconButton as p, useAiResolvingPaths as r, usePullRequest as s, openChangedFile as t, StatusLetter as u, formatLineCount as v, DIFF_CHANGE_EVENT as w, sanitizeCommitMessage as x, projectFilePath as y, useWorktreeDialogStore as z };
