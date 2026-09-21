import * as React from 'react';
import { ChevronDown, ChevronUp } from '@/components/icons';
import { containsPersian } from '@/lib/rtl';
import { cn } from '@/lib/utils';

/** Border, height, and surface shared by the plain field and the number field's shell. */
const fieldShell =
  'flex h-9 w-full rounded-lg border border-input bg-background text-sm shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)] transition-colors';

/* Chromium's own spinner is a pair of tiny white arrows that ignore the theme, so number
   fields hide it and draw their own buttons instead (see NumberInput below). */
const hideNativeSpinner =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, value, ...props }, ref) => {
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
          fieldShell,
          'px-3 py-1 placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
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
      <div
        className={cn(
          fieldShell,
          'items-center py-1 pl-3 pr-1 hover:border-foreground/20 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/50',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <input
          type="number"
          ref={setRefs}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            'h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
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
      className="flex h-3.5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/70"
    >
      {children}
    </button>
  );
}

export { Input };
