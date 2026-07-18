export const IPC = {
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
    onData: 'terminal:onData',
    onExit: 'terminal:onExit',
  },
  projects: {
    list: 'projects:list',
    create: 'projects:create',
    update: 'projects:update',
    delete: 'projects:delete',
    bootstrap: 'projects:bootstrap',
    pickFolder: 'projects:pickFolder',
  },
  skills: {
    listRepositories: 'skills:listRepositories',
    addRepository: 'skills:addRepository',
    removeRepository: 'skills:removeRepository',
    refreshRepository: 'skills:refreshRepository',
    getRepositoryIndex: 'skills:getRepositoryIndex',
    pickLocalRepository: 'skills:pickLocalRepository',
    install: 'skills:install',
    remove: 'skills:remove',
    listInstalled: 'skills:listInstalled',
  },
  fs: {
    readFile: 'fs:readFile',
    writeFile: 'fs:writeFile',
    listDirectory: 'fs:listDirectory',
    writeScratchFile: 'fs:writeScratchFile',
    saveFileAs: 'fs:saveFileAs',
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
  },
  shell: {
    openExternal: 'shell:openExternal',
  },
  promptHistory: {
    list: 'promptHistory:list',
    search: 'promptHistory:search',
    add: 'promptHistory:add',
    remove: 'promptHistory:remove',
  },
  translate: {
    text: 'translate:text',
  },
  window: {
    minimize: 'window:minimize',
    maximizeToggle: 'window:maximizeToggle',
    close: 'window:close',
    isMaximized: 'window:isMaximized',
    onMaximizedChange: 'window:onMaximizedChange',
  },
} as const;
