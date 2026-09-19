/**
 * Spots the two moments an agent CLI stops on its own and would carry on if someone typed
 * "continue": it ran into its plan's usage limit (Claude Code's 5-hour window, Codex's quota),
 * or a request died on the network (connection dropped, DNS failed, the API timed out) and
 * the CLI gave up retrying. The desktop app watches each tab's output with these and, when
 * the tab opted in, types "continue" for the user once the limit resets or a few minutes
 * after the network error.
 *
 * Pure and clock-free like `agentStatus.ts`: the caller passes the time in.
 */

/** What a tab has opted into. Both are off unless the user turns them on for that tab. */
export interface AutoContinueOptions {
  /** Send "continue" once the usage limit the agent hit has reset. */
  afterLimitReset?: boolean;
  /** Send "continue" a few minutes after the agent stopped on a network error. */
  afterNetworkError?: boolean;
}

export type AutoContinueKind = 'limit' | 'network';

export type AutoContinueSignal =
  /** `resetAt` is null when the message gave no time the app could read. */
  { kind: 'limit'; resetAt: number | null } | { kind: 'network' };

/** A continue that is scheduled for a tab, as shown next to it. */
export interface AutoContinuePending {
  kind: AutoContinueKind;
  /** Epoch ms the text will be sent. */
  fireAt: number;
  /** How many times this tab has already been continued for the same run of trouble. */
  attempt: number;
}

export const AUTO_CONTINUE_TEXT = 'continue';

/**
 * Turns a chunk of terminal output into plain text. Color codes disappear without a trace so
 * a word painted in two colors stays one word; any other control sequence (cursor moves,
 * erases) becomes a space, since a TUI often positions words with those instead of spaces.
 */
export function terminalPlainText(data: string): string {
  return (
    data
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the OSC escape itself
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the SGR escape itself
      .replace(/\x1b\[[0-9;:]*m/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the CSI escape itself
      .replace(/\x1b\[[0-9;?<>=:]*[ -/]*[@-~]/g, ' ')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: any other two-byte escape
      .replace(/\x1b[@-_]/g, ' ')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: leftover control characters
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ')
      .replace(/[ \t]+/g, ' ')
  );
}

/**
 * Usage limit messages, as the CLIs print them:
 *   Claude Code: "5-hour limit reached ∙ resets 3pm", "You've hit your limit · resets 3pm
 *   (Europe/Istanbul)", "Weekly limit reached ∙ resets Oct 9, 10am", and the older
 *   "Claude AI usage limit reached|1760000000".
 *   Codex: "You've hit your usage limit. ... try again in 2 hours 13 minutes." or
 *   "... try again at 5:34 PM."
 */
const LIMIT_PATTERN =
  /\b(?:usage|session|weekly|opus|sonnet|5-hour|five-hour|daily|hourly)\s+limit reached\b|\bhit your (?:usage |session |weekly )?limit\b|\busage limit (?:exceeded|hit)\b|\bout of (?:extra )?usage\b/i;

/**
 * Network failures an agent CLI stops on once its own retries are spent. Kept to the shapes
 * the CLIs print for a failed request, so an agent that merely writes about ECONNRESET in
 * some code does not trip it.
 */
const NETWORK_PATTERNS: RegExp[] = [
  // Claude Code: "API Error: Connection error.", "API Error: Request timed out.",
  // "API Error (fetch failed)", "API Error: 529 {"type":"overloaded_error"...}"
  /API Error:?\s*\(?\s*(?:Connection error|Request timed out|fetch failed|socket hang up|getaddrinfo|ECONN\w+|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|Overloaded|terminated|5\d\d\b)/i,
  /\bUnable to connect to (?:the )?(?:Anthropic |OpenAI )?API\b/i,
  // Codex: "stream disconnected before completion", "error sending request for url (...)",
  // "exceeded retry limit, last status: 502 Bad Gateway"
  /\bstream disconnected before completion\b/i,
  /\berror sending request for url\b/i,
  /\bexceeded retry limit\b/i,
  // Resolver and socket failures that only show up when a request actually failed.
  /\bgetaddrinfo (?:ENOTFOUND|EAI_AGAIN)\b/i,
  /\bnet::ERR_(?:INTERNET_DISCONNECTED|NETWORK_CHANGED|NAME_NOT_RESOLVED|CONNECTION_RESET|TIMED_OUT)\b/,
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const DAY_MS = 24 * 60 * 60 * 1000;

interface WallDate {
  year: number;
  /** 0-based, like `Date`. */
  month: number;
  day: number;
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    zoneFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall clock in `timeZone` at `at`, read back as if it were UTC. */
function wallClockAsUtc(at: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(new Date(at))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
}

function isZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    zoneFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Today's date on the wall clock of `timeZone` (or this machine's, without one). */
function wallDate(at: number, timeZone?: string): WallDate {
  if (isZone(timeZone)) {
    const wall = new Date(wallClockAsUtc(at, timeZone));
    return { year: wall.getUTCFullYear(), month: wall.getUTCMonth(), day: wall.getUTCDate() };
  }
  const local = new Date(at);
  return { year: local.getFullYear(), month: local.getMonth(), day: local.getDate() };
}

/** The moment a wall-clock time in `timeZone` (or this machine's zone) happens. */
function wallTimeToEpoch(date: WallDate, hour: number, minute: number, timeZone?: string): number {
  if (!isZone(timeZone)) {
    return new Date(date.year, date.month, date.day, hour, minute).getTime();
  }
  const asUtc = Date.UTC(date.year, date.month, date.day, hour, minute);
  // The zone's offset near that moment, checked twice so a DST change in between is caught.
  let at = asUtc - (wallClockAsUtc(asUtc, timeZone) - asUtc);
  at = asUtc - (wallClockAsUtc(at, timeZone) - at);
  return at;
}

function addDays(date: WallDate, days: number): WallDate {
  const next = new Date(Date.UTC(date.year, date.month, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate() };
}

const DURATION_UNITS: [RegExp, number][] = [
  [/^d(?:ays?)?$/i, DAY_MS],
  [/^h(?:ours?|rs?)?$/i, 60 * 60 * 1000],
  [/^m(?:in(?:ute)?s?)?$/i, 60 * 1000],
  [/^s(?:ec(?:ond)?s?)?$/i, 1000],
];

/** "2 hours 13 minutes", "4 days, 1 hour", "2h 5m" in milliseconds, or null. */
function parseDuration(text: string): number | null {
  let total = 0;
  let found = false;
  for (const match of text.matchAll(/(\d+)\s*([a-z]+)/gi)) {
    const unit = DURATION_UNITS.find(([pattern]) => pattern.test(match[2] ?? ''));
    if (!unit) continue;
    total += Number(match[1]) * unit[1];
    found = true;
  }
  return found ? total : null;
}

/**
 * When the usage limit described right after a limit message resets, as epoch ms, or null
 * when the text gives no time. A clock time with no date means its next occurrence.
 */
export function parseLimitReset(text: string, now: number): number | null {
  // Claude Code's older machine-readable form: "Claude AI usage limit reached|1760000000".
  const epoch = /limit reached\|(\d{10})\b/i.exec(text);
  if (epoch) return Number(epoch[1]) * 1000;

  const relative =
    /\b(?:try again|retry|resets?|reset|available again)\s+in\s+((?:\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b[\s,]*(?:and\s+)?)+)/i.exec(
      text,
    );
  if (relative?.[1]) {
    const duration = parseDuration(relative[1]);
    if (duration !== null) return now + duration;
  }

  const clock =
    /\b(?:resets?|reset at|resets at|try again at|retry at|available again at|until)\s+(?:on\s+)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(?:(\d{4}),?\s*)?(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b\s*(?:\(([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)\))?/i.exec(
      text,
    );
  if (!clock) return null;
  const [, monthName, dayText, yearText, hourText, minuteText, meridiem, timeZone] = clock;
  // A bare number ("resets 3") is too easy to misread; insist on am/pm or a ":mm".
  if (!meridiem && minuteText === undefined) return null;
  let hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem) hour = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);

  if (monthName && dayText) {
    const today = wallDate(now, timeZone);
    const month = MONTHS.indexOf(monthName.toLowerCase());
    const year = yearText ? Number(yearText) : today.year;
    let at = wallTimeToEpoch({ year, month, day: Number(dayText) }, hour, minute, timeZone);
    // "Jan 2" read in late December means next year.
    if (!yearText && at < now - DAY_MS) {
      at = wallTimeToEpoch({ year: year + 1, month, day: Number(dayText) }, hour, minute, timeZone);
    }
    return at;
  }

  const today = wallDate(now, timeZone);
  const at = wallTimeToEpoch(today, hour, minute, timeZone);
  // Printed a moment before the hour it names turns over, it still means today.
  return at > now - 60_000 ? at : wallTimeToEpoch(addDays(today, 1), hour, minute, timeZone);
}

/** How much text after a limit message is searched for the reset time. */
const RESET_LOOKAHEAD = 240;

/**
 * Looks at recent plain-text output (see `terminalPlainText`) for a usage limit or a network
 * failure. A limit wins when both show up, since waiting for it covers the other too.
 */
export function detectAutoContinueSignal(text: string, now: number): AutoContinueSignal | null {
  const limit = LIMIT_PATTERN.exec(text);
  if (limit) {
    const after = text.slice(limit.index, limit.index + limit[0].length + RESET_LOOKAHEAD);
    return { kind: 'limit', resetAt: parseLimitReset(after, now) };
  }
  if (NETWORK_PATTERNS.some((pattern) => pattern.test(text))) return { kind: 'network' };
  return null;
}
