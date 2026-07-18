import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  DetectChatIdResult,
  NotificationSendResult,
  SendTestNotificationInput,
} from '../../shared/apiTypes';
import { store } from '../store';
import { detectLatestChatId, sendTelegramMessage } from '../notifications/telegramApi';

export function registerNotificationHandlers(): void {
  ipcMain.handle(
    IPC.notifications.sendTest,
    async (_event, input: SendTestNotificationInput): Promise<NotificationSendResult> => {
      const settings = await store.getSettings();
      if (!settings.telegramBotToken || !settings.telegramChatId) {
        return { ok: false, error: 'Configure your Telegram bot token and chat ID in Settings first.' };
      }
      return sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, input.message);
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
