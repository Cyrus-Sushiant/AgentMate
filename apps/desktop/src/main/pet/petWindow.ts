import { join } from 'node:path';
import { BrowserWindow, screen } from 'electron';
import icon from '../../../resources/icon.ico?asset';
import { IPC } from '../../shared/ipcChannels';
import {
  PET_SNOOZE_MAX_MINUTES,
  type PetPipelineMessage,
  type PetSnoozeState,
  type PetWorkArea,
} from '../../shared/pet';
import { store } from '../store';

let win: BrowserWindow | null = null;
let displayListenersBound = false;
let snoozeUntil: number | null = null;
let snoozeTimer: ReturnType<typeof setTimeout> | null = null;

function primaryWorkArea(): PetWorkArea {
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x, y: area.y, width: area.width, height: area.height };
}

function loadPetRoute(target: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    void target.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/desktop-pet`);
  } else {
    void target.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/desktop-pet' });
  }
}

function fitToWorkArea(target: BrowserWindow): PetWorkArea {
  const area = primaryWorkArea();
  target.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height }, false);
  return area;
}

function broadcastWorkArea(): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(IPC.pet.onDisplayChanged, fitToWorkArea(win));
}

function bindDisplayListeners(): void {
  if (displayListenersBound) return;
  displayListenersBound = true;
  screen.on('display-metrics-changed', broadcastWorkArea);
  screen.on('display-added', broadcastWorkArea);
  screen.on('display-removed', broadcastWorkArea);
}

function applyClickThrough(target: BrowserWindow, ignore: boolean): void {
  if (ignore) target.setIgnoreMouseEvents(true, { forward: true });
  else target.setIgnoreMouseEvents(false);
}

function broadcastSnooze(): void {
  const state: PetSnoozeState = { until: snoozeUntil };
  for (const target of BrowserWindow.getAllWindows()) {
    if (!target.webContents.isDestroyed()) target.webContents.send(IPC.pet.onSnoozeChanged, state);
  }
}

function stopSnoozeTimer(): void {
  if (!snoozeTimer) return;
  clearTimeout(snoozeTimer);
  snoozeTimer = null;
}

function clearSnooze(): boolean {
  if (snoozeUntil === null) return false;
  stopSnoozeTimer();
  snoozeUntil = null;
  broadcastSnooze();
  return true;
}

function createPetWindow(): BrowserWindow {
  const area = primaryWorkArea();
  const created = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    show: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  created.setAlwaysOnTop(true, 'floating');
  created.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  created.setMenu(null);
  applyClickThrough(created, true);
  created.once('ready-to-show', () => created.showInactive());
  created.on('closed', () => {
    if (win === created) win = null;
  });

  loadPetRoute(created);
  bindDisplayListeners();
  return created;
}

export const petManager = {
  isOpen(): boolean {
    return win !== null && !win.isDestroyed();
  },

  open(): void {
    if (this.isOpen()) {
      if (win) fitToWorkArea(win);
      win?.showInactive();
      return;
    }
    win = createPetWindow();
  },

  close(): void {
    if (!win) return;
    const closing = win;
    win = null;
    if (!closing.isDestroyed()) closing.close();
  },

  async syncFromSettings(): Promise<void> {
    const settings = await store.getSettings();
    if (!settings.desktopPetEnabled) {
      // Switching the pet off and back on is a deliberate "show it now", so a
      // pending hide should not survive that round trip.
      clearSnooze();
      this.close();
      return;
    }
    if (snoozeUntil !== null && snoozeUntil > Date.now()) {
      this.close();
      return;
    }
    this.open();
    this.notifySettings();
  },

  snoozeState(): PetSnoozeState {
    return { until: snoozeUntil };
  },

  /** Hides the companion for a while. It comes back by itself when time is up. */
  snooze(minutes: number): PetSnoozeState {
    const requested = Number(minutes);
    const safe = Math.min(
      PET_SNOOZE_MAX_MINUTES,
      Math.max(1, Math.round(Number.isFinite(requested) ? requested : 0)),
    );
    const ms = safe * 60_000;
    stopSnoozeTimer();
    snoozeUntil = Date.now() + ms;
    this.close();
    snoozeTimer = setTimeout(() => {
      snoozeTimer = null;
      snoozeUntil = null;
      broadcastSnooze();
      void this.syncFromSettings();
    }, ms);
    broadcastSnooze();
    return this.snoozeState();
  },

  /** Ends a hide early, bringing the companion straight back if it is turned on. */
  cancelSnooze(): PetSnoozeState {
    if (clearSnooze()) void this.syncFromSettings();
    return this.snoozeState();
  },

  notifySettings(): void {
    if (!win || win.isDestroyed()) return;
    win.webContents.send(IPC.pet.onSettingsChanged);
  },

  sendPipelineMessage(payload: PetPipelineMessage): void {
    if (!this.isOpen()) return;
    win?.webContents.send(IPC.pet.onPipelineMessage, payload);
  },

  setClickThrough(ignore: boolean): void {
    if (!win || win.isDestroyed()) return;
    applyClickThrough(win, ignore);
  },

  workArea(): PetWorkArea {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }
    return primaryWorkArea();
  },
};
