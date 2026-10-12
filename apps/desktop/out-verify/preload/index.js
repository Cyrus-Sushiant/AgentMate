Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let electron = require("electron");
//#region src/shared/ipcChannels.ts
var IPC = {
	app: {
		getVersion: "app:getVersion",
		checkForUpdates: "app:checkForUpdates",
		downloadUpdate: "app:downloadUpdate",
		pauseDownload: "app:pauseDownload",
		quitAndInstall: "app:quitAndInstall",
		onUpdateStatus: "app:onUpdateStatus",
		relaunch: "app:relaunch",
		/** main -> the app window: show this route (a deep link from the pet or a tray click). */
		onNavigate: "app:navigate",
		/** The renderer collecting a route that arrived while the window was still loading. */
		pendingNavigate: "app:pendingNavigate",
		/** The app window reporting the page it is on, so the next launch can open there. */
		setLastRoute: "app:setLastRoute",
		/** main -> the app window: sessions are still open, ask before closing the app. */
		onConfirmQuit: "app:confirmQuit",
		/** The renderer's answer to onConfirmQuit. */
		answerQuit: "app:answerQuit",
		/** The app window saying its first page has loaded, so the splash can hand over. */
		rendererReady: "app:rendererReady"
	},
	backup: {
		export: "backup:export",
		open: "backup:open",
		restore: "backup:restore"
	},
	blueprints: {
		get: "blueprints:get",
		updateSection: "blueprints:updateSection",
		setFinalPrompt: "blueprints:setFinalPrompt",
		setDocsFolder: "blueprints:setDocsFolder",
		setConfirmBeforeWriting: "blueprints:setConfirmBeforeWriting",
		pickAttachments: "blueprints:pickAttachments",
		addAttachment: "blueprints:addAttachment",
		renameAttachment: "blueprints:renameAttachment",
		removeAttachment: "blueprints:removeAttachment",
		attachmentPath: "blueprints:attachmentPath",
		listRevisions: "blueprints:listRevisions",
		agentFileTarget: "blueprints:agentFileTarget",
		syncAgentFile: "blueprints:syncAgentFile",
		listPresets: "blueprints:listPresets",
		savePreset: "blueprints:savePreset",
		deletePreset: "blueprints:deletePreset"
	},
	cli: {
		detectAll: "cli:detectAll",
		getInstallCommand: "cli:getInstallCommand",
		checkForUpdate: "cli:checkForUpdate",
		getUpdateCommand: "cli:getUpdateCommand"
	},
	terminal: {
		create: "terminal:create",
		write: "terminal:write",
		resize: "terminal:resize",
		kill: "terminal:kill",
		usage: "terminal:usage",
		runStatus: "terminal:runStatus",
		onData: "terminal:onData",
		onExit: "terminal:onExit"
	},
	ssh: {
		listServers: "ssh:listServers",
		saveServer: "ssh:saveServer",
		removeServer: "ssh:removeServer",
		pickPrivateKeyFile: "ssh:pickPrivateKeyFile",
		vaultStatus: "ssh:vaultStatus",
		unlockVault: "ssh:unlockVault",
		setPasskey: "ssh:setPasskey",
		create: "ssh:create",
		write: "ssh:write",
		resize: "ssh:resize",
		kill: "ssh:kill",
		hostKeyStatus: "ssh:hostKeyStatus",
		trustHostKey: "ssh:trustHostKey",
		conversations: "ssh:conversations",
		onData: "ssh:onData",
		onExit: "ssh:onExit"
	},
	environments: {
		list: "environments:list",
		save: "environments:save",
		remove: "environments:remove",
		reorder: "environments:reorder",
		saveFile: "environments:saveFile",
		removeFile: "environments:removeFile",
		readFile: "environments:readFile",
		copyFile: "environments:copyFile",
		saveCredential: "environments:saveCredential",
		removeCredential: "environments:removeCredential",
		revealCredential: "environments:revealCredential",
		copyCredentialSecret: "environments:copyCredentialSecret",
		scanFolder: "environments:scanFolder",
		importFromFolder: "environments:importFromFolder",
		writeToFolder: "environments:writeToFolder"
	},
	vault: {
		status: "vault:status",
		create: "vault:create",
		unlock: "vault:unlock",
		lock: "vault:lock",
		changePassword: "vault:changePassword",
		reset: "vault:reset",
		list: "vault:list",
		getForEdit: "vault:getForEdit",
		reveal: "vault:reveal",
		copy: "vault:copy",
		save: "vault:save",
		remove: "vault:remove",
		patch: "vault:patch",
		duplicate: "vault:duplicate",
		touch: "vault:touch",
		importOpen: "vault:importOpen",
		importPreview: "vault:importPreview",
		importCommit: "vault:importCommit",
		importCancel: "vault:importCancel",
		exportCsv: "vault:exportCsv",
		fetchIcon: "vault:fetchIcon",
		onStateChanged: "vault:onStateChanged",
		onEntriesChanged: "vault:onEntriesChanged",
		onClipboardSettled: "vault:onClipboardSettled"
	},
	rdp: {
		listServers: "rdp:listServers",
		saveServer: "rdp:saveServer",
		removeServer: "rdp:removeServer",
		openSession: "rdp:openSession",
		getTicket: "rdp:getTicket",
		respondCertificate: "rdp:respondCertificate",
		checkCertificate: "rdp:checkCertificate",
		trustCertificate: "rdp:trustCertificate",
		forgetCertificate: "rdp:forgetCertificate",
		readClipboardFiles: "rdp:readClipboardFiles",
		readClipboardFile: "rdp:readClipboardFile",
		beginDownload: "rdp:beginDownload",
		prepareDownloadEntry: "rdp:prepareDownloadEntry",
		writeDownloadChunk: "rdp:writeDownloadChunk",
		finishDownloadFile: "rdp:finishDownloadFile",
		openDownloadFolder: "rdp:openDownloadFolder",
		onCertificatePrompt: "rdp:onCertificatePrompt",
		onProxyError: "rdp:onProxyError"
	},
	rdpWindow: {
		minimize: "rdpWindow:minimize",
		maximizeToggle: "rdpWindow:maximizeToggle",
		fullscreenToggle: "rdpWindow:fullscreenToggle",
		close: "rdpWindow:close",
		getState: "rdpWindow:getState",
		onStateChange: "rdpWindow:onStateChange"
	},
	sshAgent: {
		start: "sshAgent:start",
		approveCommand: "sshAgent:approveCommand",
		skipCommand: "sshAgent:skipCommand",
		answerNeedsInput: "sshAgent:answerNeedsInput",
		answerPassword: "sshAgent:answerPassword",
		stop: "sshAgent:stop",
		continue: "sshAgent:continue",
		history: "sshAgent:history",
		notifyWaiting: "sshAgent:notifyWaiting",
		onProgress: "sshAgent:onProgress"
	},
	rdpAgent: {
		start: "rdpAgent:start",
		approveAction: "rdpAgent:approveAction",
		skipAction: "rdpAgent:skipAction",
		answerNeedsInput: "rdpAgent:answerNeedsInput",
		stop: "rdpAgent:stop",
		continue: "rdpAgent:continue",
		history: "rdpAgent:history",
		notifyWaiting: "rdpAgent:notifyWaiting",
		respond: "rdpAgent:respond",
		onRequest: "rdpAgent:onRequest",
		onProgress: "rdpAgent:onProgress"
	},
	projects: {
		list: "projects:list",
		create: "projects:create",
		update: "projects:update",
		delete: "projects:delete",
		reorder: "projects:reorder",
		setPinned: "projects:setPinned",
		setArchived: "projects:setArchived",
		bootstrap: "projects:bootstrap",
		bootstrapPlan: "projects:bootstrapPlan",
		pickFolder: "projects:pickFolder",
		pickIcon: "projects:pickIcon",
		normalizeIcon: "projects:normalizeIcon",
		fetchFavicon: "projects:fetchFavicon",
		updateNotifications: "projects:updateNotifications",
		listClaudeHooks: "projects:listClaudeHooks",
		updateClaudeHook: "projects:updateClaudeHook",
		deleteClaudeHook: "projects:deleteClaudeHook"
	},
	notifications: {
		sendTest: "notifications:sendTest",
		/** Shows a message on the desktop companion, the way the pet hook does. */
		sendPetTest: "notifications:sendPetTest",
		detectChatId: "notifications:detectChatId",
		onConfirmationForwarded: "notifications:onConfirmationForwarded"
	},
	skills: {
		listRepositories: "skills:listRepositories",
		addRepository: "skills:addRepository",
		removeRepository: "skills:removeRepository",
		refreshRepository: "skills:refreshRepository",
		getRepositoryIndex: "skills:getRepositoryIndex",
		pickLocalRepository: "skills:pickLocalRepository",
		previewLocalRepository: "skills:previewLocalRepository",
		install: "skills:install",
		remove: "skills:remove",
		listInstalled: "skills:listInstalled",
		checkForUpdates: "skills:checkForUpdates",
		searchSkillsSh: "skills:searchSkillsSh",
		getSkillsShDetail: "skills:getSkillsShDetail",
		recordSkillsShInstall: "skills:recordSkillsShInstall",
		checkUiProPrerequisites: "skills:checkUiProPrerequisites",
		checkUiProUpdate: "skills:checkUiProUpdate",
		recordUiProInstall: "skills:recordUiProInstall",
		listFavorites: "skills:listFavorites",
		addFavorite: "skills:addFavorite",
		removeFavorite: "skills:removeFavorite",
		/** Aggregated Skill invocations read out of the local agent session transcripts. */
		getUsage: "skills:getUsage",
		/** Same, after throwing away the incremental scan cache and re-reading every transcript. */
		rescanUsage: "skills:rescanUsage",
		/** Where a used skill's files live, and which projects already have a copy. */
		inspectUsedSkill: "skills:inspectUsedSkill",
		/** Copies a used skill's folder into other projects' skills dirs. */
		addUsedSkillToProjects: "skills:addUsedSkillToProjects",
		runAudit: "skills:runAudit",
		cancelAudit: "skills:cancelAudit",
		/** Reports what a pasted folder path or GitHub address holds, before anything is scanned. */
		previewAuditSource: "skills:previewAuditSource",
		/** Skills sitting in a scope's agent dirs, whether or not AgentMate installed them. */
		listOnDiskSkills: "skills:listOnDiskSkills",
		listAudits: "skills:listAudits",
		latestAuditPerSkill: "skills:latestAuditPerSkill",
		getAudit: "skills:getAudit",
		removeAudit: "skills:removeAudit",
		clearAudits: "skills:clearAudits",
		/** A watched local-folder repository changed on disk; payload is the repository id. */
		onRepositoryChanged: "skills:onRepositoryChanged"
	},
	mcp: {
		listRepositories: "mcp:listRepositories",
		addRepository: "mcp:addRepository",
		removeRepository: "mcp:removeRepository",
		refreshRepository: "mcp:refreshRepository",
		getRepositoryIndex: "mcp:getRepositoryIndex",
		pickLocalRepository: "mcp:pickLocalRepository",
		install: "mcp:install",
		remove: "mcp:remove",
		listInstalled: "mcp:listInstalled"
	},
	fs: {
		readFile: "fs:readFile",
		readImage: "fs:readImage",
		writeFile: "fs:writeFile",
		listDirectory: "fs:listDirectory",
		writeScratchFile: "fs:writeScratchFile",
		saveFileAs: "fs:saveFileAs"
	},
	explorer: {
		createFile: "explorer:createFile",
		createFolder: "explorer:createFolder",
		rename: "explorer:rename",
		delete: "explorer:delete",
		copy: "explorer:copy",
		move: "explorer:move",
		pasteExternal: "explorer:pasteExternal",
		osClipboardPaths: "explorer:osClipboardPaths",
		revealInOs: "explorer:revealInOs",
		addToGitignore: "explorer:addToGitignore",
		untrack: "explorer:untrack",
		ignoredPaths: "explorer:ignoredPaths",
		listFiles: "explorer:listFiles"
	},
	workspaceSearch: {
		text: "workspaceSearch:text",
		cancel: "workspaceSearch:cancel",
		symbols: "workspaceSearch:symbols",
		onTextResults: "workspaceSearch:textResults"
	},
	settings: {
		get: "settings:get",
		update: "settings:update"
	},
	templates: {
		list: "templates:list",
		save: "templates:save",
		delete: "templates:delete"
	},
	activity: { list: "activity:list" },
	system: {
		sample: "system:sample",
		topApps: "system:topApps",
		killProcess: "system:killProcess"
	},
	ipGeo: { lookup: "ipGeo:lookup" },
	shell: {
		openExternal: "shell:openExternal",
		openPath: "shell:openPath",
		openInEditor: "shell:openInEditor"
	},
	promptHistory: {
		list: "promptHistory:list",
		search: "promptHistory:search",
		add: "promptHistory:add",
		remove: "promptHistory:remove",
		setTags: "promptHistory:setTags",
		setProject: "promptHistory:setProject"
	},
	translate: {
		text: "translate:text",
		cancel: "translate:cancel"
	},
	speech: {
		transcribe: "speech:transcribe",
		getModelState: "speech:getModelState",
		onModelProgress: "speech:onModelProgress"
	},
	ai: {
		ask: "ai:ask",
		cancel: "ai:cancel",
		listOllamaModels: "ai:listOllamaModels",
		testOllama: "ai:testOllama",
		listGeminiModels: "ai:listGeminiModels",
		assessRun: "ai:assessRun",
		cancelAssessRun: "ai:cancelAssessRun",
		askCli: "ai:askCli",
		cancelAskCli: "ai:cancelAskCli"
	},
	help: {
		ask: "help:ask",
		cancel: "help:cancel",
		status: "help:status",
		reindex: "help:reindex",
		cancelReindex: "help:cancelReindex",
		embeddingModels: "help:embeddingModels",
		onIndexProgress: "help:onIndexProgress"
	},
	projectDrafts: {
		listByProject: "projectDrafts:listByProject",
		create: "projectDrafts:create",
		updateStatus: "projectDrafts:updateStatus",
		update: "projectDrafts:update",
		promoteToScheduled: "projectDrafts:promoteToScheduled",
		remove: "projectDrafts:remove"
	},
	promptBuildWidget: {
		listWidgets: "promptBuildWidget:listWidgets",
		getWidget: "promptBuildWidget:getWidget",
		openWidget: "promptBuildWidget:openWidget",
		closeWidget: "promptBuildWidget:closeWidget"
	},
	scheduledTasks: {
		list: "scheduledTasks:list",
		listByProject: "scheduledTasks:listByProject",
		createMany: "scheduledTasks:createMany",
		updateStatus: "scheduledTasks:updateStatus",
		update: "scheduledTasks:update",
		markRan: "scheduledTasks:markRan",
		remove: "scheduledTasks:remove",
		onDue: "scheduledTasks:due",
		onChanged: "scheduledTasks:changed"
	},
	spellcheck: {
		onShowMenu: "spellcheck:showMenu",
		addToDictionary: "spellcheck:addToDictionary",
		runEditCommand: "spellcheck:runEditCommand"
	},
	splash: {
		onStatus: "splash:status",
		onClose: "splash:close"
	},
	grammar: {
		check: "grammar:check",
		/** Where the local LanguageTool lives, whether Java is there, and what the server is doing. */
		localStatus: "grammar:localStatus",
		startLocal: "grammar:startLocal",
		stopLocal: "grammar:stopLocal",
		/** Opens the tools folder in the OS file manager, creating it first if needed. */
		openToolsFolder: "grammar:openToolsFolder",
		onLocalStatus: "grammar:onLocalStatus"
	},
	proxy: {
		/** Where requests are going right now, plus what this machine itself is set to. */
		status: "proxy:status",
		/** Sends one probe request through a candidate server without saving it. */
		test: "proxy:test"
	},
	window: {
		minimize: "window:minimize",
		maximizeToggle: "window:maximizeToggle",
		close: "window:close",
		isMaximized: "window:isMaximized",
		onMaximizedChange: "window:onMaximizedChange",
		/** Whether the main window is the active window, so the glass chrome can follow it. */
		isFocused: "window:isFocused",
		onFocusChange: "window:onFocusChange"
	},
	/** Same shape as `window`, but scoped to the standalone remote session window. */
	remoteSessionWindow: {
		minimize: "remoteSessionWindow:minimize",
		maximizeToggle: "remoteSessionWindow:maximizeToggle",
		close: "remoteSessionWindow:close",
		isMaximized: "remoteSessionWindow:isMaximized",
		onMaximizedChange: "remoteSessionWindow:onMaximizedChange"
	},
	remote: {
		getState: "remote:getState",
		listInterfaces: "remote:listInterfaces",
		startHost: "remote:startHost",
		stopHost: "remote:stopHost",
		generatePairingCode: "remote:generatePairingCode",
		connect: "remote:connect",
		/** Same as `connect`, but the resulting session skips capture/WebRTC entirely: file transfer and file-manager browsing only. */
		connectFiles: "remote:connectFiles",
		disconnect: "remote:disconnect",
		listSavedServers: "remote:listSavedServers",
		connectSaved: "remote:connectSaved",
		connectSavedFiles: "remote:connectSavedFiles",
		renameSavedServer: "remote:renameSavedServer",
		removeSavedServer: "remote:removeSavedServer",
		/** Opens (or focuses) the standalone, resizable session window. */
		openSessionWindow: "remote:openSessionWindow",
		sendInput: "remote:sendInput",
		hostTile: "remote:hostTile",
		setScreenInfo: "remote:setScreenInfo",
		/** Controller role: reports the video display box's physical-pixel size, debounced on resize. */
		setDisplaySize: "remote:setDisplaySize",
		sendClipboard: "remote:sendClipboard",
		sendFile: "remote:sendFile",
		getFileProgress: "remote:getFileProgress",
		fmRoots: "remote:fmRoots",
		fmList: "remote:fmList",
		fmMkdir: "remote:fmMkdir",
		fmDelete: "remote:fmDelete",
		fmRename: "remote:fmRename",
		fmUploadTo: "remote:fmUploadTo",
		fmDownload: "remote:fmDownload",
		rtcSignal: "remote:rtcSignal",
		rtcPeerState: "remote:rtcPeerState",
		/** Controller role: renderer -> main -> host, WebRTC signaling. */
		clientRtcSignal: "remote:clientRtcSignal",
		/** Host role: an input event that arrived over the input DataChannel. */
		rtcInput: "remote:rtcInput",
		/** Host role: renderer asks main to start/stop sampling the OS cursor. */
		setCursorTracking: "remote:setCursorTracking",
		/** Benchmarking: main-process CPU/memory sample. */
		benchSample: "remote:benchSample",
		onState: "remote:onState",
		onRtcSignal: "remote:onRtcSignal",
		onRtcPeerGone: "remote:onRtcPeerGone",
		/** Controller role: WebRTC signaling arriving from the host. */
		onClientRtcSignal: "remote:onClientRtcSignal",
		/** Host role: sampled OS cursor position, for the cursor DataChannel. */
		onHostCursor: "remote:onHostCursor",
		onCaptureRefresh: "remote:onCaptureRefresh",
		onTileDemand: "remote:onTileDemand",
		onCaptureStart: "remote:onCaptureStart",
		onCaptureStop: "remote:onCaptureStop",
		onFrameTile: "remote:onFrameTile",
		onScreenInfo: "remote:onScreenInfo",
		/** Host role: a connected peer reported (or updated) its display box size. */
		onPeerDisplaySize: "remote:onPeerDisplaySize",
		onFileProgress: "remote:onFileProgress",
		onLog: "remote:onLog"
	},
	security: {
		preflight: "security:preflight",
		runScan: "security:runScan",
		cancelScan: "security:cancelScan",
		activeScan: "security:activeScan",
		history: "security:history",
		getScan: "security:getScan",
		latest: "security:latest",
		deleteScan: "security:deleteScan",
		getConfig: "security:getConfig",
		setConfig: "security:setConfig",
		suggestCodeqlLanguage: "security:suggestCodeqlLanguage",
		codeqlStatus: "security:codeqlStatus",
		installCodeql: "security:installCodeql",
		cancelCodeqlInstall: "security:cancelCodeqlInstall",
		removeCodeql: "security:removeCodeql",
		openCodeqlFolder: "security:openCodeqlFolder",
		onCodeqlProgress: "security:onCodeqlProgress",
		onScanProgress: "security:onScanProgress"
	},
	tools: {
		detectAll: "tools:detectAll",
		getInstallCommand: "tools:getInstallCommand",
		checkForUpdate: "tools:checkForUpdate",
		getUpdateCommand: "tools:getUpdateCommand",
		getUninstallCommand: "tools:getUninstallCommand",
		getInteractiveLaunchCommand: "tools:getInteractiveLaunchCommand",
		getDockerCommand: "tools:getDockerCommand"
	},
	docker: {
		availability: "docker:availability",
		list: "docker:list",
		listForProject: "docker:listForProject",
		start: "docker:start",
		stop: "docker:stop",
		restart: "docker:restart",
		remove: "docker:remove"
	},
	/** The Android page: the SDK behind it, AVDs, emulators and adb devices. */
	android: {
		sdk: "android:sdk",
		setSdkPath: "android:setSdkPath",
		pickSdkPath: "android:pickSdkPath",
		refresh: "android:refresh",
		start: "android:start",
		stop: "android:stop",
		cancelBoot: "android:cancelBoot",
		watchUsage: "android:watchUsage",
		rotate: "android:rotate",
		screenshot: "android:screenshot",
		startRecording: "android:startRecording",
		stopRecording: "android:stopRecording",
		installApk: "android:installApk",
		pickApk: "android:pickApk",
		adbPath: "android:adbPath",
		revealCapture: "android:revealCapture",
		openCapturesFolder: "android:openCapturesFolder",
		createAvd: "android:createAvd",
		deleteAvd: "android:deleteAvd",
		editAvd: "android:editAvd",
		avdConfig: "android:avdConfig",
		wipeData: "android:wipeData",
		listSystemImages: "android:listSystemImages",
		availableSystemImages: "android:availableSystemImages",
		installSystemImage: "android:installSystemImage",
		listDeviceProfiles: "android:listDeviceProfiles",
		pair: "android:pair",
		connect: "android:connect",
		disconnect: "android:disconnect",
		enableWireless: "android:enableWireless",
		/** main -> every renderer: device list, emulator state, usage and SDK changes. */
		onEvent: "android:event"
	},
	usage: {
		list: "usage:list",
		get: "usage:get",
		refresh: "usage:refresh",
		setProviderConfig: "usage:setProviderConfig",
		listWidgets: "usage:listWidgets",
		getWidget: "usage:getWidget",
		openWidget: "usage:openWidget",
		closeWidget: "usage:closeWidget",
		setWidgetStyle: "usage:setWidgetStyle",
		setWidgetSize: "usage:setWidgetSize",
		setWidgetMode: "usage:setWidgetMode",
		configureWidget: "usage:configureWidget",
		setResetAlerts: "usage:setResetAlerts",
		testResetAlert: "usage:testResetAlert",
		setThresholdAlerts: "usage:setThresholdAlerts",
		testThresholdAlert: "usage:testThresholdAlert",
		onThresholdAlert: "usage:onThresholdAlert",
		onWidgetUpdated: "usage:widgetUpdated"
	},
	pet: {
		setClickThrough: "pet:setClickThrough",
		/**
		* app -> main: a native drag started (or ended) in the app window, so the
		* companion overlay has to step out of the way until it is over.
		*/
		setDragGuard: "pet:setDragGuard",
		getWorkArea: "pet:getWorkArea",
		onDisplayChanged: "pet:displayChanged",
		onSettingsChanged: "pet:settingsChanged",
		onPipelineMessage: "pet:pipelineMessage",
		importCustom: "pet:importCustom",
		removeCustom: "pet:removeCustom",
		customDataUrls: "pet:customDataUrls",
		/** Hide the companion for N minutes; it comes back on its own. */
		snooze: "pet:snooze",
		cancelSnooze: "pet:cancelSnooze",
		getSnooze: "pet:getSnooze",
		/** main -> every renderer: the hide started, was cancelled, or ran out. */
		onSnoozeChanged: "pet:snoozeChanged",
		/**
		* Brings the app window back to the front. Takes an optional route, so the
		* failure the pet just announced can open on the Pipelines page.
		*/
		showMainWindow: "pet:showMainWindow"
	},
	/** The workspace Tests panel: discover a project's tests, run them, and follow the run. */
	tests: {
		discover: "tests:discover",
		run: "tests:run",
		cancel: "tests:cancel",
		lastRun: "tests:lastRun",
		command: "tests:command",
		/** main -> every renderer: TestRunEvent as a run starts, prints, reports results and ends. */
		onRunEvent: "tests:onRunEvent"
	},
	pipelines: {
		status: "pipelines:status",
		setMuted: "pipelines:setMuted",
		dashboardActivity: "pipelines:dashboardActivity",
		runError: "pipelines:runError",
		runAnnotations: "pipelines:runAnnotations",
		refs: "pipelines:refs",
		dispatch: "pipelines:dispatch",
		cancelRun: "pipelines:cancelRun",
		runners: "pipelines:runners"
	},
	/** The Deploy section: saved servers, installing the server core, and its health. */
	deploy: {
		listServers: "deploy:listServers",
		preflight: "deploy:preflight",
		install: "deploy:install",
		uninstall: "deploy:uninstall",
		health: "deploy:health",
		access: "deploy:access",
		enroll: "deploy:enroll",
		signIn: "deploy:signIn",
		signOut: "deploy:signOut",
		account: "deploy:account",
		stepUp: "deploy:stepUp",
		beginTotp: "deploy:beginTotp",
		confirmTotp: "deploy:confirmTotp",
		disableTotp: "deploy:disableTotp",
		onSetupProgress: "deploy:onSetupProgress",
		/** (serverId) -> DeployConnection: the server's lasting connection right now. */
		connection: "deploy:connection",
		/** (serverId) -> DeployConnection: tries the connection again now, whatever it waited for. */
		reconnect: "deploy:reconnect",
		/** main -> the main window: DeployConnection, whenever a server's connection changes. */
		onConnection: "deploy:onConnection"
	},
	/** The Deploy section's Overview: a server's facts, live metrics, updates, reboot and restarts. */
	deploySystem: {
		info: "deploySystem:info",
		services: "deploySystem:services",
		metricsHistory: "deploySystem:metricsHistory",
		updates: "deploySystem:updates",
		checkUpdates: "deploySystem:checkUpdates",
		upgradeSecurity: "deploySystem:upgradeSecurity",
		upgradeAll: "deploySystem:upgradeAll",
		setAutomaticUpdates: "deploySystem:setAutomaticUpdates",
		reboot: "deploySystem:reboot",
		restartService: "deploySystem:restartService",
		/** (DeployMetricsWatchInput) -> subscription id; samples arrive on onMetrics. */
		watchMetrics: "deploySystem:watchMetrics",
		unwatchMetrics: "deploySystem:unwatchMetrics",
		/** main -> the window that asked: DeployMetricsEvent, a batch of live samples. */
		onMetrics: "deploySystem:onMetrics"
	},
	/** The jobs a server core runs (updates, reboots, restarts) and their live logs. */
	deployJobs: {
		list: "deployJobs:list",
		get: "deployJobs:get",
		cancel: "deployJobs:cancel",
		/** (DeployJobWatchInput) -> subscription id; the log arrives on onLog. */
		watch: "deployJobs:watch",
		unwatch: "deployJobs:unwatch",
		/** main -> the window that asked: DeployJobEvent, new log lines and the job's state. */
		onLog: "deployJobs:onLog"
	},
	/** A server core's alerts: disk pressure, failed jobs, a reboot waiting. */
	deployAlerts: {
		list: "deployAlerts:list",
		acknowledge: "deployAlerts:acknowledge",
		/** (serverId) -> subscription id; the open alerts, then changes, arrive on onChanged. */
		watch: "deployAlerts:watch",
		unwatch: "deployAlerts:unwatch",
		/** main -> the window that asked: DeployAlertsEvent, alerts in revision order. */
		onChanged: "deployAlerts:onChanged"
	},
	/** A server's websites (E10): nginx itself, sites, stream proxies, applying, and site logs. */
	deploySites: {
		status: "deploySites:status",
		list: "deploySites:list",
		listStreams: "deploySites:listStreams",
		install: "deploySites:install",
		save: "deploySites:save",
		remove: "deploySites:remove",
		saveStream: "deploySites:saveStream",
		removeStream: "deploySites:removeStream",
		apply: "deploySites:apply",
		setSnippets: "deploySites:setSnippets",
		/** (DeploySiteLogWatchInput) -> subscription id; lines arrive on onLog. */
		watchLog: "deploySites:watchLog",
		unwatchLog: "deploySites:unwatchLog",
		/** main -> the window that asked: DeploySiteLogEvent, new lines of a site's log. */
		onLog: "deploySites:onLog"
	},
	/** A server's certificates (E11): Let's Encrypt orders and renewals, uploads and removal. */
	deployCerts: {
		list: "deployCerts:list",
		issue: "deployCerts:issue",
		renew: "deployCerts:renew",
		upload: "deployCerts:upload",
		remove: "deployCerts:remove"
	},
	/**
	* A server's host firewall (E13): status, presets, change history and exposure for every role;
	* preview, apply (safe apply: confirm over a new SSH connection, or it rolls back) for Admins.
	*/
	deployFirewall: {
		status: "deployFirewall:status",
		presets: "deployFirewall:presets",
		history: "deployFirewall:history",
		exposure: "deployFirewall:exposure",
		preview: "deployFirewall:preview",
		apply: "deployFirewall:apply",
		/** (DeployFirewallDecisionInput) -> the change kept, confirmed over a new SSH connection. */
		confirm: "deployFirewall:confirm",
		revert: "deployFirewall:revert",
		/** main -> the main window: DeployFirewallProgressEvent, each step of apply/confirm/revert. */
		onProgress: "deployFirewall:onProgress"
	},
	/**
	* Direct TLS (E16): the core's opt-in HTTPS port with mutual TLS. Reads and changes go over SSH
	* only, which is where the pin comes from; the firewall rule goes through deployFirewall.
	*/
	deployDirectTls: {
		/** (serverId) -> DeployDirectTlsInfo: the core's account, the pin kept here, and whether it changed. */
		status: "deployDirectTls:status",
		/** (DeployDirectTlsEnableInput) -> DeployDirectTlsInfo; Owner, may need a step-up. */
		enable: "deployDirectTls:enable",
		/** (serverId) -> DeployDirectTlsInfo, after this computer stopped using the port. */
		disable: "deployDirectTls:disable",
		/** (serverId) -> DeployDirectTlsInfo, with the key the core presents now pinned. */
		acceptPin: "deployDirectTls:acceptPin"
	},
	/**
	* Docker on a server (E06): the engine and its install, containers and their lifecycle, live
	* stats, logs and engine events, a console, and images, volumes, networks and disk use.
	*/
	deployDocker: {
		status: "deployDocker:status",
		install: "deployDocker:install",
		listContainers: "deployDocker:listContainers",
		inspect: "deployDocker:inspect",
		/** Admins, after a step-up: the container's environment values. */
		revealEnv: "deployDocker:revealEnv",
		act: "deployDocker:act",
		remove: "deployDocker:remove",
		/** The last lines of a container's log, collected once. */
		logTail: "deployDocker:logTail",
		listImages: "deployDocker:listImages",
		pullImage: "deployDocker:pullImage",
		removeImage: "deployDocker:removeImage",
		listVolumes: "deployDocker:listVolumes",
		removeVolume: "deployDocker:removeVolume",
		listNetworks: "deployDocker:listNetworks",
		removeNetwork: "deployDocker:removeNetwork",
		diskUsage: "deployDocker:diskUsage",
		prune: "deployDocker:prune",
		/** (serverId) -> subscription id; every running container's stats arrive on onStats. */
		watchStats: "deployDocker:watchStats",
		unwatchStats: "deployDocker:unwatchStats",
		onStats: "deployDocker:onStats",
		/** (DeployContainerLogsWatchInput) -> subscription id; lines arrive on onLogs. */
		watchLogs: "deployDocker:watchLogs",
		unwatchLogs: "deployDocker:unwatchLogs",
		onLogs: "deployDocker:onLogs",
		/** (serverId) -> subscription id; engine events arrive on onEvents. */
		watchEvents: "deployDocker:watchEvents",
		unwatchEvents: "deployDocker:unwatchEvents",
		onEvents: "deployDocker:onEvents",
		/** (DeployConsoleOpenInput) -> subscription id; the screen arrives on onConsole. */
		openConsole: "deployDocker:openConsole",
		/** (subscription id, keystrokes) */
		consoleInput: "deployDocker:consoleInput",
		/** (subscription id, columns, rows) */
		consoleResize: "deployDocker:consoleResize",
		closeConsole: "deployDocker:closeConsole",
		onConsole: "deployDocker:onConsole"
	},
	/**
	* A server's Apps (E07): compose stacks from a project's compose file and environment. Env
	* values stay in the main process; the renderer sees keys only.
	*/
	deployStacks: {
		/** (projectId) -> DeployComposeDiscovery, the compose files in the project. */
		discover: "deployStacks:discover",
		/** (DeployStackPreviewInput) -> DeployStackPreview: services, exposure, risks, env keys. */
		preview: "deployStacks:preview",
		list: "deployStacks:list",
		get: "deployStacks:get",
		files: "deployStacks:files",
		/** (DeployStackCreateInput) -> DeployStackUploadResult: the app and its first revision. */
		create: "deployStacks:create",
		/** (DeployStackRevisionInput) -> DeployStackUploadResult: a new revision of an app. */
		upload: "deployStacks:upload",
		acknowledge: "deployStacks:acknowledge",
		deploy: "deployStacks:deploy",
		rollback: "deployStacks:rollback",
		action: "deployStacks:action",
		delete: "deployStacks:delete",
		/** (DeployMakePrivateInput) -> DeployRevisionResult: services moved to 127.0.0.1 (E13). */
		makePrivate: "deployStacks:makePrivate",
		/** main -> renderer: DeployStackUploadProgress while files go up. */
		onUploadProgress: "deployStacks:onUploadProgress"
	},
	/**
	* A server's App Store (E12): an app installed from the catalog, its update to newer images and
	* its generated passwords revealed (Admins, after a step-up). The main process renders the
	* files itself from what was picked.
	*/
	deployAppStore: {
		/** (DeployAppInstallInput) -> DeployAppInstallResult: the app, its revision and deploy job. */
		install: "deployAppStore:install",
		/** (DeployAppUpdateInput) -> DeployRevisionResult: a copy of the live revision on newer images. */
		update: "deployAppStore:update",
		/** (DeployAppRevealInput) -> the app's .env as a map of key to value. */
		revealSecrets: "deployAppStore:revealSecrets"
	},
	/**
	* Private registries (E08): sign-ins kept on this computer (GitHub packages token, the gh
	* sign-in behind a warning, Docker Hub, custom registries), each app's choice to send them with
	* its deploys, and the write-only credentials stored on a server. No channel returns a secret.
	*/
	deployRegistry: {
		list: "deployRegistry:list",
		/** (token) -> DeployGithubTokenCheck: what GitHub says the token can do. Nothing is saved. */
		checkGithubToken: "deployRegistry:checkGithubToken",
		saveGithubToken: "deployRegistry:saveGithubToken",
		githubCliStatus: "deployRegistry:githubCliStatus",
		saveGithubCli: "deployRegistry:saveGithubCli",
		saveCredential: "deployRegistry:saveCredential",
		remove: "deployRegistry:remove",
		/** (DeployAppRegistryChoice) -> void */
		setAppChoice: "deployRegistry:setAppChoice",
		/** ({ serverId, stackId?, revision?, images? }) -> DeployRegistryPlan */
		plan: "deployRegistry:plan",
		serverList: "deployRegistry:serverList",
		serverSave: "deployRegistry:serverSave",
		serverRemove: "deployRegistry:serverRemove"
	},
	/**
	* A server core's Security area: users and roles (Owner), devices and sessions, enrollment
	* codes (made by an Owner, redeemed on another computer) and the audit trail.
	*/
	/**
	* The Deploy AI (E09): one run per server on the SSH AI's loop, with the server core as its
	* shell. Progress and live output go to the main window.
	*/
	deployAssistant: {
		/** (DeployAssistantStartInput) -> void */
		start: "deployAssistant:start",
		approve: "deployAssistant:approve",
		skip: "deployAssistant:skip",
		answer: "deployAssistant:answer",
		resume: "deployAssistant:resume",
		stop: "deployAssistant:stop",
		/** (serverId) -> DeployAssistantState */
		state: "deployAssistant:state",
		/** (serverId) -> AssistantModeInfo */
		getMode: "deployAssistant:getMode",
		/** (DeployAssistantModeInput) -> AssistantModeInfo; turning auto-run on needs a step-up. */
		setMode: "deployAssistant:setMode",
		/** main -> renderer: DeployAssistantProgressEvent */
		onProgress: "deployAssistant:onProgress",
		/** main -> renderer: DeployAssistantOutputEvent */
		onOutput: "deployAssistant:onOutput"
	},
	/** The logs center (E09): a systemd unit's journal; the other sources have channels already. */
	deployLogs: {
		/** (DeployJournalWatchInput) -> subscription id; lines arrive on onJournal. */
		watchJournal: "deployLogs:watchJournal",
		unwatchJournal: "deployLogs:unwatchJournal",
		/** main -> the window that asked: DeployJournalEvent */
		onJournal: "deployLogs:onJournal"
	},
	deploySecurity: {
		listUsers: "deploySecurity:listUsers",
		createUser: "deploySecurity:createUser",
		setUserRole: "deploySecurity:setUserRole",
		setUserDisabled: "deploySecurity:setUserDisabled",
		resetUserPassword: "deploySecurity:resetUserPassword",
		deleteUser: "deploySecurity:deleteUser",
		createEnrollmentCode: "deploySecurity:createEnrollmentCode",
		redeemEnrollmentCode: "deploySecurity:redeemEnrollmentCode",
		listDevices: "deploySecurity:listDevices",
		revokeDevice: "deploySecurity:revokeDevice",
		listSessions: "deploySecurity:listSessions",
		revokeSession: "deploySecurity:revokeSession",
		revokeOtherSessions: "deploySecurity:revokeOtherSessions",
		queryAudit: "deploySecurity:queryAudit",
		verifyAudit: "deploySecurity:verifyAudit",
		exportAudit: "deploySecurity:exportAudit"
	},
	/** The Security center (E15): the checklist, its SSH fixes, backups and restores. */
	deployHardening: {
		checklist: "deployHardening:checklist",
		previewSsh: "deployHardening:previewSsh",
		applySsh: "deployHardening:applySsh",
		confirmSsh: "deployHardening:confirmSsh",
		revertSsh: "deployHardening:revertSsh",
		/** main -> the main window: the steps of an SSH change. */
		onSshProgress: "deployHardening:onSshProgress",
		createBackup: "deployHardening:createBackup",
		pickBackup: "deployHardening:pickBackup",
		restore: "deployHardening:restore",
		/** main -> the main window: the steps of a restore. */
		onRestoreProgress: "deployHardening:onRestoreProgress"
	},
	/**
	* WordPress sites connected through the AgentMate Connector plugin (E19 to E21): connecting
	* with a key, the site's items and deploy history, and pulling and deploying WordPress projects.
	*/
	deployWordPress: {
		listSites: "deployWordPress:listSites",
		connect: "deployWordPress:connect",
		disconnect: "deployWordPress:disconnect",
		updateSettings: "deployWordPress:updateSettings",
		siteInfo: "deployWordPress:siteInfo",
		listItems: "deployWordPress:listItems",
		history: "deployWordPress:history",
		rollback: "deployWordPress:rollback",
		audit: "deployWordPress:audit",
		planPull: "deployWordPress:planPull",
		pull: "deployWordPress:pull",
		planDeploy: "deployWordPress:planDeploy",
		deploy: "deployWordPress:deploy",
		cancel: "deployWordPress:cancel",
		createProject: "deployWordPress:createProject",
		setProjectItems: "deployWordPress:setProjectItems",
		unlinkProject: "deployWordPress:unlinkProject",
		localChanges: "deployWordPress:localChanges",
		remoteFile: "deployWordPress:remoteFile",
		saveConnectorZip: "deployWordPress:saveConnectorZip",
		/** main -> the main window: the steps of a pull, deploy, rollback or new project. */
		onProgress: "deployWordPress:onProgress"
	},
	/** The Deploy section's Cloudflare page: the API token, zones, DNS, settings and rules. */
	cloudflare: {
		status: "cloudflare:status",
		saveToken: "cloudflare:saveToken",
		checkToken: "cloudflare:checkToken",
		removeToken: "cloudflare:removeToken",
		listZones: "cloudflare:listZones",
		listRecords: "cloudflare:listRecords",
		createRecord: "cloudflare:createRecord",
		updateRecord: "cloudflare:updateRecord",
		deleteRecord: "cloudflare:deleteRecord",
		zoneSettings: "cloudflare:zoneSettings",
		changeSetting: "cloudflare:changeSetting",
		purgeCache: "cloudflare:purgeCache",
		listCustomRules: "cloudflare:listCustomRules",
		createCustomRule: "cloudflare:createCustomRule",
		setCustomRuleEnabled: "cloudflare:setCustomRuleEnabled",
		deleteCustomRule: "cloudflare:deleteCustomRule",
		listAccessRules: "cloudflare:listAccessRules",
		createAccessRule: "cloudflare:createAccessRule",
		deleteAccessRule: "cloudflare:deleteAccessRule",
		planPointDomain: "cloudflare:planPointDomain",
		pointDomain: "cloudflare:pointDomain"
	},
	/** Cloudflare work on one server (E14): origin lock, Origin CA certificates, DNS-01 tokens. */
	cloudflareServer: {
		originLock: "cloudflareServer:originLock",
		previewOriginLock: "cloudflareServer:previewOriginLock",
		applyOriginLock: "cloudflareServer:applyOriginLock",
		originCertificate: "cloudflareServer:originCertificate",
		dnsTokens: "cloudflareServer:dnsTokens",
		provisionDnsToken: "cloudflareServer:provisionDnsToken",
		removeDnsToken: "cloudflareServer:removeDnsToken"
	},
	/** The workspace Pull request tab: the current branch's PR, its checks, review and merge. */
	pullRequests: {
		status: "pullRequests:status",
		suggestText: "pullRequests:suggestText",
		comment: "pullRequests:comment",
		replyThread: "pullRequests:replyThread",
		resolveThread: "pullRequests:resolveThread",
		markReady: "pullRequests:markReady",
		merge: "pullRequests:merge",
		cleanup: "pullRequests:cleanup",
		localReview: "pullRequests:localReview",
		/** Stops a suggestText or localReview run by its request id. */
		cancelAi: "pullRequests:cancelAi"
	},
	/**
	* The in-app notification inbox. Distinct from the `notifications` group above,
	* which is about sending a notification out (Telegram, the desktop companion).
	*/
	appNotifications: {
		list: "appNotifications:list",
		markRead: "appNotifications:markRead",
		markAllRead: "appNotifications:markAllRead",
		remove: "appNotifications:remove",
		unreadCount: "appNotifications:unreadCount",
		/** main -> every renderer: something was added to or changed in the inbox. */
		onChanged: "appNotifications:onChanged"
	},
	/** Git worktrees: a folder and branch per task, each with a workspace of its own. */
	worktrees: {
		list: "worktrees:list",
		defaults: "worktrees:defaults",
		suggestPath: "worktrees:suggestPath",
		create: "worktrees:create",
		previewCopy: "worktrees:previewCopy",
		copyFiles: "worktrees:copyFiles",
		removePreflight: "worktrees:removePreflight",
		remove: "worktrees:remove",
		mergePreflight: "worktrees:mergePreflight",
		merge: "worktrees:merge",
		mergeBaseIn: "worktrees:mergeBaseIn",
		prune: "worktrees:prune",
		suggestBranch: "worktrees:suggestBranch",
		cancelSuggestBranch: "worktrees:cancelSuggestBranch",
		pickLocation: "worktrees:pickLocation",
		/** main -> every renderer: a project's worktrees were added, removed or changed. */
		onChanged: "worktrees:onChanged"
	},
	git: {
		status: "git:status",
		listFiles: "git:listFiles",
		changeSummary: "git:changeSummary",
		fetch: "git:fetch",
		pull: "git:pull",
		push: "git:push",
		sync: "git:sync",
		createBranch: "git:createBranch",
		checkoutBranch: "git:checkoutBranch",
		setDefaultBranch: "git:setDefaultBranch",
		renameBranch: "git:renameBranch",
		deleteBranch: "git:deleteBranch",
		branchHistory: "git:branchHistory",
		commit: "git:commit",
		tags: "git:tags",
		createTag: "git:createTag",
		suggestTag: "git:suggestTag",
		cancelSuggestTag: "git:cancelSuggestTag",
		applyVersion: "git:applyVersion",
		cancelApplyVersion: "git:cancelApplyVersion",
		swapVersionFile: "git:swapVersionFile",
		writeVersionHunks: "git:writeVersionHunks",
		suggestBranchName: "git:suggestBranchName",
		cancelSuggestBranchName: "git:cancelSuggestBranchName",
		suggestCommitMessage: "git:suggestCommitMessage",
		cancelSuggestCommitMessage: "git:cancelSuggestCommitMessage",
		createPullRequest: "git:createPullRequest",
		init: "git:init",
		githubAccount: "git:githubAccount",
		githubActivity: "git:githubActivity",
		githubNotifications: "git:githubNotifications",
		githubMarkNotificationRead: "git:githubMarkNotificationRead",
		githubMarkNotificationsRead: "git:githubMarkNotificationsRead",
		lookupGithubRepo: "git:lookupGithubRepo",
		createGithubRepo: "git:createGithubRepo",
		connectRemote: "git:connectRemote",
		detectRemote: "git:detectRemote",
		cloneInto: "git:cloneInto",
		watchRepo: "git:watchRepo",
		unwatchRepo: "git:unwatchRepo",
		onRepoChanged: "git:onRepoChanged",
		workspaceState: "git:workspaceState",
		watchWorkingTree: "git:watchWorkingTree",
		unwatchWorkingTree: "git:unwatchWorkingTree",
		stage: "git:stage",
		unstage: "git:unstage",
		discard: "git:discard",
		undoDiscard: "git:undoDiscard",
		applyLines: "git:applyLines",
		resolveConflict: "git:resolveConflict",
		resolveConflictWithAi: "git:resolveConflictWithAi",
		cancelResolveConflictWithAi: "git:cancelResolveConflictWithAi",
		abortOperation: "git:abortOperation",
		commitStaged: "git:commitStaged",
		fileDiff: "git:fileDiff",
		writeWorkingFile: "git:writeWorkingFile",
		commitFiles: "git:commitFiles",
		commitFileDiff: "git:commitFileDiff",
		fileImage: "git:fileImage",
		commitFileImage: "git:commitFileImage",
		onWorkspaceState: "git:onWorkspaceState"
	},
	terminalClipboard: {
		saveImage: "terminalClipboard:saveImage",
		read: "terminalClipboard:read",
		previewImage: "terminalClipboard:previewImage"
	},
	browser: {
		/** (webContentsId, rect, viewport) -> BrowserElementShot | null: a crop of a picked element. */
		captureElement: "browser:captureElement",
		/** main -> renderer: a browser key pressed while a page had focus (BrowserGuestShortcut). */
		onGuestShortcut: "browser:guestShortcut",
		/** main -> renderer: a page asked for a new window (BrowserOpenInNewTab). */
		onOpenInNewTab: "browser:openInNewTab"
	},
	power: {
		keepAwakeStatus: "power:keepAwakeStatus",
		setKeepAwake: "power:setKeepAwake",
		onKeepAwake: "power:onKeepAwake"
	},
	agents: {
		sync: "agents:sync",
		setViewing: "agents:setViewing",
		acknowledge: "agents:acknowledge",
		list: "agents:list",
		statusHookSettings: "agents:statusHookSettings",
		runInfos: "agents:runInfos",
		lastRunInfoByCli: "agents:lastRunInfoByCli",
		history: "agents:history",
		onRunInfo: "agents:onRunInfo",
		onStatus: "agents:onStatus",
		autoContinuePending: "agents:autoContinuePending",
		cancelAutoContinue: "agents:cancelAutoContinue",
		onAutoContinue: "agents:onAutoContinue"
	},
	apiClient: {
		listCollections: "apiClient:listCollections",
		getCollection: "apiClient:getCollection",
		createCollection: "apiClient:createCollection",
		renameCollection: "apiClient:renameCollection",
		removeCollection: "apiClient:removeCollection",
		saveRequest: "apiClient:saveRequest",
		createFolder: "apiClient:createFolder",
		removeItem: "apiClient:removeItem",
		execute: "apiClient:execute",
		cancel: "apiClient:cancel"
	},
	packages: {
		list: "packages:list",
		update: "packages:update",
		onUpdateProgress: "packages:onUpdateProgress"
	}
};
//#endregion
//#region src/preload/cloudflareServer.ts
/**
* Cloudflare work on one server (E14): the origin lock, Origin CA certificates and the DNS
* tokens a server keeps for DNS-01. The account token never crosses here; a pasted DNS token
* goes in once and never comes back.
*/
var cloudflareServer = {
	originLock: (serverId) => electron.ipcRenderer.invoke(IPC.cloudflareServer.originLock, serverId),
	/** The firewall change the lock needs and how the server's domains stand in Cloudflare. */
	previewOriginLock: (input) => electron.ipcRenderer.invoke(IPC.cloudflareServer.previewOriginLock, input),
	/** Applies it; the firewall change then waits for its confirmation in the Firewall section. */
	applyOriginLock: (input) => electron.ipcRenderer.invoke(IPC.cloudflareServer.applyOriginLock, input),
	originCertificate: (input) => electron.ipcRenderer.invoke(IPC.cloudflareServer.originCertificate, input),
	dnsTokens: (serverId) => electron.ipcRenderer.invoke(IPC.cloudflareServer.dnsTokens, serverId),
	provisionDnsToken: (input) => electron.ipcRenderer.invoke(IPC.cloudflareServer.provisionDnsToken, input),
	removeDnsToken: (input) => electron.ipcRenderer.invoke(IPC.cloudflareServer.removeDnsToken, input)
};
//#endregion
//#region src/preload/deployAssistant.ts
/**
* The Deploy AI (E09), one run per server. Admins only: anyone else gets `[core:forbidden]`.
* Turning auto-run diagnostics on needs a step-up (`[core:stepUpRequired]` without one).
*/
function createDeployAssistant(subscribe) {
	return {
		start: (input) => electron.ipcRenderer.invoke(IPC.deployAssistant.start, input),
		/** Runs the proposed command, with an approval this computer signs for exactly that text. */
		approve: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.approve, serverId),
		skip: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.skip, serverId),
		answer: (serverId, answer) => electron.ipcRenderer.invoke(IPC.deployAssistant.answer, serverId, answer),
		/** Picks a paused run back up. */
		resume: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.resume, serverId),
		stop: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.stop, serverId),
		state: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.state, serverId),
		getMode: (serverId) => electron.ipcRenderer.invoke(IPC.deployAssistant.getMode, serverId),
		setMode: (input) => electron.ipcRenderer.invoke(IPC.deployAssistant.setMode, input),
		onProgress: (cb) => subscribe(IPC.deployAssistant.onProgress, cb),
		onOutput: (cb) => subscribe(IPC.deployAssistant.onOutput, cb)
	};
}
/** The logs center's journald source (E09); containers, stacks and sites use their own groups. */
function createDeployLogs(subscribe) {
	return {
		watchJournal: (input) => electron.ipcRenderer.invoke(IPC.deployLogs.watchJournal, input),
		unwatchJournal: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployLogs.unwatchJournal, subscriptionId),
		onJournal: (cb) => subscribe(IPC.deployLogs.onJournal, cb)
	};
}
//#endregion
//#region src/preload/deployDirectTls.ts
/**
* Direct TLS (E16), for the server's Security section. Turning it on may need a step-up
* (`[core:stepUpRequired]`): pass the password or a code, as the Firewall does. A role below
* Owner comes back as `[core:forbidden]`.
*/
function createDeployDirectTls() {
	return {
		status: (serverId) => electron.ipcRenderer.invoke(IPC.deployDirectTls.status, serverId),
		enable: (input) => electron.ipcRenderer.invoke(IPC.deployDirectTls.enable, input),
		disable: (serverId) => electron.ipcRenderer.invoke(IPC.deployDirectTls.disable, serverId),
		acceptPin: (serverId) => electron.ipcRenderer.invoke(IPC.deployDirectTls.acceptPin, serverId)
	};
}
//#endregion
//#region src/preload/deployDocker.ts
/**
* Docker on a server (E06), for the Containers screen. Lifecycle calls answer with the
* container as it is afterwards; a missing role comes back as `[core:forbidden]`, a missing
* step-up (for revealing environment values) as `[core:stepUpRequired]`.
*/
function createDeployDocker(subscribe) {
	return {
		status: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.status, serverId),
		install: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.install, input),
		listContainers: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.listContainers, serverId),
		/** Environment variable names only; revealEnv has the values. */
		inspect: (serverId, containerId) => electron.ipcRenderer.invoke(IPC.deployDocker.inspect, serverId, containerId),
		revealEnv: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.revealEnv, input),
		act: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.act, input),
		remove: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.remove, input),
		logTail: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.logTail, input),
		listImages: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.listImages, serverId),
		/** A job: its log shows the layers as they arrive. */
		pullImage: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.pullImage, input),
		removeImage: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.removeImage, input),
		listVolumes: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.listVolumes, serverId),
		removeVolume: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.removeVolume, input),
		listNetworks: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.listNetworks, serverId),
		removeNetwork: (serverId, network) => electron.ipcRenderer.invoke(IPC.deployDocker.removeNetwork, serverId, network),
		diskUsage: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.diskUsage, serverId),
		prune: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.prune, input),
		/** Every running container's figures, shared by everyone watching the server. */
		watchStats: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.watchStats, serverId),
		unwatchStats: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployDocker.unwatchStats, subscriptionId),
		onStats: (cb) => subscribe(IPC.deployDocker.onStats, cb),
		watchLogs: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.watchLogs, input),
		unwatchLogs: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployDocker.unwatchLogs, subscriptionId),
		onLogs: (cb) => subscribe(IPC.deployDocker.onLogs, cb),
		watchEvents: (serverId) => electron.ipcRenderer.invoke(IPC.deployDocker.watchEvents, serverId),
		unwatchEvents: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployDocker.unwatchEvents, subscriptionId),
		onEvents: (cb) => subscribe(IPC.deployDocker.onEvents, cb),
		openConsole: (input) => electron.ipcRenderer.invoke(IPC.deployDocker.openConsole, input),
		consoleInput: (subscriptionId, data) => electron.ipcRenderer.invoke(IPC.deployDocker.consoleInput, subscriptionId, data),
		consoleResize: (subscriptionId, columns, rows) => electron.ipcRenderer.invoke(IPC.deployDocker.consoleResize, subscriptionId, columns, rows),
		closeConsole: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployDocker.closeConsole, subscriptionId),
		onConsole: (cb) => subscribe(IPC.deployDocker.onConsole, cb)
	};
}
//#endregion
//#region src/preload/deployHardening.ts
/**
* The Security center of a server (E15): the checklist with its score, the SSH fixes (previewed,
* applied over a new key login, then kept over another or reverted), backups saved where the user
* picks, and restores over SSH. A missing role comes back as `[core:forbidden]`; a missing step-up
* as SignalR's "unauthorized", which the step-up hook asks about.
*/
function createDeployHardening(subscribe) {
	return {
		checklist: (serverId) => electron.ipcRenderer.invoke(IPC.deployHardening.checklist, serverId),
		previewSsh: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.previewSsh, input),
		applySsh: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.applySsh, input),
		confirmSsh: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.confirmSsh, input),
		revertSsh: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.revertSsh, input),
		onSshProgress: (callback) => subscribe(IPC.deployHardening.onSshProgress, callback),
		/** Asks where to save first; `saved: false` when that was cancelled. */
		createBackup: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.createBackup, input),
		/** The open dialog; null when cancelled. The file is named by a token from here on. */
		pickBackup: () => electron.ipcRenderer.invoke(IPC.deployHardening.pickBackup),
		restore: (input) => electron.ipcRenderer.invoke(IPC.deployHardening.restore, input),
		onRestoreProgress: (callback) => subscribe(IPC.deployHardening.onRestoreProgress, callback)
	};
}
//#endregion
//#region src/preload/deployRegistry.ts
/**
* Private registries (E08). Secrets only ever go in (a pasted token, a password); nothing here
* returns one. Storing on a server needs an Admin and a step-up, refused as
* `[core:stepUpRequired]` until the call carries the password or a code.
*/
function createDeployRegistry() {
	return {
		list: () => electron.ipcRenderer.invoke(IPC.deployRegistry.list),
		checkGithubToken: (token) => electron.ipcRenderer.invoke(IPC.deployRegistry.checkGithubToken, token),
		saveGithubToken: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.saveGithubToken, input),
		githubCliStatus: () => electron.ipcRenderer.invoke(IPC.deployRegistry.githubCliStatus),
		saveGithubCli: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.saveGithubCli, input),
		saveCredential: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.saveCredential, input),
		remove: (credentialId) => electron.ipcRenderer.invoke(IPC.deployRegistry.remove, credentialId),
		setAppChoice: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.setAppChoice, input),
		plan: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.plan, input),
		serverList: (serverId) => electron.ipcRenderer.invoke(IPC.deployRegistry.serverList, serverId),
		serverSave: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.serverSave, input),
		serverRemove: (input) => electron.ipcRenderer.invoke(IPC.deployRegistry.serverRemove, input)
	};
}
//#endregion
//#region src/preload/deployWordPress.ts
/**
* WordPress sites connected through the AgentMate Connector plugin (E19 to E21). A connection key
* goes in through `connect` and never comes back out. Failures carry a `[wp:code]` tag (see
* shared/wordpressErrors.ts). Long calls take an `operationId` the renderer picks, and report
* their steps on `onProgress` under it.
*/
function createDeployWordPress(subscribe) {
	return {
		listSites: () => electron.ipcRenderer.invoke(IPC.deployWordPress.listSites),
		connect: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.connect, input),
		disconnect: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.disconnect, input),
		updateSettings: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.updateSettings, input),
		siteInfo: (siteId) => electron.ipcRenderer.invoke(IPC.deployWordPress.siteInfo, siteId),
		listItems: (siteId) => electron.ipcRenderer.invoke(IPC.deployWordPress.listItems, siteId),
		history: (siteId) => electron.ipcRenderer.invoke(IPC.deployWordPress.history, siteId),
		rollback: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.rollback, input),
		audit: (query) => electron.ipcRenderer.invoke(IPC.deployWordPress.audit, query),
		planPull: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.planPull, input),
		pull: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.pull, input),
		planDeploy: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.planDeploy, input),
		deploy: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.deploy, input),
		/** Stops a running operation at its next safe point; a deploy already applying rolls back. */
		cancel: (operationId) => electron.ipcRenderer.invoke(IPC.deployWordPress.cancel, operationId),
		createProject: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.createProject, input),
		setProjectItems: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.setProjectItems, input),
		unlinkProject: (projectId) => electron.ipcRenderer.invoke(IPC.deployWordPress.unlinkProject, projectId),
		localChanges: (projectId) => electron.ipcRenderer.invoke(IPC.deployWordPress.localChanges, projectId),
		remoteFile: (input) => electron.ipcRenderer.invoke(IPC.deployWordPress.remoteFile, input),
		/** Asks where to save the bundled plugin zip; `saved: false` when that was cancelled. */
		saveConnectorZip: () => electron.ipcRenderer.invoke(IPC.deployWordPress.saveConnectorZip),
		onProgress: (callback) => subscribe(IPC.deployWordPress.onProgress, callback)
	};
}
//#endregion
//#region src/preload/index.ts
var appInfo = {
	getVersion: () => electron.ipcRenderer.invoke(IPC.app.getVersion),
	checkForUpdates: () => electron.ipcRenderer.invoke(IPC.app.checkForUpdates),
	downloadUpdate: () => electron.ipcRenderer.invoke(IPC.app.downloadUpdate),
	pauseDownload: () => electron.ipcRenderer.invoke(IPC.app.pauseDownload),
	quitAndInstall: () => electron.ipcRenderer.invoke(IPC.app.quitAndInstall),
	onUpdateStatus: (callback) => {
		const listener = (_event, status) => callback(status);
		electron.ipcRenderer.on(IPC.app.onUpdateStatus, listener);
		return () => electron.ipcRenderer.removeListener(IPC.app.onUpdateStatus, listener);
	},
	relaunch: () => electron.ipcRenderer.invoke(IPC.app.relaunch),
	/** A route that arrived while this window was still loading, or null. */
	pendingNavigate: () => electron.ipcRenderer.invoke(IPC.app.pendingNavigate),
	/** Tells main which page this window is on, so the next launch can open there. */
	setLastRoute: (route) => electron.ipcRenderer.send(IPC.app.setLastRoute, route),
	/** main asking the app window to show a route, e.g. after a click on the pet. */
	onNavigate: (callback) => {
		const listener = (_event, route) => callback(route);
		electron.ipcRenderer.on(IPC.app.onNavigate, listener);
		return () => electron.ipcRenderer.removeListener(IPC.app.onNavigate, listener);
	},
	/** main asking whether to close the app while CLIs, SSH or Remote Desktop sessions are open. */
	onConfirmQuit: (callback) => {
		const listener = (_event, summary) => callback(summary);
		electron.ipcRenderer.on(IPC.app.onConfirmQuit, listener);
		return () => electron.ipcRenderer.removeListener(IPC.app.onConfirmQuit, listener);
	},
	answerQuit: (confirmed) => electron.ipcRenderer.invoke(IPC.app.answerQuit, confirmed),
	/** Tells main the first page is on screen, so the splash can hand over to this window. */
	notifyReady: () => electron.ipcRenderer.send(IPC.app.rendererReady)
};
var backup = {
	export: (compress, options = {}) => electron.ipcRenderer.invoke(IPC.backup.export, compress, options),
	/** Picks and checks a backup file. Nothing is restored until `restore` is called. */
	open: () => electron.ipcRenderer.invoke(IPC.backup.open),
	restore: (token, options) => electron.ipcRenderer.invoke(IPC.backup.restore, token, options)
};
var cli = {
	detectAll: (force) => electron.ipcRenderer.invoke(IPC.cli.detectAll, force),
	getInstallCommand: (cliId) => electron.ipcRenderer.invoke(IPC.cli.getInstallCommand, cliId),
	checkForUpdate: (cliId, currentVersion) => electron.ipcRenderer.invoke(IPC.cli.checkForUpdate, cliId, currentVersion),
	getUpdateCommand: (cliId) => electron.ipcRenderer.invoke(IPC.cli.getUpdateCommand, cliId)
};
var terminal = {
	/** Starts a shell, or reconnects to a running one when `sessionId` names it. */
	create: (options = {}) => electron.ipcRenderer.invoke(IPC.terminal.create, options),
	write: (sessionId, data) => electron.ipcRenderer.invoke(IPC.terminal.write, sessionId, data),
	resize: (sessionId, cols, rows) => electron.ipcRenderer.invoke(IPC.terminal.resize, sessionId, cols, rows),
	kill: (sessionId) => electron.ipcRenderer.invoke(IPC.terminal.kill, sessionId),
	/** Every running shell with the CPU and memory its whole process tree is using. */
	usage: () => electron.ipcRenderer.invoke(IPC.terminal.usage),
	/** CPU, memory and listening ports for the given project runs' terminals. */
	runStatus: (sessionIds) => electron.ipcRenderer.invoke(IPC.terminal.runStatus, sessionIds),
	onData: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.terminal.onData, listener);
		return () => electron.ipcRenderer.removeListener(IPC.terminal.onData, listener);
	},
	onExit: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.terminal.onExit, listener);
		return () => electron.ipcRenderer.removeListener(IPC.terminal.onExit, listener);
	}
};
var ssh = {
	listServers: () => electron.ipcRenderer.invoke(IPC.ssh.listServers),
	saveServer: (input) => electron.ipcRenderer.invoke(IPC.ssh.saveServer, input),
	removeServer: (id) => electron.ipcRenderer.invoke(IPC.ssh.removeServer, id),
	pickPrivateKeyFile: () => electron.ipcRenderer.invoke(IPC.ssh.pickPrivateKeyFile),
	vaultStatus: () => electron.ipcRenderer.invoke(IPC.ssh.vaultStatus),
	unlockVault: (passphrase) => electron.ipcRenderer.invoke(IPC.ssh.unlockVault, passphrase),
	setPasskey: (passphrase) => electron.ipcRenderer.invoke(IPC.ssh.setPasskey, passphrase),
	/** The stored and presented host key fingerprints, read with a handshake that never logs in. */
	hostKeyStatus: (serverId) => electron.ipcRenderer.invoke(IPC.ssh.hostKeyStatus, serverId),
	/** Trusts the key the server presents now, provided it is still `fingerprint`. */
	trustHostKey: (serverId, fingerprint) => electron.ipcRenderer.invoke(IPC.ssh.trustHostKey, serverId, fingerprint),
	/**
	* Every supported CLI conversation stored on a saved server, read over SFTP. Rejects
	* with an `sshErrorCode` of 'host-key-changed' or 'vault-locked' when those stand in the way.
	*/
	conversations: (serverId) => electron.ipcRenderer.invoke(IPC.ssh.conversations, serverId),
	/** Starts a shell for a saved server, or reconnects when `sessionId` names one still running. */
	create: (options) => electron.ipcRenderer.invoke(IPC.ssh.create, options),
	write: (sessionId, data) => electron.ipcRenderer.invoke(IPC.ssh.write, sessionId, data),
	resize: (sessionId, cols, rows) => electron.ipcRenderer.invoke(IPC.ssh.resize, sessionId, cols, rows),
	kill: (sessionId) => electron.ipcRenderer.invoke(IPC.ssh.kill, sessionId),
	onData: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.ssh.onData, listener);
		return () => electron.ipcRenderer.removeListener(IPC.ssh.onData, listener);
	},
	onExit: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.ssh.onExit, listener);
		return () => electron.ipcRenderer.removeListener(IPC.ssh.onExit, listener);
	}
};
var sshAgent = {
	/** Starts an AI task in an already-connected SSH session; rejects if one is already running there. */
	start: (input) => electron.ipcRenderer.invoke(IPC.sshAgent.start, input),
	approveCommand: (sessionId) => electron.ipcRenderer.invoke(IPC.sshAgent.approveCommand, sessionId),
	skipCommand: (sessionId) => electron.ipcRenderer.invoke(IPC.sshAgent.skipCommand, sessionId),
	answerNeedsInput: (sessionId, answer) => electron.ipcRenderer.invoke(IPC.sshAgent.answerNeedsInput, sessionId, answer),
	/** True types the server's saved password into the prompt the running command opened. */
	answerPassword: (sessionId, approved) => electron.ipcRenderer.invoke(IPC.sshAgent.answerPassword, sessionId, approved),
	stop: (sessionId) => electron.ipcRenderer.invoke(IPC.sshAgent.stop, sessionId),
	/** Picks a run that paused on an error back up where it left off. */
	continueTask: (sessionId) => electron.ipcRenderer.invoke(IPC.sshAgent.continue, sessionId),
	/** The terminal's AI tasks, newest first, with every command, question and answer. */
	history: (sessionId) => electron.ipcRenderer.invoke(IPC.sshAgent.history, sessionId),
	/** Raises a system notification for a run that is waiting on the user. */
	notifyWaiting: (sessionId, tabTitle) => electron.ipcRenderer.invoke(IPC.sshAgent.notifyWaiting, sessionId, tabTitle),
	onProgress: (callback) => {
		const listener = (_event, progress) => callback(progress);
		electron.ipcRenderer.on(IPC.sshAgent.onProgress, listener);
		return () => electron.ipcRenderer.removeListener(IPC.sshAgent.onProgress, listener);
	}
};
var rdpAgent = {
	/** Starts an AI task in an open Remote Desktop session; rejects if one is already running there. */
	start: (input) => electron.ipcRenderer.invoke(IPC.rdpAgent.start, input),
	approveAction: (sessionId) => electron.ipcRenderer.invoke(IPC.rdpAgent.approveAction, sessionId),
	skipAction: (sessionId) => electron.ipcRenderer.invoke(IPC.rdpAgent.skipAction, sessionId),
	answerNeedsInput: (sessionId, answer) => electron.ipcRenderer.invoke(IPC.rdpAgent.answerNeedsInput, sessionId, answer),
	stop: (sessionId) => electron.ipcRenderer.invoke(IPC.rdpAgent.stop, sessionId),
	/** Picks a run that paused on an error back up where it left off. */
	continueTask: (sessionId) => electron.ipcRenderer.invoke(IPC.rdpAgent.continue, sessionId),
	/** The session's AI tasks, newest first, with every action, question and answer. */
	history: (sessionId) => electron.ipcRenderer.invoke(IPC.rdpAgent.history, sessionId),
	/** Raises a system notification for a run that is waiting on the user. */
	notifyWaiting: (sessionId, title) => electron.ipcRenderer.invoke(IPC.rdpAgent.notifyWaiting, sessionId, title),
	/** Answers a request from onRequest: the screenshot, or that the input was applied. */
	respond: (response) => electron.ipcRenderer.invoke(IPC.rdpAgent.respond, response),
	/** Main asking this window for a screenshot or to apply mouse and keyboard input. */
	onRequest: (callback) => {
		const listener = (_event, request) => callback(request);
		electron.ipcRenderer.on(IPC.rdpAgent.onRequest, listener);
		return () => electron.ipcRenderer.removeListener(IPC.rdpAgent.onRequest, listener);
	},
	onProgress: (callback) => {
		const listener = (_event, progress) => callback(progress);
		electron.ipcRenderer.on(IPC.rdpAgent.onProgress, listener);
		return () => electron.ipcRenderer.removeListener(IPC.rdpAgent.onProgress, listener);
	}
};
var power = {
	keepAwakeStatus: () => electron.ipcRenderer.invoke(IPC.power.keepAwakeStatus),
	setKeepAwake: (mode) => electron.ipcRenderer.invoke(IPC.power.setKeepAwake, mode),
	onKeepAwake: (callback) => {
		const listener = (_event, status) => callback(status);
		electron.ipcRenderer.on(IPC.power.onKeepAwake, listener);
		return () => electron.ipcRenderer.removeListener(IPC.power.onKeepAwake, listener);
	}
};
var agents = {
	/** Tells main which workspace tabs exist, so it can follow their agents' status. */
	sync: (entries) => electron.ipcRenderer.invoke(IPC.agents.sync, entries),
	/** The tabs on screen right now; finishing while visible and focused raises no notification. */
	setViewing: (visible, focused) => electron.ipcRenderer.invoke(IPC.agents.setViewing, visible, focused),
	acknowledge: (sessionId) => electron.ipcRenderer.invoke(IPC.agents.acknowledge, sessionId),
	list: () => electron.ipcRenderer.invoke(IPC.agents.list),
	/**
	* A settings file to pass as `--settings` when launching this CLI, which reports its status
	* back through hooks. Null when the CLI has no such hooks or they cannot run here.
	*/
	statusHookSettings: (cliId) => electron.ipcRenderer.invoke(IPC.agents.statusHookSettings, cliId),
	/** The model and effort each agent last reported. */
	runInfos: () => electron.ipcRenderer.invoke(IPC.agents.runInfos),
	/** What each CLI was last actually run on, kept across restarts. */
	lastRunInfoByCli: () => electron.ipcRenderer.invoke(IPC.agents.lastRunInfoByCli),
	history: (projectId) => electron.ipcRenderer.invoke(IPC.agents.history, projectId),
	onRunInfo: (callback) => {
		const listener = (_event, changes) => callback(changes);
		electron.ipcRenderer.on(IPC.agents.onRunInfo, listener);
		return () => electron.ipcRenderer.removeListener(IPC.agents.onRunInfo, listener);
	},
	onStatus: (callback) => {
		const listener = (_event, changes) => callback(changes);
		electron.ipcRenderer.on(IPC.agents.onStatus, listener);
		return () => electron.ipcRenderer.removeListener(IPC.agents.onStatus, listener);
	},
	/** Every "continue" scheduled for a tab after a usage limit or a network error. */
	autoContinuePending: () => electron.ipcRenderer.invoke(IPC.agents.autoContinuePending),
	cancelAutoContinue: (sessionId) => electron.ipcRenderer.invoke(IPC.agents.cancelAutoContinue, sessionId),
	onAutoContinue: (callback) => {
		const listener = (_event, changes) => callback(changes);
		electron.ipcRenderer.on(IPC.agents.onAutoContinue, listener);
		return () => electron.ipcRenderer.removeListener(IPC.agents.onAutoContinue, listener);
	}
};
var projects = {
	list: () => electron.ipcRenderer.invoke(IPC.projects.list),
	create: (input) => electron.ipcRenderer.invoke(IPC.projects.create, input),
	update: (projectId, updates) => electron.ipcRenderer.invoke(IPC.projects.update, projectId, updates),
	delete: (projectId) => electron.ipcRenderer.invoke(IPC.projects.delete, projectId),
	reorder: (orderedIds) => electron.ipcRenderer.invoke(IPC.projects.reorder, orderedIds),
	setPinned: (projectId, pinned) => electron.ipcRenderer.invoke(IPC.projects.setPinned, projectId, pinned),
	/** Moves a project in or out of the Archived group on the Projects page. */
	setArchived: (projectId, archived) => electron.ipcRenderer.invoke(IPC.projects.setArchived, projectId, archived),
	bootstrap: (projectId) => electron.ipcRenderer.invoke(IPC.projects.bootstrap, projectId),
	bootstrapPlan: (projectId) => electron.ipcRenderer.invoke(IPC.projects.bootstrapPlan, projectId),
	pickFolder: () => electron.ipcRenderer.invoke(IPC.projects.pickFolder),
	/** Opens an image picker and returns the file inlined as a data URL, or null if cancelled. */
	pickIcon: () => electron.ipcRenderer.invoke(IPC.projects.pickIcon),
	/** Shrinks a dropped or pasted image to icon size and returns it as a data URL. */
	normalizeIcon: (dataUrl) => electron.ipcRenderer.invoke(IPC.projects.normalizeIcon, dataUrl),
	/** Downloads a site's favicon; null when the site is unreachable or has no icon. */
	fetchFavicon: (siteUrl) => electron.ipcRenderer.invoke(IPC.projects.fetchFavicon, siteUrl),
	updateNotifications: (projectId, notifications) => electron.ipcRenderer.invoke(IPC.projects.updateNotifications, projectId, notifications),
	listClaudeHooks: (projectId) => electron.ipcRenderer.invoke(IPC.projects.listClaudeHooks, projectId),
	updateClaudeHook: (projectId, hookId, updates) => electron.ipcRenderer.invoke(IPC.projects.updateClaudeHook, projectId, hookId, updates),
	deleteClaudeHook: (projectId, hookId) => electron.ipcRenderer.invoke(IPC.projects.deleteClaudeHook, projectId, hookId)
};
var skills = {
	listRepositories: () => electron.ipcRenderer.invoke(IPC.skills.listRepositories),
	addRepository: (input) => electron.ipcRenderer.invoke(IPC.skills.addRepository, input),
	removeRepository: (repositoryId) => electron.ipcRenderer.invoke(IPC.skills.removeRepository, repositoryId),
	refreshRepository: (repositoryId) => electron.ipcRenderer.invoke(IPC.skills.refreshRepository, repositoryId),
	getRepositoryIndex: (repositoryId) => electron.ipcRenderer.invoke(IPC.skills.getRepositoryIndex, repositoryId),
	/** `currentPath` seeds the dialog; it falls back to the projects folder from Settings. */
	pickLocalRepository: (currentPath) => electron.ipcRenderer.invoke(IPC.skills.pickLocalRepository, currentPath ?? null),
	previewLocalRepository: (folderPath) => electron.ipcRenderer.invoke(IPC.skills.previewLocalRepository, folderPath),
	onRepositoryChanged: (cb) => subscribe(IPC.skills.onRepositoryChanged, cb),
	install: (params) => electron.ipcRenderer.invoke(IPC.skills.install, params),
	remove: (params) => electron.ipcRenderer.invoke(IPC.skills.remove, params),
	listInstalled: (projectId) => electron.ipcRenderer.invoke(IPC.skills.listInstalled, projectId),
	checkForUpdates: (projectId) => electron.ipcRenderer.invoke(IPC.skills.checkForUpdates, projectId),
	searchSkillsSh: (query) => electron.ipcRenderer.invoke(IPC.skills.searchSkillsSh, query),
	getSkillsShDetail: (skillPath) => electron.ipcRenderer.invoke(IPC.skills.getSkillsShDetail, skillPath),
	recordSkillsShInstall: (input) => electron.ipcRenderer.invoke(IPC.skills.recordSkillsShInstall, input),
	checkUiProPrerequisites: () => electron.ipcRenderer.invoke(IPC.skills.checkUiProPrerequisites),
	/** Compares the installed `uipro` CLI against the latest release on npm. */
	checkUiProUpdate: () => electron.ipcRenderer.invoke(IPC.skills.checkUiProUpdate),
	recordUiProInstall: (input) => electron.ipcRenderer.invoke(IPC.skills.recordUiProInstall, input),
	/** Skills the user has starred, newest first. */
	listFavorites: () => electron.ipcRenderer.invoke(IPC.skills.listFavorites),
	/** Stars a skill, or refreshes the details of one already starred. */
	addFavorite: (input) => electron.ipcRenderer.invoke(IPC.skills.addFavorite, input),
	removeFavorite: (skillId) => electron.ipcRenderer.invoke(IPC.skills.removeFavorite, skillId),
	/** Skill invocations counted from the local agent session transcripts. */
	getUsage: () => electron.ipcRenderer.invoke(IPC.skills.getUsage),
	/** Re-reads every transcript from scratch instead of only the newly appended bytes. */
	rescanUsage: () => electron.ipcRenderer.invoke(IPC.skills.rescanUsage),
	/** Finds a used skill's folder on disk and the projects that already have it. */
	inspectUsedSkill: (query) => electron.ipcRenderer.invoke(IPC.skills.inspectUsedSkill, query),
	/** Copies a used skill into each project's skills dirs, one result per project. */
	addUsedSkillToProjects: (input) => electron.ipcRenderer.invoke(IPC.skills.addUsedSkillToProjects, input),
	/** Scans a skill for prompt injection, exfiltration, and the other risk categories. */
	runAudit: (input) => electron.ipcRenderer.invoke(IPC.skills.runAudit, input),
	/** Stops the CLI review half of an audit started with the same requestId. */
	cancelAudit: (requestId) => electron.ipcRenderer.invoke(IPC.skills.cancelAudit, requestId),
	/** Lists the skills at a folder path or GitHub address, so either can be checked ad hoc. */
	previewAuditSource: (input) => electron.ipcRenderer.invoke(IPC.skills.previewAuditSource, input),
	/** Skills present in a project's (or the global) skills dirs, installed by AgentMate or not. */
	listOnDiskSkills: (projectId) => electron.ipcRenderer.invoke(IPC.skills.listOnDiskSkills, projectId),
	listAudits: (options) => electron.ipcRenderer.invoke(IPC.skills.listAudits, options ?? {}),
	latestAuditPerSkill: () => electron.ipcRenderer.invoke(IPC.skills.latestAuditPerSkill),
	getAudit: (id) => electron.ipcRenderer.invoke(IPC.skills.getAudit, id),
	removeAudit: (id) => electron.ipcRenderer.invoke(IPC.skills.removeAudit, id),
	clearAudits: () => electron.ipcRenderer.invoke(IPC.skills.clearAudits)
};
var mcp = {
	listRepositories: () => electron.ipcRenderer.invoke(IPC.mcp.listRepositories),
	addRepository: (input) => electron.ipcRenderer.invoke(IPC.mcp.addRepository, input),
	removeRepository: (repositoryId) => electron.ipcRenderer.invoke(IPC.mcp.removeRepository, repositoryId),
	refreshRepository: (repositoryId) => electron.ipcRenderer.invoke(IPC.mcp.refreshRepository, repositoryId),
	getRepositoryIndex: (repositoryId) => electron.ipcRenderer.invoke(IPC.mcp.getRepositoryIndex, repositoryId),
	pickLocalRepository: () => electron.ipcRenderer.invoke(IPC.mcp.pickLocalRepository),
	install: (params) => electron.ipcRenderer.invoke(IPC.mcp.install, params),
	remove: (params) => electron.ipcRenderer.invoke(IPC.mcp.remove, params),
	listInstalled: (projectId) => electron.ipcRenderer.invoke(IPC.mcp.listInstalled, projectId)
};
var security = {
	preflight: (projectId) => electron.ipcRenderer.invoke(IPC.security.preflight, projectId),
	runScan: (projectId, options, runId) => electron.ipcRenderer.invoke(IPC.security.runScan, projectId, options, runId),
	cancelScan: (runId) => electron.ipcRenderer.invoke(IPC.security.cancelScan, runId),
	activeScan: (projectId) => electron.ipcRenderer.invoke(IPC.security.activeScan, projectId),
	history: (projectId) => electron.ipcRenderer.invoke(IPC.security.history, projectId),
	getScan: (id) => electron.ipcRenderer.invoke(IPC.security.getScan, id),
	latest: (projectId) => electron.ipcRenderer.invoke(IPC.security.latest, projectId),
	deleteScan: (id) => electron.ipcRenderer.invoke(IPC.security.deleteScan, id),
	getConfig: (projectId) => electron.ipcRenderer.invoke(IPC.security.getConfig, projectId),
	setConfig: (projectId, config) => electron.ipcRenderer.invoke(IPC.security.setConfig, projectId, config),
	suggestCodeqlLanguage: (projectId) => electron.ipcRenderer.invoke(IPC.security.suggestCodeqlLanguage, projectId),
	onScanProgress: (callback) => subscribe(IPC.security.onScanProgress, callback),
	codeqlStatus: () => electron.ipcRenderer.invoke(IPC.security.codeqlStatus),
	installCodeql: () => electron.ipcRenderer.invoke(IPC.security.installCodeql),
	cancelCodeqlInstall: () => electron.ipcRenderer.invoke(IPC.security.cancelCodeqlInstall),
	removeCodeql: () => electron.ipcRenderer.invoke(IPC.security.removeCodeql),
	openCodeqlFolder: () => electron.ipcRenderer.invoke(IPC.security.openCodeqlFolder),
	onCodeqlProgress: (callback) => subscribe(IPC.security.onCodeqlProgress, callback)
};
var tools = {
	detectAll: () => electron.ipcRenderer.invoke(IPC.tools.detectAll),
	getInstallCommand: (toolId) => electron.ipcRenderer.invoke(IPC.tools.getInstallCommand, toolId),
	checkForUpdate: (toolId, currentVersion) => electron.ipcRenderer.invoke(IPC.tools.checkForUpdate, toolId, currentVersion),
	getUpdateCommand: (toolId) => electron.ipcRenderer.invoke(IPC.tools.getUpdateCommand, toolId),
	getUninstallCommand: (toolId) => electron.ipcRenderer.invoke(IPC.tools.getUninstallCommand, toolId),
	getInteractiveLaunchCommand: (toolId) => electron.ipcRenderer.invoke(IPC.tools.getInteractiveLaunchCommand, toolId),
	getDockerCommand: (toolId, action) => electron.ipcRenderer.invoke(IPC.tools.getDockerCommand, toolId, action)
};
var docker = {
	availability: () => electron.ipcRenderer.invoke(IPC.docker.availability),
	list: () => electron.ipcRenderer.invoke(IPC.docker.list),
	listForProject: (folderPath) => electron.ipcRenderer.invoke(IPC.docker.listForProject, folderPath),
	start: (id) => electron.ipcRenderer.invoke(IPC.docker.start, id),
	stop: (id) => electron.ipcRenderer.invoke(IPC.docker.stop, id),
	restart: (id) => electron.ipcRenderer.invoke(IPC.docker.restart, id),
	remove: (id, options) => electron.ipcRenderer.invoke(IPC.docker.remove, id, options)
};
var android = {
	sdk: () => electron.ipcRenderer.invoke(IPC.android.sdk),
	setSdkPath: (path) => electron.ipcRenderer.invoke(IPC.android.setSdkPath, path),
	pickSdkPath: () => electron.ipcRenderer.invoke(IPC.android.pickSdkPath),
	refresh: () => electron.ipcRenderer.invoke(IPC.android.refresh),
	start: (avdName, options) => electron.ipcRenderer.invoke(IPC.android.start, avdName, options ?? {}),
	stop: (serial) => electron.ipcRenderer.invoke(IPC.android.stop, serial),
	cancelBoot: (avdName) => electron.ipcRenderer.invoke(IPC.android.cancelBoot, avdName),
	watchUsage: (enabled) => electron.ipcRenderer.invoke(IPC.android.watchUsage, enabled),
	rotate: (serial) => electron.ipcRenderer.invoke(IPC.android.rotate, serial),
	screenshot: (serial, label) => electron.ipcRenderer.invoke(IPC.android.screenshot, serial, label),
	startRecording: (serial, label) => electron.ipcRenderer.invoke(IPC.android.startRecording, serial, label),
	stopRecording: (id) => electron.ipcRenderer.invoke(IPC.android.stopRecording, id),
	installApk: (serial, paths) => electron.ipcRenderer.invoke(IPC.android.installApk, serial, paths),
	pickApk: () => electron.ipcRenderer.invoke(IPC.android.pickApk),
	adbPath: () => electron.ipcRenderer.invoke(IPC.android.adbPath),
	revealCapture: (path) => electron.ipcRenderer.invoke(IPC.android.revealCapture, path),
	openCapturesFolder: () => electron.ipcRenderer.invoke(IPC.android.openCapturesFolder),
	createAvd: (spec) => electron.ipcRenderer.invoke(IPC.android.createAvd, spec),
	deleteAvd: (name) => electron.ipcRenderer.invoke(IPC.android.deleteAvd, name),
	editAvd: (name, edit) => electron.ipcRenderer.invoke(IPC.android.editAvd, name, edit),
	avdConfig: (name) => electron.ipcRenderer.invoke(IPC.android.avdConfig, name),
	wipeData: (name) => electron.ipcRenderer.invoke(IPC.android.wipeData, name),
	listSystemImages: () => electron.ipcRenderer.invoke(IPC.android.listSystemImages),
	availableSystemImages: (force) => electron.ipcRenderer.invoke(IPC.android.availableSystemImages, force ?? false),
	installSystemImage: (packageId) => electron.ipcRenderer.invoke(IPC.android.installSystemImage, packageId),
	listDeviceProfiles: () => electron.ipcRenderer.invoke(IPC.android.listDeviceProfiles),
	pair: (hostPort, code) => electron.ipcRenderer.invoke(IPC.android.pair, hostPort, code),
	connect: (hostPort) => electron.ipcRenderer.invoke(IPC.android.connect, hostPort),
	disconnect: (serial) => electron.ipcRenderer.invoke(IPC.android.disconnect, serial),
	enableWireless: (serial) => electron.ipcRenderer.invoke(IPC.android.enableWireless, serial),
	onEvent: (callback) => subscribe(IPC.android.onEvent, callback)
};
var fs = {
	readFile: (path) => electron.ipcRenderer.invoke(IPC.fs.readFile, path),
	/** An image file as a data URL, for the workspace viewer. Rejects for anything else. */
	readImage: (path) => electron.ipcRenderer.invoke(IPC.fs.readImage, path),
	writeFile: (path, content) => electron.ipcRenderer.invoke(IPC.fs.writeFile, path, content),
	listDirectory: (path) => electron.ipcRenderer.invoke(IPC.fs.listDirectory, path),
	writeScratchFile: (fileName, content) => electron.ipcRenderer.invoke(IPC.fs.writeScratchFile, fileName, content),
	saveFileAs: (defaultFileName, content) => electron.ipcRenderer.invoke(IPC.fs.saveFileAs, defaultFileName, content)
};
/** File operations from the workspace explorer. Every path must sit inside the project folder. */
var explorer = {
	createFile: (projectId, parentDir, name) => electron.ipcRenderer.invoke(IPC.explorer.createFile, projectId, parentDir, name),
	createFolder: (projectId, parentDir, name) => electron.ipcRenderer.invoke(IPC.explorer.createFolder, projectId, parentDir, name),
	rename: (projectId, path, newName) => electron.ipcRenderer.invoke(IPC.explorer.rename, projectId, path, newName),
	delete: (projectId, paths, options) => electron.ipcRenderer.invoke(IPC.explorer.delete, projectId, paths, options),
	copy: (projectId, sources, targetDir) => electron.ipcRenderer.invoke(IPC.explorer.copy, projectId, sources, targetDir),
	move: (projectId, sources, targetDir, options) => electron.ipcRenderer.invoke(IPC.explorer.move, projectId, sources, targetDir, options),
	/** Copies files or folders from outside the project (an OS clipboard paste, or a drag from Explorer/Finder) into it. */
	pasteExternal: (projectId, sources, targetDir) => electron.ipcRenderer.invoke(IPC.explorer.pasteExternal, projectId, sources, targetDir),
	/** The OS clipboard's current file list, for pasting real files into the workspace explorer. */
	osClipboardPaths: () => electron.ipcRenderer.invoke(IPC.explorer.osClipboardPaths),
	revealInOs: (projectId, path) => electron.ipcRenderer.invoke(IPC.explorer.revealInOs, projectId, path),
	addToGitignore: (projectId, path, pattern) => electron.ipcRenderer.invoke(IPC.explorer.addToGitignore, projectId, path, pattern),
	untrack: (projectId, path) => electron.ipcRenderer.invoke(IPC.explorer.untrack, projectId, path),
	ignoredPaths: (projectId, paths) => electron.ipcRenderer.invoke(IPC.explorer.ignoredPaths, projectId, paths),
	/** Every file in the project, for the explorer's search box. */
	listFiles: (projectId) => electron.ipcRenderer.invoke(IPC.explorer.listFiles, projectId)
};
/** The workspace search dialog: text search through ripgrep, and the project's declarations. */
var workspaceSearch = {
	/** Resolves once the search stops. Matches arrive through `onTextResults` while it runs. */
	text: (projectId, requestId, request) => electron.ipcRenderer.invoke(IPC.workspaceSearch.text, projectId, requestId, request),
	cancel: (requestId) => electron.ipcRenderer.invoke(IPC.workspaceSearch.cancel, requestId),
	/** The whole index, or `unchanged` when `sinceVersion` is still current. */
	symbols: (projectId, sinceVersion) => electron.ipcRenderer.invoke(IPC.workspaceSearch.symbols, projectId, sinceVersion),
	onTextResults: (callback) => subscribe(IPC.workspaceSearch.onTextResults, callback)
};
var settings = {
	get: () => electron.ipcRenderer.invoke(IPC.settings.get),
	update: (updates) => electron.ipcRenderer.invoke(IPC.settings.update, updates)
};
var templates = {
	list: () => electron.ipcRenderer.invoke(IPC.templates.list),
	save: (input) => electron.ipcRenderer.invoke(IPC.templates.save, input),
	delete: (templateId) => electron.ipcRenderer.invoke(IPC.templates.delete, templateId)
};
var activity = { list: () => electron.ipcRenderer.invoke(IPC.activity.list) };
var shellApi = {
	openExternal: (url) => electron.ipcRenderer.invoke(IPC.shell.openExternal, url),
	openPath: (path) => electron.ipcRenderer.invoke(IPC.shell.openPath, path),
	openInEditor: (path) => electron.ipcRenderer.invoke(IPC.shell.openInEditor, path),
	/** The file system path of a file dropped into the window. Empty for files not on disk. */
	pathForFile: (file) => electron.webUtils.getPathForFile(file)
};
var terminalClipboard = {
	/** Saves pasted image bytes to a file and returns its path, for pasting into an agent CLI. */
	saveImage: (bytes, mime) => electron.ipcRenderer.invoke(IPC.terminalClipboard.saveImage, bytes, mime),
	/** What the system clipboard holds for a terminal: text, or paths for copied files and
	* images. Null when it holds nothing a terminal can use. */
	read: () => electron.ipcRenderer.invoke(IPC.terminalClipboard.read),
	/** A data URL of an image file, scaled down for a hover preview unless `fullSize`. Null when
	* it can't be shown. */
	previewImage: (path, fullSize = false) => electron.ipcRenderer.invoke(IPC.terminalClipboard.previewImage, path, fullSize)
};
/** The workspace browser tab's pages (webview guests). */
var browser = {
	/** Crops a picked element out of a page and saves it for an agent. Null when it is off
	* screen. `rect` and `viewport` are in the page's CSS pixels. */
	captureElement: (webContentsId, rect, viewport) => electron.ipcRenderer.invoke(IPC.browser.captureElement, webContentsId, rect, viewport),
	/** A browser shortcut pressed while a page had focus. */
	onGuestShortcut: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.browser.onGuestShortcut, listener);
		return () => electron.ipcRenderer.removeListener(IPC.browser.onGuestShortcut, listener);
	},
	/** A page asked to open a new window. */
	onOpenInNewTab: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.browser.onOpenInNewTab, listener);
		return () => electron.ipcRenderer.removeListener(IPC.browser.onOpenInNewTab, listener);
	}
};
var promptHistory = {
	/** Pass a projectId to get only that project's entries. */
	list: (projectId) => electron.ipcRenderer.invoke(IPC.promptHistory.list, projectId),
	search: (query, projectId) => electron.ipcRenderer.invoke(IPC.promptHistory.search, query, projectId),
	add: (input) => electron.ipcRenderer.invoke(IPC.promptHistory.add, input),
	remove: (id) => electron.ipcRenderer.invoke(IPC.promptHistory.remove, id),
	setTags: (id, tags) => electron.ipcRenderer.invoke(IPC.promptHistory.setTags, id, tags),
	/** Moves an entry to another project, or detaches it when `projectId` is null. */
	setProject: (id, projectId) => electron.ipcRenderer.invoke(IPC.promptHistory.setProject, id, projectId)
};
var translate = {
	text: (input) => electron.ipcRenderer.invoke(IPC.translate.text, input),
	/** Stops an in-flight text() that was given the same requestId. */
	cancel: (requestId) => electron.ipcRenderer.invoke(IPC.translate.cancel, requestId)
};
var ai = {
	ask: (input) => electron.ipcRenderer.invoke(IPC.ai.ask, input),
	/** Aborts an in-flight ask() that was given the same requestId. */
	cancel: (requestId) => electron.ipcRenderer.invoke(IPC.ai.cancel, requestId),
	/** Lists installed Ollama models. Pass a baseUrl to probe a server that hasn't been saved yet. */
	listOllamaModels: (baseUrl) => electron.ipcRenderer.invoke(IPC.ai.listOllamaModels, baseUrl),
	/** Pings an Ollama server and reports its version and how many models it has. */
	testOllama: (baseUrl) => electron.ipcRenderer.invoke(IPC.ai.testOllama, baseUrl),
	listGeminiModels: () => electron.ipcRenderer.invoke(IPC.ai.listGeminiModels),
	/** Sizes a generated prompt with the default AI CLI: complexity, model, and effort. */
	assessRun: (input) => electron.ipcRenderer.invoke(IPC.ai.assessRun, input),
	/** Stops an assessRun() that was given the same requestId. */
	cancelAssessRun: (requestId) => electron.ipcRenderer.invoke(IPC.ai.cancelAssessRun, requestId),
	/** Answers a one-off prompt with the agent CLI, model and effort the user picked. */
	askCli: (input) => electron.ipcRenderer.invoke(IPC.ai.askCli, input),
	/** Stops an askCli() that was given the same requestId. */
	cancelAskCli: (requestId) => electron.ipcRenderer.invoke(IPC.ai.cancelAskCli, requestId)
};
var help = {
	/** Answers a question about using AgentMate from the Help articles. */
	ask: (input) => electron.ipcRenderer.invoke(IPC.help.ask, input),
	/** Aborts an in-flight ask() that was given the same requestId. */
	cancel: (requestId) => electron.ipcRenderer.invoke(IPC.help.cancel, requestId),
	/** How much of the Help index the provider's embedder has covered. */
	status: (provider) => electron.ipcRenderer.invoke(IPC.help.status, provider),
	/** Embeds the articles with the provider's current model; `fresh` starts over from nothing. */
	reindex: (provider, options) => electron.ipcRenderer.invoke(IPC.help.reindex, provider, options),
	/** Stops a reindex() running for the provider. */
	cancelReindex: (provider) => electron.ipcRenderer.invoke(IPC.help.cancelReindex, provider),
	/** The embedding models the help search can use with the provider. */
	embeddingModels: (provider) => electron.ipcRenderer.invoke(IPC.help.embeddingModels, provider),
	onIndexProgress: (callback) => subscribe(IPC.help.onIndexProgress, callback)
};
var speech = {
	transcribe: (input) => electron.ipcRenderer.invoke(IPC.speech.transcribe, input),
	getModelState: () => electron.ipcRenderer.invoke(IPC.speech.getModelState),
	onModelProgress: (callback) => subscribe(IPC.speech.onModelProgress, callback)
};
var system = {
	sample: () => electron.ipcRenderer.invoke(IPC.system.sample),
	topApps: (resource) => electron.ipcRenderer.invoke(IPC.system.topApps, resource),
	killProcess: (pid) => electron.ipcRenderer.invoke(IPC.system.killProcess, pid)
};
var ipGeo = { lookup: (force) => electron.ipcRenderer.invoke(IPC.ipGeo.lookup, force) };
var projectDrafts = {
	listByProject: (projectId) => electron.ipcRenderer.invoke(IPC.projectDrafts.listByProject, projectId),
	create: (input) => electron.ipcRenderer.invoke(IPC.projectDrafts.create, input),
	updateStatus: (draftId, status) => electron.ipcRenderer.invoke(IPC.projectDrafts.updateStatus, draftId, status),
	update: (draftId, patch) => electron.ipcRenderer.invoke(IPC.projectDrafts.update, draftId, patch),
	/** Turns a draft into a scheduled task and removes the draft. */
	promoteToScheduled: (draftId, task) => electron.ipcRenderer.invoke(IPC.projectDrafts.promoteToScheduled, draftId, task),
	remove: (draftId) => electron.ipcRenderer.invoke(IPC.projectDrafts.remove, draftId)
};
var blueprints = {
	get: (projectId) => electron.ipcRenderer.invoke(IPC.blueprints.get, projectId),
	updateSection: (projectId, stepId, patch) => electron.ipcRenderer.invoke(IPC.blueprints.updateSection, projectId, stepId, patch),
	setFinalPrompt: (projectId, text) => electron.ipcRenderer.invoke(IPC.blueprints.setFinalPrompt, projectId, text),
	setDocsFolder: (projectId, folder) => electron.ipcRenderer.invoke(IPC.blueprints.setDocsFolder, projectId, folder),
	setConfirmBeforeWriting: (projectId, value) => electron.ipcRenderer.invoke(IPC.blueprints.setConfirmBeforeWriting, projectId, value),
	/** Null when the picker was cancelled, so the caller can tell that from "nothing changed". */
	pickAttachments: (projectId, stepId) => electron.ipcRenderer.invoke(IPC.blueprints.pickAttachments, projectId, stepId),
	addAttachment: (projectId, stepId, input) => electron.ipcRenderer.invoke(IPC.blueprints.addAttachment, projectId, stepId, input),
	renameAttachment: (projectId, stepId, attachmentId, displayName) => electron.ipcRenderer.invoke(IPC.blueprints.renameAttachment, projectId, stepId, attachmentId, displayName),
	removeAttachment: (projectId, stepId, attachmentId) => electron.ipcRenderer.invoke(IPC.blueprints.removeAttachment, projectId, stepId, attachmentId),
	/** Absolute path of one attachment, for handing to the OS through shell.openPath. */
	attachmentPath: (projectId, attachmentId) => electron.ipcRenderer.invoke(IPC.blueprints.attachmentPath, projectId, attachmentId),
	/** `stepId` of null asks for the final prompt's history rather than a section's. */
	listRevisions: (projectId, stepId) => electron.ipcRenderer.invoke(IPC.blueprints.listRevisions, projectId, stepId),
	agentFileTarget: (projectId) => electron.ipcRenderer.invoke(IPC.blueprints.agentFileTarget, projectId),
	syncAgentFile: (projectId) => electron.ipcRenderer.invoke(IPC.blueprints.syncAgentFile, projectId),
	listPresets: () => electron.ipcRenderer.invoke(IPC.blueprints.listPresets),
	savePreset: (input) => electron.ipcRenderer.invoke(IPC.blueprints.savePreset, input),
	deletePreset: (presetId) => electron.ipcRenderer.invoke(IPC.blueprints.deletePreset, presetId)
};
var promptBuildWidget = {
	listWidgets: () => electron.ipcRenderer.invoke(IPC.promptBuildWidget.listWidgets),
	getWidget: (id) => electron.ipcRenderer.invoke(IPC.promptBuildWidget.getWidget, id),
	openWidget: (projectId, projectName) => electron.ipcRenderer.invoke(IPC.promptBuildWidget.openWidget, projectId, projectName),
	closeWidget: (id) => electron.ipcRenderer.invoke(IPC.promptBuildWidget.closeWidget, id)
};
var scheduledTasks = {
	list: () => electron.ipcRenderer.invoke(IPC.scheduledTasks.list),
	listByProject: (projectId) => electron.ipcRenderer.invoke(IPC.scheduledTasks.listByProject, projectId),
	createMany: (input) => electron.ipcRenderer.invoke(IPC.scheduledTasks.createMany, input),
	updateStatus: (taskId, status) => electron.ipcRenderer.invoke(IPC.scheduledTasks.updateStatus, taskId, status),
	update: (taskId, patch) => electron.ipcRenderer.invoke(IPC.scheduledTasks.update, taskId, patch),
	/** Records a run started by hand: completed, with the time it ran. */
	markRan: (taskId) => electron.ipcRenderer.invoke(IPC.scheduledTasks.markRan, taskId),
	remove: (taskId) => electron.ipcRenderer.invoke(IPC.scheduledTasks.remove, taskId),
	/** main saying an automatic task is due and should open in a terminal now. */
	onDue: (callback) => {
		const listener = (_event, task) => callback(task);
		electron.ipcRenderer.on(IPC.scheduledTasks.onDue, listener);
		return () => electron.ipcRenderer.removeListener(IPC.scheduledTasks.onDue, listener);
	},
	/** main saying tasks changed on its side (fired or marked missed), so lists should refetch. */
	onChanged: (callback) => {
		const listener = () => callback();
		electron.ipcRenderer.on(IPC.scheduledTasks.onChanged, listener);
		return () => electron.ipcRenderer.removeListener(IPC.scheduledTasks.onChanged, listener);
	}
};
var notifications = {
	sendTest: (input) => electron.ipcRenderer.invoke(IPC.notifications.sendTest, input),
	/** Shows the message on the desktop companion, so the pet hook can be previewed. */
	sendPetTest: (input) => electron.ipcRenderer.invoke(IPC.notifications.sendPetTest, input),
	detectChatId: () => electron.ipcRenderer.invoke(IPC.notifications.detectChatId),
	onConfirmationForwarded: (callback) => {
		const listener = (_event, payload) => callback(payload);
		electron.ipcRenderer.on(IPC.notifications.onConfirmationForwarded, listener);
		return () => electron.ipcRenderer.removeListener(IPC.notifications.onConfirmationForwarded, listener);
	}
};
var git = {
	status: (projectId) => electron.ipcRenderer.invoke(IPC.git.status, projectId),
	listFiles: (projectId) => electron.ipcRenderer.invoke(IPC.git.listFiles, projectId),
	changeSummary: (projectId) => electron.ipcRenderer.invoke(IPC.git.changeSummary, projectId),
	fetch: (projectId) => electron.ipcRenderer.invoke(IPC.git.fetch, projectId),
	pull: (projectId) => electron.ipcRenderer.invoke(IPC.git.pull, projectId),
	push: (projectId) => electron.ipcRenderer.invoke(IPC.git.push, projectId),
	sync: (projectId) => electron.ipcRenderer.invoke(IPC.git.sync, projectId),
	createBranch: (projectId, branchName) => electron.ipcRenderer.invoke(IPC.git.createBranch, projectId, branchName),
	checkoutBranch: (projectId, branchName) => electron.ipcRenderer.invoke(IPC.git.checkoutBranch, projectId, branchName),
	setDefaultBranch: (projectId, branchName) => electron.ipcRenderer.invoke(IPC.git.setDefaultBranch, projectId, branchName),
	renameBranch: (input) => electron.ipcRenderer.invoke(IPC.git.renameBranch, input),
	deleteBranch: (input) => electron.ipcRenderer.invoke(IPC.git.deleteBranch, input),
	branchHistory: (projectId, branchName) => electron.ipcRenderer.invoke(IPC.git.branchHistory, projectId, branchName),
	/** Commits everything, or only `paths` (repo-relative) when given. */
	commit: (projectId, message, paths) => electron.ipcRenderer.invoke(IPC.git.commit, projectId, message, paths),
	/** Tag state for the repo, or for one tag series (e.g. "web-v") when a prefix is given. */
	tags: (projectId, prefix) => electron.ipcRenderer.invoke(IPC.git.tags, projectId, prefix),
	createTag: (input) => electron.ipcRenderer.invoke(IPC.git.createTag, input),
	suggestTag: (projectId, requestId, prefix) => electron.ipcRenderer.invoke(IPC.git.suggestTag, projectId, requestId, prefix),
	/** Kills the CLI process behind an in-flight suggestTag(requestId). */
	cancelSuggestTag: (requestId) => electron.ipcRenderer.invoke(IPC.git.cancelSuggestTag, requestId),
	/** Runs the CLI over the project's files to bump every version string to `tag`. */
	applyVersion: (input) => electron.ipcRenderer.invoke(IPC.git.applyVersion, input),
	cancelApplyVersion: (requestId) => electron.ipcRenderer.invoke(IPC.git.cancelApplyVersion, requestId),
	/** Reverts one file the version bump changed, or puts the bump's edit back. */
	swapVersionFile: (input) => electron.ipcRenderer.invoke(IPC.git.swapVersionFile, input),
	/** Rewrites one file the version bump changed with only some of its changes kept. */
	writeVersionHunks: (input) => electron.ipcRenderer.invoke(IPC.git.writeVersionHunks, input),
	suggestBranchName: (projectId, requestId) => electron.ipcRenderer.invoke(IPC.git.suggestBranchName, projectId, requestId),
	/** Kills the CLI process behind an in-flight suggestBranchName(requestId). */
	cancelSuggestBranchName: (requestId) => electron.ipcRenderer.invoke(IPC.git.cancelSuggestBranchName, requestId),
	/** `scope: 'staged'` describes only what is staged, for a commit of just those changes. */
	suggestCommitMessage: (projectId, requestId, scope) => electron.ipcRenderer.invoke(IPC.git.suggestCommitMessage, projectId, requestId, scope),
	/** Kills the CLI process behind an in-flight suggestCommitMessage(requestId). */
	cancelSuggestCommitMessage: (requestId) => electron.ipcRenderer.invoke(IPC.git.cancelSuggestCommitMessage, requestId),
	createPullRequest: (input) => electron.ipcRenderer.invoke(IPC.git.createPullRequest, input),
	/** Creates the repository in the project folder, on the branch the caller picked. */
	init: (input) => electron.ipcRenderer.invoke(IPC.git.init, input),
	/** Who the GitHub CLI is signed in as, plus the organizations that account belongs to. */
	githubAccount: () => electron.ipcRenderer.invoke(IPC.git.githubAccount),
	/** Contribution counts for the signed-in GitHub user, used by the dashboard chart. */
	githubActivity: () => electron.ipcRenderer.invoke(IPC.git.githubActivity),
	/** Unread GitHub notifications for the signed-in account. */
	githubNotifications: () => electron.ipcRenderer.invoke(IPC.git.githubNotifications),
	/** Marks one GitHub notification thread as read. */
	githubMarkNotificationRead: (threadId) => electron.ipcRenderer.invoke(IPC.git.githubMarkNotificationRead, threadId),
	/** Marks every unread GitHub notification as read. */
	githubMarkNotificationsRead: () => electron.ipcRenderer.invoke(IPC.git.githubMarkNotificationsRead),
	lookupGithubRepo: (owner, name) => electron.ipcRenderer.invoke(IPC.git.lookupGithubRepo, owner, name),
	createGithubRepo: (input) => electron.ipcRenderer.invoke(IPC.git.createGithubRepo, input),
	/** Points origin at `url`, and optionally pushes the current branch with -u. */
	connectRemote: (input) => electron.ipcRenderer.invoke(IPC.git.connectRemote, input),
	/** Origin's URL for a folder path, as a browsable link. Null when there isn't one. */
	detectRemote: (folderPath) => electron.ipcRenderer.invoke(IPC.git.detectRemote, folderPath),
	/** Clones a public GitHub repo into the New Project folder. Never throws: check `ok`. */
	cloneInto: (input) => electron.ipcRenderer.invoke(IPC.git.cloneInto, input),
	/** Asks main to watch this project's `.git`, so outside commits reach the open Git tab. */
	watchRepo: (projectId) => electron.ipcRenderer.invoke(IPC.git.watchRepo, projectId),
	unwatchRepo: (projectId) => electron.ipcRenderer.invoke(IPC.git.unwatchRepo, projectId),
	onRepoChanged: (callback) => subscribe(IPC.git.onRepoChanged, callback),
	/** Branch, sync counts and every change, grouped the way the workspace panel lists them. */
	workspaceState: (projectId) => electron.ipcRenderer.invoke(IPC.git.workspaceState, projectId),
	/** Pushes a fresh state through onWorkspaceState whenever files in the project change. */
	watchWorkingTree: (projectId) => electron.ipcRenderer.invoke(IPC.git.watchWorkingTree, projectId),
	unwatchWorkingTree: (projectId) => electron.ipcRenderer.invoke(IPC.git.unwatchWorkingTree, projectId),
	onWorkspaceState: (callback) => {
		const listener = (_event, projectId, state) => callback(projectId, state);
		electron.ipcRenderer.on(IPC.git.onWorkspaceState, listener);
		return () => electron.ipcRenderer.removeListener(IPC.git.onWorkspaceState, listener);
	},
	stage: (projectId, paths) => electron.ipcRenderer.invoke(IPC.git.stage, projectId, paths),
	unstage: (projectId, paths) => electron.ipcRenderer.invoke(IPC.git.unstage, projectId, paths),
	/** Throws away working tree changes (or trashes untracked files); the result can be undone. */
	discard: (projectId, paths, side) => electron.ipcRenderer.invoke(IPC.git.discard, projectId, paths, side),
	undoDiscard: (projectId, token) => electron.ipcRenderer.invoke(IPC.git.undoDiscard, projectId, token),
	/** Stages, unstages or discards only some lines of a file. A discard can be undone. */
	applyLines: (input) => electron.ipcRenderer.invoke(IPC.git.applyLines, input),
	resolveConflict: (projectId, path, pick) => electron.ipcRenderer.invoke(IPC.git.resolveConflict, projectId, path, pick),
	/** Has the project's AI CLI edit the conflict markers out of one file. Nothing is staged. */
	resolveConflictWithAi: (projectId, path, requestId) => electron.ipcRenderer.invoke(IPC.git.resolveConflictWithAi, projectId, path, requestId),
	/** Stops a resolveConflictWithAi(requestId) run and puts the file back as it was. */
	cancelResolveConflictWithAi: (requestId) => electron.ipcRenderer.invoke(IPC.git.cancelResolveConflictWithAi, requestId),
	abortOperation: (projectId) => electron.ipcRenderer.invoke(IPC.git.abortOperation, projectId),
	/** Commits only what is staged, optionally pushing the branch right after. */
	commitStaged: (projectId, message, push) => electron.ipcRenderer.invoke(IPC.git.commitStaged, projectId, message, push),
	fileDiff: (projectId, path, side, origPath) => electron.ipcRenderer.invoke(IPC.git.fileDiff, projectId, path, side, origPath),
	/** Both sides of a changed image, for the viewer that stands in for a binary diff. */
	fileImage: (projectId, path, side, origPath) => electron.ipcRenderer.invoke(IPC.git.fileImage, projectId, path, side, origPath),
	/** Saves an edit to a working tree file from the diff view. `path` is repo-relative. */
	writeWorkingFile: (projectId, path, content) => electron.ipcRenderer.invoke(IPC.git.writeWorkingFile, projectId, path, content),
	/** The files a commit changed, with line counts. */
	commitFiles: (projectId, hash) => electron.ipcRenderer.invoke(IPC.git.commitFiles, projectId, hash),
	/** One file as a commit changed it. */
	commitFileDiff: (projectId, hash, path, origPath) => electron.ipcRenderer.invoke(IPC.git.commitFileDiff, projectId, hash, path, origPath),
	/** An image as a commit changed it. */
	commitFileImage: (projectId, hash, path, origPath) => electron.ipcRenderer.invoke(IPC.git.commitFileImage, projectId, hash, path, origPath)
};
var pipelines = {
	status: (projectId) => electron.ipcRenderer.invoke(IPC.pipelines.status, projectId),
	setMuted: (projectId, actions) => electron.ipcRenderer.invoke(IPC.pipelines.setMuted, projectId, actions),
	dashboardActivity: () => electron.ipcRenderer.invoke(IPC.pipelines.dashboardActivity),
	runError: (input) => electron.ipcRenderer.invoke(IPC.pipelines.runError, input),
	/** Warnings, notices and failures the run's jobs left behind. */
	runAnnotations: (input) => electron.ipcRenderer.invoke(IPC.pipelines.runAnnotations, input),
	/** Branches and tags a manual run can be started from. */
	refs: (repo) => electron.ipcRenderer.invoke(IPC.pipelines.refs, repo),
	/** Starts a workflow by hand, the way GitHub's "Run workflow" button does. */
	dispatch: (input) => electron.ipcRenderer.invoke(IPC.pipelines.dispatch, input),
	/** Stops a queued or in-progress run. */
	cancelRun: (input) => electron.ipcRenderer.invoke(IPC.pipelines.cancelRun, input),
	/** Self-hosted runners behind the projects' repos, and jobs stuck waiting for one. */
	runners: (input) => electron.ipcRenderer.invoke(IPC.pipelines.runners, input)
};
/** The Deploy section: saved servers with their server core, installing it, and its health. */
var deploy = {
	listServers: () => electron.ipcRenderer.invoke(IPC.deploy.listServers),
	/** A read-only look at the server: OS, processor, sudo, disk, and what is installed. */
	preflight: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.preflight, serverId),
	install: (input) => electron.ipcRenderer.invoke(IPC.deploy.install, input),
	uninstall: (input) => electron.ipcRenderer.invoke(IPC.deploy.uninstall, input),
	health: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.health, serverId),
	/** Whether this computer can act on the core now: signed in, or what it needs first. */
	access: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.access, serverId),
	/** Enrolls this computer over SSH, as a user the core has (again, after a revocation). */
	enroll: (input) => electron.ipcRenderer.invoke(IPC.deploy.enroll, input),
	signIn: (input) => electron.ipcRenderer.invoke(IPC.deploy.signIn, input),
	signOut: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.signOut, serverId),
	account: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.account, serverId),
	/** Confirms the password (or a code) again, for ten minutes of sensitive changes. */
	stepUp: (input) => electron.ipcRenderer.invoke(IPC.deploy.stepUp, input),
	beginTotp: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.beginTotp, serverId),
	confirmTotp: (serverId, code) => electron.ipcRenderer.invoke(IPC.deploy.confirmTotp, serverId, code),
	disableTotp: (serverId, code) => electron.ipcRenderer.invoke(IPC.deploy.disableTotp, serverId, code),
	/** Each step of a running install or removal, as it starts, finishes or fails. */
	onSetupProgress: (cb) => subscribe(IPC.deploy.onSetupProgress, cb),
	/** The server's lasting connection to its core right now. */
	connection: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.connection, serverId),
	/** Tries the connection again now, whatever it waited for (after unlocking the vault, say). */
	reconnect: (serverId) => electron.ipcRenderer.invoke(IPC.deploy.reconnect, serverId),
	/** Every change of a server's connection: online, reconnecting, needs a sign-in, and so on. */
	onConnection: (cb) => subscribe(IPC.deploy.onConnection, cb)
};
/**
* A server's Overview: its facts, live and stored metrics, updates, reboot and restarts. Calls
* refused for a missing step-up carry `[core:stepUpRequired]`; for a role, `[core:forbidden]`.
*/
var deploySystem = {
	info: (serverId) => electron.ipcRenderer.invoke(IPC.deploySystem.info, serverId),
	services: (serverId) => electron.ipcRenderer.invoke(IPC.deploySystem.services, serverId),
	metricsHistory: (input) => electron.ipcRenderer.invoke(IPC.deploySystem.metricsHistory, input),
	updates: (serverId) => electron.ipcRenderer.invoke(IPC.deploySystem.updates, serverId),
	checkUpdates: (serverId) => electron.ipcRenderer.invoke(IPC.deploySystem.checkUpdates, serverId),
	upgradeSecurity: (serverId) => electron.ipcRenderer.invoke(IPC.deploySystem.upgradeSecurity, serverId),
	/** Needs a step-up: pass the password (or a code) unless one was made in the last 10 minutes. */
	upgradeAll: (input) => electron.ipcRenderer.invoke(IPC.deploySystem.upgradeAll, input),
	setAutomaticUpdates: (serverId, enabled) => electron.ipcRenderer.invoke(IPC.deploySystem.setAutomaticUpdates, serverId, enabled),
	/** Needs a step-up, as upgradeAll. The connection drops a few seconds after the job succeeds. */
	reboot: (input) => electron.ipcRenderer.invoke(IPC.deploySystem.reboot, input),
	restartService: (serverId, service) => electron.ipcRenderer.invoke(IPC.deploySystem.restartService, serverId, service),
	/** Starts live samples for this window; they arrive on onMetrics under the returned id. */
	watchMetrics: (input) => electron.ipcRenderer.invoke(IPC.deploySystem.watchMetrics, input),
	unwatchMetrics: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deploySystem.unwatchMetrics, subscriptionId),
	onMetrics: (cb) => subscribe(IPC.deploySystem.onMetrics, cb)
};
/** The jobs a server core runs, and their live logs (already redacted by the core). */
var deployJobs = {
	list: (query) => electron.ipcRenderer.invoke(IPC.deployJobs.list, query),
	get: (serverId, jobId) => electron.ipcRenderer.invoke(IPC.deployJobs.get, serverId, jobId),
	cancel: (serverId, jobId) => electron.ipcRenderer.invoke(IPC.deployJobs.cancel, serverId, jobId),
	/** Starts a job's log for this window; it arrives on onLog until an event carries `ended`. */
	watch: (input) => electron.ipcRenderer.invoke(IPC.deployJobs.watch, input),
	unwatch: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployJobs.unwatch, subscriptionId),
	onLog: (cb) => subscribe(IPC.deployJobs.onLog, cb)
};
/** Docker on a server: containers, their stats, logs and console, and Docker's resources. */
var deployDocker = createDeployDocker(subscribe);
var deployDirectTls = createDeployDirectTls();
/** The Security center (E15): the checklist, its SSH fixes, backups and restores. */
var deployHardening = createDeployHardening(subscribe);
/** WordPress sites through the AgentMate Connector plugin, and WordPress projects (E19 to E21). */
var deployWordPress = createDeployWordPress(subscribe);
/** The Deploy AI and the logs center's journal (E09). */
var deployAssistant = createDeployAssistant(subscribe);
var deployLogs = createDeployLogs(subscribe);
/**
* A server's Apps (E07). Env values never come here: the main process reads the environment,
* renders the .env and uploads it. Changes return the job that does them (follow it with
* deployJobs.watch); refusals carry `[core:forbidden]` like deploySystem's.
*/
var deployStacks = {
	discover: (projectId) => electron.ipcRenderer.invoke(IPC.deployStacks.discover, projectId),
	preview: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.preview, input),
	list: (serverId) => electron.ipcRenderer.invoke(IPC.deployStacks.list, serverId),
	get: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.get, input),
	files: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.files, input),
	create: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.create, input),
	upload: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.upload, input),
	acknowledge: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.acknowledge, input),
	deploy: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.deploy, input),
	rollback: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.rollback, input),
	action: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.action, input),
	delete: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.delete, input),
	/** Redeploys the app as a new revision with these services on 127.0.0.1 (E13). */
	makePrivate: (input) => electron.ipcRenderer.invoke(IPC.deployStacks.makePrivate, input),
	onUploadProgress: (cb) => subscribe(IPC.deployStacks.onUploadProgress, cb)
};
/**
* A server's App Store (E12). The catalog is read from @agentmat/core in the renderer; these
* send what was picked, and the main process renders the files itself.
*/
var deployAppStore = {
	install: (input) => electron.ipcRenderer.invoke(IPC.deployAppStore.install, input),
	/** A copy of the live revision on newer images, deployed; the .env stays on the server. */
	update: (input) => electron.ipcRenderer.invoke(IPC.deployAppStore.update, input),
	/** Admins, after a step-up: the app's .env as a map of key to value. */
	revealSecrets: (input) => electron.ipcRenderer.invoke(IPC.deployAppStore.revealSecrets, input)
};
/** Private registries (E08): sign-ins on this computer and credentials stored on a server. */
var deployRegistry = createDeployRegistry();
/** A server core's alerts: disk pressure, failed jobs, a reboot waiting. */
var deployAlerts = {
	list: (query) => electron.ipcRenderer.invoke(IPC.deployAlerts.list, query),
	acknowledge: (serverId, alertId) => electron.ipcRenderer.invoke(IPC.deployAlerts.acknowledge, serverId, alertId),
	/** Starts alerts for this window: every open one first, then each change, on onChanged. */
	watch: (serverId) => electron.ipcRenderer.invoke(IPC.deployAlerts.watch, serverId),
	unwatch: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deployAlerts.unwatch, subscriptionId),
	onChanged: (cb) => subscribe(IPC.deployAlerts.onChanged, cb)
};
/**
* A server's host firewall (E13). Every role reads; Admins preview and apply. An applied change
* waits for `confirm`, which the main process sends over a brand-new SSH connection, and rolls
* back on the server by itself at its deadline otherwise. Steps arrive on onProgress.
*/
var deployFirewall = {
	status: (serverId) => electron.ipcRenderer.invoke(IPC.deployFirewall.status, serverId),
	presets: (serverId) => electron.ipcRenderer.invoke(IPC.deployFirewall.presets, serverId),
	history: (input) => electron.ipcRenderer.invoke(IPC.deployFirewall.history, input),
	exposure: (serverId) => electron.ipcRenderer.invoke(IPC.deployFirewall.exposure, serverId),
	/** The exact commands and the SSH guard's verdict. Changes nothing. */
	preview: (input) => electron.ipcRenderer.invoke(IPC.deployFirewall.preview, input),
	/**
	* May need a step-up (`[core:stepUpRequired]`): pass the password, as upgradeAll does. Not
	* called `apply`, which every function already has (Function.prototype.apply).
	*/
	applyChanges: (input) => electron.ipcRenderer.invoke(IPC.deployFirewall.apply, input),
	confirm: (input) => electron.ipcRenderer.invoke(IPC.deployFirewall.confirm, input),
	revert: (input) => electron.ipcRenderer.invoke(IPC.deployFirewall.revert, input),
	onProgress: (cb) => subscribe(IPC.deployFirewall.onProgress, cb)
};
/**
* A server's websites. Saving only stores a site; `apply` puts every saved change live (it can
* take some 20 seconds) or keeps nginx as it was and says why. Snippets are the Owner's alone.
*/
var deploySites = {
	status: (serverId) => electron.ipcRenderer.invoke(IPC.deploySites.status, serverId),
	list: (serverId) => electron.ipcRenderer.invoke(IPC.deploySites.list, serverId),
	listStreams: (serverId) => electron.ipcRenderer.invoke(IPC.deploySites.listStreams, serverId),
	/** Installs nginx from nginx.org, or adopts the one there. A job. */
	install: (serverId) => electron.ipcRenderer.invoke(IPC.deploySites.install, serverId),
	save: (serverId, settings) => electron.ipcRenderer.invoke(IPC.deploySites.save, serverId, settings),
	remove: (serverId, siteId) => electron.ipcRenderer.invoke(IPC.deploySites.remove, serverId, siteId),
	saveStream: (serverId, settings) => electron.ipcRenderer.invoke(IPC.deploySites.saveStream, serverId, settings),
	removeStream: (serverId, proxyId) => electron.ipcRenderer.invoke(IPC.deploySites.removeStream, serverId, proxyId),
	applyChanges: (serverId) => electron.ipcRenderer.invoke(IPC.deploySites.apply, serverId),
	setSnippets: (serverId, snippets) => electron.ipcRenderer.invoke(IPC.deploySites.setSnippets, serverId, snippets),
	/** Starts a site's access or error log for this window; lines arrive on onLog. */
	watchLog: (input) => electron.ipcRenderer.invoke(IPC.deploySites.watchLog, input),
	unwatchLog: (subscriptionId) => electron.ipcRenderer.invoke(IPC.deploySites.unwatchLog, subscriptionId),
	onLog: (cb) => subscribe(IPC.deploySites.onLog, cb)
};
/** A server's certificates. Removing one needs a step-up, as reboot does. */
var deployCerts = {
	list: (serverId) => electron.ipcRenderer.invoke(IPC.deployCerts.list, serverId),
	/** Orders a certificate over ACME for every domain of the site. A job. */
	issue: (input) => electron.ipcRenderer.invoke(IPC.deployCerts.issue, input),
	renew: (serverId, siteId) => electron.ipcRenderer.invoke(IPC.deployCerts.renew, serverId, siteId),
	upload: (input) => electron.ipcRenderer.invoke(IPC.deployCerts.upload, input),
	remove: (input) => electron.ipcRenderer.invoke(IPC.deployCerts.remove, input)
};
/**
* A server core's Security area. The core decides who may do what; changes to users need a
* step-up first (deploy.stepUp). Passwords pass straight through to the core.
*/
var deploySecurity = {
	listUsers: (serverId) => electron.ipcRenderer.invoke(IPC.deploySecurity.listUsers, serverId),
	createUser: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.createUser, input),
	setUserRole: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.setUserRole, input),
	setUserDisabled: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.setUserDisabled, input),
	resetUserPassword: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.resetUserPassword, input),
	deleteUser: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.deleteUser, input),
	/** Shown once: the core keeps only its hash. */
	createEnrollmentCode: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.createEnrollmentCode, input),
	/** Enrolls this computer with an Owner's code, then signs in. No SSH root needed. */
	redeemEnrollmentCode: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.redeemEnrollmentCode, input),
	listDevices: (serverId) => electron.ipcRenderer.invoke(IPC.deploySecurity.listDevices, serverId),
	revokeDevice: (serverId, deviceId) => electron.ipcRenderer.invoke(IPC.deploySecurity.revokeDevice, serverId, deviceId),
	listSessions: (serverId) => electron.ipcRenderer.invoke(IPC.deploySecurity.listSessions, serverId),
	revokeSession: (serverId, sessionId) => electron.ipcRenderer.invoke(IPC.deploySecurity.revokeSession, serverId, sessionId),
	/** Ends every session of the signed-in user's but this computer's; returns how many. */
	revokeOtherSessions: (serverId) => electron.ipcRenderer.invoke(IPC.deploySecurity.revokeOtherSessions, serverId),
	queryAudit: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.queryAudit, input),
	verifyAudit: (serverId) => electron.ipcRenderer.invoke(IPC.deploySecurity.verifyAudit, serverId),
	/** Asks where to save, then writes every matching event as JSON or CSV. */
	exportAudit: (input) => electron.ipcRenderer.invoke(IPC.deploySecurity.exportAudit, input)
};
/**
* The Deploy section's Cloudflare page. The API token goes in through saveToken and never comes
* back: everything else answers with zones, records, settings and rules.
*/
var cloudflare = {
	/** Whether a token is saved (and locked behind the Servers passkey), and its last check. */
	status: () => electron.ipcRenderer.invoke(IPC.cloudflare.status),
	/** Checks a pasted token against Cloudflare, then seals and saves it. */
	saveToken: (token) => electron.ipcRenderer.invoke(IPC.cloudflare.saveToken, token),
	/** Checks the saved token again, as after its permissions were edited on Cloudflare. */
	checkToken: () => electron.ipcRenderer.invoke(IPC.cloudflare.checkToken),
	removeToken: () => electron.ipcRenderer.invoke(IPC.cloudflare.removeToken),
	listZones: () => electron.ipcRenderer.invoke(IPC.cloudflare.listZones),
	listRecords: (zoneId) => electron.ipcRenderer.invoke(IPC.cloudflare.listRecords, zoneId),
	createRecord: (zoneId, record) => electron.ipcRenderer.invoke(IPC.cloudflare.createRecord, zoneId, record),
	updateRecord: (zoneId, recordId, record) => electron.ipcRenderer.invoke(IPC.cloudflare.updateRecord, zoneId, recordId, record),
	deleteRecord: (zoneId, recordId) => electron.ipcRenderer.invoke(IPC.cloudflare.deleteRecord, zoneId, recordId),
	zoneSettings: (zoneId) => electron.ipcRenderer.invoke(IPC.cloudflare.zoneSettings, zoneId),
	changeSetting: (zoneId, change) => electron.ipcRenderer.invoke(IPC.cloudflare.changeSetting, zoneId, change),
	purgeCache: (zoneId, request) => electron.ipcRenderer.invoke(IPC.cloudflare.purgeCache, zoneId, request),
	listCustomRules: (zoneId) => electron.ipcRenderer.invoke(IPC.cloudflare.listCustomRules, zoneId),
	createCustomRule: (zoneId, input) => electron.ipcRenderer.invoke(IPC.cloudflare.createCustomRule, zoneId, input),
	setCustomRuleEnabled: (zoneId, ruleId, enabled) => electron.ipcRenderer.invoke(IPC.cloudflare.setCustomRuleEnabled, zoneId, ruleId, enabled),
	deleteCustomRule: (zoneId, ruleId) => electron.ipcRenderer.invoke(IPC.cloudflare.deleteCustomRule, zoneId, ruleId),
	listAccessRules: (zoneId) => electron.ipcRenderer.invoke(IPC.cloudflare.listAccessRules, zoneId),
	createAccessRule: (zoneId, input) => electron.ipcRenderer.invoke(IPC.cloudflare.createAccessRule, zoneId, input),
	deleteAccessRule: (zoneId, ruleId) => electron.ipcRenderer.invoke(IPC.cloudflare.deleteAccessRule, zoneId, ruleId),
	/** What pointing a name at a saved server would change, without changing anything. */
	planPointDomain: (input) => electron.ipcRenderer.invoke(IPC.cloudflare.planPointDomain, input),
	pointDomain: (input) => electron.ipcRenderer.invoke(IPC.cloudflare.pointDomain, input)
};
var pullRequests = {
	/** The current branch, its PR (with checks and review threads) and what the tab needs to decide. */
	status: (projectId) => electron.ipcRenderer.invoke(IPC.pullRequests.status, projectId),
	/** Asks the project's CLI for a PR title and description from the branch's commits. */
	suggestText: (projectId, requestId, base) => electron.ipcRenderer.invoke(IPC.pullRequests.suggestText, projectId, requestId, base),
	comment: (input) => electron.ipcRenderer.invoke(IPC.pullRequests.comment, input),
	replyThread: (input) => electron.ipcRenderer.invoke(IPC.pullRequests.replyThread, input),
	resolveThread: (input) => electron.ipcRenderer.invoke(IPC.pullRequests.resolveThread, input),
	markReady: (projectId, number) => electron.ipcRenderer.invoke(IPC.pullRequests.markReady, projectId, number),
	/** Merges on GitHub, then optionally switches to the base, pulls and deletes the branch. */
	merge: (input) => electron.ipcRenderer.invoke(IPC.pullRequests.merge, input),
	/** The post-merge cleanup on its own, to retry a failed step or clean up later. */
	cleanup: (input) => electron.ipcRenderer.invoke(IPC.pullRequests.cleanup, input),
	/** A read-only AI review of the PR diff, returned for the user to edit before posting. */
	localReview: (projectId, requestId) => electron.ipcRenderer.invoke(IPC.pullRequests.localReview, projectId, requestId),
	cancelAi: (requestId) => electron.ipcRenderer.invoke(IPC.pullRequests.cancelAi, requestId)
};
var tests = {
	/** Reads the project's files for test frameworks and the tests they declare. */
	discover: (projectId) => electron.ipcRenderer.invoke(IPC.tests.discover, projectId),
	/** Starts a background run. No targets runs every test project. */
	run: (projectId, targets) => electron.ipcRenderer.invoke(IPC.tests.run, projectId, targets),
	cancel: (projectId) => electron.ipcRenderer.invoke(IPC.tests.cancel, projectId),
	lastRun: (projectId) => electron.ipcRenderer.invoke(IPC.tests.lastRun, projectId),
	/** The command a target would run with, as a person would type it. */
	command: (projectId, target) => electron.ipcRenderer.invoke(IPC.tests.command, projectId, target),
	onRunEvent: (callback) => subscribe(IPC.tests.onRunEvent, callback)
};
var apiClient = {
	listCollections: () => electron.ipcRenderer.invoke(IPC.apiClient.listCollections),
	getCollection: (id) => electron.ipcRenderer.invoke(IPC.apiClient.getCollection, id),
	createCollection: (name) => electron.ipcRenderer.invoke(IPC.apiClient.createCollection, name),
	renameCollection: (id, name) => electron.ipcRenderer.invoke(IPC.apiClient.renameCollection, id, name),
	removeCollection: (id) => electron.ipcRenderer.invoke(IPC.apiClient.removeCollection, id),
	/** Adds the request to the collection, or updates it where it already is. */
	saveRequest: (input) => electron.ipcRenderer.invoke(IPC.apiClient.saveRequest, input),
	createFolder: (collectionId, parentId, name) => electron.ipcRenderer.invoke(IPC.apiClient.createFolder, collectionId, parentId, name),
	removeItem: (collectionId, itemId) => electron.ipcRenderer.invoke(IPC.apiClient.removeItem, collectionId, itemId),
	/** Sends one request and resolves when it finished, failed or was cancelled. */
	execute: (input) => electron.ipcRenderer.invoke(IPC.apiClient.execute, input),
	cancel: (requestId) => electron.ipcRenderer.invoke(IPC.apiClient.cancel, requestId)
};
var appNotifications = {
	list: () => electron.ipcRenderer.invoke(IPC.appNotifications.list),
	unreadCount: () => electron.ipcRenderer.invoke(IPC.appNotifications.unreadCount),
	markRead: (notificationId) => electron.ipcRenderer.invoke(IPC.appNotifications.markRead, notificationId),
	markAllRead: () => electron.ipcRenderer.invoke(IPC.appNotifications.markAllRead),
	remove: (notificationId) => electron.ipcRenderer.invoke(IPC.appNotifications.remove, notificationId),
	onChanged: (callback) => subscribe(IPC.appNotifications.onChanged, callback)
};
function subscribe(channel, callback) {
	const listener = (_event, payload) => callback(payload);
	electron.ipcRenderer.on(channel, listener);
	return () => electron.ipcRenderer.removeListener(channel, listener);
}
var worktrees = {
	list: (projectId) => electron.ipcRenderer.invoke(IPC.worktrees.list, projectId),
	defaults: (projectId) => electron.ipcRenderer.invoke(IPC.worktrees.defaults, projectId),
	suggestPath: (projectId, branch) => electron.ipcRenderer.invoke(IPC.worktrees.suggestPath, projectId, branch),
	create: (input) => electron.ipcRenderer.invoke(IPC.worktrees.create, input),
	previewCopy: (projectId, globs) => electron.ipcRenderer.invoke(IPC.worktrees.previewCopy, projectId, globs),
	copyFiles: (projectId, worktreeId, files) => electron.ipcRenderer.invoke(IPC.worktrees.copyFiles, projectId, worktreeId, files),
	removePreflight: (projectId, worktreeId) => electron.ipcRenderer.invoke(IPC.worktrees.removePreflight, projectId, worktreeId),
	remove: (input) => electron.ipcRenderer.invoke(IPC.worktrees.remove, input),
	mergePreflight: (projectId, worktreeId) => electron.ipcRenderer.invoke(IPC.worktrees.mergePreflight, projectId, worktreeId),
	merge: (projectId, worktreeId) => electron.ipcRenderer.invoke(IPC.worktrees.merge, projectId, worktreeId),
	mergeBaseIn: (projectId, worktreeId) => electron.ipcRenderer.invoke(IPC.worktrees.mergeBaseIn, projectId, worktreeId),
	prune: (projectId) => electron.ipcRenderer.invoke(IPC.worktrees.prune, projectId),
	suggestBranch: (projectId, task, requestId) => electron.ipcRenderer.invoke(IPC.worktrees.suggestBranch, projectId, task, requestId),
	cancelSuggestBranch: (requestId) => electron.ipcRenderer.invoke(IPC.worktrees.cancelSuggestBranch, requestId),
	pickLocation: (defaultPath) => electron.ipcRenderer.invoke(IPC.worktrees.pickLocation, defaultPath),
	/** Fires with the project id whenever that project's worktrees change. */
	onChanged: (cb) => subscribe(IPC.worktrees.onChanged, cb)
};
var packages = {
	list: (projectId) => electron.ipcRenderer.invoke(IPC.packages.list, projectId),
	update: (projectId, updates) => electron.ipcRenderer.invoke(IPC.packages.update, projectId, updates),
	onUpdateProgress: (cb) => subscribe(IPC.packages.onUpdateProgress, cb)
};
var remote = {
	getState: () => electron.ipcRenderer.invoke(IPC.remote.getState),
	listInterfaces: () => electron.ipcRenderer.invoke(IPC.remote.listInterfaces),
	startHost: (input) => electron.ipcRenderer.invoke(IPC.remote.startHost, input),
	stopHost: () => electron.ipcRenderer.invoke(IPC.remote.stopHost),
	generatePairingCode: () => electron.ipcRenderer.invoke(IPC.remote.generatePairingCode),
	connect: (code) => electron.ipcRenderer.invoke(IPC.remote.connect, code),
	connectFiles: (code) => electron.ipcRenderer.invoke(IPC.remote.connectFiles, code),
	disconnect: () => electron.ipcRenderer.invoke(IPC.remote.disconnect),
	listSavedServers: () => electron.ipcRenderer.invoke(IPC.remote.listSavedServers),
	connectSaved: (id) => electron.ipcRenderer.invoke(IPC.remote.connectSaved, id),
	connectSavedFiles: (id) => electron.ipcRenderer.invoke(IPC.remote.connectSavedFiles, id),
	renameSavedServer: (id, nickname) => electron.ipcRenderer.invoke(IPC.remote.renameSavedServer, id, nickname),
	removeSavedServer: (id) => electron.ipcRenderer.invoke(IPC.remote.removeSavedServer, id),
	openSessionWindow: () => electron.ipcRenderer.invoke(IPC.remote.openSessionWindow),
	sendClipboard: () => electron.ipcRenderer.invoke(IPC.remote.sendClipboard),
	sendFile: () => electron.ipcRenderer.invoke(IPC.remote.sendFile),
	getFileProgress: () => electron.ipcRenderer.invoke(IPC.remote.getFileProgress),
	fmRoots: () => electron.ipcRenderer.invoke(IPC.remote.fmRoots),
	fmList: (path) => electron.ipcRenderer.invoke(IPC.remote.fmList, path),
	fmMkdir: (parentPath, name) => electron.ipcRenderer.invoke(IPC.remote.fmMkdir, parentPath, name),
	fmDelete: (path) => electron.ipcRenderer.invoke(IPC.remote.fmDelete, path),
	fmRename: (path, newName) => electron.ipcRenderer.invoke(IPC.remote.fmRename, path, newName),
	fmUploadTo: (destDir) => electron.ipcRenderer.invoke(IPC.remote.fmUploadTo, destDir),
	fmDownload: (path) => electron.ipcRenderer.invoke(IPC.remote.fmDownload, path),
	sendInput: (event) => electron.ipcRenderer.send(IPC.remote.sendInput, event),
	setScreenInfo: (size) => electron.ipcRenderer.send(IPC.remote.setScreenInfo, size),
	setDisplaySize: (size) => electron.ipcRenderer.send(IPC.remote.setDisplaySize, size),
	hostTile: (tile) => electron.ipcRenderer.send(IPC.remote.hostTile, tile),
	rtcSignal: (peerId, message) => electron.ipcRenderer.send(IPC.remote.rtcSignal, {
		peerId,
		message
	}),
	rtcPeerState: (peerId, connected) => electron.ipcRenderer.send(IPC.remote.rtcPeerState, {
		peerId,
		connected
	}),
	clientRtcSignal: (message) => electron.ipcRenderer.send(IPC.remote.clientRtcSignal, message),
	rtcInput: (peerId, event) => electron.ipcRenderer.send(IPC.remote.rtcInput, {
		peerId,
		event
	}),
	setCursorTracking: (enabled) => electron.ipcRenderer.send(IPC.remote.setCursorTracking, enabled),
	benchSample: () => electron.ipcRenderer.invoke(IPC.remote.benchSample),
	onState: (cb) => subscribe(IPC.remote.onState, cb),
	onRtcSignal: (cb) => subscribe(IPC.remote.onRtcSignal, cb),
	onRtcPeerGone: (cb) => subscribe(IPC.remote.onRtcPeerGone, cb),
	onClientRtcSignal: (cb) => subscribe(IPC.remote.onClientRtcSignal, cb),
	onHostCursor: (cb) => subscribe(IPC.remote.onHostCursor, cb),
	onCaptureRefresh: (cb) => subscribe(IPC.remote.onCaptureRefresh, cb),
	onTileDemand: (cb) => subscribe(IPC.remote.onTileDemand, cb),
	onCaptureStart: (cb) => subscribe(IPC.remote.onCaptureStart, cb),
	onCaptureStop: (cb) => subscribe(IPC.remote.onCaptureStop, cb),
	onFrameTile: (cb) => subscribe(IPC.remote.onFrameTile, cb),
	onScreenInfo: (cb) => subscribe(IPC.remote.onScreenInfo, cb),
	onPeerDisplaySize: (cb) => subscribe(IPC.remote.onPeerDisplaySize, cb),
	onFileProgress: (cb) => subscribe(IPC.remote.onFileProgress, cb),
	onLog: (cb) => subscribe(IPC.remote.onLog, cb)
};
var usage = {
	list: () => electron.ipcRenderer.invoke(IPC.usage.list),
	get: (providerId) => electron.ipcRenderer.invoke(IPC.usage.get, providerId),
	refresh: () => electron.ipcRenderer.invoke(IPC.usage.refresh),
	setProviderConfig: (providerId, config) => electron.ipcRenderer.invoke(IPC.usage.setProviderConfig, {
		providerId,
		config
	}),
	setResetAlerts: (alerts) => electron.ipcRenderer.invoke(IPC.usage.setResetAlerts, alerts),
	testResetAlert: () => electron.ipcRenderer.invoke(IPC.usage.testResetAlert),
	setThresholdAlerts: (alerts) => electron.ipcRenderer.invoke(IPC.usage.setThresholdAlerts, alerts),
	testThresholdAlert: () => electron.ipcRenderer.invoke(IPC.usage.testThresholdAlert),
	onThresholdAlert: (callback) => subscribe(IPC.usage.onThresholdAlert, callback),
	listWidgets: () => electron.ipcRenderer.invoke(IPC.usage.listWidgets),
	getWidget: (id) => electron.ipcRenderer.invoke(IPC.usage.getWidget, id),
	openWidget: (providerId, options) => electron.ipcRenderer.invoke(IPC.usage.openWidget, providerId, options),
	closeWidget: (id) => electron.ipcRenderer.invoke(IPC.usage.closeWidget, id),
	setWidgetStyle: (id, style) => electron.ipcRenderer.invoke(IPC.usage.setWidgetStyle, id, style),
	setWidgetSize: (id, size) => electron.ipcRenderer.invoke(IPC.usage.setWidgetSize, id, size),
	setWidgetMode: (id, mode) => electron.ipcRenderer.invoke(IPC.usage.setWidgetMode, id, mode),
	configureWidget: (id, patch) => electron.ipcRenderer.invoke(IPC.usage.configureWidget, id, patch),
	onWidgetUpdated: (callback) => subscribe(IPC.usage.onWidgetUpdated, callback)
};
var pet = {
	setClickThrough: (ignore) => electron.ipcRenderer.send(IPC.pet.setClickThrough, ignore),
	setDragGuard: (active) => electron.ipcRenderer.send(IPC.pet.setDragGuard, active),
	getWorkArea: () => electron.ipcRenderer.invoke(IPC.pet.getWorkArea),
	onDisplayChanged: (callback) => subscribe(IPC.pet.onDisplayChanged, callback),
	onSettingsChanged: (callback) => subscribe(IPC.pet.onSettingsChanged, callback),
	onPipelineMessage: (callback) => subscribe(IPC.pet.onPipelineMessage, callback),
	importCustom: () => electron.ipcRenderer.invoke(IPC.pet.importCustom),
	removeCustom: (id) => electron.ipcRenderer.invoke(IPC.pet.removeCustom, id),
	customDataUrls: () => electron.ipcRenderer.invoke(IPC.pet.customDataUrls),
	snooze: (minutes) => electron.ipcRenderer.invoke(IPC.pet.snooze, minutes),
	cancelSnooze: () => electron.ipcRenderer.invoke(IPC.pet.cancelSnooze),
	getSnooze: () => electron.ipcRenderer.invoke(IPC.pet.getSnooze),
	onSnoozeChanged: (callback) => subscribe(IPC.pet.onSnoozeChanged, callback),
	showMainWindow: (route) => electron.ipcRenderer.send(IPC.pet.showMainWindow, route)
};
var spellcheck = {
	onShowMenu: (callback) => subscribe(IPC.spellcheck.onShowMenu, callback),
	/** Resolves false when the platform has no custom dictionary (macOS). */
	addToDictionary: (word) => electron.ipcRenderer.invoke(IPC.spellcheck.addToDictionary, word),
	/** Runs it in the field that has focus. Resolves false for a command main does not know. */
	runEditCommand: (command) => electron.ipcRenderer.invoke(IPC.spellcheck.runEditCommand, command)
};
var grammar = {
	/** Resolves with no issues when grammar checking is off, so callers don't have to check first. */
	check: (input) => electron.ipcRenderer.invoke(IPC.grammar.check, input),
	localStatus: () => electron.ipcRenderer.invoke(IPC.grammar.localStatus),
	/** Starts the server if it isn't up; resolves with the status either way, error included. */
	startLocal: () => electron.ipcRenderer.invoke(IPC.grammar.startLocal),
	stopLocal: () => electron.ipcRenderer.invoke(IPC.grammar.stopLocal),
	/** Resolves with the folder that was opened. */
	openToolsFolder: () => electron.ipcRenderer.invoke(IPC.grammar.openToolsFolder),
	onLocalStatus: (callback) => subscribe(IPC.grammar.onLocalStatus, callback)
};
var proxy = {
	/** Where the app's requests are going right now, plus what this machine is set to. */
	status: () => electron.ipcRenderer.invoke(IPC.proxy.status),
	/** Probes a candidate server without saving it, so a bad one never takes the app offline. */
	test: (candidate) => electron.ipcRenderer.invoke(IPC.proxy.test, candidate)
};
var windowControls = {
	minimize: () => electron.ipcRenderer.invoke(IPC.window.minimize),
	maximizeToggle: () => electron.ipcRenderer.invoke(IPC.window.maximizeToggle),
	close: () => electron.ipcRenderer.invoke(IPC.window.close),
	isMaximized: () => electron.ipcRenderer.invoke(IPC.window.isMaximized),
	onMaximizedChange: (callback) => {
		const listener = (_event, isMaximized) => callback(isMaximized);
		electron.ipcRenderer.on(IPC.window.onMaximizedChange, listener);
		return () => electron.ipcRenderer.removeListener(IPC.window.onMaximizedChange, listener);
	},
	isFocused: () => electron.ipcRenderer.invoke(IPC.window.isFocused),
	onFocusChange: (callback) => {
		const listener = (_event, isFocused) => callback(isFocused);
		electron.ipcRenderer.on(IPC.window.onFocusChange, listener);
		return () => electron.ipcRenderer.removeListener(IPC.window.onFocusChange, listener);
	}
};
var remoteSessionWindowControls = {
	minimize: () => electron.ipcRenderer.invoke(IPC.remoteSessionWindow.minimize),
	maximizeToggle: () => electron.ipcRenderer.invoke(IPC.remoteSessionWindow.maximizeToggle),
	close: () => electron.ipcRenderer.invoke(IPC.remoteSessionWindow.close),
	isMaximized: () => electron.ipcRenderer.invoke(IPC.remoteSessionWindow.isMaximized),
	onMaximizedChange: (callback) => {
		const listener = (_event, isMaximized) => callback(isMaximized);
		electron.ipcRenderer.on(IPC.remoteSessionWindow.onMaximizedChange, listener);
		return () => electron.ipcRenderer.removeListener(IPC.remoteSessionWindow.onMaximizedChange, listener);
	}
};
/** Per-project environments (production, staging, ...) with their env files and credentials. */
var environments = {
	list: (projectId) => electron.ipcRenderer.invoke(IPC.environments.list, projectId),
	save: (input) => electron.ipcRenderer.invoke(IPC.environments.save, input),
	remove: (id) => electron.ipcRenderer.invoke(IPC.environments.remove, id),
	reorder: (projectId, orderedIds) => electron.ipcRenderer.invoke(IPC.environments.reorder, projectId, orderedIds),
	saveFile: (input) => electron.ipcRenderer.invoke(IPC.environments.saveFile, input),
	removeFile: (environmentId, fileId) => electron.ipcRenderer.invoke(IPC.environments.removeFile, environmentId, fileId),
	readFile: (environmentId, fileId) => electron.ipcRenderer.invoke(IPC.environments.readFile, environmentId, fileId),
	copyFile: (environmentId, fileId) => electron.ipcRenderer.invoke(IPC.environments.copyFile, environmentId, fileId),
	saveCredential: (input) => electron.ipcRenderer.invoke(IPC.environments.saveCredential, input),
	removeCredential: (environmentId, credentialId) => electron.ipcRenderer.invoke(IPC.environments.removeCredential, environmentId, credentialId),
	revealCredential: (environmentId, credentialId) => electron.ipcRenderer.invoke(IPC.environments.revealCredential, environmentId, credentialId),
	copyCredentialSecret: (environmentId, credentialId) => electron.ipcRenderer.invoke(IPC.environments.copyCredentialSecret, environmentId, credentialId),
	scanFolder: (projectId) => electron.ipcRenderer.invoke(IPC.environments.scanFolder, projectId),
	importFromFolder: (projectId, picks) => electron.ipcRenderer.invoke(IPC.environments.importFromFolder, projectId, picks),
	writeToFolder: (environmentId, fileId, overwrite) => electron.ipcRenderer.invoke(IPC.environments.writeToFolder, environmentId, fileId, overwrite)
};
var rdp = {
	listServers: () => electron.ipcRenderer.invoke(IPC.rdp.listServers),
	saveServer: (input) => electron.ipcRenderer.invoke(IPC.rdp.saveServer, input),
	removeServer: (id) => electron.ipcRenderer.invoke(IPC.rdp.removeServer, id),
	/** Opens a session window for a saved server and returns its session id. */
	openSession: (serverId) => electron.ipcRenderer.invoke(IPC.rdp.openSession, serverId),
	getTicket: (sessionId) => electron.ipcRenderer.invoke(IPC.rdp.getTicket, sessionId),
	respondCertificate: (sessionId, trust) => electron.ipcRenderer.invoke(IPC.rdp.respondCertificate, sessionId, trust),
	/** Fetches the certificate a saved server presents now and compares it with the saved one. */
	checkCertificate: (serverId) => electron.ipcRenderer.invoke(IPC.rdp.checkCertificate, serverId),
	/** Saves the certificate the last check of this server saw, if it still has this fingerprint. */
	trustCertificate: (serverId, fingerprint) => electron.ipcRenderer.invoke(IPC.rdp.trustCertificate, serverId, fingerprint),
	/** Forgets the saved certificate, so the next connection saves whatever the server presents. */
	forgetCertificate: (serverId) => electron.ipcRenderer.invoke(IPC.rdp.forgetCertificate, serverId),
	readClipboardFiles: (sessionId, previousSignature) => electron.ipcRenderer.invoke(IPC.rdp.readClipboardFiles, sessionId, previousSignature),
	readClipboardFile: (sessionId, signature, index) => electron.ipcRenderer.invoke(IPC.rdp.readClipboardFile, sessionId, signature, index),
	beginDownload: (sessionId) => electron.ipcRenderer.invoke(IPC.rdp.beginDownload, sessionId),
	prepareDownloadEntry: (downloadId, index, entry) => electron.ipcRenderer.invoke(IPC.rdp.prepareDownloadEntry, downloadId, index, entry),
	writeDownloadChunk: (downloadId, index, bytes) => electron.ipcRenderer.invoke(IPC.rdp.writeDownloadChunk, downloadId, index, bytes),
	finishDownloadFile: (downloadId, index, ok) => electron.ipcRenderer.invoke(IPC.rdp.finishDownloadFile, downloadId, index, ok),
	openDownloadFolder: (downloadId) => electron.ipcRenderer.invoke(IPC.rdp.openDownloadFolder, downloadId),
	onCertificatePrompt: (callback) => subscribe(IPC.rdp.onCertificatePrompt, callback),
	onProxyError: (callback) => subscribe(IPC.rdp.onProxyError, callback)
};
var rdpWindowControls = {
	minimize: () => electron.ipcRenderer.invoke(IPC.rdpWindow.minimize),
	maximizeToggle: () => electron.ipcRenderer.invoke(IPC.rdpWindow.maximizeToggle),
	fullscreenToggle: () => electron.ipcRenderer.invoke(IPC.rdpWindow.fullscreenToggle),
	close: () => electron.ipcRenderer.invoke(IPC.rdpWindow.close),
	getState: () => electron.ipcRenderer.invoke(IPC.rdpWindow.getState),
	onStateChange: (callback) => subscribe(IPC.rdpWindow.onStateChange, callback)
};
/**
* The Windows build (e.g. 26200), which xterm needs to match how ConPTY redraws. Null elsewhere.
* Exported so the tests can run it on both platforms; the renderer reads `windowsBuild` instead.
*/
function windowsBuildNumber() {
	if (process.platform !== "win32") return null;
	const build = Number(process.getSystemVersion().split(".")[2]);
	return Number.isFinite(build) && build > 0 ? build : null;
}
var agentmatApi = {
	platform: process.platform,
	windowsBuild: windowsBuildNumber(),
	app: appInfo,
	cli,
	terminal,
	ssh,
	environments,
	vault: {
		status: () => electron.ipcRenderer.invoke(IPC.vault.status),
		create: (password) => electron.ipcRenderer.invoke(IPC.vault.create, password),
		unlock: (password) => electron.ipcRenderer.invoke(IPC.vault.unlock, password),
		lock: () => electron.ipcRenderer.invoke(IPC.vault.lock),
		changePassword: (current, next) => electron.ipcRenderer.invoke(IPC.vault.changePassword, current, next),
		reset: () => electron.ipcRenderer.invoke(IPC.vault.reset),
		list: () => electron.ipcRenderer.invoke(IPC.vault.list),
		getForEdit: (id) => electron.ipcRenderer.invoke(IPC.vault.getForEdit, id),
		reveal: (id, field) => electron.ipcRenderer.invoke(IPC.vault.reveal, id, field),
		copy: (id, field) => electron.ipcRenderer.invoke(IPC.vault.copy, id, field),
		save: (input) => electron.ipcRenderer.invoke(IPC.vault.save, input),
		remove: (ids) => electron.ipcRenderer.invoke(IPC.vault.remove, ids),
		patch: (id, change) => electron.ipcRenderer.invoke(IPC.vault.patch, id, change),
		duplicate: (id) => electron.ipcRenderer.invoke(IPC.vault.duplicate, id),
		touch: () => electron.ipcRenderer.invoke(IPC.vault.touch),
		/** A site's favicon as a small data URL for an entry; null when it has none. */
		fetchIcon: (siteUrl) => electron.ipcRenderer.invoke(IPC.vault.fetchIcon, siteUrl),
		importOpen: () => electron.ipcRenderer.invoke(IPC.vault.importOpen),
		importPreview: (token, mapping) => electron.ipcRenderer.invoke(IPC.vault.importPreview, token, mapping),
		importCommit: (token, mapping, policy) => electron.ipcRenderer.invoke(IPC.vault.importCommit, token, mapping, policy),
		importCancel: (token) => electron.ipcRenderer.invoke(IPC.vault.importCancel, token),
		exportCsv: (password, format) => electron.ipcRenderer.invoke(IPC.vault.exportCsv, password, format),
		onStateChanged: (cb) => subscribe(IPC.vault.onStateChanged, cb),
		onEntriesChanged: (cb) => subscribe(IPC.vault.onEntriesChanged, cb),
		onClipboardSettled: (cb) => subscribe(IPC.vault.onClipboardSettled, cb)
	},
	rdp,
	sshAgent,
	rdpAgent,
	agents,
	power,
	projects,
	skills,
	mcp,
	security,
	tools,
	android,
	docker,
	fs,
	explorer,
	workspaceSearch,
	settings,
	templates,
	activity,
	shell: shellApi,
	terminalClipboard,
	browser,
	spellcheck,
	grammar,
	proxy,
	window: windowControls,
	remoteSessionWindow: remoteSessionWindowControls,
	rdpWindow: rdpWindowControls,
	promptHistory,
	translate,
	ai,
	help,
	speech,
	system,
	ipGeo,
	projectDrafts,
	blueprints,
	promptBuildWidget,
	scheduledTasks,
	notifications,
	git,
	worktrees,
	pipelines,
	deploy,
	deploySecurity,
	deployHardening,
	deployWordPress,
	deployFirewall,
	deploySystem,
	deployJobs,
	deployAlerts,
	deployDocker,
	deployDirectTls,
	deployAssistant,
	deployLogs,
	deploySites,
	deployCerts,
	deployStacks,
	deployAppStore,
	deployRegistry,
	cloudflare,
	cloudflareServer,
	pullRequests,
	tests,
	appNotifications,
	apiClient,
	packages,
	remote,
	usage,
	pet,
	backup,
	splash: {
		onStatus: (cb) => subscribe(IPC.splash.onStatus, cb),
		onClose: (cb) => subscribe(IPC.splash.onClose, cb)
	}
};
electron.contextBridge.exposeInMainWorld("agentmat", agentmatApi);
//#endregion
exports.windowsBuildNumber = windowsBuildNumber;
