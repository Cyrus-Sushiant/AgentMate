import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SpellcheckMenuPayload } from '@shared/spellcheck';
import { Plus } from '@/components/icons';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';

type TextField = HTMLTextAreaElement | HTMLInputElement;

interface RightClick {
  field: TextField;
  x: number;
  y: number;
}

interface MenuState extends RightClick, SpellcheckMenuPayload {
  /** Offsets of the flagged word inside the field's value. */
  start: number;
  end: number;
}

const MENU_MIN_WIDTH = 200;
const VIEWPORT_MARGIN = 8;

function isEditableTextField(node: EventTarget | null): node is TextField {
  if (!(node instanceof HTMLTextAreaElement) && !(node instanceof HTMLInputElement)) return false;
  return !node.readOnly && !node.disabled;
}

/**
 * Where the flagged word sits in the field. Chromium selects a misspelled word
 * when it is right-clicked, so the selection is normally the answer; the search
 * is the fallback for when it is not, and picks the occurrence nearest the caret
 * so repeated words still resolve to the one that was clicked.
 */
function findWordRange(field: TextField, word: string): [number, number] | null {
  const { value } = field;
  const caret = field.selectionStart ?? 0;
  const selectionEnd = field.selectionEnd ?? caret;
  if (value.slice(caret, selectionEnd) === word) return [caret, selectionEnd];

  let best: [number, number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = value.indexOf(word); index !== -1; index = value.indexOf(word, index + 1)) {
    const end = index + word.length;
    const distance = caret < index ? index - caret : Math.max(0, caret - end);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [index, end];
    }
  }
  return best;
}

function replaceRange(field: TextField, start: number, end: number, text: string): void {
  field.focus();
  field.setSelectionRange(start, end);
  // execCommand keeps the browser's own undo stack and fires the input event a
  // controlled React text box listens for. Assigning `field.value` skips both,
  // so it is only the fallback.
  if (!document.execCommand('insertText', false, text)) {
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setValue?.call(field, field.value.slice(0, start) + text + field.value.slice(end));
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const caret = start + text.length;
  field.setSelectionRange(caret, caret);
}

/**
 * Right-clicking a word Chromium underlined as misspelled opens this menu with
 * the spellchecker's suggestions. Mounted once for the whole app: it listens on
 * the document, so every text box (including ones inside dialogs and the
 * floating widget windows) gets it without any per-field wiring.
 */
export function SpellcheckMenuHost(): React.JSX.Element | null {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const pendingRef = useRef<RightClick | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((): void => {
    setMenu(null);
    setPosition(null);
  }, []);

  // The OS spellchecker on macOS keeps its own dictionary that Electron cannot
  // write to, so the entry only makes sense elsewhere.
  const canAddToDictionary = window.agentmat.platform !== 'darwin';
  const suggestions = menu?.suggestions ?? [];
  const itemCount = suggestions.length + (canAddToDictionary ? 1 : 0);

  const runItem = useCallback(
    (index: number): void => {
      if (!menu) return;
      if (index < menu.suggestions.length) {
        replaceRange(menu.field, menu.start, menu.end, menu.suggestions[index]);
      } else if (canAddToDictionary) {
        void window.agentmat.spellcheck.addToDictionary(menu.word);
      }
      close();
    },
    [menu, canAddToDictionary, close],
  );

  useEffect(() => {
    // Capture, so the field and the click point are recorded before anything in
    // the tree can stop the event, and well before main reports back which word
    // Chromium flagged.
    const onContextMenu = (event: MouseEvent): void => {
      close();
      pendingRef.current = isEditableTextField(event.target)
        ? { field: event.target, x: event.clientX, y: event.clientY }
        : null;
    };
    document.addEventListener('contextmenu', onContextMenu, true);

    const unsubscribe = window.agentmat.spellcheck.onShowMenu(({ word, suggestions: list }) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending || !pending.field.isConnected) return;
      const range = findWordRange(pending.field, word);
      if (!range) return;
      setActiveIndex(0);
      setMenu({ ...pending, word, suggestions: list, start: range[0], end: range[1] });
    });

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      unsubscribe();
    };
  }, [close]);

  // Focus never leaves the text box while the menu is open, so the keys are
  // read here instead of from a focused menu item.
  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => (current + step + itemCount) % itemCount);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        runItem(activeIndex);
        return;
      }
      // Editing the text moves the word out from under the recorded offsets.
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [menu, itemCount, activeIndex, runItem, close]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDownOutside = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onViewportChange = (): void => close();
    document.addEventListener('mousedown', onPointerDownOutside, true);
    document.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('blur', onViewportChange);
    return () => {
      document.removeEventListener('mousedown', onPointerDownOutside, true);
      document.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('blur', onViewportChange);
    };
  }, [menu, close]);

  // Flip the menu up or in once its real size is known, so a right-click near
  // the bottom or right edge does not push it off screen.
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!menu || !element) return;
    const { width, height } = element.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(menu.x, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    const fitsBelow = menu.y + height + VIEWPORT_MARGIN <= window.innerHeight;
    const top = fitsBelow ? menu.y : Math.max(VIEWPORT_MARGIN, menu.y - height);
    setPosition({ left, top });
  }, [menu]);

  if (!menu) return null;

  const wordProps = persianTextProps(menu.word);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Spelling suggestions for ${menu.word}`}
      style={{
        left: position?.left ?? menu.x,
        top: position?.top ?? menu.y,
        minWidth: MENU_MIN_WIDTH,
      }}
      // Keeping the press off the document leaves the caret and the selection
      // in the text box, and stops a Radix dialog from treating the click as an
      // outside press and closing itself.
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className={cn(
        'fixed z-[60] max-w-[280px] overflow-hidden rounded-lg border border-border bg-popover/85 p-1',
        'pointer-events-auto text-popover-foreground shadow-2xl backdrop-blur-2xl',
        'animate-in fade-in-0 zoom-in-95',
        !position && 'invisible',
      )}
    >
      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        <span
          dir={wordProps.dir}
          className={cn(
            'underline decoration-destructive decoration-wavy underline-offset-4',
            wordProps.className,
          )}
        >
          {menu.word}
        </span>
      </div>
      <div className="-mx-1 my-1 h-px bg-border" />

      {suggestions.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">No suggestions</div>
      ) : (
        suggestions.map((suggestion, index) => {
          const textProps = persianTextProps(suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              role="menuitem"
              dir={textProps.dir}
              onClick={() => runItem(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors',
                textProps.className,
                index === activeIndex && 'bg-primary/12 text-foreground',
              )}
            >
              <span className="truncate">{suggestion}</span>
            </button>
          );
        })
      )}

      {canAddToDictionary && (
        <>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => runItem(suggestions.length)}
            onMouseEnter={() => setActiveIndex(suggestions.length)}
            className={cn(
              'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none transition-colors',
              activeIndex === suggestions.length && 'bg-primary/12 text-foreground',
            )}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Add to dictionary
          </button>
        </>
      )}
    </div>
  );
}
