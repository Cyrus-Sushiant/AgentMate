import { describe, expect, it } from 'vitest';
import { useVersionDialogStore } from './versionDialogStore';

const state = () => useVersionDialogStore.getState();

describe('versionDialogStore', () => {
  it('opens the flow for one project at a time', () => {
    state().open('a');
    expect(state().openProjectId).toBe('a');
    state().open('b');
    expect(state().openProjectId).toBe('b');
  });

  it('closes only the project it is asked to close', () => {
    state().open('b');
    // Project A's tag finished in the background after the user moved on to B.
    state().close('a');
    expect(state().openProjectId).toBe('b');

    state().close('b');
    expect(state().openProjectId).toBeNull();
  });

  it('keeps a version bump per project', () => {
    state().setApplyTag('a', 'v1.2.0');
    state().setApplyTag('b', 'v1.2.0');
    state().setApplyTag('b', 'v2.0.0');
    expect(state().applyTags).toEqual({ a: 'v1.2.0', b: 'v2.0.0' });

    state().setApplyTag('a', null);
    expect(state().applyTags).toEqual({ b: 'v2.0.0' });
  });
});
