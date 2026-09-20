import { join } from 'node:path';
import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron';
import icon from '../../../resources/icon.ico?asset';
import type { RdpWindowState } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { sendToWindow } from '../ipc/send';
import { keepWindowsHidden } from '../testMode';

/**
 * Each Remote Desktop session gets its own window, like Windows' Remote Desktop Connection:
 * resizable, maximizable, able to go full screen on any monitor, and closing it disconnects.
 * Unlike the single LAN remote-control window, several servers can be open at once.
 */

const windows = new Map<string, BrowserWindow>();
let handlersRegistered = false;

function stateOf(window: BrowserWindow): RdpWindowState {
  return { isMaximized: window.isMaximized(), isFullScreen: window.isFullScreen() };
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window && [...windows.values()].includes(window) ? window : null;
}

function registerWindowControlHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(IPC.rdpWindow.minimize, (event) => senderWindow(event)?.minimize());
  ipcMain.handle(IPC.rdpWindow.maximizeToggle, (event) => {
    const window = senderWindow(event);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle(IPC.rdpWindow.fullscreenToggle, (event) => {
    const window = senderWindow(event);
    window?.setFullScreen(!window.isFullScreen());
  });
  ipcMain.handle(IPC.rdpWindow.close, (event) => senderWindow(event)?.close());
  ipcMain.handle(IPC.rdpWindow.getState, (event): RdpWindowState => {
    const window = senderWindow(event);
    return window ? stateOf(window) : { isMaximized: false, isFullScreen: false };
  });
}

export interface OpenRdpWindowOptions {
  sessionId: string;
  title: string;
  fullScreen: boolean;
  onClosed: () => void;
}

export function openRdpWindow(options: OpenRdpWindowOptions): BrowserWindow {
  registerWindowControlHandlers();

  const window = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 640,
    minHeight: 400,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#050807',
    title: options.title,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => {
    if (!keepWindowsHidden) window.show();
    if (options.fullScreen) window.setFullScreen(true);
  });
  // The page sets its own title from React; keep the server's name on the taskbar instead.
  window.on('page-title-updated', (event) => event.preventDefault());

  const sendState = (): void => {
    if (!window.isDestroyed()) sendToWindow(window, IPC.rdpWindow.onStateChange, stateOf(window));
  };
  window.on('maximize', sendState);
  window.on('unmaximize', sendState);
  window.on('enter-full-screen', sendState);
  window.on('leave-full-screen', sendState);

  window.on('closed', () => {
    windows.delete(options.sessionId);
    options.onClosed();
  });

  const hash = `/rdp-session?session=${encodeURIComponent(options.sessionId)}`;
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }

  windows.set(options.sessionId, window);
  return window;
}

export function closeAllRdpWindows(): void {
  for (const window of windows.values()) window.close();
}
