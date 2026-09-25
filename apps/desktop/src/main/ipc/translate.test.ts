import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * Translation for the Prompt Builder. The endpoint carries the text in the query string, so a
 * long document has to go out in pieces and come back joined exactly as it was: the splitting and
 * rejoining is what these check, along with the retry budget that comes from settings.
 */

const userData = useTempUserData();
expectChannelsCovered(IPC.translate);

const fetchMock = vi.fn();

async function register(): Promise<void> {
  await loadIpc(
    () => import('./translate'),
    (module) => module.registerTranslateHandlers(),
  );
}

/** The shape the gtx endpoint answers with: [[[translated, original, ...], ...], ...]. */
function reply(translated: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 429,
    json: async () => [[[translated, 'original']]],
  } as unknown as Response;
}

/** The text each request was sent, read back out of the query string. */
function sentTexts(): string[] {
  return fetchMock.mock.calls.map((call) => new URL(String(call[0])).searchParams.get('q') ?? '');
}

function translate(text: string, targetLang = 'fa'): Promise<string> {
  return invoke<string>(IPC.translate.text, { text, targetLang });
}

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: URL) =>
    reply(`[fa] ${new URL(url).searchParams.get('q')}`),
  );
  vi.stubGlobal('fetch', fetchMock);
  await register();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('translate', () => {
  it('sends the text and the target language, and returns what came back', async () => {
    const result = await translate('Hello there', 'de');

    expect(result).toBe('[fa] Hello there');
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('tl')).toBe('de');
    expect(url.searchParams.get('sl')).toBe('auto');
  });

  it('answers empty text without asking the network', async () => {
    await expect(translate('   \n  ')).resolves.toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a short document as a single request', async () => {
    await translate('One paragraph.\n\nAnd another.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('splits a long document on paragraph breaks and joins the pieces back', async () => {
    // Each paragraph is under the limit, but together they are over it, so this has to go out in
    // more than one request and come back as one string.
    const paragraph = `${'word '.repeat(150).trim()}\n\n`;
    const text = paragraph.repeat(4);

    const result = await translate(text);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    // Nothing is dropped and nothing is sent twice.
    expect(sentTexts().join('')).toBe(text);
    expect(result).toBe(
      sentTexts()
        .map((one) => `[fa] ${one}`)
        .join(''),
    );
  });

  it('cuts inside a line only when that one line is too long on its own', async () => {
    const line = 'x'.repeat(3000);

    await translate(line);

    const sent = sentTexts();
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every((piece) => piece.length <= 1200)).toBe(true);
    expect(sent.join('')).toBe(line);
  });

  it('keeps whitespace pieces as they are instead of translating them', async () => {
    // A blank line has nothing to translate, and sending it would waste a request.
    const text = `${'word '.repeat(150).trim()}\n\n   \n\n${'word '.repeat(150).trim()}`;

    await translate(text);

    expect(sentTexts().some((piece) => piece.trim() === '')).toBe(false);
  });

  // These two ride the real backoff (500ms, then 1000ms). Fake timers do not help: the retry
  // budget is read from disk first, so the timer does not exist yet at the point a test could
  // advance it.
  it('retries as many times as the setting allows, then gives up', async () => {
    userData.writeData('settings.json', { translateMaxRetries: 2 });
    await register();
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(translate('Hello')).rejects.toThrow('network down');

    // One attempt plus two retries.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops retrying as soon as one attempt works', async () => {
    userData.writeData('settings.json', { translateMaxRetries: 3 });
    await register();
    fetchMock.mockRejectedValueOnce(new Error('one blip')).mockResolvedValue(reply('[fa] Hello'));

    await expect(translate('Hello')).resolves.toBe('[fa] Hello');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails on an error status rather than returning half a translation', async () => {
    userData.writeData('settings.json', { translateMaxRetries: 0 });
    await register();
    fetchMock.mockResolvedValue(reply('', false));

    await expect(translate('Hello')).rejects.toThrow(/429/);
  });

  it('gives every request a deadline, so a stalled connection cannot hang forever', async () => {
    await translate('Hello');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('stops a request when it is cancelled, without retrying it', async () => {
    userData.writeData('settings.json', { translateMaxRetries: 3 });
    await register();
    let started!: () => void;
    const sent = new Promise<void>((resolve) => {
      started = resolve;
    });
    // Never answers on its own, like a connection that went quiet.
    fetchMock.mockImplementation(
      (_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          started();
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const pending = invoke<string>(IPC.translate.text, {
      text: 'Hello',
      targetLang: 'en',
      requestId: 'req-1',
    });
    await sent;

    await expect(invoke<boolean>(IPC.translate.cancel, 'req-1')).resolves.toBe(true);
    await expect(pending).rejects.toThrow(/aborted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Nothing is left to cancel once it has stopped.
    await expect(invoke<boolean>(IPC.translate.cancel, 'req-1')).resolves.toBe(false);
  });

  it('refuses an answer that is not the shape the endpoint documents', async () => {
    userData.writeData('settings.json', { translateMaxRetries: 0 });
    await register();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);

    await expect(translate('Hello')).rejects.toThrow(/response shape/);
  });
});
