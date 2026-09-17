import { useId, useState } from 'react';
import { X } from '@/components/icons';
import { Input } from '@/components/ui/input';

const MAX_SUGGESTIONS = 6;

/** Tags as removable chips, with suggestions from tags already used elsewhere in the vault. */
export function TagInput({
  id,
  value,
  onChange,
  suggestions,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const has = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase());

  function add(raw: string): void {
    const tag = raw.trim().replace(/,$/, '').trim();
    setDraft('');
    if (!tag || has(tag)) return;
    onChange([...value, tag]);
  }

  const query = draft.trim().toLowerCase();
  const matches = query
    ? suggestions
        .filter((tag) => !has(tag) && tag.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-2.5 pr-1 text-xs"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          id={id}
          value={draft}
          placeholder="Add a tag and press Enter"
          autoComplete="off"
          aria-controls={matches.length ? listId : undefined}
          onChange={(event) => {
            const next = event.target.value;
            if (next.endsWith(',')) add(next);
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && draft.trim()) {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
        {matches.length > 0 && (
          <div
            id={listId}
            role="listbox"
            aria-label="Tag suggestions"
            className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-xl"
          >
            {matches.map((tag) => (
              <div
                key={tag}
                role="option"
                aria-selected={false}
                tabIndex={-1}
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-accent"
                // mousedown so the input's blur doesn't add the half-typed draft first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(tag);
                }}
                onClick={() => add(tag)}
                onKeyDown={(event) => event.key === 'Enter' && add(tag)}
              >
                {tag}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
