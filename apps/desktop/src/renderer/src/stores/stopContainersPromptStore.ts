import type { DockerContainer } from '@shared/apiTypes';
import { create } from 'zustand';

/** What the user decided about the containers a stopped run left behind. */
export interface StopContainersAnswer {
  /** The containers to stop. Empty means leave every one of them running. */
  stopIds: string[];
  /** Save this choice as the setting, so the question is not asked again. */
  remember: boolean;
}

interface StopContainersOffer {
  /** Names of the projects whose runs just stopped, for the sentence in the dialog. */
  projects: string[];
  containers: DockerContainer[];
}

interface StopContainersPromptState extends StopContainersOffer {
  open: boolean;
  resolve: ((answer: StopContainersAnswer | null) => void) | null;
}

const initialState: StopContainersPromptState = {
  open: false,
  projects: [],
  containers: [],
  resolve: null,
};

export const useStopContainersPromptStore = create<StopContainersPromptState>(() => initialState);

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Opens the "stop these containers too?" dialog and resolves once the user answers.
 *
 * Only one dialog is ever open. An offer that arrives while it is showing (a second run stopped a
 * moment later) is folded into it and resolves with null: the caller that opened the dialog acts
 * on the answer for everything in it.
 */
export function promptStopContainers(
  offer: StopContainersOffer,
): Promise<StopContainersAnswer | null> {
  const current = useStopContainersPromptStore.getState();
  if (current.open) {
    useStopContainersPromptStore.setState({
      projects: unique([...current.projects, ...offer.projects], (name) => name),
      containers: unique([...current.containers, ...offer.containers], (one) => one.id),
    });
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    useStopContainersPromptStore.setState({
      open: true,
      projects: unique(offer.projects, (name) => name),
      containers: unique(offer.containers, (one) => one.id),
      resolve,
    });
  });
}

export function resolveStopContainers(answer: StopContainersAnswer): void {
  useStopContainersPromptStore.getState().resolve?.(answer);
  // What was shown stays put: the dialog fades out over it, and emptying the list first would
  // blank the dialog for that moment. The next offer replaces all of it.
  useStopContainersPromptStore.setState({ open: false, resolve: null });
}

/** Closing the dialog any other way than a button: keep everything, and remember nothing. */
export function dismissStopContainers(): void {
  resolveStopContainers({ stopIds: [], remember: false });
}
