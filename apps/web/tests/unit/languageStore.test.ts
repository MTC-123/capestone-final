import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLanguageStore } from '@/store/useLanguageStore';

describe('useLanguageStore', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'ar' });
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    // Clear cookies
    document.cookie = 'ricer-language=; Max-Age=0';
  });

  it('defaults to Arabic', () => {
    expect(useLanguageStore.getState().language).toBe('ar');
  });

  it('setLanguage("fr") updates language', () => {
    useLanguageStore.getState().setLanguage('fr');
    expect(useLanguageStore.getState().language).toBe('fr');
  });

  it('setLanguage("fr") sets dir to ltr', () => {
    useLanguageStore.getState().setLanguage('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('setLanguage("fr") sets lang attribute', () => {
    useLanguageStore.getState().setLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('setLanguage("fr") sets cookie', () => {
    useLanguageStore.getState().setLanguage('fr');
    expect(document.cookie).toContain('ricer-language=fr');
  });

  it('setLanguage("ar") sets dir to rtl', () => {
    useLanguageStore.getState().setLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('setLanguage("en") sets dir to ltr and lang to en', () => {
    useLanguageStore.getState().setLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switching languages updates state correctly', () => {
    useLanguageStore.getState().setLanguage('en');
    useLanguageStore.getState().setLanguage('ar');
    expect(useLanguageStore.getState().language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
