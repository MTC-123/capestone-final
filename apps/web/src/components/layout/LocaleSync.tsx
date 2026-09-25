'use client';

import * as React from 'react';
import { useLanguage } from '@/hooks/useTranslation';

/** Keeps <html lang/dir> and the language cookie in step with the store. */
export default function LocaleSync() {
  const language = useLanguage();

  React.useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [language]);

  return null;
}
