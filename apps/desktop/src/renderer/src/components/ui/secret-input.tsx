import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { Eye, EyeOff } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ExtraInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'id' | 'placeholder' | 'className'
>;

/** A masked text input with an eye toggle, for passwords, API keys, and other secrets. */
export const SecretInput = forwardRef<
  HTMLInputElement,
  {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    /** Extra buttons shown before the eye, such as a password generator. */
    trailing?: ReactNode;
  } & ExtraInputProps
>(function SecretInput({ id, value, onChange, placeholder, className, trailing, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        {...rest}
        className={cn(trailing ? 'pr-16' : 'pr-9', 'font-mono placeholder:font-sans', className)}
      />
      {/* Inset by the field's edge plus a hair, so the round buttons sit inside its round end. */}
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {trailing}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide value' : 'Show value'}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  );
});
