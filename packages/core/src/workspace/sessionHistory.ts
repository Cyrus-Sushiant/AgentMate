/**
 * Summaries of past agent conversations, read from the transcripts the CLIs keep on disk.
 * Main reads the first and last chunk of each file; everything here works on those lines,
 * so a 20MB transcript costs the same as a short one.
 */

export type AgentHistoryProvider = 'claude-code' | 'codex';

export interface AgentHistorySession {
  provider: AgentHistoryProvider;
  /** The id the CLI resumes the conversation by. */
  id: string;
  /** A name the user or the CLI gave the conversation, when there is one. */
  title: string | null;
  /** The first thing the user asked, cleaned up for a one-line preview. */
  firstPrompt: string | null;
  /** The most recent thing the user asked, when it differs from the first. */
  lastPrompt: string | null;
  cwd: string | null;
  gitBranch: string | null;
  model: string | null;
  /** The reasoning effort the session ran at, when the CLI records one. */
  effort: string | null;
  startedAt: number | null;
  updatedAt: number;
  sizeBytes: number;
  /** Started by a tool (`claude -p`, `codex exec`) rather than typed into by a person. */
  background: boolean;
}

export type SessionSummary = Omit<AgentHistorySession, 'provider' | 'updatedAt' | 'sizeBytes'>;

const PREVIEW_LIMIT = 240;

/** Claude Code names a project's transcript folder after its path, every other character a dash. */
export function claudeProjectDirName(cwd: string): string {
  return cwd.replace(/[\\/]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
}

/** Whether two folder paths point at the same place, ignoring separators, a trailing slash and (on Windows) case. */
export function sameFolder(a: string, b: string, caseInsensitive: boolean): boolean {
  const norm = (p: string): string => {
    const slashed = p.replaceAll('\\', '/').replace(/\/+$/, '');
    return caseInsensitive ? slashed.toLowerCase() : slashed;
  };
  return norm(a) === norm(b);
}

/**
 * Turns a raw prompt into a preview line, or null when it is not something the user typed:
 * slash command wrappers, command output, system reminders and interrupted-request markers.
 */
export function promptPreview(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (
    /^<(command-name|command-message|local-command-stdout|local-command-caveat|bash-stdout|bash-stderr)>/.test(
      trimmed,
    ) ||
    trimmed.startsWith('Caveat: The messages below') ||
    trimmed.startsWith('[Request interrupted')
  ) {
    return null;
  }
  const cleaned = trimmed
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/<bash-input>([\s\S]*?)<\/bash-input>/g, '! $1')
    .replace(/\[Image #\d+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > PREVIEW_LIMIT ? `${cleaned.slice(0, PREVIEW_LIMIT - 1)}…` : cleaned;
}

function parse(line: string): Record<string, unknown> | null {
  if (!line || line[0] !== '{') return null;
  try {
    const value = JSON.parse(line) as unknown;
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function time(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

function claudeUserText(record: Record<string, unknown>): string | null {
  if (record.type !== 'user' || record.isMeta === true || record.isSidechain === true) return null;
  const message = record.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content === 'string') return promptPreview(content);
  if (!Array.isArray(content)) return null;
  // Tool results come back as user messages too; only text blocks are the person talking.
  const text = content
    .map((block) =>
      block && typeof block === 'object' && (block as { type?: unknown }).type === 'text'
        ? String((block as { text?: unknown }).text ?? '')
        : '',
    )
    .join(' ');
  return promptPreview(text);
}

/**
 * Summarizes a Claude Code transcript from its first and last lines. Returns null when the
 * file holds no conversation (only snapshots or hook records).
 */
export function summarizeClaudeTranscript(
  id: string,
  head: string[],
  tail: string[],
): SessionSummary | null {
  let firstPrompt: string | null = null;
  let lastPrompt: string | null = null;
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let startedAt: number | null = null;
  let model: string | null = null;
  let effort: string | null = null;
  let background = false;
  let customTitle: string | null = null;
  let aiTitle: string | null = null;
  let summary: string | null = null;

  const readTitles = (record: Record<string, unknown>): void => {
    if (record.type === 'custom-title') customTitle = str(record.customTitle) ?? customTitle;
    else if (record.type === 'ai-title') aiTitle = str(record.aiTitle) ?? aiTitle;
    else if (record.type === 'summary') summary = str(record.summary) ?? summary;
  };

  for (const line of head) {
    const record = parse(line);
    if (!record) continue;
    readTitles(record);
    startedAt ??= time(record.timestamp);
    if (record.type === 'user' || record.type === 'assistant') {
      cwd ??= str(record.cwd);
      gitBranch ??= str(record.gitBranch);
      if (record.entrypoint === 'sdk-cli' || record.entrypoint === 'sdk-ts') background = true;
    }
    if (record.type === 'assistant') {
      model ??= str((record.message as { model?: unknown } | undefined)?.model);
      effort ??= str(record.perTurnEffort) ?? str(record.effort);
    }
    const text = claudeUserText(record);
    if (text) {
      firstPrompt ??= text;
      lastPrompt = text;
    }
  }

  for (const line of tail) {
    const record = parse(line);
    if (!record) continue;
    readTitles(record);
    if (record.type === 'last-prompt') {
      const text = typeof record.lastPrompt === 'string' ? promptPreview(record.lastPrompt) : null;
      if (text) lastPrompt = text;
    }
    if (record.type === 'assistant') {
      const tailModel = str((record.message as { model?: unknown } | undefined)?.model);
      // Synthetic placeholders are written for interrupted turns; they are not a model.
      if (tailModel && tailModel !== '<synthetic>') model = tailModel;
      effort = str(record.perTurnEffort) ?? str(record.effort) ?? effort;
    }
    if (record.type === 'user' || record.type === 'assistant') {
      gitBranch = str(record.gitBranch) ?? gitBranch;
      cwd ??= str(record.cwd);
    }
    const text = claudeUserText(record);
    if (text) {
      firstPrompt ??= text;
      lastPrompt = text;
    }
  }

  if (!firstPrompt && !customTitle && !aiTitle && !summary) return null;
  return {
    id,
    title: customTitle ?? aiTitle ?? summary,
    firstPrompt,
    lastPrompt: lastPrompt === firstPrompt ? null : lastPrompt,
    cwd,
    gitBranch,
    model: model === '<synthetic>' ? null : model,
    effort,
    startedAt,
    background,
  };
}

/** Just the working folder and id of a Codex rollout, from its first line. */
export function codexRolloutMeta(firstLine: string): {
  id: string;
  cwd: string | null;
  background: boolean;
} | null {
  const record = parse(firstLine);
  if (record?.type !== 'session_meta') return null;
  const payload = record.payload as Record<string, unknown> | undefined;
  const id = str(payload?.id) ?? str(payload?.session_id);
  if (!payload || !id) return null;
  return {
    id,
    cwd: str(payload.cwd),
    background: payload.originator === 'codex_exec' || payload.source === 'exec',
  };
}

/** Summarizes a Codex rollout from its first and last lines. */
export function summarizeCodexRollout(head: string[], tail: string[]): SessionSummary | null {
  const meta = head.length > 0 ? codexRolloutMeta(head[0]) : null;
  if (!meta) return null;
  const firstRecord = parse(head[0]);
  let startedAt = time((firstRecord?.payload as { timestamp?: unknown } | undefined)?.timestamp);
  startedAt ??= time(firstRecord?.timestamp);
  let firstPrompt: string | null = null;
  let lastPrompt: string | null = null;
  let model: string | null = null;
  let effort: string | null = null;
  let gitBranch: string | null = null;

  const read = (line: string): void => {
    const record = parse(line);
    const payload = record?.payload as Record<string, unknown> | undefined;
    if (!record || !payload) return;
    if (record.type === 'turn_context') {
      model = str(payload.model) ?? model;
      effort = str(payload.effort) ?? str(payload.reasoning_effort) ?? effort;
    }
    if (record.type === 'session_meta') {
      const git = payload.git as { branch?: unknown } | undefined;
      gitBranch = str(git?.branch) ?? gitBranch;
    }
    if (record.type === 'event_msg' && payload.type === 'user_message') {
      const text = typeof payload.message === 'string' ? promptPreview(payload.message) : null;
      if (text) {
        firstPrompt ??= text;
        lastPrompt = text;
      }
    }
  };
  for (const line of head) read(line);
  for (const line of tail) read(line);

  if (!firstPrompt) return null;
  return {
    id: meta.id,
    title: null,
    firstPrompt,
    lastPrompt: lastPrompt === firstPrompt ? null : lastPrompt,
    cwd: meta.cwd,
    gitBranch,
    model,
    effort,
    startedAt,
    background: meta.background,
  };
}
