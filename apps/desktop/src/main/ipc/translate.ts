import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { TranslateTextInput } from '../../shared/apiTypes';
import { store } from '../store';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uses Google Translate's free "gtx" web-client endpoint (no API key, no
// billing) rather than the paid Cloud Translation API — this is what lets
// Prompt Builder offer direct translation with zero setup. It's an
// undocumented, unofficial endpoint that Google could change or block without
// notice; callers should treat failures as recoverable.
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return '';

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

  return segments.map((segment) => (Array.isArray(segment) ? String(segment[0] ?? '') : '')).join('');
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
  ipcMain.handle(IPC.translate.text, (_event, input: TranslateTextInput): Promise<string> =>
    translateTextWithRetries(input.text, input.targetLang),
  );
}
