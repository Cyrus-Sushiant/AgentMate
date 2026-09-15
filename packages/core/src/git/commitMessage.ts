/**
 * How AI-written commit messages are shaped. The user picks a style (or writes their own
 * instructions) and which CLI writes them; this builds the prompt that CLI receives.
 */

export type CommitMessageStyle = 'conventional' | 'plain' | 'detailed' | 'custom';

export interface CommitMessageSettings {
  /** CLI_REGISTRY id that writes the message. Null uses the project's CLI, then the app default. */
  cliId: string | null;
  style: CommitMessageStyle;
  /** The user's own rules. Replaces the style's rules for `custom`, adds to them otherwise. */
  instructions: string;
  /** Whether a short body under the summary line is welcome when the change needs one. */
  includeBody: boolean;
  /** Longest summary line to ask for. */
  maxSubjectLength: number;
}

export const DEFAULT_COMMIT_MESSAGE_SETTINGS: CommitMessageSettings = {
  cliId: null,
  style: 'conventional',
  instructions: '',
  includeBody: true,
  maxSubjectLength: 72,
};

export const COMMIT_MESSAGE_STYLES: {
  value: CommitMessageStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'conventional',
    label: 'Conventional Commits',
    description: 'type(scope): summary, e.g. "fix(auth): keep the session after refresh".',
  },
  {
    value: 'plain',
    label: 'Plain summary',
    description: 'One clear sentence in the imperative, e.g. "Keep the session after refresh".',
  },
  {
    value: 'detailed',
    label: 'Summary and bullet points',
    description: 'A summary line, then a bulleted list of the notable changes.',
  },
  {
    value: 'custom',
    label: 'My own instructions',
    description: 'Only the rules you write below.',
  },
];

const STYLE_RULES: Record<Exclude<CommitMessageStyle, 'custom'>, string> = {
  conventional:
    'Use the Conventional Commits format: type(optional scope): summary. Pick the type from ' +
    'feat, fix, refactor, perf, docs, test, build, ci, chore or style.',
  plain: 'Write the summary as one plain sentence in the imperative mood, without a type prefix.',
  detailed:
    'Write a summary line in the imperative mood, then a blank line, then a short bulleted list ' +
    'of the notable changes.',
};

export function normalizeCommitMessageSettings(value: unknown): CommitMessageSettings {
  const rec = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const style = COMMIT_MESSAGE_STYLES.some((s) => s.value === rec.style)
    ? (rec.style as CommitMessageStyle)
    : DEFAULT_COMMIT_MESSAGE_SETTINGS.style;
  const length = Number(rec.maxSubjectLength);
  return {
    cliId: typeof rec.cliId === 'string' && rec.cliId ? rec.cliId : null,
    style,
    instructions: typeof rec.instructions === 'string' ? rec.instructions.slice(0, 4000) : '',
    includeBody: rec.includeBody !== false,
    maxSubjectLength:
      Number.isFinite(length) && length >= 30 && length <= 200
        ? Math.round(length)
        : DEFAULT_COMMIT_MESSAGE_SETTINGS.maxSubjectLength,
  };
}

/** The prompt a CLI gets to write a commit message for `changeSummary`. */
export function buildCommitMessagePrompt(
  settings: CommitMessageSettings,
  changeSummary: string,
): string {
  const rules: string[] = [];
  const own = settings.instructions.trim();
  if (settings.style === 'custom') {
    rules.push(own || STYLE_RULES.conventional);
  } else {
    rules.push(STYLE_RULES[settings.style]);
    if (own) rules.push(`Also follow these instructions from the user:\n${own}`);
  }
  rules.push(`Keep the summary line under ${settings.maxSubjectLength} characters.`);
  if (settings.style !== 'detailed') {
    rules.push(
      settings.includeBody
        ? 'Add a brief body after a blank line only when the change needs explaining.'
        : 'Write only the summary line, with no body.',
    );
  }
  return [
    'Write a git commit message describing these changes.',
    ...rules,
    'Do not read or edit any files; judge only from the information below. Reply with ONLY the ' +
      'commit message, no code fences, no extra commentary.',
    '',
    changeSummary,
  ].join('\n');
}
