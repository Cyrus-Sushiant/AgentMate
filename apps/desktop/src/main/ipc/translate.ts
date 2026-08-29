import { ipcMain } from 'electron';
import type { TranslateTextInput } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { store } from '../store';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The gtx endpoint carries the text in the query string, so a long request
 * comes back truncated or not at all. Anything past this goes out in pieces.
 */
const MAX_TRANSLATE_CHARS = 1200;

/**
 * Splits on paragraph breaks first, then on line breaks, and only cuts inside a
 * line when that single line is over the budget on its own. The separators stay
 * attached to the pieces they follow, so joining the results back together is a
 * plain concatenation and the original layout survives the trip.
 */
function splitForTranslation(text: string): string[] {
  const pieces: string[] = [];
  const push = (piece: string): void => {
    if (piece.length <= MAX_TRANSLATE_CHARS) {
      pieces.push(piece);
      return;
    }
    const lines = piece.split(/(?<=\n)/);
    if (lines.length > 1) {
      for (const line of lines) push(line);
      return;
    }
    for (let i = 0; i < piece.length; i += MAX_TRANSLATE_CHARS) {
      pieces.push(piece.slice(i, i + MAX_TRANSLATE_CHARS));
    }
  };
  for (const paragraph of text.split(/(?<=\n\n)/)) push(paragraph);

  // Pack them back up, so a short document still goes out as one request.
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + piece.length <= MAX_TRANSLATE_CHARS) {
      chunks[chunks.length - 1] = last + piece;
    } else {
      chunks.push(piece);
    }
  }
  return chunks;
}

// Uses Google Translate's free "gtx" web-client endpoint (no API key, no
// billing) rather than the paid Cloud Translation API. That's what lets
// Prompt Builder offer direct translation with zero setup. It's an
// undocumented, unofficial endpoint that Google could change or block without
// notice; callers should treat failures as recoverable.
async function translateChunk(text: string, targetLang: string): Promise<string> {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translate request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  // Response shape: [[[translatedChunk, originalChunk, ...], ...], ...]
  const segments = Array.isArray(data) ? data[0] : null;
  if (!Array.isArray(segments)) {
    throw new Error('Unexpected translate response shape.');
  }

  return segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? '') : ''))
    .join('');
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return '';

  const out: string[] = [];
  for (const chunk of splitForTranslation(text)) {
    // Sequential on purpose: the endpoint is undocumented and unauthenticated,
    // and firing a dozen requests at once is the quickest way to be blocked.
    // Whitespace-only pieces have nothing to translate and come back empty.
    out.push(chunk.trim() ? await translateChunk(chunk, targetLang) : chunk);
  }
  return out.join('');
}

async function translateTextWithRetries(text: string, targetLang: string): Promise<string> {
  const { translateMaxRetries } = await store.getSettings();
  const maxAttempts = 1 + Math.max(0, translateMaxRetries);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await translateText(text, targetLang);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await delay(500 * attempt);
    }
  }
  throw lastError;
}

export function registerTranslateHandlers(): void {
  ipcMain.handle(
    IPC.translate.text,
    (_event, input: TranslateTextInput): Promise<string> =>
      translateTextWithRetries(input.text, input.targetLang),
  );
}
