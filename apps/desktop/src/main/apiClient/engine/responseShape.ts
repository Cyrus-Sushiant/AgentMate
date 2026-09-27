import type { ApiTimings } from '../../../shared/apiClientTypes';

/** "Application/JSON; charset=utf-8" to "application/json". */
export function mediaType(contentType: string | undefined | null): string {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

const TEXT_SUBTYPES =
  /(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|yaml|csv|html)/;

/**
 * Whether a body can travel as text. Anything that is not clearly text goes as base64 so bytes
 * survive the trip to the renderer. With no content type at all, the bytes decide.
 */
export function isTextMime(mime: string, body: Buffer): boolean {
  if (mime.startsWith('text/')) return true;
  if (mime) return TEXT_SUBTYPES.test(mime.split('/')[1] ?? '');
  const sample = body.subarray(0, 1024);
  if (sample.includes(0)) return false;
  return !sample.toString('utf-8').includes('�');
}

/** Offsets Postman's requester records, in ms since the request started. */
export interface TimingOffsets {
  request?: number;
  socket?: number;
  lookup?: number;
  connect?: number;
  secureConnect?: number;
  response?: number;
  end?: number;
  done?: number;
}

function gap(later: number | undefined, earlier: number | undefined): number {
  if (later === undefined || earlier === undefined) return 0;
  return Math.max(0, Math.round((later - earlier) * 100) / 100);
}

/**
 * Turns the offsets into the phases the Timeline shows. A socket that was reused never looks up
 * or connects, so those phases are 0 and the wait for the first byte starts at the socket.
 */
export function phaseTimings(offsets: TimingOffsets | undefined, fallbackTotal = 0): ApiTimings {
  if (!offsets || offsets.end === undefined) {
    return { dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: fallbackTotal };
  }
  const ready = offsets.secureConnect ?? offsets.connect ?? offsets.socket;
  return {
    dns: gap(offsets.lookup, offsets.socket),
    tcp: gap(offsets.connect, offsets.lookup),
    tls: gap(offsets.secureConnect, offsets.connect),
    firstByte: gap(offsets.response, ready),
    download: gap(offsets.end, offsets.response),
    total: Math.round(offsets.end * 100) / 100,
  };
}

/** Console arguments as the strings the Console drawer prints. */
export function consoleText(args: readonly unknown[]): string[] {
  return args.map((value) => {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  });
}
