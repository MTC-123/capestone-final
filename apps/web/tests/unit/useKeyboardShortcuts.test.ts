import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock next/navigation before importing the hook
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
}));

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

/**
 * Dispatch a keydown event. If a target element is provided, the event is
 * dispatched from that element so `event.target` is set correctly by the DOM
 * (the event bubbles up to `document` where the hook listens). The element
 * must be attached to the document for bubbling to work.
 */
function fireKey(key: string, target?: HTMLElement, opts?: Partial<KeyboardEventInit>) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });

  if (target) {
    target.dispatchEvent(event);
  } else {
    document.dispatchEvent(event);
  }
}

/**
 * Helper: create an element, append it to the body, run a callback, then
 * clean up. This ensures bubbling works and `event.target` is correct.
 */
function withDomElement<T extends HTMLElement>(
  el: T,
  fn: (el: T) => void
) {
  document.body.appendChild(el);
  try {
    fn(el);
  } finally {
    document.body.removeChild(el);
  }
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('toggles the command palette with Ctrl+K and Cmd+K', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(result.current.paletteOpen).toBe(false);
    act(() => fireKey('k', undefined, { ctrlKey: true }));
    expect(result.current.paletteOpen).toBe(true);
    act(() => fireKey('k', undefined, { metaKey: true }));
    expect(result.current.paletteOpen).toBe(false);
  });

  it('opens the palette even while typing in a field', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    withDomElement(document.createElement('input'), (input) => {
      act(() => fireKey('k', input, { ctrlKey: true }));
    });
    expect(result.current.paletteOpen).toBe(true);
  });

  it('navigates to /report on Alt+N', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('n', undefined, { altKey: true, code: 'KeyN' }));
    expect(mockPush).toHaveBeenCalledWith('/report');
  });

  it('ignores single printable keys (WCAG 2.1.4)', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      fireKey('n');
      fireKey('r');
      fireKey('f');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not trigger Alt shortcuts while typing', () => {
    renderHook(() => useKeyboardShortcuts());
    withDomElement(document.createElement('textarea'), (el) => {
      act(() => fireKey('n', el, { altKey: true, code: 'KeyN' }));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('toggles the help overlay with ? and closes it with Escape', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('?'));
    expect(result.current.showOverlay).toBe(true);
    act(() => fireKey('Escape'));
    expect(result.current.showOverlay).toBe(false);
  });
});
