import { useState } from 'react';
import { CliLogo } from '@/components/cliLogos';
import { ChevronDown, Copy, MessageSquare, Pencil, Send, Trash2, X } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { elementLabel } from '@/lib/browser/annotationPrompt';
import type { AnnotationIntent, BrowserAnnotation } from '@/lib/browser/types';
import { cn } from '@/lib/utils';
import type { DeliverOptions } from '@/lib/workspace/agentSend';

/**
 * The comments waiting in a browser tab, floating over the bottom right of the page. Each row is
 * numbered like its pin on the page; hovering a row makes that pin pulse. Send types them all into
 * the agent as one prompt.
 */

export interface SendTargets {
  /** Where a plain Send goes: the agent the workspace would pick, or its default CLI. */
  defaultLabel: string;
  running: { tabId: string; cliId: string; label: string }[];
  newTabs: { cliId: string; name: string }[];
}

export interface CommentTrayProps {
  annotations: readonly BrowserAnnotation[];
  currentUrl: string;
  targets: SendTargets;
  onSend: (target?: DeliverOptions['target']) => void;
  onCopy: () => void;
  onClear: () => void;
  onEdit: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
  onHover: (id: string | null) => void;
  onReveal: (annotation: BrowserAnnotation) => void;
}

const INTENT_CHIP: Record<AnnotationIntent, { label: string; className: string } | null> = {
  change: null,
  fix: { label: 'Fix', className: 'bg-destructive/12 text-destructive' },
  question: { label: 'Ask', className: 'bg-sky-500/12 text-sky-500' },
};

function pagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + (parsed.hash.startsWith('#/') ? parsed.hash : '');
  } catch {
    return url;
  }
}

function samePage(a: string, b: string): boolean {
  const strip = (url: string) => (url.includes('#/') ? url : url.replace(/#.*$/, ''));
  return strip(a) === strip(b);
}

function plural(count: number): string {
  return `${count} comment${count === 1 ? '' : 's'}`;
}

function TrayIconButton({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          tone === 'danger'
            ? 'hover:bg-destructive/15 hover:text-destructive'
            : 'hover:bg-foreground/10 hover:text-foreground',
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

function Row({
  annotation,
  n,
  elsewhere,
  onEdit,
  onRemove,
  onHover,
  onReveal,
}: {
  annotation: BrowserAnnotation;
  n: number;
  elsewhere: boolean;
  onEdit: (comment: string) => void;
  onRemove: () => void;
  onHover: (hovering: boolean) => void;
  onReveal: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const chip = INTENT_CHIP[annotation.intent];
  const label = elementLabel(annotation.element);

  const save = (value: string): void => {
    setEditing(false);
    const next = value.trim();
    if (next && next !== annotation.comment) onEdit(next);
  };

  return (
    <li
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'group relative flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-foreground/[0.05]',
        elsewhere && 'opacity-60 hover:opacity-100',
      )}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <SimpleTooltip
            label={
              annotation.thumbDataUrl ? (
                <img
                  src={annotation.thumbDataUrl}
                  alt=""
                  className="max-h-40 max-w-56 rounded border border-border/60"
                />
              ) : null
            }
            side="left"
          >
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{label}</span>
          </SimpleTooltip>
          {chip ? (
            <span
              className={cn(
                'shrink-0 rounded px-1 text-[9px] font-semibold uppercase tracking-wide',
                chip.className,
              )}
            >
              {chip.label}
            </span>
          ) : null}
        </div>
        {editing ? (
          <textarea
            autoFocus
            aria-label={`Edit comment ${n}`}
            defaultValue={annotation.comment}
            rows={2}
            onBlur={(event) => save(event.currentTarget.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') setEditing(false);
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                save(event.currentTarget.value);
              }
            }}
            className="mt-0.5 w-full resize-none rounded-md border border-primary/40 bg-background px-1.5 py-1 text-xs outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="block w-full text-left text-xs leading-snug text-foreground line-clamp-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
          >
            {annotation.comment}
          </button>
        )}
        {elsewhere ? (
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            on {pagePath(annotation.page.url)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <TrayIconButton label={`Edit comment ${n}`} onClick={() => setEditing(true)}>
          <Pencil className="h-2.5 w-2.5" />
        </TrayIconButton>
        <TrayIconButton label={`Delete comment ${n}`} tone="danger" onClick={onRemove}>
          <Trash2 className="h-2.5 w-2.5" />
        </TrayIconButton>
      </div>
    </li>
  );
}

export function CommentTray({
  annotations,
  currentUrl,
  targets,
  onSend,
  onCopy,
  onClear,
  onEdit,
  onRemove,
  onHover,
  onReveal,
}: CommentTrayProps): React.JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false);
  if (annotations.length === 0) return null;
  const count = plural(annotations.length);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto absolute bottom-3 right-3 flex h-8 items-center gap-2 rounded-full border border-white/10 bg-popover/90 pl-2.5 pr-3 text-xs font-medium text-foreground shadow-2xl backdrop-blur-2xl transition-colors hover:bg-popover animate-in fade-in-0 slide-in-from-bottom-1"
      >
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {annotations.length}
        </span>
        {count}
      </button>
    );
  }

  return (
    <section
      aria-label="Page comments"
      className="pointer-events-auto absolute bottom-3 right-3 flex max-h-[55%] w-[min(21rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-popover/90 text-popover-foreground shadow-2xl backdrop-blur-2xl animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <header className="flex items-center gap-1.5 border-b border-border/50 py-1.5 pl-3 pr-1.5">
        <MessageSquare className="h-3 w-3 text-primary" />
        <span className="mr-auto text-xs font-semibold">{count}</span>
        <TrayIconButton label="Copy comments" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </TrayIconButton>
        <TrayIconButton label="Clear comments" tone="danger" onClick={onClear}>
          <Trash2 className="h-3 w-3" />
        </TrayIconButton>
        <TrayIconButton label="Hide comments" onClick={() => setCollapsed(true)}>
          <X className="h-3 w-3" />
        </TrayIconButton>
      </header>

      <ul aria-label="Comments" className="min-h-0 flex-1 overflow-y-auto p-1">
        {annotations.map((annotation, index) => (
          <Row
            key={annotation.id}
            annotation={annotation}
            n={index + 1}
            elsewhere={!samePage(annotation.page.url, currentUrl)}
            onEdit={(comment) => onEdit(annotation.id, comment)}
            onRemove={() => onRemove(annotation.id)}
            onHover={(hovering) => onHover(hovering ? annotation.id : null)}
            onReveal={() => onReveal(annotation)}
          />
        ))}
      </ul>

      <footer className="flex items-center gap-2 border-t border-border/50 p-2">
        <div className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSend(undefined)}
            aria-label={`Send to ${targets.defaultLabel}`}
            className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-l-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_18px_-6px_hsl(var(--primary)/0.7)] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send className="h-3 w-3 shrink-0" />
            <span className="truncate">Send to {targets.defaultLabel}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Choose where to send"
                className="flex h-8 w-7 items-center justify-center rounded-r-lg border-l border-primary-foreground/20 bg-primary text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:brightness-110"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60">
              {targets.running.length > 0 ? (
                <>
                  <DropdownMenuLabel>Running in this workspace</DropdownMenuLabel>
                  {targets.running.map((target) => (
                    <DropdownMenuItem
                      key={target.tabId}
                      onSelect={() => onSend({ tabId: target.tabId })}
                    >
                      <CliLogo cliId={target.cliId} className="h-3.5 w-3.5" />
                      <span className="truncate">{target.label}</span>
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        running
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuLabel>Start a new tab</DropdownMenuLabel>
              {targets.newTabs.map((cli) => (
                <DropdownMenuItem key={cli.cliId} onSelect={() => onSend({ newCliId: cli.cliId })}>
                  <CliLogo cliId={cli.cliId} className="h-3.5 w-3.5" />
                  <span className="truncate">New {cli.name} tab</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </footer>
    </section>
  );
}
