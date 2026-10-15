// @vitest-environment jsdom
import type { DockerContainer } from '@shared/apiTypes';
import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dismissStopContainers,
  promptStopContainers,
  useStopContainersPromptStore,
} from '@/stores/stopContainersPromptStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { StopContainersDialog, StopContainersDialogHost } from './StopContainersDialog';

/**
 * Shown on its own a moment after the user stops a run, so it has to be calm: everything starts
 * selected so the usual answer is one click, nothing is stopped by a stray keypress, and closing it
 * any way other than a button means "leave them running".
 */

function container(id: string, over: Partial<DockerContainer> = {}): DockerContainer {
  return {
    id,
    name: `shop-${id}-1`,
    image: id === 'db' ? 'postgres:16' : 'redis:7',
    state: 'running',
    status: id === 'db' ? 'Up 3 hours' : 'Up 25 minutes',
    composeProject: 'shop',
    cpuPercent: null,
    memUsedBytes: null,
    memLimitBytes: null,
    ...over,
  };
}

const DB = container('db');
const CACHE = container('cache');
const QUEUE = container('queue');

function renderDialog(props: Partial<React.ComponentProps<typeof StopContainersDialog>> = {}) {
  const onAnswer = vi.fn();
  const onDismiss = vi.fn();
  const view = renderWithProviders(
    <StopContainersDialog
      open
      projects={['Web Shop']}
      containers={[DB, CACHE]}
      onAnswer={onAnswer}
      onDismiss={onDismiss}
      {...props}
    />,
  );
  return { ...view, onAnswer, onDismiss };
}

const stopButton = (name: RegExp | string) => screen.getByRole('button', { name });
const keepButton = () => screen.getByRole('button', { name: 'Keep running' });
const row = (name: RegExp) => screen.getByRole('checkbox', { name });

beforeEach(() => {
  dismissStopContainers();
});

describe('what it says', () => {
  it('asks the question and names the project and what is still running', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Stop the Docker containers too?' })).toBeVisible();
    expect(
      screen.getByText(
        'Web Shop has stopped, but 2 containers from its Docker Compose setup are still running and using memory.',
      ),
    ).toBeVisible();
  });

  it('lists each container with its image and how long it has been up', () => {
    renderDialog();

    const db = row(/shop-db-1/);
    expect(db).toHaveAccessibleName(/postgres:16/);
    expect(db).toHaveAccessibleName(/Up 3 hours/);
    expect(row(/shop-cache-1/)).toHaveAccessibleName(/redis:7/);
  });

  it('speaks in the singular for one container', () => {
    renderDialog({ containers: [DB] });

    expect(
      screen.getByText(
        'Web Shop has stopped, but 1 container from its Docker Compose setup is still running and using memory.',
      ),
    ).toBeVisible();
  });

  it('names two projects', () => {
    renderDialog({ projects: ['Web Shop', 'Admin'] });

    expect(
      screen.getByText(/^Web Shop and Admin have stopped, but 2 containers from their/),
    ).toBeVisible();
  });

  it('counts the projects from three, rather than reading out a list', () => {
    renderDialog({ projects: ['Web Shop', 'Admin', 'Docs'] });

    expect(screen.getByText(/^3 projects have stopped, but 2 containers from their/)).toBeVisible();
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('choosing what to stop', () => {
  it('starts with every container selected, so the usual answer is one click', async () => {
    const { user, onAnswer } = renderDialog();

    expect(row(/shop-db-1/)).toBeChecked();
    expect(row(/shop-cache-1/)).toBeChecked();
    await user.click(stopButton('Stop 2 containers'));

    expect(onAnswer).toHaveBeenCalledWith({ stopIds: ['db', 'cache'], remember: false });
  });

  it('follows the selection in the button and in what it stops', async () => {
    const { user, onAnswer } = renderDialog({ containers: [DB, CACHE, QUEUE] });

    await user.click(row(/shop-db-1/));
    expect(screen.getByText('2 of 3 selected')).toBeVisible();
    await user.click(stopButton('Stop 2 containers'));

    // Keeping the database up while stopping the rest is the point of listing them.
    expect(onAnswer).toHaveBeenCalledWith({ stopIds: ['cache', 'queue'], remember: false });
  });

  it('says "1 container" for a single selection', async () => {
    const { user } = renderDialog();

    await user.click(row(/shop-db-1/));

    expect(stopButton('Stop 1 container')).toBeEnabled();
  });

  it('cannot stop nothing, but can still keep everything', async () => {
    const { user, onAnswer } = renderDialog();

    await user.click(row(/shop-db-1/));
    await user.click(row(/shop-cache-1/));

    expect(stopButton('Stop containers')).toBeDisabled();
    await user.click(keepButton());
    expect(onAnswer).toHaveBeenCalledWith({ stopIds: [], remember: false });
  });

  it('offers select none and select all once there is a choice to make', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(row(/shop-db-1/)).not.toBeChecked();
    expect(row(/shop-cache-1/)).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(row(/shop-db-1/)).toBeChecked();
    expect(row(/shop-cache-1/)).toBeChecked();
  });

  it('has no counter or select all for a single container', () => {
    renderDialog({ containers: [DB] });

    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Select (all|none)/ })).toBeNull();
  });

  it('scrolls the list once there are many rows, so the buttons never leave the screen', () => {
    const many = Array.from({ length: 9 }, (_, i) => container(`svc${i}`));
    renderDialog({ containers: many });

    const list = screen.getByRole('list', { name: 'Containers' });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(9);
    expect(list).toHaveClass('overflow-y-auto');
  });
});

describe('keeping them running', () => {
  it('answers with nothing to stop', async () => {
    const { user, onAnswer, onDismiss } = renderDialog();

    await user.click(keepButton());

    expect(onAnswer).toHaveBeenCalledWith({ stopIds: [], remember: false });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.each([
    ['Escape', async (user: ReturnType<typeof renderDialog>['user']) => user.keyboard('{Escape}')],
    [
      'the close button',
      async (user: ReturnType<typeof renderDialog>['user']) =>
        user.click(screen.getByRole('button', { name: 'Close' })),
    ],
  ])('treats %s as a dismissal, which remembers nothing', async (_name, close) => {
    const { user, onAnswer, onDismiss } = renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /Remember my choice/ }));

    await close(user);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('remembering the answer', () => {
  const remember = () => screen.getByRole('checkbox', { name: /Remember my choice/ });

  it('is off to begin with, and says where to change it later', () => {
    renderDialog();

    expect(remember()).not.toBeChecked();
    expect(screen.getByText('Change it any time in Settings, General.')).toBeVisible();
  });

  it('passes through with Stop when every container is selected', async () => {
    const { user, onAnswer } = renderDialog();

    await user.click(remember());
    await user.click(stopButton('Stop 2 containers'));

    expect(onAnswer).toHaveBeenCalledWith({ stopIds: ['db', 'cache'], remember: true });
  });

  it('passes through with Keep running', async () => {
    const { user, onAnswer } = renderDialog();

    await user.click(remember());
    await user.click(keepButton());

    expect(onAnswer).toHaveBeenCalledWith({ stopIds: [], remember: true });
  });

  it('is unavailable for a partial selection, because "always stop" would not mean that', async () => {
    const { user, onAnswer } = renderDialog();
    await user.click(remember());

    await user.click(row(/shop-db-1/));

    expect(remember()).toBeDisabled();
    expect(remember()).not.toBeChecked();
    expect(
      screen.getByText('Only available when you stop every container or keep them all.'),
    ).toBeVisible();
    await user.click(stopButton('Stop 1 container'));
    expect(onAnswer).toHaveBeenCalledWith({ stopIds: ['cache'], remember: false });
  });

  it('comes back, as it was ticked, when the selection is whole again', async () => {
    const { user } = renderDialog();
    await user.click(remember());
    await user.click(row(/shop-db-1/));

    await user.click(row(/shop-db-1/));

    expect(remember()).toBeEnabled();
    expect(remember()).toBeChecked();
  });
});

describe('not stopping anything by accident', () => {
  it('opens with focus on the dialog itself, not on a button a stray Enter would press', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('can be driven from the keyboard', async () => {
    const { user, onAnswer } = renderDialog();

    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
    await user.click(keepButton());
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('StopContainersDialogHost', () => {
  it('shows what the store holds and hands the answer back to whoever asked', async () => {
    const { user } = renderWithProviders(<StopContainersDialogHost />);
    expect(screen.queryByRole('dialog')).toBeNull();

    let answer: ReturnType<typeof promptStopContainers> | undefined;
    act(() => {
      answer = promptStopContainers({ projects: ['Web Shop'], containers: [DB, CACHE] });
    });
    expect(await screen.findByRole('dialog')).toBeVisible();

    await user.click(row(/shop-db-1/));
    await user.click(stopButton('Stop 1 container'));

    await expect(answer).resolves.toEqual({ stopIds: ['cache'], remember: false });
    expect(useStopContainersPromptStore.getState().open).toBe(false);
  });

  it('counts closing it as keeping everything', async () => {
    const { user } = renderWithProviders(<StopContainersDialogHost />);
    let answer: ReturnType<typeof promptStopContainers> | undefined;
    act(() => {
      answer = promptStopContainers({ projects: ['Web Shop'], containers: [DB] });
    });
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await expect(answer).resolves.toEqual({ stopIds: [], remember: false });
  });

  it('selects a container that joins while it is open, and leaves earlier choices alone', async () => {
    const { user } = renderWithProviders(<StopContainersDialogHost />);
    act(() => {
      void promptStopContainers({ projects: ['Web Shop'], containers: [DB, CACHE] });
    });
    await screen.findByRole('dialog');
    await user.click(row(/shop-db-1/));

    // A second run stopped a moment later: its containers are folded into the same dialog.
    act(() => {
      void promptStopContainers({ projects: ['Admin'], containers: [QUEUE] });
    });

    expect(await screen.findByRole('checkbox', { name: /shop-queue-1/ })).toBeChecked();
    expect(row(/shop-db-1/)).not.toBeChecked();
    expect(row(/shop-cache-1/)).toBeChecked();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it("starts every dialog afresh, without the last dialog's choices", async () => {
    const { user } = renderWithProviders(<StopContainersDialogHost />);
    act(() => {
      void promptStopContainers({ projects: ['Web Shop'], containers: [DB, CACHE] });
    });
    await screen.findByRole('dialog');
    await user.click(row(/shop-db-1/));
    await user.click(keepButton());
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      void promptStopContainers({ projects: ['Web Shop'], containers: [DB, CACHE] });
    });
    await screen.findByRole('dialog');

    expect(row(/shop-db-1/)).toBeChecked();
  });
});
