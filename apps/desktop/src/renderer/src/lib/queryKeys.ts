export const queryKeys = {
  /** A project file open in an editor tab. */
  workspaceFile: (path: string) => ['workspace-file', path] as const,
  /** An image file open in a viewer tab. Nested under its file key, so a rename clears both. */
  workspaceImage: (path: string) => ['workspace-file', path, 'image'] as const,
  /** Prefix of every explorer listing for a project, so one invalidate refreshes the whole tree. */
  workspaceExplorer: (projectId: string) => ['workspace-explorer', projectId] as const,
  workspaceExplorerDir: (projectId: string, dir: string) =>
    ['workspace-explorer', projectId, dir] as const,
  workspaceExplorerIgnored: (projectId: string, dir: string) =>
    ['workspace-explorer', projectId, dir, 'ignored'] as const,
  /** Every file in the project, for the explorer's search box. */
  workspaceExplorerFiles: (projectId: string) =>
    ['workspace-explorer', projectId, 'files'] as const,
  /**
   * The project's declarations, for the search dialog's type and member filters. Under the
   * explorer prefix, so a change on disk that refreshes the tree checks these too.
   */
  workspaceSymbols: (projectId: string) => ['workspace-explorer', projectId, 'symbols'] as const,
  cliStatus: ['cli-status'] as const,
  projects: ['projects'] as const,
  /** Every API Client collection's outline, for the sidebar. */
  apiCollections: ['api-collections'] as const,
  /** One collection in full, nested under the list so one invalidate refreshes both. */
  apiCollection: (id: string) => ['api-collections', id] as const,
  project: (id: string) => ['projects', id] as const,
  activity: ['activity'] as const,
  repositories: ['skill-repositories'] as const,
  /** Prefix of every repositoryIndex key, for invalidating them all at once. */
  repositoryIndexes: ['skill-repository-index'] as const,
  repositoryIndex: (id: string) => ['skill-repository-index', id] as const,
  localSkillFolderPreviews: ['local-skill-folder-preview'] as const,
  localSkillFolderPreview: (path: string) => ['local-skill-folder-preview', path] as const,
  installedSkills: (projectId: string | null) => ['installed-skills', projectId] as const,
  /** Prefix of every skill-audit key, so one invalidate refreshes the history and the per-skill lists. */
  skillAudits: ['skill-audits'] as const,
  skillAuditsFor: (skillId: string) => ['skill-audits', skillId] as const,
  skillAuditsLatest: ['skill-audits-latest'] as const,
  skillFavorites: ['skill-favorites'] as const,
  skillUsage: ['skill-usage'] as const,
  usedSkillInspection: (skill: string) => ['used-skill-inspection', skill] as const,
  auditSourcePreview: (input: string) => ['audit-source-preview', input] as const,
  onDiskSkills: (projectId: string) => ['on-disk-skills', projectId] as const,
  skillUpdates: (projectId: string | null) => ['skill-updates', projectId] as const,
  mcpRepositories: ['mcp-repositories'] as const,
  mcpRepositoryIndex: (id: string) => ['mcp-repository-index', id] as const,
  installedMcpServers: (projectId: string) => ['installed-mcp-servers', projectId] as const,
  codeqlStatus: ['codeql-status'] as const,
  securityActive: (projectId: string) => ['security', projectId, 'active'] as const,
  securityPreflight: (projectId: string) => ['security', projectId, 'preflight'] as const,
  securityLatest: (projectId: string) => ['security', projectId, 'latest'] as const,
  securityHistory: (projectId: string) => ['security', projectId, 'history'] as const,
  securityConfig: (projectId: string) => ['security', projectId, 'config'] as const,
  toolsStatus: ['tools-status'] as const,
  templates: ['prompt-templates'] as const,
  settings: ['settings'] as const,
  petCustomImages: ['pet-custom-images'] as const,
  petSnooze: ['pet-snooze'] as const,
  usageList: ['usage-list'] as const,
  appVersion: ['app-version'] as const,
  promptHistory: ['prompt-history'] as const,
  promptHistorySearch: (query: string) => ['prompt-history', query] as const,
  // Nested under the same root so invalidating `promptHistory` refreshes it too.
  projectPromptHistory: (projectId: string) => ['prompt-history', 'project', projectId] as const,
  ipGeo: ['ip-geo'] as const,
  topResourceApps: (resource: string) => ['top-resource-apps', resource] as const,
  cliUpdateCheck: (cliId: string, version: string | null) =>
    ['cli-update-check', cliId, version] as const,
  toolUpdateCheck: (toolId: string, version: string | null) =>
    ['tool-update-check', toolId, version] as const,
  projectDrafts: (projectId: string) => ['project-drafts', projectId] as const,
  blueprint: (projectId: string) => ['blueprint', projectId] as const,
  // Nested under the blueprint root so one invalidation after a save refreshes
  // the record and its history together.
  blueprintRevisions: (projectId: string, stepId: string | null) =>
    ['blueprint', projectId, 'revisions', stepId ?? 'final-prompt'] as const,
  blueprintAgentFile: (projectId: string) => ['blueprint', projectId, 'agent-file'] as const,
  blueprintPresets: ['blueprint-presets'] as const,
  scheduledTasks: (projectId: string) => ['scheduled-tasks', projectId] as const,
  /** Prefix of every project's task list, for changes made by the scheduler in main. */
  scheduledTasksAll: ['scheduled-tasks'] as const,
  claudeHooks: (projectId: string) => ['claude-hooks', projectId] as const,
  gitStatus: (projectId: string) => ['git-status', projectId] as const,
  /** A project's git worktrees, with each one's live status. */
  worktrees: (projectId: string) => ['worktrees', projectId] as const,
  /** What the New worktree dialog starts from: branches, copy patterns, setup command. */
  worktreeDefaults: (projectId: string) => ['worktrees', projectId, 'defaults'] as const,
  /** The workspace changes panel's state, pushed live by the working tree watcher. */
  gitWorkspaceState: (projectId: string) => ['git-workspace-state', projectId] as const,
  agentHistory: (projectId: string) => ['agent-history', projectId] as const,
  /** The workspace Pull request tab: the current branch and its PR, checks and review. */
  pullRequest: (projectId: string) => ['pull-request', projectId] as const,
  gitFileDiff: (projectId: string, side: string, path: string) =>
    ['git-file-diff', projectId, side, path] as const,
  /** Both sides of a changed image. Under the diff prefix, so the watcher refreshes it too. */
  gitFileImage: (projectId: string, side: string, path: string) =>
    ['git-file-diff', projectId, side, path, 'image'] as const,
  /** Prefix of every diff of a project, to refresh open diffs after the tree changed. */
  gitFileDiffs: (projectId: string) => ['git-file-diff', projectId] as const,
  gitFiles: (projectId: string) => ['git-files', projectId] as const,
  gitTags: (projectId: string) => ['git-tags', projectId] as const,
  /** Tag state for one tag series. Nested so invalidating gitTags refreshes it too. */
  gitTagsForPrefix: (projectId: string, prefix: string) =>
    ['git-tags', projectId, 'prefix', prefix] as const,
  gitBranchHistory: (projectId: string, branch: string) =>
    ['git-branch-history', projectId, branch] as const,
  /** Prefix of a project's branch histories, for invalidating every branch at once. */
  gitBranchHistories: (projectId: string) => ['git-branch-history', projectId] as const,
  githubAccount: ['github-account'] as const,
  githubActivity: ['github-activity'] as const,
  githubNotifications: ['github-notifications'] as const,
  githubActionsActivity: ['github-actions-activity'] as const,
  /** Annotations one finished Actions run left behind. */
  runAnnotations: (repo: string, runId: number) => ['run-annotations', repo, runId] as const,
  pipelineStatus: (projectId: string) => ['pipeline-status', projectId] as const,
  /** Test frameworks and tests found in a project, for the workspace Tests panel. */
  testsDiscovery: (projectId: string) => ['tests-discovery', projectId] as const,
  /** Branches and tags of a repo, for picking what a manual workflow run should build. */
  pipelineRefs: (repo: string) => ['pipeline-refs', repo] as const,
  appNotifications: ['app-notifications'] as const,
  appNotificationUnread: ['app-notifications-unread'] as const,
  packages: (projectId: string) => ['packages', projectId] as const,
  skillsShSearch: (query: string) => ['skills-sh-search', query] as const,
  skillsShDetail: (id: string) => ['skills-sh-detail', id] as const,
  uiProPrerequisites: ['ui-ux-pro-max-prerequisites'] as const,
  uiProUpdate: ['ui-ux-pro-max-update'] as const,
  remoteSavedServers: ['remote-saved-servers'] as const,
  sshServers: ['ssh-servers'] as const,
  /** A terminal's AI task history, refetched as the running task reports progress. */
  sshAgentHistory: (sessionId: string) => ['ssh-agent-history', sessionId] as const,
  sshVaultStatus: ['ssh-vault-status'] as const,
  rdpServers: ['rdp-servers'] as const,
  projectEnvironments: (projectId: string) => ['project-environments', projectId] as const,
  /** Local LanguageTool install and server state, for Settings and the Tools card. */
  grammarLocalStatus: ['grammar-local-status'] as const,
  /** Which proxy the app is going through, and what this machine itself is set to. */
  proxyStatus: ['proxy-status'] as const,
  androidSdk: ['android-sdk'] as const,
  androidSnapshot: ['android-snapshot'] as const,
  androidSystemImages: ['android-system-images'] as const,
  androidAvailableImages: ['android-available-images'] as const,
  androidDeviceProfiles: ['android-device-profiles'] as const,
  androidAvdConfig: (name: string) => ['android-avd-config', name] as const,
  dockerAvailability: ['docker-availability'] as const,
  dockerList: ['docker-list'] as const,
  dockerListForProject: (projectId: string) => ['docker-list', 'project', projectId] as const,
  /** Saved servers with the server core each one runs, for the Deploy rail. */
  deployServers: ['deploy', 'servers'] as const,
  /** A core's live health, shared by its rail entry and its health card. */
  deployHealth: (serverId: string) => ['deploy', 'health', serverId] as const,
  /** The install wizard's read-only look at a server. */
  deployPreflight: (serverId: string) => ['deploy', 'preflight', serverId] as const,
  /** Whether this computer is signed in to a server's core, or what it needs first. */
  deployAccess: (serverId: string) => ['deploy', 'access', serverId] as const,
  /** Prefix of a core's Security area: users, devices, sessions, the audit trail and the step-up. */
  deploySecurity: (serverId: string) => ['deploy', 'security', serverId] as const,
  deployUsers: (serverId: string) => ['deploy', 'security', serverId, 'users'] as const,
  deployDevices: (serverId: string) => ['deploy', 'security', serverId, 'devices'] as const,
  deploySessions: (serverId: string) => ['deploy', 'security', serverId, 'sessions'] as const,
  deployAudit: (serverId: string, filter: object) =>
    ['deploy', 'security', serverId, 'audit', filter] as const,
  /** Until when the core takes sensitive changes without asking for the password again. */
  deployStepUp: (serverId: string) => ['deploy', 'security', serverId, 'step-up'] as const,
  /** A server's lasting connection to its core, kept current by its change events. */
  deployConnection: (serverId: string) => ['deploy', 'connection', serverId] as const,
  /** Prefix of a server's Overview reads, fetched again when its connection comes back. */
  deployOverview: (serverId: string) => ['deploy', 'overview', serverId] as const,
  deploySystemInfo: (serverId: string) => ['deploy', 'overview', serverId, 'info'] as const,
  deployServices: (serverId: string) => ['deploy', 'overview', serverId, 'services'] as const,
  deployUpdates: (serverId: string) => ['deploy', 'overview', serverId, 'updates'] as const,
  deployActiveJobs: (serverId: string) => ['deploy', 'overview', serverId, 'jobs'] as const,
  deployMetricsHistory: (serverId: string, range: string) =>
    ['deploy', 'overview', serverId, 'metrics', range] as const,
  /** Prefix of a server's Docker reads (E06), fetched again on engine events and reconnects. */
  deployDocker: (serverId: string) => ['deploy', 'docker', serverId] as const,
  deployDockerStatus: (serverId: string) => ['deploy', 'docker', serverId, 'status'] as const,
  deployContainers: (serverId: string) => ['deploy', 'docker', serverId, 'containers'] as const,
  deployContainer: (serverId: string, containerId: string) =>
    ['deploy', 'docker', serverId, 'container', containerId] as const,
  deployImages: (serverId: string) => ['deploy', 'docker', serverId, 'images'] as const,
  deployVolumes: (serverId: string) => ['deploy', 'docker', serverId, 'volumes'] as const,
  deployNetworks: (serverId: string) => ['deploy', 'docker', serverId, 'networks'] as const,
  deployDiskUsage: (serverId: string) => ['deploy', 'docker', serverId, 'disk'] as const,
  /** Prefix of a server's Websites section: nginx, sites, stream proxies and certificates. */
  deployWeb: (serverId: string) => ['deploy', 'web', serverId] as const,
  deployNginx: (serverId: string) => ['deploy', 'web', serverId, 'nginx'] as const,
  deploySites: (serverId: string) => ['deploy', 'web', serverId, 'sites'] as const,
  deployStreams: (serverId: string) => ['deploy', 'web', serverId, 'streams'] as const,
  /** Everything the Firewall section reads (E13), dropped at once after a change. */
  deployFirewall: (serverId: string) => ['deploy', 'firewall', serverId] as const,
  deployFirewallStatus: (serverId: string) => ['deploy', 'firewall', serverId, 'status'] as const,
  deployFirewallPresets: (serverId: string) => ['deploy', 'firewall', serverId, 'presets'] as const,
  deployFirewallHistory: (serverId: string) => ['deploy', 'firewall', serverId, 'history'] as const,
  deployFirewallExposure: (serverId: string) =>
    ['deploy', 'firewall', serverId, 'exposure'] as const,
  /** Whether a Cloudflare token is saved, and what its last check found. */
  cloudflareStatus: ['cloudflare', 'status'] as const,
  /** Prefix of everything read with the Cloudflare token, dropped when the token changes. */
  cloudflareData: ['cloudflare', 'data'] as const,
  cloudflareZones: ['cloudflare', 'data', 'zones'] as const,
  cloudflareRecords: (zoneId: string) => ['cloudflare', 'data', 'records', zoneId] as const,
  cloudflareSettings: (zoneId: string) => ['cloudflare', 'data', 'settings', zoneId] as const,
  cloudflareCustomRules: (zoneId: string) => ['cloudflare', 'data', 'customRules', zoneId] as const,
  cloudflareAccessRules: (zoneId: string) => ['cloudflare', 'data', 'accessRules', zoneId] as const,
  /** Every running shell with its process tree's CPU and memory, for the Running CLIs modal. */
  terminalUsage: ['terminal-usage'] as const,
  vaultStatus: ['vault', 'status'] as const,
  /** Prefix of everything decrypted from the vault, removed as a whole when it locks. */
  vaultData: ['vault', 'data'] as const,
  vaultEntries: ['vault', 'data', 'entries'] as const,
  vaultEntry: (id: string) => ['vault', 'data', 'entry', id] as const,
};
