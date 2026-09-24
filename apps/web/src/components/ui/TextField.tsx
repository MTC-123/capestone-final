import * as React from 'react';
import { cn } from '@/lib/cn';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';

export type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'className'> & {
  label: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: IconName;
  /** Rendered inside the field after the input, e.g. a show-password button. */
  trailing?: React.ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  /** Visually hide the label (it stays available to assistive technology). */
  hideLabel?: boolean;
};

export function TextField({
  id,
  label,
  helperText,
  errorText,
  leadingIcon,
  trailing,
  containerClassName,
  inputClassName,
  hideLabel,
  required,
  disabled,
  ...props
}: TextFieldProps) {
  const describedByIds = [errorText ? `${id}-error` : null, helperText ? `${id}-help` : null].filter(Boolean) as string[];

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      <label
        htmlFor={id}
        className={cn('block text-[13px] font-medium text-foreground', disabled && 'opacity-60', hideLabel && 'sr-only')}
      >
        {label}
        {required ? (
          <span className="ms-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      <div
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-[10px] border bg-surface px-3 transition-[border-color,box-shadow]',
          errorText ? 'border-danger/60' : 'border-input hover:border-foreground/25',
          'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
          disabled && 'opacity-60'
        )}
      >
        {leadingIcon ? <Icon name={leadingIcon} className="text-muted-foreground" size={17} /> : null}
        <input
          id={id}
          className={cn(
            'h-full w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm',
            inputClassName
          )}
          aria-invalid={!!errorText || undefined}
          aria-describedby={describedByIds.length ? describedByIds.join(' ') : undefined}
          required={required}
          disabled={disabled}
          {...props}
        />
        {trailing}
      </div>

      {errorText ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <Icon name="warning" size={14} />
          {errorText}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/** Password field with an accessible show/hide toggle. */
export function PasswordField({
  revealLabel,
  concealLabel,
  ...props
}: Omit<TextFieldProps, 'type' | 'trailing'> & { revealLabel: string; concealLabel: string }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? concealLabel : revealLabel}
          aria-pressed={visible}
          className="-me-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={17} />
        </button>
      }
    />
  );
}
