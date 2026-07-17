import { autoUpdater } from 'electron-updater';
import { app } from 'electron';

/**
 * No real update server exists yet (see the placeholder `publish` block in
 * electron-builder.yml). This only runs in packaged builds and fails quietly
 * so it's harmless until a real feed URL is configured.
 */
export function checkForUpdatesQuietly(): void {
  if (!app.isPackaged) return;
  // electron-updater logs internally (even on handled failures) via its own
  // `logger`, and also emits 'error' on its EventEmitter — an unhandled
  // 'error' event throws. Silence both until a real update feed exists.
  autoUpdater.logger = null;
  autoUpdater.on('error', () => undefined);
  autoUpdater.checkForUpdates().catch(() => {
    // No update feed configured yet — expected until real infra exists.
  });
}
