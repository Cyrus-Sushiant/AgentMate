import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useState } from 'react';
import { isGrammarMistake } from '@agentmat/core';
import type { GrammarIssue } from '@shared/grammar';
import { Ban, Check, RefreshCw, SpellCheck, Spinner, X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import type { GrammarCheckState } from '@/hooks/useGrammarCheck';
import { issueKey, issueStyle, issueTitle, replaceFieldRange, type TextField } from '@/lib/grammar';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';

export interface GrammarPanelProps {
  field: TextField | null;
  value: string;
  state: GrammarCheckState;
  /** Reported as the user points at a row, so the field can highlight that issue. */
  onActiveIssueChange?: (issue: GrammarIssue | null) => void;
  className?: string;
}

/** Nudges the caret to the issue so the user can see what is being talked about. */
function reveal(field: TextField | null, issue: GrammarIssue): void {
  if (!field) return;
  field.focus();
  field.setSelectionRange(issue.offset, issue.offset + issue.length);
}

function applyFix(field: TextField | null, issue: GrammarIssue, replacement: string): void {
  if (!field) return;
  // The value can have moved on since the check; replacing then would corrupt
  // the text rather than fix it.
  if (field.value.slice(issue.offset, issue.offset + issue.length) !== issue.text) return;
  replaceFieldRange(field, issue.offset, issue.offset + issue.length, replacement);
}

/**
 * Applies one suggestion per issue, back to front so each replacement leaves the
 * offsets of the ones before it untouched.
 */
function applyAll(field: TextField | null, issues: GrammarIssue[]): void {
  if (!field) return;
  const ordered = [...issues].sort((a, b) => b.offset - a.offset);
  for (const issue of ordered) {
    const replacement = issue.replacements[0];
    if (replacement) applyFix(field, issue, replacement);
  }
}

/**
 * The writing review panel: every issue LanguageTool found in one field, with
 * its suggestions, in the order they appear in the text. The counter that opens
 * it doubles as the field's check status.
 */
export function GrammarPanel({
  field,
  value,
  state,
  onActiveIssueChange,
  className,
}: GrammarPanelProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!state.active) return null;

  const { issues, checking, error } = state;
  const mistakes = issues.filter(
    (issue) => isGrammarMistake(issue.kind) && issue.replacements.length > 0,
  );
  const hasText = value.trim().length > 0;
  const ordered = [...issues].sort((a, b) => a.offset - b.offset);

  const label = checking
    ? 'Checking…'
    : error
      ? 'Check failed'
      : issues.length === 0
        ? hasText
          ? 'No issues'
          : 'Writing check'
        : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onActiveIssueChange?.(null);
      }}
    >
      <SimpleTooltip label="Writing check (grammar, spelling, style)">
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            // A press here must not steal the caret from the field, otherwise
            // applying a fix would land in the wrong place.
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-foreground/25 hover:text-foreground',
              error && 'border-destructive/40 text-destructive',
              className,
            )}
          >
            {checking ? (
              <Spinner className="h-3 w-3 animate-spin" />
            ) : issues.length > 0 ? (
              <span className={cn('h-1.5 w-1.5 rounded-full', issueStyle(ordered[0].kind).dot)} />
            ) : (
              <SpellCheck className="h-3 w-3" />
            )}
            {label}
          </button>
        </PopoverPrimitive.Trigger>
      </SimpleTooltip>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 w-[22rem] rounded-lg border border-border bg-popover/90 p-0 text-popover-foreground shadow-2xl backdrop-blur-2xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SpellCheck className="h-3.5 w-3.5 text-primary" />
              Writing check
            </div>
            <div className="flex items-center gap-1.5">
              {state.language ? (
                <Badge variant="secondary" className="font-normal">
                  {state.language}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                {state.settings.source === 'local' ? 'Local' : 'Online'}
              </Badge>
            </div>
          </div>

          {error ? (
            <p className="border-b border-border px-3 py-2 text-xs leading-relaxed text-destructive">
              {error}
            </p>
          ) : null}

          {state.truncatedAt !== null ? (
            <p className="border-b border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              This text is long: only the first {state.truncatedAt.toLocaleString()} characters were
              checked.
            </p>
          ) : null}

          {ordered.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              {checking ? (
                <>
                  <Spinner className="h-3.5 w-3.5 animate-spin" /> Checking this text…
                </>
              ) : hasText ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Nothing to fix here.
                </>
              ) : (
                'Write something and this will check it.'
              )}
            </div>
          ) : (
            <ul className="max-h-72 divide-y divide-border/70 overflow-y-auto">
              {ordered.map((issue) => {
                const style = issueStyle(issue.kind);
                const flaggedProps = persianTextProps(issue.text);
                return (
                  <li
                    key={issueKey(issue)}
                    onMouseEnter={() => onActiveIssueChange?.(issue)}
                    onMouseLeave={() => onActiveIssueChange?.(null)}
                    className="space-y-1.5 px-3 py-2 hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {issueTitle(issue)}
                      </span>
                      <SimpleTooltip label="Ignore this one">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => state.dismiss(issue)}
                          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Ignore this issue"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </SimpleTooltip>
                    </div>

                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => reveal(field, issue)}
                      dir={flaggedProps.dir}
                      className={cn(
                        'block max-w-full cursor-pointer truncate text-left text-sm underline decoration-wavy underline-offset-4',
                        style.decoration,
                        flaggedProps.className,
                      )}
                    >
                      {issue.text}
                    </button>

                    {issue.message ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {issue.message}
                      </p>
                    ) : null}

                    {issue.replacements.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {issue.replacements.slice(0, 4).map((replacement) => (
                          <button
                            key={replacement}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyFix(field, issue, replacement)}
                            className="cursor-pointer rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-primary/20"
                          >
                            {replacement}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                        <Ban className="h-3 w-3" /> No suggestion for this one
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={checking}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void state.recheck()}
            >
              <RefreshCw className={cn('h-3 w-3', checking && 'animate-spin')} /> Check again
            </Button>
            {mistakes.length > 0 ? (
              <SimpleTooltip label="Applies the top suggestion for spelling, grammar, and punctuation. Style stays as written.">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyAll(field, mistakes)}
                >
                  Fix {mistakes.length} {mistakes.length === 1 ? 'mistake' : 'mistakes'}
                </Button>
              </SimpleTooltip>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
