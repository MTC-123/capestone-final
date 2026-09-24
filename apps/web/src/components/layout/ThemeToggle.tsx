'use client';

import React from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsDark } from '@/lib/client/browserStores';
import { useServerPreferences } from '@/components/providers/PreferencesProvider';

/**
 * Light/dark switch. The choice is stored in the `ricer-theme` cookie so the
 * server renders the right scheme on the next request.
 */
export function ThemeToggle() {
  const { language } = useTranslation();
  const { theme: serverTheme } = useServerPreferences();
  const theme = useIsDark(serverTheme === 'dark') ? 'dark' : 'light';

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.cookie = `ricer-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const labels = {
    ar: { dark: 'الوضع الداكن', light: 'الوضع الفاتح' },
    fr: { dark: 'Mode sombre', light: 'Mode clair' },
    en: { dark: 'Dark mode', light: 'Light mode' },
  }[language];

  return (
    <IconButton label={theme === 'light' ? labels.dark : labels.light} onClick={toggleTheme}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} aria-hidden size={18} />
    </IconButton>
  );
}
