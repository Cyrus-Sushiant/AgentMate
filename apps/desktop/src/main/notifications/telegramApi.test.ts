import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, type LocalServer, startHttpServer } from '../../test/main/fixtures';
import {
  detectLatestChatId,
  editTelegramMessage,
  pollTelegramUpdates,
  sendTelegramMessage,
} from './telegramApi';

/**
 * The client talks to api.telegram.org by absolute URL, so the only thing stubbed here is the
 * hostname: every request still goes over a real socket to a real server. That keeps the parts
 * that break in production (query string building, how a non-2xx body is read) under test.
 */

let server: LocalServer | null = null;

/** Sends every https://api.telegram.org request to the local server instead. */
function redirectTelegramToLocal(target: string): void {
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    if (url.hostname !== 'api.telegram.org') return realFetch(input, init);
    return realFetch(`${target}${url.pathname}${url.search}`, init);
  });
}

beforeEach(() => {
  server = null;
});

afterEach(async () => {
  await server?.close();
  server = null;
});

async function serve(
  handler: (path: string, response: ServerResponse, body: string) => void,
): Promise<LocalServer> {
  server = await startHttpServer((request, response, body) => {
    handler(request.url ?? '/', response, body);
  });
  redirectTelegramToLocal(server.url);
  return server;
}

describe('sendTelegramMessage', () => {
  it('posts the chat id and text, and returns the new message id', async () => {
    const local = await serve((_path, response) =>
      json(response, { ok: true, result: { message_id: 4711 } }),
    );

    const result = await sendTelegramMessage('12345:secret', '-1009', 'Build finished');

    expect(result).toEqual({ ok: true, messageId: 4711 });
    expect(local.requests[0].method).toBe('POST');
    // The bot token lives in the path, which is why it must never be logged with the URL.
    expect(local.requests[0].url).toBe('/bot12345:secret/sendMessage');
    expect(JSON.parse(local.requests[0].body)).toEqual({
      chat_id: '-1009',
      text: 'Build finished',
    });
    expect(local.requests[0].headers['content-type']).toBe('application/json');
  });

  it('surfaces the Telegram description when the API refuses', async () => {
    await serve((_path, response) =>
      json(response, { ok: false, description: 'Bad Request: chat not found' }, 400),
    );

    await expect(sendTelegramMessage('t', 'nope', 'hi')).resolves.toEqual({
      ok: false,
      error: 'Bad Request: chat not found',
    });
  });

  it('falls back to the status code when there is no description', async () => {
    await serve((_path, response) => json(response, { ok: false }, 502));

    await expect(sendTelegramMessage('t', 'c', 'hi')).resolves.toEqual({
      ok: false,
      error: 'Telegram API returned 502',
    });
  });

  it('treats an ok:false body with a 200 status as a failure', async () => {
    await serve((_path, response) => json(response, { ok: false, description: 'Forbidden' }));

    await expect(sendTelegramMessage('t', 'c', 'hi')).resolves.toMatchObject({ ok: false });
  });

  it('reports a transport failure instead of throwing at the caller', async () => {
    const local = await serve((_path, response) => response.end());
    await local.close();
    server = null;

    const result = await sendTelegramMessage('t', 'c', 'hi');

    // A notification failing must never take down whatever triggered it.
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('editTelegramMessage', () => {
  it('sends the message id alongside the new text', async () => {
    const local = await serve((_path, response) => json(response, { ok: true }));

    await expect(editTelegramMessage('tok', '42', 99, 'now green')).resolves.toEqual({ ok: true });

    expect(local.requests[0].url).toBe('/bottok/editMessageText');
    expect(JSON.parse(local.requests[0].body)).toEqual({
      chat_id: '42',
      message_id: 99,
      text: 'now green',
    });
  });

  it('accepts "message is not modified" as success', async () => {
    await serve((_path, response) =>
      json(
        response,
        { ok: false, description: 'Bad Request: message is not modified: nothing changed' },
        400,
      ),
    );

    // Re-sending an unchanged status is normal, so it must not look like an error to the user.
    await expect(editTelegramMessage('tok', '42', 99, 'same')).resolves.toEqual({ ok: true });
  });

  it('still reports other failures', async () => {
    await serve((_path, response) =>
      json(response, { ok: false, description: 'message to edit not found' }, 400),
    );

    await expect(editTelegramMessage('tok', '42', 99, 'x')).resolves.toEqual({
      ok: false,
      error: 'message to edit not found',
    });
  });
});

describe('pollTelegramUpdates', () => {
  it('long-polls with the offset and returns the next one past the last update', async () => {
    const local = await serve((_path, response) =>
      json(response, {
        ok: true,
        result: [
          { update_id: 10, message: { chat: { id: -100123 }, text: 'yes' } },
          { update_id: 11, message: { chat: { id: -100123 }, text: 'no' } },
        ],
      }),
    );

    const result = await pollTelegramUpdates('tok', 10);

    expect(result.messages).toEqual([
      { chatId: '-100123', text: 'yes' },
      { chatId: '-100123', text: 'no' },
    ]);
    // Without the +1 the same replies would be handled over and over.
    expect(result.nextOffset).toBe(12);
    const url = new URL(`http://x${local.requests[0].url}`);
    expect(url.pathname).toBe('/bottok/getUpdates');
    expect(url.searchParams.get('offset')).toBe('10');
    expect(url.searchParams.get('timeout')).toBe('25');
  });

  it('honours a shorter timeout, which startup uses to take a baseline', async () => {
    const local = await serve((_path, response) => json(response, { ok: true, result: [] }));

    await pollTelegramUpdates('tok', 0, 0);

    expect(new URL(`http://x${local.requests[0].url}`).searchParams.get('timeout')).toBe('0');
  });

  it('advances the offset past updates that carry no text', async () => {
    await serve((_path, response) =>
      json(response, {
        ok: true,
        result: [{ update_id: 5, message: { chat: { id: 1 } } }, { update_id: 6 }],
      }),
    );

    // A sticker or an edited-message update still has to move the offset, or the poll loop
    // would fetch it forever.
    await expect(pollTelegramUpdates('tok', 0)).resolves.toEqual({ messages: [], nextOffset: 7 });
  });

  it('keeps the current offset when the API answers with an error', async () => {
    await serve((_path, response) => json(response, { ok: false, description: 'nope' }, 401));

    await expect(pollTelegramUpdates('tok', 33)).resolves.toEqual({ messages: [], nextOffset: 33 });
  });

  it('propagates a transport failure so the caller can back off', async () => {
    const local = await serve((_path, response) => response.end());
    await local.close();
    server = null;

    // Unlike the send helpers this one throws, which is what the poll loop's catch relies on.
    await expect(pollTelegramUpdates('tok', 0)).rejects.toThrow();
  });
});

describe('detectLatestChatId', () => {
  it('returns the chat id of the most recent message', async () => {
    const local = await serve((_path, response) =>
      json(response, {
        ok: true,
        result: [
          { update_id: 1, message: { chat: { id: 111 }, text: 'old' } },
          { update_id: 2, message: { chat: { id: 222 }, text: 'new' } },
        ],
      }),
    );

    await expect(detectLatestChatId('tok')).resolves.toEqual({ chatId: '222' });
    expect(new URL(`http://x${local.requests[0].url}`).searchParams.get('limit')).toBe('100');
  });

  it('explains what to do when the bot has never been messaged', async () => {
    await serve((_path, response) => json(response, { ok: true, result: [] }));

    const result = await detectLatestChatId('tok');

    expect(result.chatId).toBeNull();
    // The whole point of this helper is to spare the user hunting for the id, so the empty
    // case has to tell them the one step they are missing.
    expect(result.error).toMatch(/Send your bot any message/);
  });

  it('reports an invalid token', async () => {
    await serve((_path, response) =>
      json(response, { ok: false, description: 'Unauthorized' }, 401),
    );

    await expect(detectLatestChatId('bad')).resolves.toEqual({
      chatId: null,
      error: 'Unauthorized',
    });
  });

  it('reports a transport failure rather than throwing', async () => {
    const local = await serve((_path, response) => response.end());
    await local.close();
    server = null;

    const result = await detectLatestChatId('tok');
    expect(result.chatId).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
