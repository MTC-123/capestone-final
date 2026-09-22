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

  it('toggles showOverlay when "?" is pressed', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    // Initially false
    expect(result.current.showOverlay).toBe(false);

    // Press "?" -> true
    act(() => {
      fireKey('?');
    });
    expect(result.current.showOverlay).toBe(true);

    // Press "?" again -> false
    act(() => {
      fireKey('?');
    });
    expect(result.current.showOverlay).toBe(false);
  });

  it('sets showOverlay to false when Escape is pressed', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    // Open overlay first
    act(() => {
      fireKey('?');
    });
    expect(result.current.showOverlay).toBe(true);

    // Press Escape
    act(() => {
      fireKey('Escape');
    });
    expect(result.current.showOverlay).toBe(false);
  });

  it('dispatches ricer:close-panels custom event on Escape', () => {
    const handler = vi.fn();
    document.addEventListener('ricer:close-panels', handler);

    renderHook(() => useKeyboardShortcuts());

    act(() => {
      fireKey('Escape');
    });

    expect(handler).toHaveBeenCalledTimes(1);

    document.removeEventListener('ricer:close-panels', handler);
  });

  it('navigates to /report when "n" is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      fireKey('n');
    });

    expect(mockPush).toHaveBeenCalledWith('/report');
  });

  it('suppresses shortcuts when target is an INPUT element', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    withDomElement(input, (el) => {
      act(() => {
        fireKey('?', el);
      });
    });

    // showOverlay should remain false because the event target is an INPUT
    expect(result.current.showOverlay).toBe(false);
  });

  it('suppresses shortcuts when target is a TEXTAREA element', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement('textarea');
    withDomElement(textarea, (el) => {
      act(() => {
        fireKey('?', el);
      });
    });

    expect(result.current.showOverlay).toBe(false);
  });

  it('suppresses shortcuts when target is a SELECT element', () => {
    renderHook(() => useKeyboardShortcuts());

    const select = document.createElement('select');
    withDomElement(select, (el) => {
      act(() => {
        fireKey('n', el);
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('suppresses shortcuts when target is contentEditable', () => {
    renderHook(() => useKeyboardShortcuts());

    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom does not implement isContentEditable, so we polyfill it
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    withDomElement(div, (el) => {
      act(() => {
        fireKey('n', el);
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('allows setShowOverlay to be called programmatically', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    act(() => {
      result.current.setShowOverlay(true);
    });
    expect(result.current.showOverlay).toBe(true);

    act(() => {
      result.current.setShowOverlay(false);
    });
    expect(result.current.showOverlay).toBe(false);
  });

  it('removes the keydown listener on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts());

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
