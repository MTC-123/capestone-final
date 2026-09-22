'use client';

import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'sm' | 'md' | 'lg' | 'xl';

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return 'mobile';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg'); // SSR-safe default

  useEffect(() => {
    function update() {
      setBreakpoint(getBreakpoint(window.innerWidth));
    }

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return breakpoint;
}

export function useIsMobile(): boolean {
  const bp = useBreakpoint();
  return bp === 'mobile' || bp === 'sm';
}

export function useIsTablet(): boolean {
  const bp = useBreakpoint();
  return bp === 'md';
}
