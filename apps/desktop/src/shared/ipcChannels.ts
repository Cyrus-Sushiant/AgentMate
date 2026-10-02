export const IPC = {
  app: {
    getVersion: 'app:getVersion',
    checkForUpdates: 'app:checkForUpdates',
    downloadUpdate: 'app:downloadUpdate',
    pauseDownload: 'app:pauseDownload',
    quitAndInstall: 'app:quitAndInstall',
    onUpdateStatus: 'app:onUpdateStatus',
    relaunch: 'app:relaunch',
    /** main -> the app window: show this route (a deep link from the pet or a tray click). */
    onNavigate: 'app:navigate',
    /** The renderer collecting a route that arrived while the window was still loading. */
    pendingNavigate: 'app:pendingNavigate',
    /** The app window reporting the page it is on, so the next launch can open there. */
    setLastRoute: 'app:setLastRoute',
    /** main -> the app window: sessions are still open, ask before closing the app. */
    onConfirmQuit: 'app:confirmQuit',
    /** The renderer's answer to onConfirmQuit. */
    answerQuit: 'app:answerQuit',
    /** The app window saying its first page has loaded, so the splash can hand over. */
    rendererReady: 'app:rendererReady',
  },
  backup: {
    export: 'backup:export',
    open: 'backup:open',
    restore: 'backup:restore',
  },
  blueprints: {
    get: 'blueprints:get',
    updateSection: 'blueprints:updateSection',
    setFinalPrompt: 'blueprints:setFinalPrompt',
    setDocsFolder: 'blueprints:setDocsFolder',
    setConfirmBeforeWriting: 'blueprints:setConfirmBeforeWriting',
    pickAttachments: 'blueprints:pickAttachments',
    addAttachment: 'blueprints:addAttachment',
    renameAttachment: 'blueprints:renameAttachment',
    removeAttachment: 'blueprints:removeAttachment',
    attachmentPath: 'blueprints:attachmentPath',
    listRevisions: 'blueprints:listRevisions',
    agentFileTarget: 'blueprints:agentFileTarget',
    syncAgentFile: 'blueprints:syncAgentFile',
    listPresets: 'blueprints:listPresets',
    savePreset: 'blueprints:savePreset',
    deletePreset: 'blueprints:deletePreset',
  },
  cli: {
    detectAll: 'cli:detectAll',
    getInstallCommand: 'cli:getInstallCommand',
    checkForUpdate: 'cli:checkForUpdate',
    getUpdateCommand: 'cli:getUpdateCommand',
  },
  terminal: {
    create: 'terminal:create',
    write: 'terminal:write',
    resize: 'terminal:resize',
    kill: 'terminal:kill',
    usage: 'terminal:usage',
    onData: 'terminal:onData',
    onExit: 'terminal:onExit',
  },
  ssh: {
    listServers: 'ssh:listServers',
    saveServer: 'ssh:saveServer',
    removeServer: 'ssh:removeServer',
    pickPrivateKeyFile: 'ssh:pickPrivateKeyFile',
    vaultStatus: 'ssh:vaultStatus',
    unlockVault: 'ssh:unlockVault',
    setPasskey: 'ssh:setPasskey',
    create: 'ssh:create',
    write: 'ssh:write',
    resize: 'ssh:resize',
    kill: 'ssh:kill',
    // (serverId) -> SshHostKeyStatus: the stored key and the one the server presents now
    hostKeyStatus: 'ssh:hostKeyStatus',
    // (serverId, fingerprint): trusts the presented key, provided it is still that fingerprint
    trustHostKey: 'ssh:trustHostKey',
    onData: 'ssh:onData',
    onExit: 'ssh:onExit',
  },
  environments: {
    list: 'environments:list',
    save: 'environments:save',
    remove: 'environments:remove',
    reorder: 'environments:reorder',
    saveFile: 'environments:saveFile',
    removeFile: 'environments:removeFile',
    readFile: 'environments:readFile',
    copyFile: 'environments:copyFile',
    saveCredential: 'environments:saveCredential',
    removeCredential: 'environments:removeCredential',
    revealCredential: 'environments:revealCredential',
    copyCredentialSecret: 'environments:copyCredentialSecret',
    scanFolder: 'environments:scanFolder',
    importFromFolder: 'environments:importFromFolder',
    writeToFolder: 'environments:writeToFolder',
  },
  vault: {
    status: 'vault:status',
    create: 'vault:create',
    unlock: 'vault:unlock',
    lock: 'vault:lock',
    changePassword: 'vault:changePassword',
    reset: 'vault:reset',
    list: 'vault:list',
    getForEdit: 'vault:getForEdit',
    reveal: 'vault:reveal',
    copy: 'vault:copy',
    save: 'vault:save',
    remove: 'vault:remove',
    patch: 'vault:patch',
    duplicate: 'vault:duplicate',
    touch: 'vault:touch',
    importOpen: 'vault:importOpen',
    importPreview: 'vault:importPreview',
    importCommit: 'vault:importCommit',
    importCancel: 'vault:importCancel',
    exportCsv: 'vault:exportCsv',
    fetchIcon: 'vault:fetchIcon',
    // main -> renderer
    onStateChanged: 'vault:onStateChanged',
    onEntriesChanged: 'vault:onEntriesChanged',
    onClipboardSettled: 'vault:onClipboardSettled',
  },
  rdp: {
    listServers: 'rdp:listServers',
    saveServer: 'rdp:saveServer',
    removeServer: 'rdp:removeServer',
    openSession: 'rdp:openSession',
    getTicket: 'rdp:getTicket',
    respondCertificate: 'rdp:respondCertificate',
    readClipboardFiles: 'rdp:readClipboardFiles',
    readClipboardFile: 'rdp:readClipboardFile',
    beginDownload: 'rdp:beginDownload',
    prepareDownloadEntry: 'rdp:prepareDownloadEntry',
    writeDownloadChunk: 'rdp:writeDownloadChunk',
    finishDownloadFile: 'rdp:finishDownloadFile',
    openDownloadFolder: 'rdp:openDownloadFolder',
    onCertificatePrompt: 'rdp:onCertificatePrompt',
    onProxyError: 'rdp:onProxyError',
  },
  rdpWindow: {
    minimize: 'rdpWindow:minimize',
    maximizeToggle: 'rdpWindow:maximizeToggle',
    fullscreenToggle: 'rdpWindow:fullscreenToggle',
    close: 'rdpWindow:close',
    getState: 'rdpWindow:getState',
    onStateChange: 'rdpWindow:onStateChange',
  },
  sshAgent: {
    start: 'sshAgent:start',
    approveCommand: 'sshAgent:approveCommand',
    skipCommand: 'sshAgent:skipCommand',
    answerNeedsInput: 'sshAgent:answerNeedsInput',
    answerPassword: 'sshAgent:answerPassword',
    stop: 'sshAgent:stop',
    continue: 'sshAgent:continue',
    history: 'sshAgent:history',
    notifyWaiting: 'sshAgent:notifyWaiting',
    // main -> renderer: the task's status changed (thinking, proposed a command, running it, ...)
    onProgress: 'sshAgent:onProgress',
  },
  projects: {
    list: 'projects:list',
    create: 'projects:create',
    update: 'projects:update',
    delete: 'projects:delete',
    reorder: 'projects:reorder',
    setPinned: 'projects:setPinned',
    setArchived: 'projects:setArchived',
    bootstrap: 'projects:bootstrap',
    bootstrapPlan: 'projects:bootstrapPlan',
    pickFolder: 'projects:pickFolder',
    pickIcon: 'projects:pickIcon',
    normalizeIcon: 'projects:normalizeIcon',
    fetchFavicon: 'projects:fetchFavicon',
    updateNotifications: 'projects:updateNotifications',
    listClaudeHooks: 'projects:listClaudeHooks',
    updateClaudeHook: 'projects:updateClaudeHook',
    deleteClaudeHook: 'projects:deleteClaudeHook',
  },
  notifications: {
    sendTest: 'notifications:sendTest',
    /** Shows a message on the desktop companion, the way the pet hook does. */
    sendPetTest: 'notifications:sendPetTest',
    detectChatId: 'notifications:detectChatId',
    onConfirmationForwarded: 'notifications:onConfirmationForwarded',
  },
  skills: {
    listRepositories: 'skills:listRepositories',
    addRepository: 'skills:addRepository',
    removeRepository: 'skills:removeRepository',
    refreshRepository: 'skills:refreshRepository',
    getRepositoryIndex: 'skills:getRepositoryIndex',
    pickLocalRepository: 'skills:pickLocalRepository',
    previewLocalRepository: 'skills:previewLocalRepository',
    install: 'skills:install',
    remove: 'skills:remove',
    listInstalled: 'skills:listInstalled',
    checkForUpdates: 'skills:checkForUpdates',
    searchSkillsSh: 'skills:searchSkillsSh',
    getSkillsShDetail: 'skills:getSkillsShDetail',
    recordSkillsShInstall: 'skills:recordSkillsShInstall',
    checkUiProPrerequisites: 'skills:checkUiProPrerequisites',
    checkUiProUpdate: 'skills:checkUiProUpdate',
    recordUiProInstall: 'skills:recordUiProInstall',
    // Favorites
    listFavorites: 'skills:listFavorites',
    addFavorite: 'skills:addFavorite',
    removeFavorite: 'skills:removeFavorite',
    // Usage
    /** Aggregated Skill invocations read out of the local agent session transcripts. */
    getUsage: 'skills:getUsage',
    /** Same, after throwing away the incremental scan cache and re-reading every transcript. */
    rescanUsage: 'skills:rescanUsage',
    /** Where a used skill's files live, and which projects already have a copy. */
    inspectUsedSkill: 'skills:inspectUsedSkill',
    /** Copies a used skill's folder into other projects' skills dirs. */
    addUsedSkillToProjects: 'skills:addUsedSkillToProjects',
    // Security audit
    runAudit: 'skills:runAudit',
    cancelAudit: 'skills:cancelAudit',
    /** Reports what a pasted folder path or GitHub address holds, before anything is scanned. */
    previewAuditSource: 'skills:previewAuditSource',
    /** Skills sitting in a scope's agent dirs, whether or not AgentMate installed them. */
    listOnDiskSkills: 'skills:listOnDiskSkills',
    listAudits: 'skills:listAudits',
    latestAuditPerSkill: 'skills:latestAuditPerSkill',
    getAudit: 'skills:getAudit',
    removeAudit: 'skills:removeAudit',
    clearAudits: 'skills:clearAudits',
    // main -> renderer events
    /** A watched local-folder repository changed on disk; payload is the repository id. */
    onRepositoryChanged: 'skills:onRepositoryChanged',
  },
  mcp: {
    listRepositories: 'mcp:listRepositories',
    addRepository: 'mcp:addRepository',
    removeRepository: 'mcp:removeRepository',
    refreshRepository: 'mcp:refreshRepository',
    getRepositoryIndex: 'mcp:getRepositoryIndex',
    pickLocalRepository: 'mcp:pickLocalRepository',
    install: 'mcp:install',
    remove: 'mcp:remove',
    listInstalled: 'mcp:listInstalled',
  },
  fs: {
    readFile: 'fs:readFile',
    readImage: 'fs:readImage',
    writeFile: 'fs:writeFile',
    listDirectory: 'fs:listDirectory',
    writeScratchFile: 'fs:writeScratchFile',
    saveFileAs: 'fs:saveFileAs',
  },
  explorer: {
    createFile: 'explorer:createFile',
    createFolder: 'explorer:createFolder',
    rename: 'explorer:rename',
    delete: 'explorer:delete',
    copy: 'explorer:copy',
    move: 'explorer:move',
    pasteExternal: 'explorer:pasteExternal',
    osClipboardPaths: 'explorer:osClipboardPaths',
    revealInOs: 'explorer:revealInOs',
    addToGitignore: 'explorer:addToGitignore',
    untrack: 'explorer:untrack',
    ignoredPaths: 'explorer:ignoredPaths',
    listFiles: 'explorer:listFiles',
  },
  workspaceSearch: {
    text: 'workspaceSearch:text',
    cancel: 'workspaceSearch:cancel',
    symbols: 'workspaceSearch:symbols',
    onTextResults: 'workspaceSearch:textResults',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
  },
  templates: {
    list: 'templates:list',
    save: 'templates:save',
    delete: 'templates:delete',
  },
  activity: {
    list: 'activity:list',
  },
  system: {
    sample: 'system:sample',
    topApps: 'system:topApps',
    killProcess: 'system:killProcess',
  },
  ipGeo: {
    lookup: 'ipGeo:lookup',
  },
  shell: {
    openExternal: 'shell:openExternal',
    openPath: 'shell:openPath',
    openInEditor: 'shell:openInEditor',
  },
  promptHistory: {
    list: 'promptHistory:list',
    search: 'promptHistory:search',
    add: 'promptHistory:add',
    remove: 'promptHistory:remove',
    setTags: 'promptHistory:setTags',
    setProject: 'promptHistory:setProject',
  },
  translate: {
    text: 'translate:text',
    cancel: 'translate:cancel',
  },
  speech: {
    transcribe: 'speech:transcribe',
    getModelState: 'speech:getModelState',
    // main -> renderer: first-run model download progress
    onModelProgress: 'speech:onModelProgress',
  },
  ai: {
    ask: 'ai:ask',
    cancel: 'ai:cancel',
    listOllamaModels: 'ai:listOllamaModels',
    testOllama: 'ai:testOllama',
    listGeminiModels: 'ai:listGeminiModels',
    assessRun: 'ai:assessRun',
    cancelAssessRun: 'ai:cancelAssessRun',
  },
  projectDrafts: {
    listByProject: 'projectDrafts:listByProject',
    create: 'projectDrafts:create',
    updateStatus: 'projectDrafts:updateStatus',
    update: 'projectDrafts:update',
    promoteToScheduled: 'projectDrafts:promoteToScheduled',
    remove: 'projectDrafts:remove',
  },
  promptBuildWidget: {
    listWidgets: 'promptBuildWidget:listWidgets',
    getWidget: 'promptBuildWidget:getWidget',
    openWidget: 'promptBuildWidget:openWidget',
    closeWidget: 'promptBuildWidget:closeWidget',
  },
  scheduledTasks: {
    list: 'scheduledTasks:list',
    listByProject: 'scheduledTasks:listByProject',
    createMany: 'scheduledTasks:createMany',
    updateStatus: 'scheduledTasks:updateStatus',
    update: 'scheduledTasks:update',
    markRan: 'scheduledTasks:markRan',
    remove: 'scheduledTasks:remove',
    // main -> renderer: an automatic task is due, open it in a terminal
    onDue: 'scheduledTasks:due',
    // main -> renderer: tasks changed outside the renderer (fired or missed)
    onChanged: 'scheduledTasks:changed',
  },
  spellcheck: {
    // main -> renderer: an editable field was right-clicked, open the writing menu
    onShowMenu: 'spellcheck:showMenu',
    addToDictionary: 'spellcheck:addToDictionary',
  },
  splash: {
    // main -> splash window: what startup is busy with right now
    onStatus: 'splash:status',
    // main -> splash window: the app window is up, fade out
    onClose: 'splash:close',
  },
  grammar: {
    check: 'grammar:check',
    /** Where the local LanguageTool lives, whether Java is there, and what the server is doing. */
    localStatus: 'grammar:localStatus',
    startLocal: 'grammar:startLocal',
    stopLocal: 'grammar:stopLocal',
    /** Opens the tools folder in the OS file manager, creating it first if needed. */
    openToolsFolder: 'grammar:openToolsFolder',
    // main -> renderer: the local server changed state (starting, up, failed)
    onLocalStatus: 'grammar:onLocalStatus',
  },
  proxy: {
    /** Where requests are going right now, plus what this machine itself is set to. */
    status: 'proxy:status',
    /** Sends one probe request through a candidate server without saving it. */
    test: 'proxy:test',
  },
  window: {
    minimize: 'window:minimize',
    maximizeToggle: 'window:maximizeToggle',
    close: 'window:close',
    isMaximized: 'window:isMaximized',
    onMaximizedChange: 'window:onMaximizedChange',
  },
  /** Same shape as `window`, but scoped to the standalone remote session window. */
  remoteSessionWindow: {
    minimize: 'remoteSessionWindow:minimize',
    maximizeToggle: 'remoteSessionWindow:maximizeToggle',
    close: 'remoteSessionWindow:close',
    isMaximized: 'remoteSessionWindow:isMaximized',
    onMaximizedChange: 'remoteSessionWindow:onMaximizedChange',
  },
  remote: {
    getState: 'remote:getState',
    listInterfaces: 'remote:listInterfaces',
    startHost: 'remote:startHost',
    stopHost: 'remote:stopHost',
    generatePairingCode: 'remote:generatePairingCode',
    connect: 'remote:connect',
    /** Same as `connect`, but the resulting session skips capture/WebRTC entirely: file transfer and file-manager browsing only. */
    connectFiles: 'remote:connectFiles',
    disconnect: 'remote:disconnect',
    listSavedServers: 'remote:listSavedServers',
    connectSaved: 'remote:connectSaved',
    connectSavedFiles: 'remote:connectSavedFiles',
    renameSavedServer: 'remote:renameSavedServer',
    removeSavedServer: 'remote:removeSavedServer',
    /** Opens (or focuses) the standalone, resizable session window. */
    openSessionWindow: 'remote:openSessionWindow',
    sendInput: 'remote:sendInput',
    hostTile: 'remote:hostTile',
    setScreenInfo: 'remote:setScreenInfo',
    /** Controller role: reports the video display box's physical-pixel size, debounced on resize. */
    setDisplaySize: 'remote:setDisplaySize',
    sendClipboard: 'remote:sendClipboard',
    sendFile: 'remote:sendFile',
    getFileProgress: 'remote:getFileProgress',
    // Remote file manager: browse/mkdir/delete/rename/upload/download on the peer's filesystem.
    fmRoots: 'remote:fmRoots',
    fmList: 'remote:fmList',
    fmMkdir: 'remote:fmMkdir',
    fmDelete: 'remote:fmDelete',
    fmRename: 'remote:fmRename',
    fmUploadTo: 'remote:fmUploadTo',
    fmDownload: 'remote:fmDownload',
    rtcSignal: 'remote:rtcSignal',
    rtcPeerState: 'remote:rtcPeerState',
    /** Controller role: renderer -> main -> host, WebRTC signaling. */
    clientRtcSignal: 'remote:clientRtcSignal',
    /** Host role: an input event that arrived over the input DataChannel. */
    rtcInput: 'remote:rtcInput',
    /** Host role: renderer asks main to start/stop sampling the OS cursor. */
    setCursorTracking: 'remote:setCursorTracking',
    /** Benchmarking: main-process CPU/memory sample. */
    benchSample: 'remote:benchSample',
    // main -> renderer events
    onState: 'remote:onState',
    onRtcSignal: 'remote:onRtcSignal',
    onRtcPeerGone: 'remote:onRtcPeerGone',
    /** Controller role: WebRTC signaling arriving from the host. */
    onClientRtcSignal: 'remote:onClientRtcSignal',
    /** Host role: sampled OS cursor position, for the cursor DataChannel. */
    onHostCursor: 'remote:onHostCursor',
    onCaptureRefresh: 'remote:onCaptureRefresh',
    onTileDemand: 'remote:onTileDemand',
    onCaptureStart: 'remote:onCaptureStart',
    onCaptureStop: 'remote:onCaptureStop',
    onFrameTile: 'remote:onFrameTile',
    onScreenInfo: 'remote:onScreenInfo',
    /** Host role: a connected peer reported (or updated) its display box size. */
    onPeerDisplaySize: 'remote:onPeerDisplaySize',
    onFileProgress: 'remote:onFileProgress',
    onLog: 'remote:onLog',
  },
  security: {
    preflight: 'security:preflight',
    runScan: 'security:runScan',
    cancelScan: 'security:cancelScan',
    activeScan: 'security:activeScan',
    history: 'security:history',
    getScan: 'security:getScan',
    latest: 'security:latest',
    deleteScan: 'security:deleteScan',
    getConfig: 'security:getConfig',
    setConfig: 'security:setConfig',
    suggestCodeqlLanguage: 'security:suggestCodeqlLanguage',
    codeqlStatus: 'security:codeqlStatus',
    installCodeql: 'security:installCodeql',
    cancelCodeqlInstall: 'security:cancelCodeqlInstall',
    removeCodeql: 'security:removeCodeql',
    openCodeqlFolder: 'security:openCodeqlFolder',
    onCodeqlProgress: 'security:onCodeqlProgress',
    onScanProgress: 'security:onScanProgress',
  },
  tools: {
    detectAll: 'tools:detectAll',
    getInstallCommand: 'tools:getInstallCommand',
    checkForUpdate: 'tools:checkForUpdate',
    getUpdateCommand: 'tools:getUpdateCommand',
    getUninstallCommand: 'tools:getUninstallCommand',
    getInteractiveLaunchCommand: 'tools:getInteractiveLaunchCommand',
    getDockerCommand: 'tools:getDockerCommand',
  },
  docker: {
    availability: 'docker:availability',
    list: 'docker:list',
    listForProject: 'docker:listForProject',
    start: 'docker:start',
    stop: 'docker:stop',
    restart: 'docker:restart',
    remove: 'docker:remove',
  },
  /** The Android page: the SDK behind it, AVDs, emulators and adb devices. */
  android: {
    sdk: 'android:sdk',
    setSdkPath: 'android:setSdkPath',
    pickSdkPath: 'android:pickSdkPath',
    refresh: 'android:refresh',
    start: 'android:start',
    stop: 'android:stop',
    cancelBoot: 'android:cancelBoot',
    watchUsage: 'android:watchUsage',
    rotate: 'android:rotate',
    screenshot: 'android:screenshot',
    startRecording: 'android:startRecording',
    stopRecording: 'android:stopRecording',
    installApk: 'android:installApk',
    pickApk: 'android:pickApk',
    adbPath: 'android:adbPath',
    revealCapture: 'android:revealCapture',
    openCapturesFolder: 'android:openCapturesFolder',
    createAvd: 'android:createAvd',
    deleteAvd: 'android:deleteAvd',
    editAvd: 'android:editAvd',
    avdConfig: 'android:avdConfig',
    wipeData: 'android:wipeData',
    listSystemImages: 'android:listSystemImages',
    availableSystemImages: 'android:availableSystemImages',
    installSystemImage: 'android:installSystemImage',
    listDeviceProfiles: 'android:listDeviceProfiles',
    pair: 'android:pair',
    connect: 'android:connect',
    disconnect: 'android:disconnect',
    enableWireless: 'android:enableWireless',
    /** main -> every renderer: device list, emulator state, usage and SDK changes. */
    onEvent: 'android:event',
  },
  usage: {
    list: 'usage:list',
    get: 'usage:get',
    refresh: 'usage:refresh',
    setProviderConfig: 'usage:setProviderConfig',
    listWidgets: 'usage:listWidgets',
    getWidget: 'usage:getWidget',
    openWidget: 'usage:openWidget',
    closeWidget: 'usage:closeWidget',
    setWidgetStyle: 'usage:setWidgetStyle',
    setWidgetSize: 'usage:setWidgetSize',
    setWidgetMode: 'usage:setWidgetMode',
    configureWidget: 'usage:configureWidget',
    setResetAlerts: 'usage:setResetAlerts',
    testResetAlert: 'usage:testResetAlert',
    setThresholdAlerts: 'usage:setThresholdAlerts',
    testThresholdAlert: 'usage:testThresholdAlert',
    // main -> renderer: threshold alert fired but the OS has no notification
    // centre to show it, so the renderer shows a toast instead.
    onThresholdAlert: 'usage:onThresholdAlert',
    // main -> widget window: instance changed, re-read it
    onWidgetUpdated: 'usage:widgetUpdated',
  },
  pet: {
    setClickThrough: 'pet:setClickThrough',
    /**
     * app -> main: a native drag started (or ended) in the app window, so the
     * companion overlay has to step out of the way until it is over.
     */
    setDragGuard: 'pet:setDragGuard',
    getWorkArea: 'pet:getWorkArea',
    onDisplayChanged: 'pet:displayChanged',
    onSettingsChanged: 'pet:settingsChanged',
    onPipelineMessage: 'pet:pipelineMessage',
    importCustom: 'pet:importCustom',
    removeCustom: 'pet:removeCustom',
    customDataUrls: 'pet:customDataUrls',
    /** Hide the companion for N minutes; it comes back on its own. */
    snooze: 'pet:snooze',
    cancelSnooze: 'pet:cancelSnooze',
    getSnooze: 'pet:getSnooze',
    /** main -> every renderer: the hide started, was cancelled, or ran out. */
    onSnoozeChanged: 'pet:snoozeChanged',
    /**
     * Brings the app window back to the front. Takes an optional route, so the
     * failure the pet just announced can open on the Pipelines page.
     */
    showMainWindow: 'pet:showMainWindow',
  },
  /** The workspace Tests panel: discover a project's tests, run them, and follow the run. */
  tests: {
    discover: 'tests:discover',
    run: 'tests:run',
    cancel: 'tests:cancel',
    lastRun: 'tests:lastRun',
    command: 'tests:command',
    /** main -> every renderer: TestRunEvent as a run starts, prints, reports results and ends. */
    onRunEvent: 'tests:onRunEvent',
  },
  pipelines: {
    status: 'pipelines:status',
    setMuted: 'pipelines:setMuted',
    dashboardActivity: 'pipelines:dashboardActivity',
    runError: 'pipelines:runError',
    runAnnotations: 'pipelines:runAnnotations',
    refs: 'pipelines:refs',
    dispatch: 'pipelines:dispatch',
    cancelRun: 'pipelines:cancelRun',
  },
  /** The Deploy section: saved servers, installing the server core, and its health. */
  deploy: {
    listServers: 'deploy:listServers',
    preflight: 'deploy:preflight',
    install: 'deploy:install',
    uninstall: 'deploy:uninstall',
    health: 'deploy:health',
    access: 'deploy:access',
    enroll: 'deploy:enroll',
    signIn: 'deploy:signIn',
    signOut: 'deploy:signOut',
    account: 'deploy:account',
    stepUp: 'deploy:stepUp',
    beginTotp: 'deploy:beginTotp',
    confirmTotp: 'deploy:confirmTotp',
    disableTotp: 'deploy:disableTotp',
    onSetupProgress: 'deploy:onSetupProgress',
    /** (serverId) -> DeployConnection: the server's lasting connection right now. */
    connection: 'deploy:connection',
    /** (serverId) -> DeployConnection: tries the connection again now, whatever it waited for. */
    reconnect: 'deploy:reconnect',
    /** main -> the main window: DeployConnection, whenever a server's connection changes. */
    onConnection: 'deploy:onConnection',
  },
  /** The Deploy section's Overview: a server's facts, live metrics, updates, reboot and restarts. */
  deploySystem: {
    info: 'deploySystem:info',
    services: 'deploySystem:services',
    metricsHistory: 'deploySystem:metricsHistory',
    updates: 'deploySystem:updates',
    checkUpdates: 'deploySystem:checkUpdates',
    upgradeSecurity: 'deploySystem:upgradeSecurity',
    upgradeAll: 'deploySystem:upgradeAll',
    setAutomaticUpdates: 'deploySystem:setAutomaticUpdates',
    reboot: 'deploySystem:reboot',
    restartService: 'deploySystem:restartService',
    /** (DeployMetricsWatchInput) -> subscription id; samples arrive on onMetrics. */
    watchMetrics: 'deploySystem:watchMetrics',
    unwatchMetrics: 'deploySystem:unwatchMetrics',
    /** main -> the window that asked: DeployMetricsEvent, a batch of live samples. */
    onMetrics: 'deploySystem:onMetrics',
  },
  /** The jobs a server core runs (updates, reboots, restarts) and their live logs. */
  deployJobs: {
    list: 'deployJobs:list',
    get: 'deployJobs:get',
    cancel: 'deployJobs:cancel',
    /** (DeployJobWatchInput) -> subscription id; the log arrives on onLog. */
    watch: 'deployJobs:watch',
    unwatch: 'deployJobs:unwatch',
    /** main -> the window that asked: DeployJobEvent, new log lines and the job's state. */
    onLog: 'deployJobs:onLog',
  },
  /** A server core's alerts: disk pressure, failed jobs, a reboot waiting. */
  deployAlerts: {
    list: 'deployAlerts:list',
    acknowledge: 'deployAlerts:acknowledge',
    /** (serverId) -> subscription id; the open alerts, then changes, arrive on onChanged. */
    watch: 'deployAlerts:watch',
    unwatch: 'deployAlerts:unwatch',
    /** main -> the window that asked: DeployAlertsEvent, alerts in revision order. */
    onChanged: 'deployAlerts:onChanged',
  },
  /** A server's websites (E10): nginx itself, sites, stream proxies, applying, and site logs. */
  deploySites: {
    status: 'deploySites:status',
    list: 'deploySites:list',
    listStreams: 'deploySites:listStreams',
    install: 'deploySites:install',
    save: 'deploySites:save',
    remove: 'deploySites:remove',
    saveStream: 'deploySites:saveStream',
    removeStream: 'deploySites:removeStream',
    apply: 'deploySites:apply',
    setSnippets: 'deploySites:setSnippets',
    /** (DeploySiteLogWatchInput) -> subscription id; lines arrive on onLog. */
    watchLog: 'deploySites:watchLog',
    unwatchLog: 'deploySites:unwatchLog',
    /** main -> the window that asked: DeploySiteLogEvent, new lines of a site's log. */
    onLog: 'deploySites:onLog',
  },
  /** A server's certificates (E11): Let's Encrypt orders and renewals, uploads and removal. */
  deployCerts: {
    list: 'deployCerts:list',
    issue: 'deployCerts:issue',
    renew: 'deployCerts:renew',
    upload: 'deployCerts:upload',
    remove: 'deployCerts:remove',
  },
  /**
   * A server's host firewall (E13): status, presets, change history and exposure for every role;
   * preview, apply (safe apply: confirm over a new SSH connection, or it rolls back) for Admins.
   */
  deployFirewall: {
    status: 'deployFirewall:status',
    presets: 'deployFirewall:presets',
    history: 'deployFirewall:history',
    exposure: 'deployFirewall:exposure',
    preview: 'deployFirewall:preview',
    apply: 'deployFirewall:apply',
    /** (DeployFirewallDecisionInput) -> the change kept, confirmed over a new SSH connection. */
    confirm: 'deployFirewall:confirm',
    revert: 'deployFirewall:revert',
    /** main -> the main window: DeployFirewallProgressEvent, each step of apply/confirm/revert. */
    onProgress: 'deployFirewall:onProgress',
  },
  /**
   * Docker on a server (E06): the engine and its install, containers and their lifecycle, live
   * stats, logs and engine events, a console, and images, volumes, networks and disk use.
   */
  deployDocker: {
    status: 'deployDocker:status',
    install: 'deployDocker:install',
    listContainers: 'deployDocker:listContainers',
    inspect: 'deployDocker:inspect',
    /** Admins, after a step-up: the container's environment values. */
    revealEnv: 'deployDocker:revealEnv',
    act: 'deployDocker:act',
    remove: 'deployDocker:remove',
    /** The last lines of a container's log, collected once. */
    logTail: 'deployDocker:logTail',
    listImages: 'deployDocker:listImages',
    pullImage: 'deployDocker:pullImage',
    removeImage: 'deployDocker:removeImage',
    listVolumes: 'deployDocker:listVolumes',
    removeVolume: 'deployDocker:removeVolume',
    listNetworks: 'deployDocker:listNetworks',
    removeNetwork: 'deployDocker:removeNetwork',
    diskUsage: 'deployDocker:diskUsage',
    prune: 'deployDocker:prune',
    /** (serverId) -> subscription id; every running container's stats arrive on onStats. */
    watchStats: 'deployDocker:watchStats',
    unwatchStats: 'deployDocker:unwatchStats',
    onStats: 'deployDocker:onStats',
    /** (DeployContainerLogsWatchInput) -> subscription id; lines arrive on onLogs. */
    watchLogs: 'deployDocker:watchLogs',
    unwatchLogs: 'deployDocker:unwatchLogs',
    onLogs: 'deployDocker:onLogs',
    /** (serverId) -> subscription id; engine events arrive on onEvents. */
    watchEvents: 'deployDocker:watchEvents',
    unwatchEvents: 'deployDocker:unwatchEvents',
    onEvents: 'deployDocker:onEvents',
    /** (DeployConsoleOpenInput) -> subscription id; the screen arrives on onConsole. */
    openConsole: 'deployDocker:openConsole',
    /** (subscription id, keystrokes) */
    consoleInput: 'deployDocker:consoleInput',
    /** (subscription id, columns, rows) */
    consoleResize: 'deployDocker:consoleResize',
    closeConsole: 'deployDocker:closeConsole',
    onConsole: 'deployDocker:onConsole',
  },
  /**
   * A server core's Security area: users and roles (Owner), devices and sessions, enrollment
   * codes (made by an Owner, redeemed on another computer) and the audit trail.
   */
  deploySecurity: {
    listUsers: 'deploySecurity:listUsers',
    createUser: 'deploySecurity:createUser',
    setUserRole: 'deploySecurity:setUserRole',
    setUserDisabled: 'deploySecurity:setUserDisabled',
    resetUserPassword: 'deploySecurity:resetUserPassword',
    deleteUser: 'deploySecurity:deleteUser',
    createEnrollmentCode: 'deploySecurity:createEnrollmentCode',
    redeemEnrollmentCode: 'deploySecurity:redeemEnrollmentCode',
    listDevices: 'deploySecurity:listDevices',
    revokeDevice: 'deploySecurity:revokeDevice',
    listSessions: 'deploySecurity:listSessions',
    revokeSession: 'deploySecurity:revokeSession',
    revokeOtherSessions: 'deploySecurity:revokeOtherSessions',
    queryAudit: 'deploySecurity:queryAudit',
    verifyAudit: 'deploySecurity:verifyAudit',
    exportAudit: 'deploySecurity:exportAudit',
  },
  /** The Deploy section's Cloudflare page: the API token, zones, DNS, settings and rules. */
  cloudflare: {
    status: 'cloudflare:status',
    saveToken: 'cloudflare:saveToken',
    checkToken: 'cloudflare:checkToken',
    removeToken: 'cloudflare:removeToken',
    listZones: 'cloudflare:listZones',
    listRecords: 'cloudflare:listRecords',
    createRecord: 'cloudflare:createRecord',
    updateRecord: 'cloudflare:updateRecord',
    deleteRecord: 'cloudflare:deleteRecord',
    zoneSettings: 'cloudflare:zoneSettings',
    changeSetting: 'cloudflare:changeSetting',
    purgeCache: 'cloudflare:purgeCache',
    listCustomRules: 'cloudflare:listCustomRules',
    createCustomRule: 'cloudflare:createCustomRule',
    setCustomRuleEnabled: 'cloudflare:setCustomRuleEnabled',
    deleteCustomRule: 'cloudflare:deleteCustomRule',
    listAccessRules: 'cloudflare:listAccessRules',
    createAccessRule: 'cloudflare:createAccessRule',
    deleteAccessRule: 'cloudflare:deleteAccessRule',
    planPointDomain: 'cloudflare:planPointDomain',
    pointDomain: 'cloudflare:pointDomain',
  },
  /** The workspace Pull request tab: the current branch's PR, its checks, review and merge. */
  pullRequests: {
    status: 'pullRequests:status',
    suggestText: 'pullRequests:suggestText',
    comment: 'pullRequests:comment',
    replyThread: 'pullRequests:replyThread',
    resolveThread: 'pullRequests:resolveThread',
    markReady: 'pullRequests:markReady',
    merge: 'pullRequests:merge',
    cleanup: 'pullRequests:cleanup',
    localReview: 'pullRequests:localReview',
    /** Stops a suggestText or localReview run by its request id. */
    cancelAi: 'pullRequests:cancelAi',
  },
  /**
   * The in-app notification inbox. Distinct from the `notifications` group above,
   * which is about sending a notification out (Telegram, the desktop companion).
   */
  appNotifications: {
    list: 'appNotifications:list',
    markRead: 'appNotifications:markRead',
    markAllRead: 'appNotifications:markAllRead',
    remove: 'appNotifications:remove',
    unreadCount: 'appNotifications:unreadCount',
    /** main -> every renderer: something was added to or changed in the inbox. */
    onChanged: 'appNotifications:onChanged',
  },
  /** Git worktrees: a folder and branch per task, each with a workspace of its own. */
  worktrees: {
    list: 'worktrees:list',
    defaults: 'worktrees:defaults',
    suggestPath: 'worktrees:suggestPath',
    create: 'worktrees:create',
    previewCopy: 'worktrees:previewCopy',
    copyFiles: 'worktrees:copyFiles',
    removePreflight: 'worktrees:removePreflight',
    remove: 'worktrees:remove',
    mergePreflight: 'worktrees:mergePreflight',
    merge: 'worktrees:merge',
    mergeBaseIn: 'worktrees:mergeBaseIn',
    prune: 'worktrees:prune',
    suggestBranch: 'worktrees:suggestBranch',
    cancelSuggestBranch: 'worktrees:cancelSuggestBranch',
    pickLocation: 'worktrees:pickLocation',
    /** main -> every renderer: a project's worktrees were added, removed or changed. */
    onChanged: 'worktrees:onChanged',
  },
  git: {
    status: 'git:status',
    listFiles: 'git:listFiles',
    changeSummary: 'git:changeSummary',
    fetch: 'git:fetch',
    pull: 'git:pull',
    push: 'git:push',
    sync: 'git:sync',
    createBranch: 'git:createBranch',
    checkoutBranch: 'git:checkoutBranch',
    setDefaultBranch: 'git:setDefaultBranch',
    renameBranch: 'git:renameBranch',
    deleteBranch: 'git:deleteBranch',
    branchHistory: 'git:branchHistory',
    commit: 'git:commit',
    tags: 'git:tags',
    createTag: 'git:createTag',
    suggestTag: 'git:suggestTag',
    cancelSuggestTag: 'git:cancelSuggestTag',
    applyVersion: 'git:applyVersion',
    cancelApplyVersion: 'git:cancelApplyVersion',
    swapVersionFile: 'git:swapVersionFile',
    writeVersionHunks: 'git:writeVersionHunks',
    suggestBranchName: 'git:suggestBranchName',
    cancelSuggestBranchName: 'git:cancelSuggestBranchName',
    suggestCommitMessage: 'git:suggestCommitMessage',
    cancelSuggestCommitMessage: 'git:cancelSuggestCommitMessage',
    createPullRequest: 'git:createPullRequest',
    init: 'git:init',
    githubAccount: 'git:githubAccount',
    githubActivity: 'git:githubActivity',
    githubNotifications: 'git:githubNotifications',
    githubMarkNotificationRead: 'git:githubMarkNotificationRead',
    githubMarkNotificationsRead: 'git:githubMarkNotificationsRead',
    lookupGithubRepo: 'git:lookupGithubRepo',
    createGithubRepo: 'git:createGithubRepo',
    connectRemote: 'git:connectRemote',
    detectRemote: 'git:detectRemote',
    watchRepo: 'git:watchRepo',
    unwatchRepo: 'git:unwatchRepo',
    // main -> renderer: the repo moved on disk (commit, checkout, merge, fetch, stage)
    onRepoChanged: 'git:onRepoChanged',
    workspaceState: 'git:workspaceState',
    watchWorkingTree: 'git:watchWorkingTree',
    unwatchWorkingTree: 'git:unwatchWorkingTree',
    stage: 'git:stage',
    unstage: 'git:unstage',
    discard: 'git:discard',
    undoDiscard: 'git:undoDiscard',
    applyLines: 'git:applyLines',
    resolveConflict: 'git:resolveConflict',
    resolveConflictWithAi: 'git:resolveConflictWithAi',
    cancelResolveConflictWithAi: 'git:cancelResolveConflictWithAi',
    abortOperation: 'git:abortOperation',
    commitStaged: 'git:commitStaged',
    fileDiff: 'git:fileDiff',
    writeWorkingFile: 'git:writeWorkingFile',
    commitFiles: 'git:commitFiles',
    commitFileDiff: 'git:commitFileDiff',
    fileImage: 'git:fileImage',
    commitFileImage: 'git:commitFileImage',
    // main -> renderer: (projectId, WorkspaceGitState) whenever a watched working tree changes
    onWorkspaceState: 'git:onWorkspaceState',
  },
  terminalClipboard: {
    saveImage: 'terminalClipboard:saveImage',
    read: 'terminalClipboard:read',
    previewImage: 'terminalClipboard:previewImage',
  },
  browser: {
    /** (webContentsId, rect, viewport) -> BrowserElementShot | null: a crop of a picked element. */
    captureElement: 'browser:captureElement',
    /** main -> renderer: a browser key pressed while a page had focus (BrowserGuestShortcut). */
    onGuestShortcut: 'browser:guestShortcut',
    /** main -> renderer: a page asked for a new window (BrowserOpenInNewTab). */
    onOpenInNewTab: 'browser:openInNewTab',
  },
  power: {
    // () -> KeepAwakeStatus
    keepAwakeStatus: 'power:keepAwakeStatus',
    // (mode) -> KeepAwakeStatus: stores the choice and applies it
    setKeepAwake: 'power:setKeepAwake',
    // main -> renderer: the keep-awake state changed
    onKeepAwake: 'power:onKeepAwake',
  },

  agents: {
    sync: 'agents:sync',
    setViewing: 'agents:setViewing',
    acknowledge: 'agents:acknowledge',
    list: 'agents:list',
    statusHookSettings: 'agents:statusHookSettings',
    runInfos: 'agents:runInfos',
    // The model and effort each CLI was last actually running on, kept across restarts
    lastRunInfoByCli: 'agents:lastRunInfoByCli',
    // (projectId) -> AgentHistorySession[]: past Claude Code and Codex conversations in its folder
    history: 'agents:history',
    // main -> renderer: AgentRunInfoMap of sessions whose model or effort just changed
    onRunInfo: 'agents:onRunInfo',
    // main -> renderer: AgentStatusMap of sessions whose status just changed
    onStatus: 'agents:onStatus',
    // () -> AutoContinuePendingMap: every "continue" scheduled after a limit or network error
    autoContinuePending: 'agents:autoContinuePending',
    // (sessionId) -> void: drops the continue scheduled for that tab
    cancelAutoContinue: 'agents:cancelAutoContinue',
    // main -> renderer: AutoContinuePendingMap of tabs whose scheduled continue changed
    onAutoContinue: 'agents:onAutoContinue',
  },
  apiClient: {
    listCollections: 'apiClient:listCollections',
    getCollection: 'apiClient:getCollection',
    createCollection: 'apiClient:createCollection',
    renameCollection: 'apiClient:renameCollection',
    removeCollection: 'apiClient:removeCollection',
    saveRequest: 'apiClient:saveRequest',
    createFolder: 'apiClient:createFolder',
    removeItem: 'apiClient:removeItem',
    // (ExecuteApiRequestInput) -> ApiExecutionResult, once the request finished or failed
    execute: 'apiClient:execute',
    // (requestId) -> boolean: stops a request started by execute
    cancel: 'apiClient:cancel',
  },
  packages: {
    list: 'packages:list',
    update: 'packages:update',
    // main -> renderer: per-package progress while an update batch runs
    onUpdateProgress: 'packages:onUpdateProgress',
  },
} as const;
