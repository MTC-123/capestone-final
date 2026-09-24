'use client';

import * as React from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

/** Keeps <html lang/dir> and the language cookie in step with the store. */
export default function LocaleSync() {
  const language = useLanguageStore((s) => s.language);

  React.useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [language]);

  return null;
}
