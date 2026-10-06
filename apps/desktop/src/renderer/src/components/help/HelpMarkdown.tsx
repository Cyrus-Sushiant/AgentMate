import { type HelpSection, resolveHelpLink } from '@shared/help/parse';
import { Children, isValidElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { CircleInfo, Sparkles, TriangleAlert } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Renders a Help article's Markdown in the app's own type and colours. Links between articles stay
 * inside the Help page, `> [!TIP]` blocks become callouts, and key names written in code ticks
 * (`Ctrl+K`, `F1`) are drawn as keycaps.
 */

type CalloutKind = 'note' | 'tip' | 'warning';

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, string> };
}

/**
 * Marks GitHub-style callout blockquotes so the blockquote renderer can tell them apart, and drops
 * the `[!KIND]` marker itself. Small enough that it is not worth a dependency.
 */
function remarkCallouts() {
  const walk = (node: MdNode): void => {
    if (node.type === 'blockquote') {
      const first = node.children?.[0];
      const text = first?.type === 'paragraph' ? first.children?.[0] : undefined;
      const match =
        text?.type === 'text' ? /^\[!(NOTE|TIP|WARNING)\]\s*/i.exec(text.value ?? '') : null;
      if (first && text && match) {
        text.value = (text.value ?? '').slice(match[0].length);
        if (!text.value && first.children!.length > 1 && first.children![1]!.type === 'break') {
          first.children!.splice(0, 2);
        } else if (!text.value) {
          first.children!.shift();
        }
        if (first.children!.length === 0) node.children!.shift();
        node.data = { hProperties: { 'data-callout': match[1]!.toLowerCase() } };
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  return (tree: MdNode) => walk(tree);
}

const CALLOUT: Record<CalloutKind, { label: string; icon: typeof CircleInfo; tone: string }> = {
  note: {
    label: 'Note',
    icon: CircleInfo,
    tone: 'border-sky-500/40 bg-sky-500/[0.07] [--callout:var(--color-sky-500)]',
  },
  tip: {
    label: 'Tip',
    icon: Sparkles,
    tone: 'border-primary/40 bg-primary/[0.07] [--callout:hsl(var(--primary))]',
  },
  warning: {
    label: 'Heads up',
    icon: TriangleAlert,
    tone: 'border-amber-500/50 bg-amber-500/[0.08] [--callout:var(--color-amber-500)]',
  },
};

const KEY_NAME =
  /^(Ctrl|Control|Cmd|Command|Shift|Alt|Option|Opt|Win|Meta|Esc|Escape|Enter|Return|Tab|Space|Backspace|Delete|Del|Home|End|PageUp|PageDown|Up|Down|Left|Right|F\d{1,2})$/i;

/** Splits `Ctrl+Shift+P` into keys, or returns null when the code is not a key combination. */
export function keyCombo(text: string): string[] | null {
  const parts = text.split(/\s*\+\s*/);
  if (parts.length === 0 || parts.some((p) => !p)) return null;
  const last = parts.at(-1)!;
  const modifiersOk = parts.slice(0, -1).every((p) => KEY_NAME.test(p));
  const lastOk =
    KEY_NAME.test(last) || (parts.length > 1 && last.length === 1) || /^[`\\[\]]$/.test(last);
  return modifiersOk && lastOk ? parts : null;
}

function textOf(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : isValidElement<{ children?: React.ReactNode }>(child)
          ? textOf(child.props.children)
          : '',
    )
    .join('');
}

export interface HelpMarkdownProps {
  slug: string;
  markdown: string;
  /** The article's sections, whose ids the headings take in order so anchors match the outline. */
  sections: HelpSection[];
}

export function HelpMarkdown({ slug, markdown, sections }: HelpMarkdownProps): React.JSX.Element {
  const ids = sections.filter((s) => s.level > 0).map((s) => s.id);
  let next = 0;

  const components: Components = {
    h2: ({ children }) => (
      <h2
        id={ids[next++]}
        className="help-heading mt-12 mb-3 text-[1.35rem] font-semibold tracking-tight first:mt-0"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={ids[next++]}
        className="help-heading mt-8 mb-2 text-base font-semibold tracking-tight"
      >
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="my-3 leading-7 text-foreground/85">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    a: ({ href, children }) => {
      const target = resolveHelpLink(href, slug);
      if (target) {
        return (
          <Link
            to={`/help/${target.slug}${target.anchor ? `#${target.anchor}` : ''}`}
            className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-muted-foreground/60">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="help-steps my-4 space-y-2.5 pl-0 [counter-reset:step]">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-7 text-foreground/85">{children}</li>,
    blockquote: ({ children, ...props }) => {
      const kind = (props as Record<string, unknown>)['data-callout'] as CalloutKind | undefined;
      if (!kind) {
        return (
          <blockquote className="my-4 border-l-2 border-border pl-4 text-muted-foreground">
            {children}
          </blockquote>
        );
      }
      const callout = CALLOUT[kind];
      const Icon = callout.icon;
      return (
        <aside
          aria-label={callout.label}
          className={cn('my-5 flex gap-3 rounded-lg border px-4 py-3 [&_p]:my-1', callout.tone)}
        >
          <Icon className="mt-1.5 h-3.5 w-3.5 shrink-0 text-[var(--callout)]" />
          <div className="min-w-0 text-sm">{children}</div>
        </aside>
      );
    },
    code: ({ className, children }) => {
      if (/language-/.test(className ?? '')) {
        return (
          <code className={cn('font-mono text-[0.8rem] leading-6', className)}>{children}</code>
        );
      }
      const text = textOf(children);
      const keys = keyCombo(text);
      if (keys) {
        return (
          <span className="inline-flex items-center gap-0.5 align-baseline whitespace-nowrap">
            {keys.map((key, i) => (
              <span key={`${key}-${i}`} className="inline-flex items-center gap-0.5">
                {i > 0 && <span className="text-[0.7em] text-muted-foreground">+</span>}
                <kbd className="help-kbd">{key}</kbd>
              </span>
            ))}
          </span>
        );
      }
      return (
        <code className="rounded-md bg-foreground/[0.07] px-1.5 py-0.5 font-mono text-[0.84em] text-foreground">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-border/70 bg-foreground/[0.04] px-4 py-3">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-foreground/[0.04]">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b border-border/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border/40 px-3 py-2 align-top text-foreground/85">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-border/60" />,
  };

  return (
    <div className="help-prose text-[0.95rem]">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
