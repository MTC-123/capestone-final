import * as React from 'react';
import { cn } from '@/lib/cn';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';

export type TextFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'className'
> & {
  label: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: IconName;
  containerClassName?: string;
  inputClassName?: string;
};

export function TextField({
  id,
  label,
  helperText,
  errorText,
  leadingIcon,
  containerClassName,
  inputClassName,
  required,
  disabled,
  ...props
}: TextFieldProps) {
  const describedByIds = [
    errorText ? `${id}-error` : null,
    helperText ? `${id}-help` : null,
  ].filter(Boolean) as string[];

  return (
    <div className={cn('space-y-2', containerClassName)}>
      <label
        htmlFor={id}
        className={cn('text-sm font-semibold text-foreground', disabled && 'opacity-60')}
      >
        {label}
        {required ? <span className="ms-1 text-danger">*</span> : null}
      </label>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-surface px-3 py-2 shadow-sm transition',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
          disabled && 'opacity-60'
        )}
      >
        {leadingIcon ? (
          <Icon name={leadingIcon} aria-hidden={true} className="text-muted-foreground" size={18} />
        ) : null}

        <input
          id={id}
          className={cn(
            'h-8 sm:h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
            inputClassName
          )}
          aria-invalid={!!errorText || undefined}
          aria-describedby={describedByIds.length ? describedByIds.join(' ') : undefined}
          required={required}
          disabled={disabled}
          {...props}
        />
      </div>

      {errorText ? (
        <div id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {errorText}
        </div>
      ) : null}

      {helperText ? (
        <div id={`${id}-help`} className="text-xs text-muted-foreground">
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
