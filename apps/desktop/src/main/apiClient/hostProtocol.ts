import type { EngineEvent, EngineRunInput, EngineRunSummary } from './engine/types';

/**
 * Messages between main and the utility process that runs requests. Each side checks what it
 * receives, and anything of the wrong shape is dropped: a confused process must not be able to
 * resolve someone else's request or crash the other side.
 */

export type MainToHost =
  | { type: 'run'; runId: string; input: EngineRunInput }
  | { type: 'cancel'; runId: string };

export type HostToMain =
  | { type: 'ready'; runtimeVersion: string }
  | { type: 'event'; runId: string; event: EngineEvent }
  | { type: 'done'; runId: string; summary: EngineRunSummary }
  | { type: 'fatal'; error: string };

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRunInput(value: unknown): value is EngineRunInput {
  if (!isRecord(value) || !isRecord(value.collection) || !isRecord(value.options)) return false;
  return Array.isArray(value.collection.item) && typeof value.options.timeoutMs === 'number';
}

const EVENT_TYPES = new Set(['request', 'response', 'assertion', 'console', 'exception']);

function isEvent(value: unknown): value is EngineEvent {
  return isRecord(value) && typeof value.type === 'string' && EVENT_TYPES.has(value.type);
}

function isSummary(value: unknown): value is EngineRunSummary {
  return (
    isRecord(value) &&
    (value.error === null || typeof value.error === 'string') &&
    typeof value.cancelled === 'boolean' &&
    Array.isArray(value.environment) &&
    Array.isArray(value.globals) &&
    Array.isArray(value.collectionVariables)
  );
}

export function parseMainMessage(value: unknown): MainToHost | null {
  if (!isRecord(value) || !isId(value.runId)) return null;
  if (value.type === 'run' && isRunInput(value.input)) {
    return { type: 'run', runId: value.runId, input: value.input };
  }
  if (value.type === 'cancel') return { type: 'cancel', runId: value.runId };
  return null;
}

export function parseHostMessage(value: unknown): HostToMain | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'ready':
      return typeof value.runtimeVersion === 'string'
        ? { type: 'ready', runtimeVersion: value.runtimeVersion }
        : null;
    case 'event':
      return isId(value.runId) && isEvent(value.event)
        ? { type: 'event', runId: value.runId, event: value.event }
        : null;
    case 'done':
      return isId(value.runId) && isSummary(value.summary)
        ? { type: 'done', runId: value.runId, summary: value.summary }
        : null;
    case 'fatal':
      return typeof value.error === 'string' ? { type: 'fatal', error: value.error } : null;
    default:
      return null;
  }
}
