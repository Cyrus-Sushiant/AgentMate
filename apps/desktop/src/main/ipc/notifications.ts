import { ipcMain } from 'electron';
import type {
  DetectChatIdResult,
  NotificationSendResult,
  SendTestNotificationInput,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { speakOnPet } from '../notifications/petNotifier';
import { detectLatestChatId, sendTelegramMessage } from '../notifications/telegramApi';
import { petManager } from '../pet/petWindow';
import { store } from '../store';

export function registerNotificationHandlers(): void {
  ipcMain.handle(
    IPC.notifications.sendTest,
    async (_event, input: SendTestNotificationInput): Promise<NotificationSendResult> => {
      const settings = await store.getSettings();
      if (!settings.telegramBotToken || !settings.telegramChatId) {
        return {
          ok: false,
          error: 'Configure your Telegram bot token and chat ID in Settings first.',
        };
      }
      return sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, input.message);
    },
  );

  ipcMain.handle(
    IPC.notifications.sendPetTest,
    async (_event, input: SendTestNotificationInput): Promise<NotificationSendResult> => {
      const settings = await store.getSettings();
      if (!settings.desktopPetEnabled) {
        return { ok: false, error: 'Turn the desktop companion on in Settings to see this.' };
      }
      const snoozedUntil = petManager.snoozeState().until;
      if (snoozedUntil && snoozedUntil > Date.now()) {
        return {
          ok: false,
          error: 'The companion is hidden right now. Bring it back to see this.',
        };
      }
      if (!speakOnPet(settings, 'Preview', input.message)) {
        return { ok: false, error: 'The companion is not on screen right now.' };
      }
      return { ok: true };
    },
  );

  ipcMain.handle(IPC.notifications.detectChatId, async (): Promise<DetectChatIdResult> => {
    const settings = await store.getSettings();
    if (!settings.telegramBotToken) {
      return { chatId: null, error: 'Enter your Telegram bot token first.' };
    }
    return detectLatestChatId(settings.telegramBotToken);
  });
}
