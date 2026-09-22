'use client';

import * as React from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

function setLocaleDocument(language: 'ar' | 'fr' | 'en') {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
  document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function LocaleSync() {
  const language = useLanguageStore((s) => s.language);

  React.useEffect(() => {
    useLanguageStore.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    setLocaleDocument(language);
  }, [language]);

  return null;
}
