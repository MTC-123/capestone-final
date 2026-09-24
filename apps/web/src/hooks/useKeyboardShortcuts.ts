'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * Global shortcuts. Everything except "?" uses a modifier so no single
 * printable key triggers an action (WCAG 2.1.4 Character Key Shortcuts).
 *   Mod+K  command palette      Alt+N  new report
 *   Alt+L  map layers           Alt+G  map legend
 *   Alt+F  fullscreen map       ?      shortcut help
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (isTyping(e.target)) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowOverlay((v) => !v);
        return;
      }
      if (!e.altKey || e.metaKey || e.ctrlKey) return;

      // Alt+letter produces special characters on macOS, so match on the physical key.
      switch (e.code) {
        case 'KeyN':
          e.preventDefault();
          router.push('/report');
          break;
        case 'KeyL':
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ricer:toggle-layers'));
          break;
        case 'KeyG':
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('ricer:toggle-legend'));
          break;
        case 'KeyF': {
          e.preventDefault();
          const mapEl = document.querySelector('[data-ricer-map-ready]');
          if (document.fullscreenElement) void document.exitFullscreen();
          else void mapEl?.requestFullscreen();
          break;
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return { showOverlay, setShowOverlay, paletteOpen, setPaletteOpen };
}
