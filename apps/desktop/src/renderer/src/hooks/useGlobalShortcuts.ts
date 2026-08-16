import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GlobalShortcutCommandId } from '@/lib/shortcuts';
import { useSearchStore } from '@/stores/searchStore';
import { commandForEvent, useShortcutStore } from '@/stores/shortcutStore';
import { useTerminalStore } from '@/stores/terminalStore';

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

/** Routing away from under an open dialog would strand it over the new page. */
const BLOCKED_BY_DIALOG = new Set<GlobalShortcutCommandId>(['nav.projects']);

/**
 * Runs the app-wide shortcuts. Mounted once by the shell.
 *
 * The listener sits on `window` in the bubble phase on purpose. Dialogs handle
 * their keys through React, whose listener lives on the root container further
 * down the tree, so a dialog that binds the same combination (the prompt
 * builder's Ctrl+T, for one) gets there first and calls `preventDefault`. That
 * parks this handler, which is what gives the open modal the final say.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  const toggleSearch = useSearchStore((s) => s.toggle);
  const toggleDrawer = useTerminalStore((s) => s.toggleDrawer);
  const openDefaultSession = useTerminalStore((s) => s.openDefaultSession);

  useEffect(() => {
    const actions: Record<GlobalShortcutCommandId, () => void> = {
      'terminal.toggle': toggleDrawer,
      'terminal.new': () => void openDefaultSession(),
      'nav.projects': () => navigate('/projects'),
      'search.toggle': toggleSearch,
    };

    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.isComposing) return;
      const id = commandForEvent(
        event,
        useShortcutStore.getState().overrides,
        isTypingTarget(event.target),
      );
      if (!id) return;
      if (BLOCKED_BY_DIALOG.has(id) && isDialogOpen()) return;
      event.preventDefault();
      actions[id]();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, openDefaultSession, toggleDrawer, toggleSearch]);
}
