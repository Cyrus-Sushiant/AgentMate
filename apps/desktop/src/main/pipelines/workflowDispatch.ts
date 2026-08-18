import type { GithubWorkflowDispatchInput } from '../../shared/apiTypes';

export interface WorkflowDispatchSpec {
  /** True when the workflow file declares a `workflow_dispatch` trigger, so it can be started by hand. */
  dispatchable: boolean;
  inputs: GithubWorkflowDispatchInput[];
}

interface Line {
  indent: number;
  text: string;
}

interface Entry {
  key: string;
  value: string;
  /** Index of the first child line of this entry. */
  start: number;
  /** Index just past the last child line. */
  end: number;
}

const INPUT_TYPES = ['string', 'boolean', 'choice', 'number', 'environment'] as const;

/** Drops a trailing `# comment`, ignoring `#` that sits inside a quoted scalar. */
function stripComment(value: string): string {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#' && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trimEnd();
  }
  return value.trimEnd();
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.endsWith(first)) return trimmed.slice(1, -1);
  return trimmed;
}

function readLines(source: string): Line[] {
  const lines: Line[] = [];
  for (const raw of source.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const text = stripComment(raw.trim());
    if (!text) continue;
    lines.push({ indent: raw.length - raw.trimStart().length, text });
  }
  return lines;
}

/** Splits `key: value` at the first colon that is a mapping separator rather than part of a scalar. */
function splitEntry(text: string): { key: string; value: string } | null {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ':' && (i === text.length - 1 || /\s/.test(text[i + 1]))) {
      const key = unquote(text.slice(0, i));
      if (!key) return null;
      return { key, value: text.slice(i + 1).trim() };
    }
  }
  return null;
}

/** The mapping entries of one block: the lines in [from, to) sitting at the block's own indent. */
function blockEntries(lines: Line[], from: number, to: number): Entry[] {
  if (from >= to) return [];
  const indent = lines[from].indent;
  const entries: Entry[] = [];
  for (let i = from; i < to; i += 1) {
    if (lines[i].indent !== indent) continue;
    const parsed = splitEntry(lines[i].text);
    if (!parsed) continue;
    let end = i + 1;
    while (end < to && lines[end].indent > indent) end += 1;
    entries.push({ key: parsed.key, value: parsed.value, start: i + 1, end });
  }
  return entries;
}

/** The `- item` lines of one block, at the block's own indent. */
function blockItems(lines: Line[], from: number, to: number): string[] {
  if (from >= to) return [];
  const indent = lines[from].indent;
  const items: string[] = [];
  for (let i = from; i < to; i += 1) {
    if (lines[i].indent !== indent) continue;
    if (lines[i].text.startsWith('- ')) items.push(unquote(lines[i].text.slice(2)));
  }
  return items;
}

function parseFlowList(value: string): string[] {
  if (!value.startsWith('[') || !value.endsWith(']')) return [];
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => unquote(item))
    .filter(Boolean);
}

/** A scalar value that may be inline, a flow list, or a `|`/`>` block folded onto the next lines. */
function scalarValue(lines: Line[], entry: Entry): string {
  if (entry.value && entry.value !== '|' && entry.value !== '>' && !entry.value.startsWith('|')) {
    return unquote(entry.value);
  }
  const folded: string[] = [];
  for (let i = entry.start; i < entry.end; i += 1) folded.push(lines[i].text);
  return folded.join(' ').trim();
}

function listValue(lines: Line[], entry: Entry): string[] {
  const inline = parseFlowList(entry.value);
  if (inline.length > 0) return inline;
  return blockItems(lines, entry.start, entry.end);
}

function parseInputs(lines: Line[], from: number, to: number): GithubWorkflowDispatchInput[] {
  return blockEntries(lines, from, to).map((entry) => {
    const props = blockEntries(lines, entry.start, entry.end);
    const find = (key: string): Entry | undefined =>
      props.find((prop) => prop.key.toLowerCase() === key);

    const typeEntry = find('type');
    const rawType = typeEntry ? scalarValue(lines, typeEntry).toLowerCase() : '';
    const type = (INPUT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as GithubWorkflowDispatchInput['type'])
      : 'string';

    const descriptionEntry = find('description');
    const defaultEntry = find('default');
    const requiredEntry = find('required');
    const optionsEntry = find('options');

    return {
      name: entry.key,
      description: descriptionEntry ? scalarValue(lines, descriptionEntry) : '',
      required: requiredEntry ? scalarValue(lines, requiredEntry).toLowerCase() === 'true' : false,
      type,
      default: defaultEntry ? scalarValue(lines, defaultEntry) : '',
      options: optionsEntry ? listValue(lines, optionsEntry) : [],
    };
  });
}

/**
 * Reads the `workflow_dispatch` trigger out of a workflow file so the app knows whether the
 * workflow can be started by hand, and which inputs to ask for. This is a targeted reader rather
 * than a real YAML parser: it only walks the `on:` block, which is always plain nested mappings
 * and lists in practice.
 */
export function parseWorkflowDispatch(source: string): WorkflowDispatchSpec {
  const lines = readLines(source);
  const top = blockEntries(lines, 0, lines.length);
  // YAML 1.1 reads a bare `on` as the boolean true, so files written by tools that round-trip
  // through a parser often come back quoted.
  const onEntry = top.find((entry) => entry.key === 'on' || entry.key === 'true');
  if (!onEntry) return { dispatchable: false, inputs: [] };

  if (onEntry.value) {
    const names = onEntry.value.startsWith('[')
      ? parseFlowList(onEntry.value)
      : [unquote(onEntry.value)];
    return { dispatchable: names.includes('workflow_dispatch'), inputs: [] };
  }

  if (blockItems(lines, onEntry.start, onEntry.end).includes('workflow_dispatch')) {
    return { dispatchable: true, inputs: [] };
  }

  const trigger = blockEntries(lines, onEntry.start, onEntry.end).find(
    (entry) => entry.key === 'workflow_dispatch',
  );
  if (!trigger) return { dispatchable: false, inputs: [] };

  const inputsEntry = blockEntries(lines, trigger.start, trigger.end).find(
    (entry) => entry.key === 'inputs',
  );
  return {
    dispatchable: true,
    inputs: inputsEntry ? parseInputs(lines, inputsEntry.start, inputsEntry.end) : [],
  };
}
