import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import icon from '../../../resources/icon.ico?asset';
import type {
  DesktopWidgetInstance,
  WidgetMode,
  WidgetSize,
  WidgetStyle,
} from '@agentmat/core';
import { store } from '../store';

// One frameless, transparent, always-on-top BrowserWindow per pinned widget.
// Each loads the existing renderer bundle at the `#/widget/<id>` hash route, so
// no extra Vite entry is needed. Window position is persisted back to settings
// whenever the user drags a widget (OS-level move via -webkit-app-region: drag).

const WIDGET_DIMENSIONS: Record<WidgetSize, { width: number; height: number }> = {
  small: { width: 230, height: 120 },
  medium: { width: 300, height: 168 },
  large: { width: 330, height: 240 },
};

const windows = new Map<string, BrowserWindow>();

async function readWidgets(): Promise<DesktopWidgetInstance[]> {
  const settings = await store.getSettings();
  return settings.usageWidgets ?? [];
}

async function writeWidgets(widgets: DesktopWidgetInstance[]): Promise<void> {
  const settings = await store.getSettings();
  await store.setSettings({ ...settings, usageWidgets: widgets });
}

async function upsertWidget(instance: DesktopWidgetInstance): Promise<void> {
  const widgets = await readWidgets();
  const idx = widgets.findIndex((w) => w.id === instance.id);
  if (idx >= 0) widgets[idx] = instance;
  else widgets.push(instance);
  await writeWidgets(widgets);
}

function loadWidgetRoute(win: BrowserWindow, id: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/widget/${id}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/widget/${id}` });
  }
}

function createWidgetWindow(instance: DesktopWidgetInstance): BrowserWindow {
  const dims = WIDGET_DIMENSIONS[instance.size];
  const win = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    x: instance.x,
    y: instance.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    show: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.once('ready-to-show', () => win.show());

  // Persist position after the user drags the widget (debounced).
  let moveTimer: NodeJS.Timeout | null = null;
  const persistBounds = (): void => {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      const [x, y] = win.getPosition();
      void readWidgets().then((widgets) => {
        const existing = widgets.find((w) => w.id === instance.id);
        if (existing) void upsertWidget({ ...existing, x, y });
      });
    }, 400);
  };
  win.on('moved', persistBounds);

  win.on('closed', () => {
    if (moveTimer) clearTimeout(moveTimer);
    windows.delete(instance.id);
  });

  loadWidgetRoute(win, instance.id);
  windows.set(instance.id, win);
  return win;
}

export const widgetManager = {
  async list(): Promise<DesktopWidgetInstance[]> {
    return readWidgets();
  },

  async get(id: string): Promise<DesktopWidgetInstance | null> {
    const widgets = await readWidgets();
    return widgets.find((w) => w.id === id) ?? null;
  },

  async open(providerId: string, size: WidgetSize = 'medium'): Promise<DesktopWidgetInstance> {
    const instance: DesktopWidgetInstance = {
      id: randomUUID(),
      providerId,
      // Cascade new widgets slightly so they don't stack exactly.
      x: 80 + windows.size * 24,
      y: 80 + windows.size * 24,
      size,
      style: 'colorful',
      mode: 'auto',
    };
    await upsertWidget(instance);
    createWidgetWindow(instance);
    return instance;
  },

  async close(id: string): Promise<void> {
    windows.get(id)?.close();
    windows.delete(id);
    const widgets = await readWidgets();
    await writeWidgets(widgets.filter((w) => w.id !== id));
  },

  async setStyle(id: string, style: WidgetStyle): Promise<void> {
    const current = await this.get(id);
    if (!current) return;
    await upsertWidget({ ...current, style });
    windows.get(id)?.webContents.send('usage:widgetUpdated', { id });
  },

  async setMode(id: string, mode: WidgetMode): Promise<void> {
    const current = await this.get(id);
    if (!current) return;
    await upsertWidget({ ...current, mode });
    windows.get(id)?.webContents.send('usage:widgetUpdated', { id });
  },

  async setSize(id: string, size: WidgetSize): Promise<void> {
    const current = await this.get(id);
    if (!current) return;
    await upsertWidget({ ...current, size });
    const win = windows.get(id);
    if (win) {
      const dims = WIDGET_DIMENSIONS[size];
      win.setSize(dims.width, dims.height);
      win.webContents.send('usage:widgetUpdated', { id });
    }
  },

  /** Re-open every saved widget on app launch. */
  async restoreAll(): Promise<void> {
    const widgets = await readWidgets();
    for (const instance of widgets) {
      if (!windows.has(instance.id)) createWidgetWindow(instance);
    }
  },

  closeAll(): void {
    for (const win of windows.values()) win.close();
    windows.clear();
  },
};
