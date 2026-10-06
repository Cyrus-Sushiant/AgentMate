import { HELP_ARTICLES } from '@shared/help/articles';
import {
  createHelpSearch,
  type HelpSearchHit,
  highlightRanges,
  searchTerms,
} from '@shared/help/search';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';

const search = createHelpSearch(HELP_ARTICLES);

/** Wraps the parts of `text` that match the query in <mark>. */
function Highlighted({ text, terms }: { text: string; terms: string[] }): React.JSX.Element {
  const ranges = highlightRanges(text, terms);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="rounded-[3px] bg-primary/20 px-px text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

export interface HelpSearchBoxHandle {
  focus: () => void;
  setQuery: (query: string) => void;
}

export interface HelpSearchBoxProps {
  /** 'hero' is the big box on the Help home, 'compact' sits atop the article sidebar. */
  variant?: 'hero' | 'compact';
  className?: string;
}

export const HelpSearchBox = forwardRef<HelpSearchBoxHandle, HelpSearchBoxProps>(
  function HelpSearchBox({ variant = 'compact', className }, ref) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const hero = variant === 'hero';

    const hits = useMemo(() => (query.trim() ? search(query, hero ? 8 : 7) : []), [query, hero]);
    const terms = useMemo(() => searchTerms(query), [query]);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      setQuery: (next) => {
        setQuery(next);
        setActive(0);
        setOpen(true);
        inputRef.current?.focus();
      },
    }));

    // "/" focuses the box from anywhere on the Help page, the way most docs sites work.
    useEffect(() => {
      function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
        event.preventDefault();
        inputRef.current?.focus();
      }
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    function choose(hit: HelpSearchHit): void {
      navigate(`/help/${hit.slug}${hit.sectionId ? `#${hit.sectionId}` : ''}`);
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
      if (event.key === 'ArrowDown' && hits.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActive((i) => (i + 1) % hits.length);
      } else if (event.key === 'ArrowUp' && hits.length > 0) {
        event.preventDefault();
        setActive((i) => (i - 1 + hits.length) % hits.length);
      } else if (event.key === 'Enter') {
        const hit = hits[active];
        if (hit) {
          event.preventDefault();
          choose(hit);
        }
      } else if (event.key === 'Escape') {
        if (query) {
          event.preventDefault();
          setQuery('');
        } else {
          inputRef.current?.blur();
        }
      }
    }

    const showPanel = open && query.trim().length > 0;

    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'flex items-center gap-2.5 border bg-background/70 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10',
            hero
              ? 'h-14 rounded-2xl border-border px-5 shadow-[0_1px_0_0_hsl(var(--foreground)/0.04),0_12px_32px_-18px_hsl(0_0%_0%/0.35)]'
              : 'h-9 rounded-lg border-border/80 px-3',
          )}
        >
          <Search
            className={cn('shrink-0 text-muted-foreground', hero ? 'h-4.5 w-4.5' : 'h-3.5 w-3.5')}
          />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search the help"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showPanel && hits[active] ? `${listId}-${active}` : undefined}
            value={query}
            placeholder={hero ? 'Search for a page, a button, a setting…' : 'Search the help'}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70',
              hero ? 'text-base' : 'text-sm',
            )}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="help-kbd shrink-0" aria-hidden>
              /
            </kbd>
          )}
        </div>

        {showPanel && (
          <div
            className={cn(
              'search-panel help-search-panel absolute inset-x-0 z-30 mt-2 max-h-[60vh] overflow-y-auto p-1.5',
              !hero && 'min-w-[22rem]',
            )}
          >
            {hits.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No articles match “{query.trim()}”. Try a page name, like Vault or Workspace.
              </p>
            ) : (
              <div id={listId} role="listbox" aria-label="Help results">
                {hits.map((hit, i) => (
                  <div
                    key={`${hit.slug}#${hit.sectionId}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(hit)}
                    className={cn(
                      'group flex cursor-pointer gap-3 rounded-lg px-3 py-2.5 transition-colors',
                      i === active ? 'bg-primary/[0.09]' : 'hover:bg-foreground/[0.04]',
                    )}
                  >
                    <FileText
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors',
                        i === active ? 'text-primary' : 'text-muted-foreground/70',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
                        <span className="truncate">
                          <Highlighted text={hit.articleTitle} terms={terms} />
                        </span>
                        {hit.heading && (
                          <>
                            <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
                            <span className="truncate text-foreground/80">
                              <Highlighted text={hit.heading} terms={terms} />
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        <Highlighted text={hit.snippet} terms={terms} />
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                      {hit.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
