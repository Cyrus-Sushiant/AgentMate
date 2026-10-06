import * as React from 'react';
import { ChevronDown, ChevronUp } from '@/components/icons';
import { containsPersian } from '@/lib/rtl';
import { cn } from '@/lib/utils';

/**
 * The shared field look, the same soft pill the search boxes use. The unlayered
 * `.field-surface` rule in index.css draws the wash, the edge, and the hover, focus, invalid,
 * and disabled states, so only shape and size are set here.
 */
export const FIELD_SURFACE = 'field-surface';

/**
 * A native colour input drawn as a small field pill, with Chromium's swatch rounded to match.
 * Callers add the width.
 */
export const COLOR_FIELD = cn(
  FIELD_SURFACE,
  'h-8 w-12 cursor-pointer rounded-full p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0',
);

/** Height and shape shared by the plain field and the number field's shell. */
const fieldShell = cn(FIELD_SURFACE, 'flex h-9 w-full rounded-full text-sm');

/* Chromium's own spinner is a pair of tiny white arrows that ignore the theme, so number
   fields hide it and draw their own buttons instead (see NumberInput below). */
const hideNativeSpinner =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * `bare` drops the field surface, for an input that sits inside a container which already
   * draws one (a composer pill, say). Utilities can't strip it, since the rule is unlayered.
   */
  variant?: 'default' | 'bare';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, variant = 'default', ...props }, ref) => {
    const isPersian = typeof value === 'string' && containsPersian(value);
    if (type === 'number') {
      return <NumberInput className={className} value={value} ref={ref} {...props} />;
    }
    return (
      <input
        type={type}
        value={value}
        dir={isPersian ? 'rtl' : undefined}
        ref={ref}
        className={cn(
          variant === 'bare'
            ? 'flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70'
            : fieldShell,
          'px-3.5 py-1 disabled:cursor-not-allowed disabled:opacity-50',
          isPersian && 'font-vazirmatn',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

/**
 * A number field whose step buttons are ours: the shell carries the border and any width the
 * caller asked for, the input sits inside it borderless, and the chevrons step the value the
 * way the native arrows would.
 */
const NumberInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, disabled, readOnly, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const step = (direction: 'up' | 'down') => {
      const element = innerRef.current;
      if (!element || element.disabled || element.readOnly) return;
      const before = element.value;
      try {
        if (direction === 'up') element.stepUp();
        else element.stepDown();
      } catch {
        // stepUp/stepDown throw on a value the browser cannot parse, nothing to step then.
        return;
      }
      const stepped = element.value;
      // React tracks the last value it wrote, so setting it through the prototype setter is
      // what makes a controlled input notice the change and fire onChange.
      element.value = before;
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setValue) setValue.call(element, stepped);
      else element.value = stepped;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.focus();
    };

    const steppable = !disabled && !readOnly;

    return (
      // The shell's `.field-surface` rule dims it while the input inside is disabled.
      <div className={cn(fieldShell, 'items-center py-1 pl-3.5 pr-2', className)}>
        <input
          type="number"
          ref={setRefs}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            'h-full w-full min-w-0 bg-transparent outline-none disabled:cursor-not-allowed',
            hideNativeSpinner,
          )}
          {...props}
        />
        {steppable && (
          <span className="ml-1 flex shrink-0 flex-col justify-center gap-px">
            <StepButton label="Increase value" onClick={() => step('up')}>
              <ChevronUp className="h-2 w-2" />
            </StepButton>
            <StepButton label="Decrease value" onClick={() => step('down')}>
              <ChevronDown className="h-2 w-2" />
            </StepButton>
          </span>
        )}
      </div>
    );
  },
);
NumberInput.displayName = 'NumberInput';

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      // Keeping focus on the field means the value stays selectable and arrow keys keep working.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex h-3.5 w-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/70"
    >
      {children}
    </button>
  );
}

export { Input };
