'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'fire' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      type = 'button',
      variant = 'secondary',
      size = 'md',
      isLoading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const spinnerSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold',
          'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-5 text-[15px]',
          variant === 'primary' && 'bg-primary text-primary-foreground shadow-elev-1 hover:brightness-110',
          variant === 'fire' && 'bg-accent-fire text-white shadow-glow-fire hover:brightness-110',
          variant === 'danger' && 'bg-danger text-white shadow-elev-1 hover:brightness-110',
          variant === 'secondary' && 'border border-border bg-surface-2 text-foreground hover:border-foreground/20 hover:bg-muted',
          variant === 'outline' && 'border border-border bg-transparent text-foreground hover:border-foreground/25 hover:bg-surface-2',
          variant === 'ghost' && 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          className
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Spinner className={spinnerSize} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
