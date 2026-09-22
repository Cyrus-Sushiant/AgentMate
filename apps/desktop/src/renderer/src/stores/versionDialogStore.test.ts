import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_TAG_DRAFT, useVersionDialogStore } from './versionDialogStore';

const state = () => useVersionDialogStore.getState();

beforeEach(() => {
  useVersionDialogStore.setState({ openProjectId: null, applyTags: {}, drafts: {} });
});

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

  it('builds up one tag form per project without losing what is already typed', () => {
    state().patchDraft('a', { version: '1.1.0' });
    state().patchDraft('a', { message: 'Adds the widget.' });
    state().patchDraft('b', { version: '9.9.9' });

    expect(state().drafts.a).toEqual({
      ...EMPTY_TAG_DRAFT,
      version: '1.1.0',
      message: 'Adds the widget.',
    });
    expect(state().drafts.b?.version).toBe('9.9.9');
  });

  it("clears one project's form and leaves the others alone", () => {
    state().patchDraft('a', { version: '1.1.0' });
    state().patchDraft('b', { version: '2.0.0' });

    state().clearDraft('a');
    expect(state().drafts.a).toBeUndefined();
    expect(state().drafts.b?.version).toBe('2.0.0');

    // Nothing to clear is not an error, and it must not churn the object either.
    const before = state().drafts;
    state().clearDraft('a');
    expect(state().drafts).toBe(before);
  });
});
