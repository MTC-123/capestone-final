import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { useLanguageStore } from '@/store/useLanguageStore';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    useLanguageStore.setState({ language: 'ar' });
  });

  it('toggles aria-pressed state', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const ar = screen.getByRole('button', { name: 'العربية' });
    const fr = screen.getByRole('button', { name: 'Français' });
    const en = screen.getByRole('button', { name: 'English' });

    expect(ar).toHaveAttribute('aria-pressed', 'true');
    expect(fr).toHaveAttribute('aria-pressed', 'false');
    expect(en).toHaveAttribute('aria-pressed', 'false');

    await user.click(fr);
    expect(fr).toHaveAttribute('aria-pressed', 'true');
  });
});
