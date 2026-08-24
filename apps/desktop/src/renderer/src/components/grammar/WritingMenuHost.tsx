import type { AppSettings } from '@agentmat/core';
import type { GrammarIssue } from '@shared/grammar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Ban, Check, Plus, RefreshCw, Spinner } from '@/components/icons';
import {
  checkScopeAt,
  isEditableTextField,
  issueAtOffset,
  issueStyle,
  issueTitle,
  nextIssueFrom,
  replaceFieldRange,
  shiftIssues,
  type TextField,
} from '@/lib/grammar';
import { getFieldGrammar } from '@/lib/grammarRegistry';
import { queryKeys } from '@/lib/queryKeys';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';

interface RightClick {
  field: TextField;
  x: number;
  y: number;
}

interface MenuState extends RightClick {
  /** Word Chromium flagged as misspelled, or '' when the click wasn't on one. */
  word: string;
  /** Offsets of that word in the field's value. Null when there is no flagged word. */
  wordRange: [number, number] | null;
  spellingSuggestions: string[];
  /** Where the user right-clicked, in value offsets. */
  caret: number;
  /** LanguageTool issue under the caret, once one is known. */
  issue: GrammarIssue | null;
  /** Every issue known for this field, for the "next issue" jump. */
  fieldIssues: GrammarIssue[];
  /** True while an on-demand check is still running. */
  checking: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Suggestions read as the primary action, everything else as an aside. */
  tone: 'primary' | 'muted';
  run: () => void;
}

const MENU_MIN_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

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

/**
 * The app's writing menu: right-clicking a text field offers LanguageTool's
 * grammar and style fixes alongside Chromium's spelling suggestions, and checks
 * the text on the spot when nothing has been checked yet.
 *
 * Mounted once for the whole app. It listens on the document, so every text box
 * (including ones inside dialogs and the floating widget windows) gets it
 * without any per-field wiring.
 */
export function WritingMenuHost(): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const pendingRef = useRef<RightClick | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /** Bumped on every right-click so a slow check can tell it has been superseded. */
  const openIdRef = useRef(0);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  const grammarSettings = settingsQuery.data?.grammar ?? null;
  const grammarEnabled = grammarSettings?.enabled ?? false;

  const { mutate: saveSettings } = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => window.agentmat.settings.update(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const close = useCallback((): void => {
    openIdRef.current += 1;
    setMenu(null);
    setPosition(null);
  }, []);

  // The OS spellchecker on macOS keeps its own dictionary that Electron cannot
  // write to, so the entry only makes sense elsewhere.
  const canAddToDictionary = window.agentmat.platform !== 'darwin';

  /**
   * Checks the text around the caret and returns what it found, in the field's
   * own offsets. A live-checked field re-checks itself so its underlines update
   * too; anything else (live checking off, a plain input) is checked here.
   */
  const checkAround = useCallback(
    async (field: TextField, caret: number): Promise<GrammarIssue[]> => {
      const entry = getFieldGrammar(field);
      try {
        if (entry) return await entry.recheck();
        const selection =
          field.selectionEnd != null && field.selectionEnd > caret
            ? { start: caret, end: field.selectionEnd }
            : null;
        const scope = checkScopeAt(field.value, caret, selection);
        const result = await window.agentmat.grammar.check({ text: scope.text });
        return shiftIssues(result.issues, scope.offset);
      } catch {
        // The reason is surfaced by the field's own writing panel; the menu just
        // reports that it found nothing.
        return [];
      }
    },
    [],
  );

  /** Moves the caret to an issue and reopens the menu on it, without a second right-click. */
  const jumpToIssue = useCallback((state: MenuState, issue: GrammarIssue): void => {
    const { field } = state;
    field.focus();
    field.setSelectionRange(issue.offset, issue.offset + issue.length);
    const rect = field.getBoundingClientRect();
    setMenu({
      ...state,
      // Anchored to the field rather than the old click point, which by now
      // points at whatever was under the previous issue.
      x: Math.min(rect.left + 24, window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_MARGIN),
      y: rect.bottom + 4,
      caret: issue.offset,
      issue,
      word: '',
      wordRange: null,
      spellingSuggestions: [],
      checking: false,
    });
    setActiveIndex(0);
    setPosition(null);
  }, []);

  const items = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    const { field, issue } = menu;
    const list: MenuItem[] = [];

    // A grammar issue is more specific than Chromium's dictionary miss, so its
    // replacements win the top of the menu when both apply to the same spot.
    const replacements = issue ? issue.replacements : menu.spellingSuggestions;
    const range: [number, number] | null = issue
      ? [issue.offset, issue.offset + issue.length]
      : menu.wordRange;

    if (range) {
      for (const replacement of replacements) {
        list.push({
          key: `replace:${replacement}`,
          label: replacement,
          tone: 'primary',
          run: () => {
            replaceFieldRange(field, range[0], range[1], replacement);
            close();
          },
        });
      }
    }

    if (issue) {
      list.push({
        key: 'ignore',
        label: 'Ignore',
        icon: Check,
        tone: 'muted',
        run: () => {
          getFieldGrammar(field)?.dismiss(issue);
          close();
        },
      });
      if (issue.ruleId && grammarSettings) {
        list.push({
          key: 'ignore-rule',
          label: 'Never flag this rule',
          icon: Ban,
          tone: 'muted',
          run: () => {
            saveSettings({
              grammar: {
                ...grammarSettings,
                ignoredRules: [...new Set([...grammarSettings.ignoredRules, issue.ruleId])],
              },
            });
            getFieldGrammar(field)?.dismiss(issue);
            close();
          },
        });
      }
    }

    if (menu.word && canAddToDictionary) {
      list.push({
        key: 'add-to-dictionary',
        label: 'Add to dictionary',
        icon: Plus,
        tone: 'muted',
        run: () => {
          void window.agentmat.spellcheck.addToDictionary(menu.word);
          close();
        },
      });
    }

    const others = menu.fieldIssues.filter(
      (candidate) => !issue || candidate.offset !== issue.offset,
    );
    if (others.length > 0) {
      const next = nextIssueFrom(others, menu.caret);
      if (next) {
        list.push({
          key: 'next-issue',
          label:
            others.length === 1 ? 'Go to the other issue' : `Next issue (${others.length} left)`,
          icon: ArrowRight,
          tone: 'muted',
          run: () => jumpToIssue(menu, next),
        });
      }
    }

    // Nothing at the caret and nothing else found: offer a pass over the text,
    // which is the useful thing both next to a misspelling and right after an edit.
    if (!issue && !menu.checking && menu.fieldIssues.length === 0 && grammarEnabled) {
      list.push({
        key: 'recheck',
        label: menu.word ? 'Check the grammar here' : 'Check writing again',
        icon: RefreshCw,
        tone: 'muted',
        run: () => {
          setMenu((current) => (current ? { ...current, checking: true } : current));
          void checkAround(field, menu.caret).then((found) => {
            setMenu((current) =>
              current
                ? {
                    ...current,
                    checking: false,
                    fieldIssues: found,
                    issue: issueAtOffset(found, current.caret),
                  }
                : current,
            );
          });
        },
      });
    }

    return list;
  }, [
    menu,
    canAddToDictionary,
    checkAround,
    close,
    grammarEnabled,
    grammarSettings,
    jumpToIssue,
    saveSettings,
  ]);

  const runItem = useCallback(
    (index: number): void => {
      items[index]?.run();
    },
    [items],
  );

  /**
   * Resolves what the menu should show for one right-click: what is already
   * known about the field, and failing that, a check of the text around the
   * caret run on the spot.
   */
  const openFor = useCallback(
    async (pending: RightClick, word: string, spellingSuggestions: string[]): Promise<void> => {
      const openId = ++openIdRef.current;
      const { field } = pending;
      const caret = field.selectionStart ?? 0;
      const known = getFieldGrammar(field)?.issues ?? [];
      const issue = issueAtOffset(known, caret);
      const wordRange = word ? findWordRange(field, word) : null;

      // Nothing to say, and nothing we could find out: leave the click alone.
      // An empty field is the common case here, xterm's hidden input among them.
      if (!issue && !word && (!grammarEnabled || !field.value.trim())) return;

      const base: MenuState = {
        ...pending,
        word,
        wordRange,
        spellingSuggestions,
        caret,
        issue,
        fieldIssues: known,
        // A flagged word already has suggestions to show, so it opens right away
        // rather than behind a spinner; a grammar check only runs when the menu
        // would otherwise have nothing in it.
        checking: !issue && !word && grammarEnabled && known.length === 0,
      };
      setActiveIndex(0);
      setPosition(null);
      setMenu(base);
      if (!base.checking) return;

      const found = await checkAround(field, caret);
      if (openId !== openIdRef.current) return;
      setMenu((current) =>
        current
          ? {
              ...current,
              checking: false,
              fieldIssues: found,
              issue: issueAtOffset(found, current.caret),
            }
          : current,
      );
    },
    [grammarEnabled, checkAround],
  );

  useEffect(() => {
    // Capture, so the field and the click point are recorded before anything in
    // the tree can stop the event, and well before main reports back what
    // Chromium made of the word under the cursor.
    const onContextMenu = (event: MouseEvent): void => {
      close();
      pendingRef.current = isEditableTextField(event.target)
        ? { field: event.target, x: event.clientX, y: event.clientY }
        : null;
    };
    document.addEventListener('contextmenu', onContextMenu, true);

    const unsubscribe = window.agentmat.spellcheck.onShowMenu(({ word, suggestions }) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending || !pending.field.isConnected) return;
      void openFor(pending, word, suggestions);
    });

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      unsubscribe();
    };
  }, [close, openFor]);

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
      if (items.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => (current + step + items.length) % items.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        runItem(activeIndex);
        return;
      }
      // Editing the text moves the issue out from under the recorded offsets.
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [menu, items, activeIndex, runItem, close]);

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
  // the bottom or right edge does not push it off screen. Every state that
  // changes the menu's height (a finished check, a jump to another issue)
  // replaces `menu`, so that alone is the right trigger.
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

  const { issue } = menu;
  const flagged = issue ? issue.text : menu.word;
  const flaggedProps = persianTextProps(flagged);
  const style = issue ? issueStyle(issue.kind) : null;
  const heading = issue ? issueTitle(issue) : menu.word ? 'Spelling' : 'Writing check';

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={flagged ? `Writing suggestions for ${flagged}` : 'Writing check'}
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
        'fixed z-[60] max-w-[320px] overflow-hidden rounded-lg border border-border bg-popover/85 p-1',
        'pointer-events-auto text-popover-foreground shadow-2xl backdrop-blur-2xl',
        'animate-in fade-in-0 zoom-in-95',
        !position && 'invisible',
      )}
    >
      <div className="space-y-1 px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {style ? <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} /> : null}
          <span className="truncate">{heading}</span>
        </div>
        {flagged ? (
          <div
            dir={flaggedProps.dir}
            className={cn(
              'truncate text-sm underline decoration-wavy underline-offset-4',
              style ? style.decoration : 'decoration-destructive',
              flaggedProps.className,
            )}
          >
            {flagged}
          </div>
        ) : null}
        {issue?.message ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{issue.message}</p>
        ) : null}
      </div>

      <div className="-mx-1 my-1 h-px bg-border" />

      {menu.checking ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <Spinner className="h-3.5 w-3.5 animate-spin" />
          Checking writing…
        </div>
      ) : items.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {issue || menu.word ? 'No suggestions' : 'No writing issues here'}
        </div>
      ) : (
        items.map((item, index) => {
          const textProps = persianTextProps(item.label);
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              dir={item.tone === 'primary' ? textProps.dir : undefined}
              onClick={() => runItem(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors',
                item.tone === 'primary' ? textProps.className : 'text-muted-foreground',
                index === activeIndex && 'bg-primary/12 text-foreground',
              )}
            >
              {item.icon ? <item.icon className="h-3.5 w-3.5 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
