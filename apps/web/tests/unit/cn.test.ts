import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('ignores undefined, null, false, 0, and empty string', () => {
    expect(cn(undefined, null, false, 0, '')).toBe('');
  });

  it('returns a single string unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple strings with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('includes a number as a string', () => {
    expect(cn(42)).toBe('42');
  });

  it('applies conditional classes when the condition is true', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('excludes conditional classes when the condition is false', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('includes keys from an object whose values are true', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('returns empty string for an object with all false values', () => {
    expect(cn({ foo: false, bar: false })).toBe('');
  });

  it('flattens nested arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('handles deeply nested arrays', () => {
    expect(cn(['a', ['b', 'c']], 'd')).toBe('a b c d');
  });

  it('handles a mix of strings, booleans, objects, and arrays', () => {
    expect(
      cn('base', true && 'on', false && 'off', { extra: true, nope: false }, ['arr1', 'arr2'])
    ).toBe('base on extra arr1 arr2');
  });

  it('ignores falsy values inside nested arrays', () => {
    expect(cn(['a', null, undefined, false, 'b'])).toBe('a b');
  });

  it('handles an object inside a nested array', () => {
    expect(cn([{ deep: true }])).toBe('deep');
  });
});
