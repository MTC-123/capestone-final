'use client';

import React, { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const initial = stored === 'light' ? 'light' : 'dark';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <IconButton
      label={theme === 'light' ? 'Dark mode' : 'Light mode'}
      onClick={toggleTheme}
    >
      <span className="transition-transform duration-200 hover:rotate-12">
        <Icon name={theme === 'light' ? 'moon' : 'sun'} aria-hidden size={18} />
      </span>
    </IconButton>
  );
}
