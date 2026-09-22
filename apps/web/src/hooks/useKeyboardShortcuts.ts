'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip when focus is in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'f':
        case 'F': {
          e.preventDefault();
          const mapEl = document.querySelector('[data-ricer-map-ready]');
          if (mapEl) {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              mapEl.requestFullscreen();
            }
          }
          break;
        }
        case 'r':
        case 'R': {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            window.location.reload();
          }
          break;
        }
        case 'n':
        case 'N': {
          e.preventDefault();
          router.push('/report');
          break;
        }
        case 'l':
        case 'L': {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ricer:toggle-layers'));
          break;
        }
        case 'g':
        case 'G': {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ricer:toggle-legend'));
          break;
        }
        case 'w':
        case 'W': {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ricer:toggle-weather'));
          break;
        }
        case 'd':
        case 'D': {
          e.preventDefault();
          const isDark = document.documentElement.classList.contains('dark');
          const newTheme = isDark ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
          localStorage.setItem('theme', newTheme);
          break;
        }
        case 'Escape': {
          setShowOverlay(false);
          document.dispatchEvent(new CustomEvent('ricer:close-panels'));
          break;
        }
        case '?': {
          e.preventDefault();
          setShowOverlay((prev) => !prev);
          break;
        }
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showOverlay, setShowOverlay };
}
