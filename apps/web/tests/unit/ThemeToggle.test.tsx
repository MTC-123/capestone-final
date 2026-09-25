import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useLanguageStore } from '@/store/useLanguageStore';

function clearThemeCookie() {
  document.cookie = 'ricer-theme=; Path=/; Max-Age=0';
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    clearThemeCookie();
    document.documentElement.classList.remove('dark');
    useLanguageStore.setState({ language: 'en' });
  });

  it('reflects the server-rendered scheme on mount', async () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Light mode' })).toBeInTheDocument();
  });

  it('offers dark mode when the page is light', async () => {
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Dark mode' })).toBeInTheDocument();
  });

  it('toggles the html class and persists the choice in a cookie', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(await screen.findByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.cookie).toContain('ricer-theme=dark');

    await user.click(screen.getByRole('button', { name: 'Light mode' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.cookie).toContain('ricer-theme=light');
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = await screen.findByRole('button', { name: 'Dark mode' });
    button.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('localises its label', async () => {
    useLanguageStore.setState({ language: 'fr' });
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Mode sombre' })).toBeInTheDocument();
  });
});
