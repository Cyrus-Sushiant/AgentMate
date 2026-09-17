/**
 * Every AI model name AgentMate knows, in one file.
 *
 * When a provider ships a new model (or renames one), this is the only file to edit. The rest of
 * the app reads from here: the run recommendation in Prompt Builder, launch defaults in Settings,
 * CLI argument hints, Ask AI's model pickers, the Diffray wizard, token cost estimates, and the
 * labels on usage windows.
 *
 * Each entry keeps the three names a model goes by apart:
 * - `label` is what people read ("Opus 5").
 * - `cliArg` is what goes after the CLI's model flag ("opus").
 * - `apiId` is the id the provider's API and logs use ("claude-opus-5"). Cost estimates match it
 *   against MODEL_PRICES by prefix.
 *
 * This file imports nothing, so any module can read it without an import cycle.
 */

export interface CatalogModel {
  /** What people read, e.g. "Opus 5". */
  label: string;
  /** Model family without the version, e.g. "Opus". */
  family?: string;
  /** Value for the CLI's model flag, e.g. "opus". */
  cliArg?: string;
  /** Id the provider's API and logs use, e.g. "claude-opus-5". */
  apiId?: string;
}

/** A model offered in a simple picker, where the value is the id sent as is. */
export interface CatalogModelOption {
  value: string;
  label: string;
}

// Anthropic (Claude Code and anything else that takes Claude aliases)

export const CLAUDE_MODELS = {
  haiku: { label: 'Haiku 4.5', family: 'Haiku', cliArg: 'haiku', apiId: 'claude-haiku-4-5' },
  sonnet: { label: 'Sonnet 5', family: 'Sonnet', cliArg: 'sonnet', apiId: 'claude-sonnet-5' },
  opus: { label: 'Opus 5', family: 'Opus', cliArg: 'opus', apiId: 'claude-opus-5' },
  fable: { label: 'Fable 5.1', family: 'Fable', cliArg: 'fable', apiId: 'claude-fable-5-1' },
} as const satisfies Record<string, CatalogModel>;

/** Claude family names, e.g. for reading "Set model to Opus 5" out of a transcript. */
export const CLAUDE_FAMILIES: readonly string[] = Object.values(CLAUDE_MODELS).map((m) => m.family);

/**
 * The Claude model that plans above Pro meter in a weekly bucket of its own. It moved from Opus
 * to Fable once already. The stored window key stays 'week-fable' either way.
 */
export const CLAUDE_WEEKLY_METERED_MODEL = CLAUDE_MODELS.fable;

// OpenAI (Codex CLI)

export const CODEX_MODELS = {
  luna: { label: 'GPT-5.6 Luna', cliArg: 'gpt-5.6-luna', apiId: 'gpt-5.6-luna' },
  terra: { label: 'GPT-5.6 Terra', cliArg: 'gpt-5.6-terra', apiId: 'gpt-5.6-terra' },
  sol: { label: 'GPT-5.6 Sol', cliArg: 'gpt-5.6-sol', apiId: 'gpt-5.6-sol' },
} as const satisfies Record<string, CatalogModel>;

/** Priced in place of a Codex log entry that never said which model it came from. */
export const CODEX_LOG_FALLBACK_MODEL = 'gpt-5';

// Google (Gemini CLI)

export const GEMINI_CLI_MODELS = {
  flash25: { label: 'Gemini 2.5 Flash', cliArg: 'gemini-2.5-flash', apiId: 'gemini-2.5-flash' },
  flash3: {
    label: 'Gemini 3 Flash',
    cliArg: 'gemini-3-flash-preview',
    apiId: 'gemini-3-flash-preview',
  },
  pro3: { label: 'Gemini 3 Pro', cliArg: 'gemini-3-pro-preview', apiId: 'gemini-3-pro-preview' },
} as const satisfies Record<string, CatalogModel>;

// Example model names shown as argument hints, per CLI id. Only the model goes here. The flag
// stays with the CLI in cli/registry.ts, since each CLI spells it differently.

export const CLI_MODEL_EXAMPLES = {
  'claude-code': CLAUDE_MODELS.sonnet.cliArg,
  openclaude: CLAUDE_MODELS.sonnet.cliArg,
  aider: CLAUDE_MODELS.sonnet.cliArg,
  pi: CLAUDE_MODELS.sonnet.cliArg,
  'gemini-cli': 'gemini-2.5-pro',
  opencode: 'anthropic/claude-sonnet-4-5',
  'codex-cli': 'gpt-5-codex',
  'grok-cli': 'grok-4',
  'cursor-cli': 'sonnet-4-thinking',
  'copilot-cli': 'claude-sonnet-4.5',
  'qwen-cli': 'qwen3-coder-plus',
  'cline-cli': 'claude-sonnet-4-5',
  'continue-cli': 'owner/package',
} as const;

// Ask AI (direct API calls)

export const OPENAI_API_MODELS: readonly CatalogModelOption[] = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
];
export const DEFAULT_OPENAI_API_MODEL = 'gpt-4o-mini';

export const GEMINI_API_MODELS: readonly CatalogModelOption[] = [
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
];
export const DEFAULT_GEMINI_API_MODEL = 'gemini-2.0-flash';

// Tools

/** Strix takes one model in provider/model form. */
export const STRIX_DEFAULT_MODEL = `anthropic/${CLAUDE_MODELS.sonnet.apiId}`;

/** Commented-out example in the generated .codex/config.toml. */
export const CODEX_CONFIG_EXAMPLE_MODEL = CLI_MODEL_EXAMPLES['codex-cli'];

/** Models Diffray accepts, per executor. An empty value leaves it to the executor. */
export const DIFFRAY_EXECUTOR_MODELS = {
  'claude-cli': [
    { value: CLAUDE_MODELS.haiku.cliArg, label: `${CLAUDE_MODELS.haiku.family} (fast)` },
    { value: CLAUDE_MODELS.sonnet.cliArg, label: `${CLAUDE_MODELS.sonnet.family} (balanced)` },
    { value: CLAUDE_MODELS.opus.cliArg, label: `${CLAUDE_MODELS.opus.family} (thorough)` },
  ],
  'cursor-agent-cli': [
    { value: 'auto', label: 'Auto' },
    { value: 'sonnet-4.5', label: 'Sonnet 4.5' },
    { value: 'opus-4.5', label: 'Opus 4.5' },
  ],
  'opencode-cli': [
    { value: 'opencode/gpt-5-nano', label: 'GPT-5 nano' },
    { value: 'opencode/grok-code', label: 'Grok code' },
  ],
  'codex-cli': [],
} as const satisfies Record<string, readonly CatalogModelOption[]>;

/** Model names as Diffray's docs write them in its speed vs quality table. */
export const DIFFRAY_DOC_MODELS = {
  haiku: CLAUDE_MODELS.haiku.cliArg,
  sonnet: CLAUDE_MODELS.sonnet.cliArg,
  opus: CLAUDE_MODELS.opus.cliArg,
  codex: 'gpt-5.2',
  opencodeNano: 'opencode/gpt-5-nano',
} as const;

// Local speech (voice input)

export interface WhisperModel {
  /** Key stored in settings. */
  key: string;
  label: string;
  /** Hugging Face repo with the ONNX weights. */
  hubId: string;
}

export const WHISPER_MODELS: readonly WhisperModel[] = [
  { key: 'tiny', label: 'Tiny (fastest, ~75 MB)', hubId: 'onnx-community/whisper-tiny' },
  { key: 'base', label: 'Base (balanced, ~145 MB)', hubId: 'onnx-community/whisper-base' },
  { key: 'small', label: 'Small (most accurate, ~490 MB)', hubId: 'onnx-community/whisper-small' },
];
/** `base` is the accuracy and size sweet spot for short dictation. */
export const DEFAULT_WHISPER_MODEL = 'base';

// Prices

export interface ModelPrice {
  input: number;
  output: number;
  /** Price of reading a cached input token (usually a fraction of `input`). */
  cacheRead: number;
  /** Price of writing/creating a cache entry (usually a premium over `input`). */
  cacheWrite: number;
}

/**
 * Hand-maintained subset of model pricing (USD per 1,000,000 tokens), in the spirit of LiteLLM's
 * price map. Keys are matched by longest prefix against the model id, so dated variants
 * ("claude-sonnet-5-20260101") fall through to their base entry. Older ids stay listed because
 * past logs still name them.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic (Claude). Cache read is a tenth of the input rate; cache write carries a 1.25×
  // premium (the 5-minute TTL, which is what the CLIs use). Opus dropped from $15/$75 to $5/$25
  // at 4.5, so the newer Opus ids need their own entries; longest-prefix keeps 4.0/4.1 on the
  // old rate.
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-mythos-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  'claude-3-opus': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },

  // OpenAI (GPT / o-series / Codex).
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  'gpt-4.1': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
  'o4-mini': { input: 1.1, output: 4.4, cacheRead: 0.275, cacheWrite: 1.1 },
  o3: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
  'codex-mini': { input: 1.5, output: 6, cacheRead: 0.375, cacheWrite: 1.5 },

  // Google (Gemini).
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 1.25 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.075, cacheWrite: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0.1 },

  // Others.
  'deepseek-chat': { input: 0.27, output: 1.1, cacheRead: 0.07, cacheWrite: 0.27 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
  'mistral-large': { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 2 },
};

/** The catalog entry whose API id this is, ignoring a date suffix and a `[1m]` context tag. */
export function catalogModelForApiId(model: string): CatalogModel | undefined {
  const id = model
    .trim()
    .toLowerCase()
    .replace(/\[1m\]$/, '')
    .replace(/-\d{8}$/, '');
  const all: CatalogModel[] = [
    ...Object.values(CLAUDE_MODELS),
    ...Object.values(CODEX_MODELS),
    ...Object.values(GEMINI_CLI_MODELS),
  ];
  return all.find((m) => m.apiId === id);
}
