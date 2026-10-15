/**
 * Placeholders for run commands, written as `{{name}}` in the command itself. Before a run,
 * the app asks for each value and puts it in as typed. Nothing is quoted, so a template carries
 * whatever quotes it needs. Anything that is not a clean placeholder stays literal text.
 */

export interface RunInput {
  /** The name as written in the template. It is also the key of its value. */
  name: string;
  /** A command with a required input cannot run until that input has a value. */
  required: boolean;
  /** The value the input starts with, when the template gives one. */
  defaultValue: string | undefined;
}

/** Values typed so far, keyed by input name. An input with no entry has not been touched. */
export type RunInputValues = Readonly<Record<string, string>>;

export type RunCommandPart =
  | { kind: 'text'; text: string }
  | { kind: 'value'; name: string; text: string }
  | { kind: 'missing'; name: string; text: string };

export interface RunInputEdit {
  command: string;
  /** The span of the input's name in the new command, so it can be typed over at once. */
  selectionStart: number;
  selectionEnd: number;
}

/**
 * A name, then optionally `?` (the value may stay empty) and `=default`. A default can hold
 * anything except braces.
 */
const PLACEHOLDER = /\{\{([\p{L}_][\p{L}\p{N}‌_-]*)(\?)?(?:=([^{}]*))?\}\}/gu;

/** Go template keywords written bare, so a `{{end}}` in a template is never read as an input. */
const TEMPLATE_KEYWORDS = new Set(['end', 'else', 'break', 'continue']);

/** Control characters. In a terminal a newline runs the command and a Tab completes, so they become spaces. */
const CONTROL = /\p{Cc}+/gu;

/** A placeholder typed right after one of these reads as part of it, so no space goes in front. */
const JOINS_BEFORE = new Set(['=', ':', '/', '\\', "'", '"', '(']);

interface Placeholder {
  start: number;
  text: string;
  name: string;
  optional: boolean;
  defaultValue: string | undefined;
}

function placeholdersIn(command: string): Placeholder[] {
  const found: Placeholder[] = [];
  for (const match of command.matchAll(PLACEHOLDER)) {
    const name = match[1] ?? '';
    if (TEMPLATE_KEYWORDS.has(name)) continue;
    found.push({
      start: match.index ?? 0,
      text: match[0],
      name,
      optional: match[2] !== undefined,
      defaultValue: match[3],
    });
  }
  return found;
}

export function parseRunInputs(command: string): RunInput[] {
  const inputs = new Map<string, RunInput>();
  for (const placeholder of placeholdersIn(command)) {
    const seen = inputs.get(placeholder.name);
    if (!seen) {
      inputs.set(placeholder.name, {
        name: placeholder.name,
        required: !placeholder.optional,
        defaultValue: placeholder.defaultValue,
      });
      continue;
    }
    // Required wins across repeats, and the first default that is given wins.
    seen.required ||= !placeholder.optional;
    seen.defaultValue ??= placeholder.defaultValue;
  }
  return [...inputs.values()];
}

function inputsByName(command: string): Map<string, RunInput> {
  return new Map(parseRunInputs(command).map((input): [string, RunInput] => [input.name, input]));
}

/** A name as a label: `target-env` reads "Target env". */
export function runInputLabel(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').trim().toLowerCase();
  if (words === '') return name;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What a typed value becomes: control characters turn into spaces and the edges are trimmed. */
export function sanitizeRunInputValue(value: string): string {
  return value.replace(CONTROL, ' ').trim();
}

/** What an input holds now: the typed value, or its default until anything has been typed. */
function currentValue(input: RunInput, values: RunInputValues): string {
  const raw = Object.hasOwn(values, input.name) ? values[input.name] : input.defaultValue;
  return sanitizeRunInputValue(raw ?? '');
}

/** The required inputs that have nothing in them, in the order they appear in the command. */
export function missingRunInputs(inputs: RunInput[], values: RunInputValues): RunInput[] {
  return inputs.filter((input) => input.required && currentValue(input, values) === '');
}

/**
 * The command cut into pieces, so a preview can show which parts were typed. A required input
 * that is still blank keeps its placeholder text and is marked as missing.
 */
export function runCommandParts(command: string, values: RunInputValues): RunCommandPart[] {
  const inputs = inputsByName(command);
  const parts: RunCommandPart[] = [];
  let cursor = 0;
  const addText = (text: string): void => {
    if (text !== '') parts.push({ kind: 'text', text });
  };

  for (const placeholder of placeholdersIn(command)) {
    const input = inputs.get(placeholder.name);
    if (!input) continue;
    addText(command.slice(cursor, placeholder.start));
    cursor = placeholder.start + placeholder.text.length;

    const value = currentValue(input, values);
    if (value !== '') {
      parts.push({ kind: 'value', name: input.name, text: value });
    } else if (input.required) {
      parts.push({ kind: 'missing', name: input.name, text: placeholder.text });
    }
  }
  addText(command.slice(cursor));
  return parts;
}

/** The command ready to run, with every value filled in. */
export function fillRunInputs(command: string, values: RunInputValues): string {
  return runCommandParts(command, values)
    .map((part) => part.text)
    .join('')
    .trim();
}

/** A name nothing else in the command uses: value, then value2, value3 and so on. */
function freshInputName(command: string): string {
  const taken = new Set(parseRunInputs(command).map((input) => input.name));
  if (!taken.has('value')) return 'value';
  let n = 2;
  while (taken.has(`value${n}`)) n += 1;
  return `value${n}`;
}

/** Whether a space belongs in front of the text at `index`, judged by the character before it. */
function needsSpaceBefore(command: string, index: number): boolean {
  if (index === 0) return false;
  const previous = command.charAt(index - 1);
  return !/\s/.test(previous) && !JOINS_BEFORE.has(previous);
}

/** Whether a word character sits at `index`, so a placeholder put in front of it needs a space. */
function needsSpaceAfter(command: string, index: number): boolean {
  return /[\p{L}\p{N}]/u.test(command.charAt(index));
}

function overlapsPlaceholder(command: string, from: number, to: number): boolean {
  return placeholdersIn(command).some(
    (placeholder) => from < placeholder.start + placeholder.text.length && to > placeholder.start,
  );
}

/** An insertion point inside a placeholder moves to just after it, never into its middle. */
function outsidePlaceholders(command: string, index: number): number {
  for (const placeholder of placeholdersIn(command)) {
    const end = placeholder.start + placeholder.text.length;
    if (index > placeholder.start && index < end) return end;
  }
  return index;
}

/**
 * Adds a new input at the selection, or at the caret. Selected text that can be a value becomes
 * the input's default, so the text stays visible and the name is the only thing left to type.
 */
export function insertRunInput(
  command: string,
  selectionStart: number,
  selectionEnd: number,
): RunInputEdit {
  const clamp = (offset: number): number => Math.min(Math.max(offset, 0), command.length);
  const from = clamp(Math.min(selectionStart, selectionEnd));
  const to = clamp(Math.max(selectionStart, selectionEnd));
  const name = freshInputName(command);
  const selected = command.slice(from, to);
  const core = selected.trim();

  if (core !== '' && !/[{}\p{Cc}]/u.test(selected) && !overlapsPlaceholder(command, from, to)) {
    const lead = selected.slice(0, selected.length - selected.trimStart().length);
    const trail = selected.slice(selected.trimEnd().length);
    const before = lead || (needsSpaceBefore(command, from) ? ' ' : '');
    const after = trail || (needsSpaceAfter(command, to) ? ' ' : '');
    const start = from + before.length + 2;
    return {
      command: `${command.slice(0, from)}${before}{{${name}=${core}}}${after}${command.slice(to)}`,
      selectionStart: start,
      selectionEnd: start + name.length,
    };
  }

  const point = outsidePlaceholders(command, to);
  const before = needsSpaceBefore(command, point) ? ' ' : '';
  const after = needsSpaceAfter(command, point) ? ' ' : '';
  const start = point + before.length + 2;
  return {
    command: `${command.slice(0, point)}${before}{{${name}}}${after}${command.slice(point)}`,
    selectionStart: start,
    selectionEnd: start + name.length,
  };
}

/** The command for a list or a tooltip: `<name>` for a required input, `[name]` for an optional one. */
export function runCommandSummary(command: string): string {
  const inputs = inputsByName(command);
  let summary = '';
  let cursor = 0;
  for (const placeholder of placeholdersIn(command)) {
    const input = inputs.get(placeholder.name);
    if (!input) continue;
    summary += command.slice(cursor, placeholder.start);
    summary += input.required ? `<${input.name}>` : `[${input.name}]`;
    cursor = placeholder.start + placeholder.text.length;
  }
  return summary + command.slice(cursor);
}
