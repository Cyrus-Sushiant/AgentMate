import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, Notification, nativeImage } from 'electron';
import icon from '../../../resources/icon.ico?asset';
import { focusMainWindow } from '../mainWindow';

/**
 * OS notifications that take the user to what they are about when clicked.
 *
 * A plain `notification.on('click')` is not enough on Windows. The listener lives on the JS
 * object, so once that object is garbage collected, or the toast has timed out into the Action
 * Center, a click reaches nothing. Windows toasts therefore carry their route in the toast's
 * `launch` argument, and `Notification.handleActivation` reads it back no matter what happened
 * to the object (even when the click is what started the app).
 */

const ROUTE_ARG = 'agentmate-route';
/** Enough to keep recent toasts clickable without holding on to every one ever shown. */
const MAX_LIVE = 50;
/** The instance event and the activation callback both fire for one click on Windows. */
const DUPLICATE_CLICK_MS = 1500;

const live = new Map<string, Notification>();
let lastOpened = { route: '', at: 0 };
let toastIconUrl: string | null | undefined;

export interface OsNotificationInput {
  title: string;
  body: string;
  /** The renderer route a click opens, e.g. `/workspace/<projectId>?session=<tabId>`. */
  route: string;
  silent?: boolean;
}

function openRoute(route: string): void {
  const now = Date.now();
  if (lastOpened.route === route && now - lastOpened.at < DUPLICATE_CLICK_MS) return;
  lastOpened = { route, at: now };
  focusMainWindow(route);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Toasts can't show an .ico, so the app icon is written out once as a PNG. */
function iconForToast(): string | null {
  if (toastIconUrl !== undefined) return toastIconUrl;
  try {
    const png = nativeImage.createFromPath(icon).toPNG();
    const path = join(app.getPath('temp'), 'agentmate-notification-icon.png');
    writeFileSync(path, png);
    toastIconUrl = png.length > 0 ? pathToFileURL(path).href : null;
  } catch {
    toastIconUrl = null;
  }
  return toastIconUrl;
}

function toastXml({ title, body, route, silent }: OsNotificationInput): string {
  const launch = new URLSearchParams({ [ROUTE_ARG]: route }).toString();
  const iconUrl = iconForToast();
  return [
    `<toast launch="${escapeXml(launch)}" activationType="foreground">`,
    '<visual><binding template="ToastGeneric">',
    `<text>${escapeXml(title)}</text>`,
    body ? `<text>${escapeXml(body)}</text>` : '',
    iconUrl ? `<image placement="appLogoOverride" src="${escapeXml(iconUrl)}"/>` : '',
    '</binding></visual>',
    silent ? '<audio silent="true"/>' : '',
    '</toast>',
  ].join('');
}

function forget(id: string): void {
  live.delete(id);
}

/**
 * Shows an OS notification that opens `route` when clicked. Returns false when the platform
 * has no notifications, so the caller can fall back to something in the app.
 */
export function showOsNotification(input: OsNotificationInput): boolean {
  if (!Notification.isSupported()) return false;
  const id = randomUUID();
  const notification =
    process.platform === 'win32'
      ? new Notification({ id, toastXml: toastXml(input) })
      : new Notification({
          id,
          title: input.title,
          body: input.body,
          icon,
          silent: input.silent ?? false,
        });

  notification.on('click', () => {
    forget(id);
    openRoute(input.route);
  });
  notification.on('close', (details) => {
    // A toast that timed out moves to the Action Center and can still be clicked there.
    if (details?.reason !== 'timedOut') forget(id);
  });
  notification.on('failed', () => forget(id));

  // Held here so the object, and its click listener, outlive this call.
  live.set(id, notification);
  if (live.size > MAX_LIVE) {
    const oldest = live.keys().next().value;
    if (oldest) forget(oldest);
  }

  notification.show();
  return true;
}

/**
 * Routes Windows toast clicks, including ones from the Action Center after the notification
 * object is gone and ones that launched the app. Call once the main window exists, since a
 * click that started the app is replayed as soon as this registers.
 */
export function registerNotificationActivation(): void {
  if (process.platform !== 'win32') return;
  Notification.handleActivation((details) => {
    if (details.type !== 'click') return;
    const route = new URLSearchParams(details.arguments).get(ROUTE_ARG);
    if (route?.startsWith('/')) openRoute(route);
    else focusMainWindow();
  });
}
