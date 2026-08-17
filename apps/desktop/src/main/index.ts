import { join } from 'node:path';
import { app, BrowserWindow, desktopCapturer, session, shell } from 'electron';
import icon from '../../resources/icon.ico?asset';
import { registerActivityHandlers } from './ipc/activity';
import { registerAiHandlers } from './ipc/ai';
import { registerAppHandlers } from './ipc/app';
import { registerBackupHandlers } from './ipc/backup';
import { registerCliDetectionHandlers } from './ipc/cliDetection';
import { registerFileSystemHandlers } from './ipc/fileSystem';
import { registerGitHandlers } from './ipc/git';
import { registerIpGeoHandlers } from './ipc/ipGeo';
import { registerMcpHandlers } from './ipc/mcp';
import { registerNotificationHandlers } from './ipc/notifications';
import { registerPackageManagerHandlers } from './ipc/packageManagers';
import { registerPetHandlers } from './ipc/pet';
import { registerPipelineHandlers } from './ipc/pipelines';
import { registerProjectDraftHandlers } from './ipc/projectDrafts';
import { registerProjectHandlers } from './ipc/projects';
import { registerPromptBuildWidgetHandlers } from './ipc/promptBuildWidget';
import { registerPromptHistoryHandlers } from './ipc/promptHistory';
import { registerRemoteHandlers } from './ipc/remote';
import { registerScheduledTaskHandlers } from './ipc/scheduledTasks';
import { registerSettingsHandlers } from './ipc/settings';
import { registerShellHandlers } from './ipc/shell';
import { registerSpeechHandlers } from './ipc/speech';
import { registerSkillHandlers } from './ipc/skills';
import { registerSystemStatsHandlers } from './ipc/systemStats';
import { registerTemplateHandlers } from './ipc/templates';
import { killAllTerminalSessions, registerTerminalHandlers } from './ipc/terminal';
import { registerToolHandlers } from './ipc/tools';
import { registerTranslateHandlers } from './ipc/translate';
import { registerUsageHandlers } from './ipc/usage';
import { widgetManager } from './usage/widgetWindows';
import { promptBuildWidgetManager } from './promptBuild/widgetWindows';
import { petManager } from './pet/petWindow';
import { setMainWindow, setMainWindowFactory } from './mainWindow';
import { configureSpellChecker, registerSpellcheckHandlers } from './spellcheck';
import { registerWindowHandlers } from './ipc/window';
import { seedExampleRepositoryIfEmpty } from './exampleSkillRepo';
import { startHookServer, stopHookServer } from './notifications/hookServer';
import { startResetAlertWatcher, stopResetAlertWatcher } from './usage/resetAlerts';
import { startThresholdAlertWatcher, stopThresholdAlertWatcher } from './usage/thresholdAlerts';
import {
  startNetworkQualityAlertWatcher,
  stopNetworkQualityAlertWatcher,
} from './network/qualityAlerts';
import { remoteManager } from './remote/manager';
import { startHourlyUpdateChecks } from './updater';
import { startPipelineWatcher, stopPipelineWatcher } from './pipelines/watcher';

// Chromium normally deprioritizes timers, rendering, and IPC delivery for a
// minimized/occluded window (and Windows' own efficiency-mode throttling
// piles on top of that). That combination is what makes the terminal drawer's
// pty sessions appear to freeze or reset a short while after the window is
// minimized, and if the app was launched from a shell running inside one of
// those terminals, drags the whole app down with it. These switches keep the
// main window's renderer running at full priority regardless of window state.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Distinct name in dev so `electron-vite dev` gets its own userData dir and
// single-instance lock instead of colliding with an installed release build
// (same name -> same lock -> dev process loses the race and quits, while the
// already-running release instance gets focused, looking like "dev opened
// release").
app.setName(app.isPackaged ? 'AgentMate' : 'AgentMate Dev');
// Windows groups notifications/taskbar entries by this id rather than the exe
// name, so without it toasts show up as "Electron" with the Electron icon.
// Must match electron-builder.yml's `appId` so the packaged install (which
// registers that id via its shortcut) and dev runs agree on identity.
if (process.platform === 'win32') app.setAppUserModelId('com.agentmate.app');

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#050807',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Keep terminal output flowing and the pty session healthy while the
      // window is minimized; see the command-line switches above.
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  setMainWindow(win);
  registerWindowHandlers(win);
  remoteManager.init(win);

  // Closing the main window tears down the floating usage widgets too, so the
  // app can fully quit on Windows/Linux instead of lingering with only
  // taskbar-less widget windows (they're persisted and restored next launch).
  win.on('closed', () => {
    if (process.platform !== 'darwin') {
      widgetManager.closeAll();
      promptBuildWidgetManager.closeAll();
      petManager.close();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      // biome-ignore lint/suspicious/noConsole: forwards renderer console output into the main process log
      console.log(`[renderer] ${sourceId}:${line} ${message}`);
    });
  }

  // Any attempt to open a new window/tab (target="_blank", window.open) is
  // redirected to the user's default browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function registerAllIpcHandlers(): void {
  registerAppHandlers();
  registerCliDetectionHandlers();
  registerTerminalHandlers();
  registerProjectHandlers();
  registerSkillHandlers();
  registerMcpHandlers();
  registerToolHandlers();
  registerFileSystemHandlers();
  registerSettingsHandlers();
  registerTemplateHandlers();
  registerActivityHandlers();
  registerShellHandlers();
  registerPromptHistoryHandlers();
  registerTranslateHandlers();
  registerSystemStatsHandlers();
  registerIpGeoHandlers();
  registerProjectDraftHandlers();
  registerScheduledTaskHandlers();
  registerNotificationHandlers();
  registerAiHandlers();
  registerSpeechHandlers();
  registerGitHandlers();
  registerPackageManagerHandlers();
  registerRemoteHandlers();
  registerUsageHandlers();
  registerBackupHandlers();
  registerPromptBuildWidgetHandlers();
  registerPetHandlers();
  registerPipelineHandlers();
  registerSpellcheckHandlers();
}

app.whenReady().then(() => {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  // Vite's dev server needs an inline HMR/preamble script and a websocket
  // connection back to itself; the packaged app never talks to either, so
  // production stays locked down to 'self' only.
  const csp = isDev
    ? "default-src 'self' http://localhost:5173 ws://localhost:5173; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:5173 ws://localhost:5173; worker-src 'self' blob:;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Prompt Builder's voice input calls getUserMedia for the microphone. Electron
  // grants permission requests by default (the same default that lets every
  // "Copy" button use navigator.clipboard), so no permission handler is needed
  // here. Adding a restrictive one would break clipboard writes and the Remote
  // feature. On macOS the OS still gates the mic behind its own TCC prompt,
  // which needs NSMicrophoneUsageDescription in the packaged Info.plist (see
  // electron-builder.yml).

  // When the Remote page (host side) calls getDisplayMedia, capture the primary
  // screen directly instead of popping the OS source picker. The operator has
  // already opted in by starting a host session.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => callback(sources.length ? { video: sources[0] } : {}))
        .catch(() => callback({}));
    },
    { useSystemPicker: false },
  );

  configureSpellChecker();
  registerAllIpcHandlers();
  void seedExampleRepositoryIfEmpty();
  void startHookServer();
  setMainWindowFactory(createMainWindow);
  createMainWindow();
  void widgetManager.restoreAll();
  void promptBuildWidgetManager.restoreAll();
  void petManager.syncFromSettings();
  startResetAlertWatcher();
  startThresholdAlertWatcher();
  startNetworkQualityAlertWatcher();
  startPipelineWatcher();
  startHourlyUpdateChecks();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('second-instance', () => {
  const [existingWindow] = BrowserWindow.getAllWindows();
  if (existingWindow) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
  }
});

app.on('window-all-closed', () => {
  killAllTerminalSessions();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killAllTerminalSessions();
  petManager.close();
  stopHookServer();
  stopResetAlertWatcher();
  stopThresholdAlertWatcher();
  stopNetworkQualityAlertWatcher();
  stopPipelineWatcher();
  remoteManager.shutdown();
});
