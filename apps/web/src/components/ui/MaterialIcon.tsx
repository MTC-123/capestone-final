import * as React from 'react';
import { cn } from '@/lib/cn';

export type MaterialIconProps = {
  name: string;
  className?: string;
  fill?: 0 | 1;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  opticalSize?: 20 | 24 | 40 | 48;
  'aria-hidden'?: boolean;
};

export function MaterialIcon({
  name,
  className,
  fill,
  weight,
  grade,
  opticalSize,
  ...props
}: MaterialIconProps) {
  const fvs: string[] = [];
  if (typeof fill === 'number') fvs.push(`'FILL' ${fill}`);
  if (typeof weight === 'number') fvs.push(`'wght' ${weight}`);
  if (typeof grade === 'number') fvs.push(`'GRAD' ${grade}`);
  if (typeof opticalSize === 'number') fvs.push(`'opsz' ${opticalSize}`);

  return (
    <span
      className={cn('material-symbols-outlined leading-none select-none', className)}
      style={fvs.length ? { fontVariationSettings: fvs.join(', ') } : undefined}
      {...props}
    >
      {name}
    </span>
  );
}
