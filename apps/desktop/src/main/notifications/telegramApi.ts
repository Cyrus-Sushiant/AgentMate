export interface TelegramSendResult {
  ok: boolean;
  error?: string;
  /** message_id of the sent message, used to edit it in place later (e.g. status updates). */
  messageId?: number;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.description ?? `Telegram API returned ${response.status}` };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Edits a previously sent message in place, e.g. to reflect a scheduled task's new status. */
export async function editTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!response.ok || !data.ok) {
      // Telegram errors here if the new text is identical to the old — harmless, treat as success.
      if (data.description?.includes('message is not modified')) return { ok: true };
      return { ok: false, error: data.description ?? `Telegram API returned ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

/**
 * Polls getUpdates once with a long-poll timeout, returning new messages since `offset`.
 * Callers track the returned `nextOffset` and pass it back in on the next call.
 */
export async function pollTelegramUpdates(
  botToken: string,
  offset: number,
  timeoutSeconds = 25,
): Promise<{ messages: { chatId: string; text: string }[]; nextOffset: number }> {
  const url = new URL(`https://api.telegram.org/bot${botToken}/getUpdates`);
  url.searchParams.set('timeout', String(timeoutSeconds));
  url.searchParams.set('offset', String(offset));
  const response = await fetch(url, { signal: AbortSignal.timeout((timeoutSeconds + 5) * 1000) });
  const data = (await response.json()) as { ok: boolean; result?: TelegramUpdate[] };
  if (!response.ok || !data.ok || !data.result) {
    return { messages: [], nextOffset: offset };
  }

  const messages: { chatId: string; text: string }[] = [];
  let nextOffset = offset;
  for (const update of data.result) {
    nextOffset = update.update_id + 1;
    if (update.message?.text) {
      messages.push({ chatId: String(update.message.chat.id), text: update.message.text });
    }
  }
  return { messages, nextOffset };
}

/** Finds the chat ID of the most recent message sent to the bot, so users don't have to hunt for it. */
export async function detectLatestChatId(
  botToken: string,
): Promise<{ chatId: string | null; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=100`);
    const data = (await response.json()) as { ok: boolean; result?: TelegramUpdate[]; description?: string };
    if (!response.ok || !data.ok) {
      return { chatId: null, error: data.description ?? `Telegram API returned ${response.status}` };
    }
    const messages = data.result ?? [];
    const last = messages.at(-1);
    if (!last?.message) {
      return { chatId: null, error: 'No messages found yet. Send your bot any message on Telegram, then try again.' };
    }
    return { chatId: String(last.message.chat.id) };
  } catch (error) {
    return { chatId: null, error: error instanceof Error ? error.message : String(error) };
  }
}
