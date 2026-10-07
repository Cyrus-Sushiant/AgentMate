import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import * as React from 'react';
import { Check, ChevronsUpDown, Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FIELD_SURFACE } from './input';
import { LIST_OPTION, LIST_SEARCH, OVERLAY_MOTION, OVERLAY_SURFACE } from './overlay';

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
  icon?: React.ReactNode;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Shows an "x" in place of the chevron once a value is selected, so it can be reset to empty. */
  clearable?: boolean;
  /**
   * Offers what was typed in the search box as a value of its own, for lists that can't be
   * complete (model names, say). A value that matches no option is shown as typed.
   */
  allowCustom?: boolean;
  /** Label for the typed-value row, given the typed text. */
  customLabel?: (text: string) => string;
  /** What the field is, for screen readers, when no visible label points at it. */
  ariaLabel?: string;
  /** Marks the value as rejected, which tints the trigger the way an invalid input is. */
  invalid?: boolean;
  /**
   * `bare` drops the field surface, for a trigger that sits inside a pill which already draws
   * one. Utilities can't strip it, since the rule is unlayered.
   */
  variant?: 'default' | 'bare';
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  className,
  disabled,
  clearable,
  allowCustom,
  customLabel = (text) => `Use "${text}"`,
  ariaLabel,
  invalid,
  variant = 'default',
}: ComboboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const selected =
    options.find((o) => o.value === value) ??
    (allowCustom && value ? { value, label: value } : undefined);
  const typed = search.trim();
  const showCustom =
    allowCustom &&
    typed.length > 0 &&
    !options.some((o) => o.value.toLowerCase() === typed.toLowerCase());

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-full py-2 pl-3.5 pr-2.5 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            variant === 'bare' ? 'bg-transparent' : FIELD_SURFACE,
            className,
          )}
        >
          <span
            className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}
          >
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          {clearable && selected && !disabled ? (
            <span
              role="button"
              aria-label="Clear selection"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="shrink-0 rounded-full p-0.5 opacity-50 hover:bg-foreground/10 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            OVERLAY_SURFACE,
            OVERLAY_MOTION,
            'z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden origin-[var(--radix-popover-content-transform-origin)]',
          )}
        >
          <CommandPrimitive className="flex flex-col" filter={cmdkFilter}>
            {/* The search box is the same soft pill as the field that opened the list. */}
            <div className="p-1 pb-0">
              <div className={LIST_SEARCH}>
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <CommandPrimitive.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder={searchPlaceholder}
                  className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <CommandPrimitive.List className="rail-scroll max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </CommandPrimitive.Empty>
              {showCustom ? (
                <CommandPrimitive.Item
                  // Always matches the filter, since its value is the search text itself.
                  value={typed}
                  onSelect={() => {
                    onChange(typed);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={LIST_OPTION}
                >
                  <Check className="h-3.5 w-3.5 shrink-0 opacity-0" />
                  <span className="truncate font-mono text-xs">{customLabel(typed)}</span>
                </CommandPrimitive.Item>
              ) : null}
              {options.map((option) => (
                <CommandPrimitive.Item
                  key={option.value}
                  value={[option.label, ...(option.keywords ?? [])].join(' ')}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={LIST_OPTION}
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-primary',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function cmdkFilter(value: string, search: string): number {
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}
