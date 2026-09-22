'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  className?: string;
}

export function Slider({ value, onValueChange, min, max, step = 1, label, className }: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-primary shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
}
