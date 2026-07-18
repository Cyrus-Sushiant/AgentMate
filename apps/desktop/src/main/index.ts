import { join } from 'node:path';
import { app, BrowserWindow, session, shell } from 'electron';
import { registerActivityHandlers } from './ipc/activity';
import { registerCliDetectionHandlers } from './ipc/cliDetection';
import { registerFileSystemHandlers } from './ipc/fileSystem';
import { registerIpGeoHandlers } from './ipc/ipGeo';
import { registerNotificationHandlers } from './ipc/notifications';
import { registerProjectHandlers } from './ipc/projects';
import { registerPromptHistoryHandlers } from './ipc/promptHistory';
import { registerScheduledTaskHandlers } from './ipc/scheduledTasks';
import { registerSettingsHandlers } from './ipc/settings';
import { registerShellHandlers } from './ipc/shell';
import { registerSkillHandlers } from './ipc/skills';
import { registerSystemStatsHandlers } from './ipc/systemStats';
import { registerTemplateHandlers } from './ipc/templates';
import { killAllTerminalSessions, registerTerminalHandlers } from './ipc/terminal';
import { registerTranslateHandlers } from './ipc/translate';
import { registerWindowHandlers } from './ipc/window';
import { seedExampleRepositoryIfEmpty } from './exampleSkillRepo';
import { startHookServer, stopHookServer } from './notifications/hookServer';
import { checkForUpdatesQuietly } from './updater';

app.setName('AgentMate');

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#050807',
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
  registerCliDetectionHandlers();
  registerTerminalHandlers();
  registerProjectHandlers();
  registerSkillHandlers();
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

  registerAllIpcHandlers();
  void seedExampleRepositoryIfEmpty();
  void startHookServer();
  createMainWindow();
  checkForUpdatesQuietly();

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
});
