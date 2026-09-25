import { describe, expect, it } from 'vitest';
import { isWorktreeScope, parseScopeId, worktreeScopeId } from './scope.js';

const PROJECT = '0b8f4f8e-6a3c-4c1e-9b1f-2f4a5d6e7f80';

describe('workspace scope ids', () => {
  it('round-trips a worktree scope', () => {
    const scope = worktreeScopeId(PROJECT, 'wt-1a2b3c4d');
    expect(isWorktreeScope(scope)).toBe(true);
    expect(parseScopeId(scope)).toEqual({ projectId: PROJECT, worktreeId: 'wt-1a2b3c4d' });
  });

  it('treats a plain project id as the main checkout', () => {
    expect(isWorktreeScope(PROJECT)).toBe(false);
    expect(parseScopeId(PROJECT)).toEqual({ projectId: PROJECT, worktreeId: null });
  });

  it('survives being put in a URL path segment', () => {
    const scope = worktreeScopeId(PROJECT, 'wt-1');
    expect(decodeURIComponent(encodeURIComponent(scope))).toBe(scope);
    expect(encodeURIComponent(scope)).toBe(scope);
  });

  it('rejects ids that would not round-trip', () => {
    expect(() => worktreeScopeId('a~b', 'wt')).toThrow();
    expect(() => worktreeScopeId(PROJECT, '')).toThrow();
  });
});
