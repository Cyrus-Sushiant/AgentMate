import type { GrammarIssue } from '@shared/grammar';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { issueKey, issueStyle, type TextField } from '@/lib/grammar';
import { cn } from '@/lib/utils';

export interface GrammarUnderlinesProps {
  field: TextField | null;
  /** The field's value, mirrored here character for character. */
  value: string;
  issues: GrammarIssue[];
  /** Drawn with a highlight, for the issue the writing panel is pointing at. */
  activeIssue?: GrammarIssue | null;
}

/** Style properties the mirror has to match for the underlines to land on the right glyphs. */
const MIRRORED_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'wordSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'textAlign',
  'direction',
  'wordBreak',
  'overflowWrap',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

/** Keeps the last line of a value that ends in a newline from collapsing. Zero-width space. */
const ZERO_WIDTH_SPACE = '​';

interface Segment {
  text: string;
  issue: GrammarIssue | null;
}

/** Splits the value into plain runs and flagged runs, dropping issues that overlap an earlier one. */
function segments(value: string, issues: GrammarIssue[]): Segment[] {
  const ordered = [...issues].sort((a, b) => a.offset - b.offset || b.length - a.length);
  const out: Segment[] = [];
  let cursor = 0;
  for (const issue of ordered) {
    if (issue.offset < cursor) continue;
    if (issue.offset > cursor) out.push({ text: value.slice(cursor, issue.offset), issue: null });
    out.push({ text: value.slice(issue.offset, issue.offset + issue.length), issue });
    cursor = issue.offset + issue.length;
  }
  if (cursor < value.length) out.push({ text: value.slice(cursor), issue: null });
  return out;
}

/**
 * Draws LanguageTool's underlines over a text field, Grammarly-style.
 *
 * A textarea can't style parts of its own text, so this mirrors the value in a
 * div sitting exactly on top of it: same font, same padding, same wrapping,
 * transparent text, and only the flagged runs painted. The mirror scrolls with
 * the field and never takes a click, so the field underneath behaves normally.
 */
export function GrammarUnderlines({
  field,
  value,
  issues,
  activeIssue,
}: GrammarUnderlinesProps): React.JSX.Element | null {
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  // Copy the field's typography every render: a theme switch, a font swap, or a
  // layout change can move the text, and the underlines have to move with it.
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    if (!field || !mirror) return;
    const computed = window.getComputedStyle(field);
    for (const property of MIRRORED_PROPERTIES) {
      mirror.style[property] = computed[property];
    }
    // The field's own border is part of where its text starts, so it is
    // reproduced as a transparent border rather than guessed at.
    mirror.style.borderStyle = 'solid';
    mirror.style.borderColor = 'transparent';
    mirror.style.whiteSpace = field instanceof HTMLInputElement ? 'pre' : 'pre-wrap';

    // A textarea holding more than fits gives up 8px of its text column to a
    // scrollbar. The mirror has none, so without the same gutter its lines wrap
    // a character later and every underline after the first wrap drifts.
    const borderX =
      Number.parseFloat(computed.borderLeftWidth) + Number.parseFloat(computed.borderRightWidth);
    const gutter = Math.max(0, field.offsetWidth - field.clientWidth - borderX);
    if (gutter > 0) {
      // Chromium puts the scrollbar on the left in a right-to-left field.
      const side = computed.direction === 'rtl' ? 'paddingLeft' : 'paddingRight';
      mirror.style[side] = `${Number.parseFloat(computed[side]) + gutter}px`;
    }
    mirror.scrollTop = field.scrollTop;
    mirror.scrollLeft = field.scrollLeft;
  });

  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!field || !mirror) return;
    const sync = (): void => {
      mirror.scrollTop = field.scrollTop;
      mirror.scrollLeft = field.scrollLeft;
    };
    field.addEventListener('scroll', sync, { passive: true });
    return () => field.removeEventListener('scroll', sync);
  }, [field]);

  if (!field || issues.length === 0) return null;

  const activeKey = activeIssue ? issueKey(activeIssue) : null;

  return (
    <div
      ref={mirrorRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 box-border select-none overflow-hidden text-transparent"
    >
      {segments(value, issues).map((segment, index) => {
        // Runs are positional, so their index is the only identity they have.
        if (!segment.issue) return <span key={index}>{segment.text}</span>;
        const style = issueStyle(segment.issue.kind);
        const isActive = activeKey !== null && issueKey(segment.issue) === activeKey;
        return (
          <span
            key={index}
            style={{ textDecorationSkipInk: 'none' }}
            className={cn(
              'underline decoration-wavy decoration-2 underline-offset-2',
              style.decoration,
              isActive && 'rounded bg-primary/20',
            )}
          >
            {segment.text}
          </span>
        );
      })}
      {value.endsWith('\n') ? ZERO_WIDTH_SPACE : null}
    </div>
  );
}
