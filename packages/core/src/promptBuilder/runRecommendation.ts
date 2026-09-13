import { cliIdForTargetAI, getCliDefinition } from '../cli/registry.js';
import type { PromptType } from './types.js';

/**
 * Suggests which model and reasoning effort to run a Prompt Builder request with,
 * so the result is good enough without paying for a bigger model than the task needs.
 *
 * Everything here is a local heuristic over the request text and prompt type. It runs
 * on every keystroke, costs nothing, and works offline, which matters more for a hint
 * like this than squeezing out a slightly better guess from another model call.
 */

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

/** Rough spend multiplier per effort level, relative to `high`. */
const EFFORT_COST_FACTOR: Record<EffortLevel, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
  xhigh: 1.4,
  max: 2,
};

export type TaskComplexity = 'light' | 'moderate' | 'complex';

export interface TaskSignal {
  label: string;
  /** Whether this signal pushed the recommendation toward a bigger or a smaller run. */
  direction: 'up' | 'down';
}

export interface TaskAssessment {
  /** 0 (trivial) to 100 (hardest). */
  score: number;
  complexity: TaskComplexity;
  signals: TaskSignal[];
  /** False when there's no request text yet, so the score only reflects the prompt type. */
  hasRequest: boolean;
}

export interface RunModelOption {
  /** Stable key within a profile. */
  id: string;
  label: string;
  /** Short tier name shown above the model, e.g. "Fast". */
  tier: string;
  /** Value passed to the CLI's model flag. Absent for provider-agnostic CLIs. */
  modelArg?: string;
  /** Model id to look up in the usage price map. */
  pricingId?: string;
  /** Relative spend of this model against the others, 1 being the cheapest. */
  costWeight: number;
  bestFor: string;
  /** Highest task score this model is the cheapest good fit for. */
  maxScore: number;
  /** Effort levels this model accepts, lowest first. Absent when effort can't be set. */
  efforts?: readonly EffortLevel[];
  /** Effort to suggest for the lower, middle, and upper third of this model's score band. */
  effortPicks?: readonly [EffortLevel, EffortLevel, EffortLevel];
}

export interface TargetRunProfile {
  cliId: string | undefined;
  /** True when the CLI runs against a provider we can't know, so models are described by class. */
  generic: boolean;
  executable: string | undefined;
  modelFlag?: string;
  effortArgs?: (level: EffortLevel) => string[];
  /** Shown instead of effort controls when the selected model has no effort setting. */
  effortHint: string;
  note?: string;
  models: readonly RunModelOption[];
}

export interface RunChoice {
  model: RunModelOption;
  effort: EffortLevel | undefined;
}

export interface RunRecommendation {
  targetAI: string;
  profile: TargetRunProfile;
  assessment: TaskAssessment;
  recommended: RunChoice;
}

// Prompt types that usually mean more reasoning, more files, or more risk.
const PROMPT_TYPE_WEIGHT: Partial<Record<PromptType, number>> = {
  Architecture: 25,
  Security: 25,
  'AI Agent': 22,
  Performance: 20,
  'Full Stack': 15,
  Database: 15,
  Electron: 14,
  Refactoring: 14,
  'Bug Fix': 12,
  DevOps: 12,
  Backend: 12,
  API: 12,
  Frontend: 8,
  React: 8,
  'Next.js': 8,
  'Node.js': 8,
  '.NET': 8,
  Flutter: 8,
  Python: 8,
  Mobile: 10,
  Testing: 6,
  'Code Review': 10,
  Product: 6,
  'UX Review': 6,
  'UI Design': 4,
  Documentation: 0,
  Custom: 5,
};

interface KeywordRule {
  label: string;
  pattern: RegExp;
  /** Persian phrases, matched by substring because \b doesn't apply to Persian script. */
  persian?: string[];
}

const HEAVY_RULES: KeywordRule[] = [
  {
    label: 'System-wide change',
    pattern:
      /\b(architect\w*|redesign\w*|rewrite|rebuild|from scratch|whole (app|project|codebase)|entire (app|project|codebase)|across the (app|codebase|project)|monorepo|system-wide)\b/i,
    persian: ['معماری', 'بازنویسی', 'کل پروژه', 'کل برنامه', 'از صفر'],
  },
  {
    label: 'Migration or schema change',
    pattern: /\b(migrat\w*|schema|upgrade \w+ to|port(ing)? to)\b/i,
    persian: ['مهاجرت', 'اسکیما', 'ارتقا'],
  },
  {
    label: 'Security-sensitive',
    pattern:
      /\b(auth\w*|login|password|oauth|jwt|permissions?|encrypt\w*|secrets?|vulnerab\w*|xss|csrf|injection)\b/i,
    persian: ['امنیت', 'احراز هویت', 'رمز عبور', 'لاگین'],
  },
  {
    label: 'Performance or concurrency',
    pattern:
      /\b(race condition|concurren\w*|deadlock|threads?|memory leak|optimi[sz]\w*|performance|latency|scal(e|ing|able))\b/i,
    persian: ['کارایی', 'بهینه', 'سرعت', 'نشت حافظه'],
  },
  {
    label: 'Hard-to-pin-down bug',
    pattern: /\b(intermittent\w*|flaky|sometimes|randomly|can'?t reproduce|root cause)\b/i,
    persian: ['گاهی', 'به صورت تصادفی', 'علت اصلی'],
  },
  {
    label: 'Several moving parts',
    pattern:
      /\b(end[- ]to[- ]end|integrat\w*|pipeline|sync\w*|real[- ]?time|websockets?|distributed|multiple (services|pages|screens|components))\b/i,
    persian: ['یکپارچه', 'همگام', 'چند صفحه', 'چند سرویس'],
  },
];

const LIGHT_RULE: KeywordRule = {
  label: 'Small, contained change',
  pattern:
    /\b(typos?|rename|wording|label|colou?r|padding|margin|spacing|comment|readme|bump|reformat|lint|small|minor|tiny|quick|simple|one[- ]liner)\b/i,
  persian: ['تایپو', 'کوچک', 'ساده', 'رنگ', 'متن دکمه', 'جزئی'],
};

const EXPLORE_RULE: KeywordRule = {
  label: 'Needs investigation first',
  pattern: /\b(investigate|explore|compare|evaluate|trade-?offs?|figure out|research)\b/i,
  persian: ['بررسی', 'تحقیق', 'مقایسه'],
};

function matches(rule: KeywordRule, text: string): boolean {
  if (rule.pattern.test(text)) return true;
  return rule.persian?.some((phrase) => text.includes(phrase)) ?? false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function complexityForScore(score: number): TaskComplexity {
  if (score < 30) return 'light';
  if (score < 65) return 'moderate';
  return 'complex';
}

export function assessTaskComplexity(input: {
  rawInput: string;
  promptType: PromptType;
}): TaskAssessment {
  const text = input.rawInput.trim();
  const signals: TaskSignal[] = [];
  const typeWeight = PROMPT_TYPE_WEIGHT[input.promptType] ?? 5;
  let score = 20 + typeWeight;

  if (typeWeight >= 20) signals.push({ label: `${input.promptType} work`, direction: 'up' });
  if (typeWeight === 0) signals.push({ label: `${input.promptType} work`, direction: 'down' });

  if (!text) {
    const clamped = clamp(score, 0, 100);
    return {
      score: clamped,
      complexity: complexityForScore(clamped),
      signals,
      hasRequest: false,
    };
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 8) {
    score -= 8;
    signals.push({ label: 'Short request', direction: 'down' });
  } else if (words > 150) {
    score += 20;
    signals.push({ label: 'Long, detailed request', direction: 'up' });
  } else if (words > 60) {
    score += 10;
    signals.push({ label: 'Detailed request', direction: 'up' });
  }

  const steps = text.split(/\r?\n/).filter((line) => /^\s*([-*•]|\d+[.)])\s+/.test(line)).length;
  if (steps >= 6) {
    score += 18;
    signals.push({ label: `${steps} separate steps`, direction: 'up' });
  } else if (steps >= 3) {
    score += 10;
    signals.push({ label: `${steps} separate steps`, direction: 'up' });
  }

  const files = new Set(
    text.match(
      /[\w./-]+\.(tsx?|jsx?|py|rs|go|java|kt|swift|cs|dart|vue|svelte|css|scss|sql|json|ya?ml)\b/gi,
    ) ?? [],
  ).size;
  if (files >= 3) {
    score += 8;
    signals.push({ label: `Mentions ${files} files`, direction: 'up' });
  }

  let heavy = 0;
  for (const rule of HEAVY_RULES) {
    if (!matches(rule, text)) continue;
    heavy += 12;
    signals.push({ label: rule.label, direction: 'up' });
  }
  score += Math.min(heavy, 30);

  if (matches(EXPLORE_RULE, text)) {
    score += 6;
    signals.push({ label: EXPLORE_RULE.label, direction: 'up' });
  }

  // A "small" request that also trips a heavy rule ("small auth fix") is still auth work,
  // so only discount it when nothing pushed the other way.
  if (heavy === 0 && matches(LIGHT_RULE, text)) {
    score -= 12;
    signals.push({ label: LIGHT_RULE.label, direction: 'down' });
  }

  const clamped = clamp(Math.round(score), 0, 100);
  return {
    score: clamped,
    complexity: complexityForScore(clamped),
    signals,
    hasRequest: true,
  };
}

const CLAUDE_EFFORTS: readonly EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const CODEX_EFFORTS: readonly EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Hand-maintained per CLI. Model names change often, so only CLIs whose flags and model
 * names we've checked against their docs get a concrete profile; the rest get the generic
 * one, which describes models by class instead of guessing ids.
 */
const RUN_PROFILES: Record<string, Omit<TargetRunProfile, 'cliId' | 'executable'>> = {
  'claude-code': {
    generic: false,
    modelFlag: '--model',
    effortArgs: (level) => ['--effort', level],
    effortHint: 'Haiku has no effort setting. It is already the quickest, cheapest option.',
    models: [
      {
        id: 'haiku',
        label: 'Haiku 4.5',
        tier: 'Fast',
        modelArg: 'haiku',
        pricingId: 'claude-haiku-4-5',
        costWeight: 1,
        bestFor: 'Small, well-defined edits and quick lookups',
        maxScore: 22,
      },
      {
        id: 'sonnet',
        label: 'Sonnet 5',
        tier: 'Balanced',
        modelArg: 'sonnet',
        pricingId: 'claude-sonnet-5',
        costWeight: 3,
        bestFor: 'Everyday features, fixes, and tests',
        maxScore: 60,
        efforts: CLAUDE_EFFORTS,
        effortPicks: ['low', 'medium', 'high'],
      },
      {
        id: 'opus',
        label: 'Opus 5',
        tier: 'Deep',
        modelArg: 'opus',
        pricingId: 'claude-opus-5',
        costWeight: 5,
        bestFor: 'Multi-file refactors and tricky systems work',
        maxScore: 86,
        efforts: CLAUDE_EFFORTS,
        effortPicks: ['medium', 'high', 'xhigh'],
      },
      {
        id: 'fable',
        label: 'Fable 5.1',
        tier: 'Frontier',
        modelArg: 'fable',
        pricingId: 'claude-fable-5',
        costWeight: 10,
        bestFor: 'Long, demanding agent sessions and hard reasoning',
        maxScore: 100,
        efforts: CLAUDE_EFFORTS,
        effortPicks: ['high', 'high', 'xhigh'],
      },
    ],
  },
  'codex-cli': {
    generic: false,
    modelFlag: '--model',
    effortArgs: (level) => ['-c', `model_reasoning_effort=${level}`],
    effortHint: 'This model has no effort setting.',
    models: [
      {
        id: 'luna',
        label: 'GPT-5.6 Luna',
        tier: 'Fast',
        modelArg: 'gpt-5.6-luna',
        costWeight: 1,
        bestFor: 'Small, well-defined edits',
        maxScore: 30,
        efforts: CODEX_EFFORTS,
        effortPicks: ['low', 'low', 'medium'],
      },
      {
        id: 'terra',
        label: 'GPT-5.6 Terra',
        tier: 'Balanced',
        modelArg: 'gpt-5.6-terra',
        costWeight: 3,
        bestFor: 'Everyday features, fixes, and tests',
        maxScore: 65,
        efforts: CODEX_EFFORTS,
        effortPicks: ['medium', 'medium', 'high'],
      },
      {
        id: 'sol',
        label: 'GPT-5.6 Sol',
        tier: 'Deep',
        modelArg: 'gpt-5.6-sol',
        costWeight: 6,
        bestFor: 'Complex, multi-step engineering work',
        maxScore: 100,
        efforts: CODEX_EFFORTS,
        effortPicks: ['high', 'high', 'xhigh'],
      },
    ],
  },
  'gemini-cli': {
    generic: false,
    modelFlag: '--model',
    effortHint:
      'Gemini CLI has no per-run effort flag. Its thinking budget lives in settings.json (thinkingConfig).',
    models: [
      {
        id: 'flash-2.5',
        label: 'Gemini 2.5 Flash',
        tier: 'Fast',
        modelArg: 'gemini-2.5-flash',
        pricingId: 'gemini-2.5-flash',
        costWeight: 1,
        bestFor: 'Small, well-defined edits',
        maxScore: 30,
      },
      {
        id: 'flash-3',
        label: 'Gemini 3 Flash',
        tier: 'Balanced',
        modelArg: 'gemini-3-flash-preview',
        costWeight: 2,
        bestFor: 'Everyday features, fixes, and tests',
        maxScore: 65,
      },
      {
        id: 'pro-3',
        label: 'Gemini 3 Pro',
        tier: 'Deep',
        modelArg: 'gemini-3-pro-preview',
        costWeight: 6,
        bestFor: 'Complex reasoning and larger changes',
        maxScore: 100,
      },
    ],
  },
};

const GENERIC_MODELS: readonly RunModelOption[] = [
  {
    id: 'fast',
    label: 'Small model',
    tier: 'Fast',
    costWeight: 1,
    bestFor: 'A Haiku, Flash, or mini class model for small edits',
    maxScore: 30,
  },
  {
    id: 'balanced',
    label: 'Mid-tier model',
    tier: 'Balanced',
    costWeight: 3,
    bestFor: 'A Sonnet class model for everyday coding',
    maxScore: 65,
  },
  {
    id: 'frontier',
    label: 'Frontier model',
    tier: 'Deep',
    costWeight: 6,
    bestFor: 'An Opus or Pro class model for complex work',
    maxScore: 100,
  },
];

export function runProfileForTargetAI(targetAI: string): TargetRunProfile {
  const cliId = cliIdForTargetAI(targetAI);
  const cli = cliId ? getCliDefinition(cliId) : undefined;
  const executable = cli?.executableNames[0];
  const known = cliId ? RUN_PROFILES[cliId] : undefined;
  if (known) return { ...known, cliId, executable };

  // The example args already name each CLI's real model flag (`--model`, `-m`, ...).
  const exampleFlag = cli?.argsExample?.split(/\s+/)[0];
  const modelFlag =
    exampleFlag && /^-/.test(exampleFlag) && /model|^-m$/.test(exampleFlag)
      ? exampleFlag
      : undefined;
  return {
    cliId,
    executable,
    generic: true,
    modelFlag,
    effortHint: 'If your provider has a reasoning effort setting, set it there.',
    note: `${cli?.label ?? targetAI} runs whichever provider you set up, so pick the matching model from it.`,
    models: GENERIC_MODELS,
  };
}

function effortForBand(model: RunModelOption, band: 0 | 1 | 2): EffortLevel | undefined {
  if (!model.efforts?.length) return undefined;
  return model.effortPicks?.[band] ?? model.efforts[Math.floor(model.efforts.length / 2)];
}

/** The effort to show when the user switches to a model without a score to place it by. */
export function defaultEffortFor(model: RunModelOption): EffortLevel | undefined {
  return effortForBand(model, 1);
}

export function recommendRun(input: {
  rawInput: string;
  promptType: PromptType;
  targetAI: string;
}): RunRecommendation {
  const assessment = assessTaskComplexity(input);
  const profile = runProfileForTargetAI(input.targetAI);
  const index = Math.max(
    0,
    profile.models.findIndex((m) => assessment.score <= m.maxScore),
  );
  const model = profile.models[index] ?? profile.models[profile.models.length - 1]!;
  const floor = index > 0 ? (profile.models[index - 1]?.maxScore ?? 0) : 0;
  const span = Math.max(1, model.maxScore - floor);
  const position = (assessment.score - floor) / span;
  const band: 0 | 1 | 2 = position < 1 / 3 ? 0 : position < 2 / 3 ? 1 : 2;

  return {
    targetAI: input.targetAI,
    profile,
    assessment,
    recommended: { model, effort: effortForBand(model, band) },
  };
}

/** CLI args that apply a choice, e.g. `['--model', 'sonnet', '--effort', 'medium']`. */
export function runChoiceArgs(profile: TargetRunProfile, choice: RunChoice): string[] {
  const args: string[] = [];
  if (profile.modelFlag && choice.model.modelArg)
    args.push(profile.modelFlag, choice.model.modelArg);
  if (choice.effort && profile.effortArgs && choice.model.efforts?.includes(choice.effort)) {
    args.push(...profile.effortArgs(choice.effort));
  }
  return args;
}

/**
 * Drops run args the user already set in their own CLI arguments, so a configured
 * `--model` wins and the CLI never sees the same flag twice. Run args always come in
 * flag/value pairs; for `-c key=value` pairs the key is what has to be unique.
 */
export function withoutConfiguredRunArgs(configuredArgs: string, runArgs: string[]): string[] {
  const configured = configuredArgs.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (let i = 0; i + 1 < runArgs.length; i += 2) {
    const flag = runArgs[i]!;
    const value = runArgs[i + 1]!;
    const key = flag === '-c' ? value.split('=')[0]! : flag;
    const clash =
      flag === '-c'
        ? configured.some((arg) => arg.startsWith(`${key}=`))
        : configured.some((arg) => arg === key || arg.startsWith(`${key}=`));
    if (!clash) kept.push(flag, value);
  }
  return kept;
}

export type CostLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Where a choice sits on this CLI's own cost range, 1 being its cheapest run and 5 its
 * priciest. It's relative on purpose: token counts depend on the repo and the agent's
 * path through it, so a dollar figure per task would be a guess dressed up as a number.
 */
export function relativeCostLevel(profile: TargetRunProfile, choice: RunChoice): CostLevel {
  const value = (m: RunModelOption, e: EffortLevel | undefined) =>
    m.costWeight * (e ? EFFORT_COST_FACTOR[e] : 1);
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const m of profile.models) {
    const levels = m.efforts?.length ? m.efforts : [undefined];
    for (const e of levels) {
      const v = value(m, e);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  const current = value(choice.model, choice.effort);
  if (max <= min) return 3;
  const t = Math.log(current / min) / Math.log(max / min);
  return clamp(Math.round(1 + t * 4), 1, 5) as CostLevel;
}
