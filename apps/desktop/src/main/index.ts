import { join } from 'node:path';
import { app, BrowserWindow, desktopCapturer, session, shell } from 'electron';
import icon from '../../resources/icon.ico?asset';
import { registerActivityHandlers } from './ipc/activity';
import { registerAiHandlers } from './ipc/ai';
import { registerAppHandlers } from './ipc/app';
import { registerCliDetectionHandlers } from './ipc/cliDetection';
import { registerFileSystemHandlers } from './ipc/fileSystem';
import { registerGitHandlers } from './ipc/git';
import { registerIpGeoHandlers } from './ipc/ipGeo';
import { registerMcpHandlers } from './ipc/mcp';
import { registerNotificationHandlers } from './ipc/notifications';
import { registerProjectHandlers } from './ipc/projects';
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
import { registerWindowHandlers } from './ipc/window';
import { seedExampleRepositoryIfEmpty } from './exampleSkillRepo';
import { startHookServer, stopHookServer } from './notifications/hookServer';
import { remoteManager } from './remote/manager';
import { startHourlyUpdateChecks } from './updater';

app.setName('AgentMate');

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

function createMainWindow(): void {
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
    },
  });

  win.once('ready-to-show', () => win.show());
  registerWindowHandlers(win);
  remoteManager.init(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      // eslint-disable-next-line no-console
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
  registerScheduledTaskHandlers();
  registerNotificationHandlers();
  registerAiHandlers();
  registerSpeechHandlers();
  registerGitHandlers();
  registerRemoteHandlers();
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
  // here — adding a restrictive one would break clipboard writes and the Remote
  // feature. On macOS the OS still gates the mic behind its own TCC prompt,
  // which needs NSMicrophoneUsageDescription in the packaged Info.plist (see
  // electron-builder.yml).

  // When the Remote page (host side) calls getDisplayMedia, capture the primary
  // screen directly instead of popping the OS source picker — the operator has
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

  registerAllIpcHandlers();
  void seedExampleRepositoryIfEmpty();
  void startHookServer();
  createMainWindow();
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
  stopHookServer();
  remoteManager.shutdown();
});
