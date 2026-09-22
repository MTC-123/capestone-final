'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
          checked
            ? 'ltr:translate-x-5 rtl:-translate-x-5 shadow-glow-green'
            : 'translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  );
}
