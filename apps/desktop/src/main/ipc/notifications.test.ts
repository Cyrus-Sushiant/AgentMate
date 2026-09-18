import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationSendResult } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * The "send a test notification" buttons in Settings. Each one has to say why nothing happened
 * rather than reporting success it cannot know about: no token, the companion turned off, or the
 * companion snoozed all look identical from the renderer otherwise.
 */

const userData = useTempUserData();
expectChannelsCovered(IPC.notifications, [
  // Pushed from main when a hook forwards a confirmation, rather than invoked from the renderer.
  IPC.notifications.onConfirmationForwarded,
]);

const sendTelegramMessage = vi.fn<() => Promise<NotificationSendResult>>();
const detectLatestChatId = vi.fn();
const speakOnPet = vi.fn<() => boolean>();
const snoozeState = vi.fn<() => { until: number | null }>();

vi.mock('../notifications/telegramApi', () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...(args as [])),
  detectLatestChatId: (...args: unknown[]) => detectLatestChatId(...(args as [])),
}));
vi.mock('../notifications/petNotifier', () => ({
  speakOnPet: (...args: unknown[]) => speakOnPet(...(args as [])),
}));
vi.mock('../pet/petWindow', () => ({
  petManager: { snoozeState: () => snoozeState() },
}));

async function register(settings: Record<string, unknown> = {}): Promise<void> {
  userData.writeData('settings.json', settings);
  await loadIpc(
    () => import('./notifications'),
    (module) => module.registerNotificationHandlers(),
  );
}

beforeEach(() => {
  sendTelegramMessage.mockReset();
  detectLatestChatId.mockReset();
  speakOnPet.mockReset();
  snoozeState.mockReset();
  snoozeState.mockReturnValue({ until: null });
});

describe('the Telegram test message', () => {
  it('says what is missing instead of sending nothing', async () => {
    await register({ telegramBotToken: '', telegramChatId: '' });

    const result = await invoke<NotificationSendResult>(IPC.notifications.sendTest, {
      message: 'hello',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Configure your Telegram bot token and chat ID in Settings first.',
    });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('refuses when only half of the credentials are filled in', async () => {
    await register({ telegramBotToken: 'bot-token', telegramChatId: '' });

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendTest, { message: 'hello' }),
    ).resolves.toMatchObject({ ok: false });
  });

  it('sends the message with the saved token and chat', async () => {
    await register({ telegramBotToken: 'bot-token', telegramChatId: '12345' });
    sendTelegramMessage.mockResolvedValue({ ok: true });

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendTest, { message: 'hello' }),
    ).resolves.toEqual({ ok: true });
    expect(sendTelegramMessage).toHaveBeenCalledWith('bot-token', '12345', 'hello');
  });

  it('passes a failure from Telegram straight back', async () => {
    await register({ telegramBotToken: 'bot-token', telegramChatId: '12345' });
    sendTelegramMessage.mockResolvedValue({ ok: false, error: 'chat not found' });

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendTest, { message: 'hello' }),
    ).resolves.toEqual({ ok: false, error: 'chat not found' });
  });
});

describe('the companion test message', () => {
  it('says the companion is off rather than pretending it spoke', async () => {
    await register({ desktopPetEnabled: false });

    const result = await invoke<NotificationSendResult>(IPC.notifications.sendPetTest, {
      message: 'hello',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Turn the desktop companion on in Settings to see this.',
    });
    expect(speakOnPet).not.toHaveBeenCalled();
  });

  it('says so while the companion is snoozed', async () => {
    await register({ desktopPetEnabled: true });
    snoozeState.mockReturnValue({ until: Date.now() + 60_000 });

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendPetTest, { message: 'hello' }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining('hidden right now') });
  });

  it('goes ahead once the snooze has run out', async () => {
    await register({ desktopPetEnabled: true });
    snoozeState.mockReturnValue({ until: Date.now() - 1_000 });
    speakOnPet.mockReturnValue(true);

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendPetTest, { message: 'hello' }),
    ).resolves.toEqual({ ok: true });
  });

  it('reports that nothing is on screen when the companion window is gone', async () => {
    await register({ desktopPetEnabled: true });
    speakOnPet.mockReturnValue(false);

    await expect(
      invoke<NotificationSendResult>(IPC.notifications.sendPetTest, { message: 'hello' }),
    ).resolves.toEqual({ ok: false, error: 'The companion is not on screen right now.' });
  });
});

describe('finding the chat id', () => {
  it('asks for the token first', async () => {
    await register({ telegramBotToken: '' });

    await expect(invoke(IPC.notifications.detectChatId)).resolves.toEqual({
      chatId: null,
      error: 'Enter your Telegram bot token first.',
    });
    expect(detectLatestChatId).not.toHaveBeenCalled();
  });

  it('reads the latest chat the bot was written to', async () => {
    await register({ telegramBotToken: 'bot-token' });
    detectLatestChatId.mockResolvedValue({ chatId: '98765' });

    await expect(invoke(IPC.notifications.detectChatId)).resolves.toEqual({ chatId: '98765' });
    expect(detectLatestChatId).toHaveBeenCalledWith('bot-token');
  });
});
