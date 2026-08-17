import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bold,
  Code,
  Eye,
  Heading,
  HorizontalRule,
  Italic,
  Link,
  ListOrdered,
  ListTodo,
  ListUnordered,
  Pencil,
  Quote,
  SplitView,
  Strikethrough,
  Table,
  WindowMaximize,
  WindowRestore,
} from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { MarkdownPreview } from './MarkdownPreview';
import {
  RULE_SNIPPET,
  TABLE_SNIPPET,
  continueList,
  indentSelection,
  insertBlock,
  insertCodeBlock,
  insertLink,
  toggleBlockPrefix,
  toggleHeading,
  toggleInlineWrap,
  type EditState,
} from './markdownCommands';
import { isShortcutLetter } from '@/lib/shortcutKey';
import { cn } from '@/lib/utils';

export type MarkdownViewMode = 'write' | 'split' | 'preview';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Invoked on Ctrl/Cmd+S so the host can persist without leaving the editor. */
  onSave?: () => void;
  readOnly?: boolean;
  /** Starting height in pixels; the drag handle takes over from there. */
  defaultHeight?: number;
  className?: string;
}

interface ToolbarAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (state: EditState) => EditState | null;
}

const TOOLBAR_GROUPS: ToolbarAction[][] = [
  [
    { key: 'bold', label: 'Bold (Ctrl+B)', icon: Bold, run: (s) => toggleInlineWrap(s, '**') },
    { key: 'italic', label: 'Italic (Ctrl+I)', icon: Italic, run: (s) => toggleInlineWrap(s, '*') },
    {
      key: 'strike',
      label: 'Strikethrough',
      icon: Strikethrough,
      run: (s) => toggleInlineWrap(s, '~~'),
    },
    { key: 'inline-code', label: 'Inline code', icon: Code, run: (s) => toggleInlineWrap(s, '`') },
  ],
  [
    { key: 'h1', label: 'Heading 1', icon: Heading, run: (s) => toggleHeading(s, 1) },
    { key: 'h2', label: 'Heading 2', icon: Heading, run: (s) => toggleHeading(s, 2) },
    { key: 'h3', label: 'Heading 3', icon: Heading, run: (s) => toggleHeading(s, 3) },
  ],
  [
    {
      key: 'bullet',
      label: 'Bulleted list',
      icon: ListUnordered,
      run: (s) => toggleBlockPrefix(s, 'bullet'),
    },
    {
      key: 'ordered',
      label: 'Numbered list',
      icon: ListOrdered,
      run: (s) => toggleBlockPrefix(s, 'ordered'),
    },
    { key: 'task', label: 'Task list', icon: ListTodo, run: (s) => toggleBlockPrefix(s, 'task') },
    { key: 'quote', label: 'Quote', icon: Quote, run: (s) => toggleBlockPrefix(s, 'quote') },
  ],
  [
    { key: 'link', label: 'Link (Ctrl+K)', icon: Link, run: insertLink },
    { key: 'code-block', label: 'Code block', icon: Code, run: insertCodeBlock },
    { key: 'table', label: 'Table', icon: Table, run: (s) => insertBlock(s, TABLE_SNIPPET) },
    {
      key: 'rule',
      label: 'Horizontal rule',
      icon: HorizontalRule,
      run: (s) => insertBlock(s, RULE_SNIPPET),
    },
  ],
];

const HEADING_LABELS: Record<string, string> = { h1: 'H1', h2: 'H2', h3: 'H3' };

/** Below this the toolbar would crowd out the text itself. */
const MIN_HEIGHT = 180;

const VIEW_MODES: {
  key: MarkdownViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'write', label: 'Write', icon: Pencil },
  { key: 'split', label: 'Split', icon: SplitView },
  { key: 'preview', label: 'Preview', icon: Eye },
];

/**
 * A markdown-aware editor: formatting toolbar, list continuation, and a live
 * preview. The plain-text alternative is the Monaco editor; this one is for
 * writing prose rather than reading source.
 *
 * The box is drag-resizable from its bottom edge and can be maximized over the
 * app the way the terminal drawer is, for long writing sessions.
 */
export function MarkdownEditor({
  value,
  onChange,
  onSave,
  readOnly = false,
  defaultHeight = 420,
  className,
}: MarkdownEditorProps): React.JSX.Element {
  const [view, setView] = useState<MarkdownViewMode>('split');
  const [height, setHeight] = useState(defaultHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // A command's caret position can only be applied once React has flushed the
  // new value into the textarea, so it waits here until the layout effect.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingSelection.current = null;
    textarea.focus();
    textarea.setSelectionRange(pending.start, pending.end);
  }, [value]);

  // Escape is the way out of a full-screen panel, but only while it is one.
  // Otherwise the key belongs to whatever dialog the editor is sitting in.
  useEffect(() => {
    if (!isMaximized) return;
    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setIsMaximized(false);
    }
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isMaximized]);

  /** Drag the bottom edge to set the height, like a terminal pane divider. */
  function startResize(event: React.PointerEvent<HTMLDivElement>): void {
    if (isMaximized) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = containerRef.current?.offsetHeight ?? height;
    setIsResizing(true);

    function handleMove(move: PointerEvent): void {
      setHeight(Math.max(MIN_HEIGHT, startHeight + move.clientY - startY));
    }
    function handleUp(): void {
      setIsResizing(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  function apply(run: (state: EditState) => EditState | null): boolean {
    const textarea = textareaRef.current;
    if (!textarea || readOnly) return false;
    const next = run({
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    });
    if (!next) return false;
    // A command that changed only the selection won't re-run the layout effect
    // (the value is identical), so move the caret here rather than queue it.
    if (next.value === textarea.value) {
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
      return true;
    }
    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
    onChange(next.value);
    return true;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    const mod = event.ctrlKey || event.metaKey;

    if (mod && isShortcutLetter(event, 's')) {
      event.preventDefault();
      onSave?.();
      return;
    }
    if (mod && isShortcutLetter(event, 'b')) {
      event.preventDefault();
      apply((s) => toggleInlineWrap(s, '**'));
      return;
    }
    if (mod && isShortcutLetter(event, 'i')) {
      event.preventDefault();
      apply((s) => toggleInlineWrap(s, '*'));
      return;
    }
    if (mod && isShortcutLetter(event, 'k')) {
      event.preventDefault();
      apply(insertLink);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      apply((s) => indentSelection(s, event.shiftKey));
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !mod) {
      // `continueList` returns null off a list line, which leaves the browser's
      // own newline handling (and its undo stack) untouched.
      if (apply(continueList)) event.preventDefault();
    }
  }

  /** Keep the preview roughly at the same relative position as the source. */
  function syncPreviewScroll(): void {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;
    const scrollable = textarea.scrollHeight - textarea.clientHeight;
    if (scrollable <= 0) return;
    const ratio = textarea.scrollTop / scrollable;
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }

  const showEditor = view !== 'preview';
  const showPreview = view !== 'write';

  return (
    <div
      ref={containerRef}
      style={isMaximized ? undefined : { height }}
      className={cn(
        'flex flex-col overflow-hidden border border-border',
        isMaximized
          ? 'fixed inset-x-0 bottom-0 top-11 z-50 rounded-none border-x-0 border-b-0 bg-background'
          : 'relative rounded-lg',
        isResizing && 'select-none',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        {showEditor &&
          TOOLBAR_GROUPS.map((group, index) => (
            <div key={group[0].key} className="flex items-center gap-0.5">
              {index > 0 && <span className="mx-1 h-4 w-px bg-border" aria-hidden />}
              {group.map((action) => (
                <SimpleTooltip key={action.key} label={action.label} wrapTrigger={readOnly}>
                  <button
                    type="button"
                    aria-label={action.label}
                    disabled={readOnly}
                    // Keeps focus (and the selection) in the textarea when clicked.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => apply(action.run)}
                    className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    {HEADING_LABELS[action.key] ? (
                      <span className="font-semibold">{HEADING_LABELS[action.key]}</span>
                    ) : (
                      <action.icon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </SimpleTooltip>
              ))}
            </div>
          ))}
        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-background p-0.5">
          {VIEW_MODES.map((mode) => (
            <SimpleTooltip key={mode.key} label={`${mode.label} mode`}>
              <button
                type="button"
                onClick={() => setView(mode.key)}
                className={cn(
                  'flex h-6 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent',
                  view === mode.key && 'bg-accent text-foreground',
                )}
              >
                <mode.icon className="h-3 w-3" />
                {mode.label}
              </button>
            </SimpleTooltip>
          ))}
        </div>
        <SimpleTooltip label={isMaximized ? 'Restore editor (Esc)' : 'Maximize editor'}>
          <button
            type="button"
            aria-label={isMaximized ? 'Restore editor' : 'Maximize editor'}
            aria-pressed={isMaximized}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsMaximized((v) => !v)}
            className="flex h-6 items-center rounded px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {isMaximized ? (
              <WindowRestore className="h-3.5 w-3.5" />
            ) : (
              <WindowMaximize className="h-3.5 w-3.5" />
            )}
          </button>
        </SimpleTooltip>
      </div>

      <div className="flex min-h-0 flex-1 divide-x divide-border">
        {showEditor && (
          <textarea
            ref={textareaRef}
            value={value}
            readOnly={readOnly}
            // Markdown here is prose (READMEs, skill docs), so the spellchecker
            // earns its keep even though it also flags the odd code fence.
            spellCheck
            aria-label="Markdown source"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={showPreview ? syncPreviewScroll : undefined}
            className={cn(
              'min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none',
              showPreview ? 'w-1/2' : 'w-full',
            )}
          />
        )}
        {showPreview && (
          <div
            ref={previewRef}
            className={cn('min-h-0 flex-1 overflow-y-auto p-4', showEditor && 'w-1/2')}
          >
            {value.trim() ? (
              <MarkdownPreview content={value} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      {!isMaximized && (
        <div
          role="separator"
          aria-label="Resize editor"
          aria-orientation="horizontal"
          onPointerDown={startResize}
          // Double-click snaps back to the height the host asked for.
          onDoubleClick={() => setHeight(defaultHeight)}
          className="group flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-t border-border bg-muted/40"
        >
          <span
            className={cn(
              'h-0.5 w-8 rounded-full bg-border group-hover:bg-muted-foreground',
              isResizing && 'bg-muted-foreground',
            )}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}
