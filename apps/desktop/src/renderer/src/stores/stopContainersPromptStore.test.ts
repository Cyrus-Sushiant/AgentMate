import type { DockerContainer } from '@shared/apiTypes';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  dismissStopContainers,
  promptStopContainers,
  resolveStopContainers,
  useStopContainersPromptStore,
} from './stopContainersPromptStore';

/**
 * The question "stop these containers too?" is asked from plain functions (a keyboard shortcut,
 * a store action), so it lives in a store that one dialog host renders. Two runs stopping close
 * together must end up in one dialog, not two stacked on top of each other.
 */

function container(id: string, over: Partial<DockerContainer> = {}): DockerContainer {
  return {
    id,
    name: `${id}-1`,
    image: 'postgres:16',
    state: 'running',
    status: 'Up 2 hours',
    composeProject: 'shop',
    cpuPercent: null,
    memUsedBytes: null,
    memLimitBytes: null,
    ...over,
  };
}

function prompt() {
  return useStopContainersPromptStore.getState();
}

beforeEach(() => {
  dismissStopContainers();
});

describe('promptStopContainers', () => {
  it('opens with the projects and containers it was given', () => {
    void promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });

    expect(prompt().open).toBe(true);
    expect(prompt().projects).toEqual(['Web Shop']);
    expect(prompt().containers.map((one) => one.id)).toEqual(['db']);
  });

  it('resolves with the answer and closes', async () => {
    const answer = promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });

    resolveStopContainers({ stopIds: ['db'], remember: true });

    await expect(answer).resolves.toEqual({ stopIds: ['db'], remember: true });
    expect(prompt().open).toBe(false);
  });

  it('treats a dismissal as keeping everything and remembering nothing', async () => {
    const answer = promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });

    dismissStopContainers();

    await expect(answer).resolves.toEqual({ stopIds: [], remember: false });
    expect(prompt().open).toBe(false);
  });

  it('merges a second offer into the open dialog instead of stacking another', async () => {
    const first = promptStopContainers({
      projects: ['Web Shop'],
      containers: [container('db')],
    });
    const second = promptStopContainers({
      projects: ['Admin'],
      containers: [container('cache')],
    });

    // The caller whose offer was folded in has nothing left to do: the first one acts for both.
    await expect(second).resolves.toBeNull();
    expect(prompt().projects).toEqual(['Web Shop', 'Admin']);
    expect(prompt().containers.map((one) => one.id)).toEqual(['db', 'cache']);

    resolveStopContainers({ stopIds: ['db', 'cache'], remember: false });
    await expect(first).resolves.toEqual({ stopIds: ['db', 'cache'], remember: false });
  });

  it('lists a container offered twice only once, and a project only once', () => {
    void promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });
    void promptStopContainers({
      projects: ['Web Shop'],
      containers: [container('db'), container('cache')],
    });

    expect(prompt().projects).toEqual(['Web Shop']);
    expect(prompt().containers.map((one) => one.id)).toEqual(['db', 'cache']);
  });

  it('keeps what it showed once answered, so the dialog does not go blank while it fades out', () => {
    void promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });

    resolveStopContainers({ stopIds: [], remember: false });

    expect(prompt().open).toBe(false);
    expect(prompt().projects).toEqual(['Web Shop']);
    expect(prompt().containers.map((one) => one.id)).toEqual(['db']);
  });

  it('starts clean after an answer, carrying nothing over from the last dialog', () => {
    void promptStopContainers({ projects: ['Web Shop'], containers: [container('db')] });
    resolveStopContainers({ stopIds: [], remember: false });

    void promptStopContainers({ projects: ['Admin'], containers: [container('cache')] });

    expect(prompt().projects).toEqual(['Admin']);
    expect(prompt().containers.map((one) => one.id)).toEqual(['cache']);
  });
});
