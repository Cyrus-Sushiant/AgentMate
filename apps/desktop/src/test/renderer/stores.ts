/**
 * Zustand stores are module singletons, so state set by one test is still there in the next one
 * in the same file. This puts every store that the file has loaded back to its initial state.
 */

interface ResettableStore {
  getState: () => unknown;
  setState: (state: unknown, replace: true) => void;
  getInitialState: () => unknown;
}

function isStore(value: unknown): value is ResettableStore {
  if (typeof value !== 'function') return false;
  const candidate = value as Partial<ResettableStore>;
  return (
    typeof candidate.getState === 'function' &&
    typeof candidate.setState === 'function' &&
    typeof candidate.getInitialState === 'function'
  );
}

const storeModules = import.meta.glob<Record<string, unknown>>('../../renderer/src/stores/*.ts', {
  eager: false,
});

let loaded: Record<string, unknown>[] | null = null;

/** Resets every store. Safe to call when a test never touched one. */
export async function resetAllStoresAsync(): Promise<void> {
  // Stores that persist need localStorage, which a file running in the node environment has no
  // business touching.
  if (typeof window === 'undefined') return;
  if (!loaded) {
    const modules = await Promise.all(
      Object.entries(storeModules)
        .filter(([path]) => !path.includes('.test.'))
        .map(([, load]) => load().catch(() => ({}) as Record<string, unknown>)),
    );
    loaded = modules;
  }

  resetLoaded();
}

function resetLoaded(): void {
  for (const module of loaded ?? []) {
    for (const exported of Object.values(module)) {
      if (!isStore(exported)) continue;
      try {
        exported.setState(exported.getInitialState(), true);
      } catch {
        // A store whose persist layer is unavailable keeps whatever it has; the next test
        // installs its own bridge anyway.
      }
    }
  }
}

/**
 * The synchronous part: resets the stores already imported by an earlier call. The first call in
 * a file kicks off the load so later tests in it are covered.
 */
export function resetAllStores(): void {
  if (typeof window === 'undefined') return;
  if (!loaded) {
    void resetAllStoresAsync().catch(() => undefined);
    return;
  }
  resetLoaded();
}
