import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, vi } from 'vitest';
import 'vitest-axe/extend-expect';
import * as matchers from 'vitest-axe/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock Next.js Image component
vi.mock('next/image', () => ({
  __esModule: true,
  default: vi.fn((props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement('img', props);
  }),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  __esModule: true,
  default: vi.fn(({ children, href, ...props }) => {
    return React.createElement('a', { href, ...props }, children);
  }),
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
}));

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => null,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
