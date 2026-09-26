'use client';

import { useSyncExternalStore } from 'react';

/**
 * Small external stores for browser-only values, read with
 * useSyncExternalStore so the server snapshot is used during hydration and
 * the real value takes over afterwards — no setState-in-effect needed.
 */

const noopSubscribe = () => () => {};

/** Whether the <html> element currently carries the `dark` class. */
export function useIsDark(serverValue: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
    () => serverValue
  );
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** The OS "reduce motion" setting, kept live. Server render assumes motion is allowed. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
}

export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true
  );
}

/** Wall-clock time refreshed every `intervalMs`; null during SSR/hydration. */
const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: number | undefined;

export function useNow(intervalMs = 15_000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      clockListeners.add(onChange);
      if (clockTimer === undefined) {
        clockNow = Date.now();
        clockTimer = window.setInterval(() => {
          clockNow = Date.now();
          clockListeners.forEach((l) => l());
        }, intervalMs);
      }
      return () => {
        clockListeners.delete(onChange);
        if (clockListeners.size === 0 && clockTimer !== undefined) {
          window.clearInterval(clockTimer);
          clockTimer = undefined;
        }
      };
    },
    () => clockNow || (clockNow = Date.now()),
    () => null
  );
}

/** A boolean persisted in localStorage, shared by every component using the same key. */
const flagEvent = 'ricer:local-flag';

export function useLocalFlag(key: string, fallback = false): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      const handler = (e: Event) => {
        if (!(e instanceof StorageEvent) || e.key === key) onChange();
      };
      window.addEventListener('storage', handler);
      window.addEventListener(flagEvent, handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener(flagEvent, handler);
      };
    },
    () => {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : raw === '1';
      } catch {
        return fallback;
      }
    },
    () => fallback
  );
  const set = (next: boolean) => {
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(flagEvent));
  };
  return [value, set];
}
