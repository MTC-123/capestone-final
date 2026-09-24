import { useSyncExternalStore } from 'react';
import { useLanguageStore, type Language } from '@/store/useLanguageStore';
import { translations, TranslationKey } from '@/i18n/translations';
import { useServerPreferences } from '@/components/providers/PreferencesProvider';

const subscribe = (onChange: () => void) => useLanguageStore.subscribe(onChange);
const getSnapshot = () => useLanguageStore.getState().language;

/**
 * Current UI language. During the server render and hydration the value is
 * the locale resolved from the request (cookie / Accept-Language), so server
 * HTML and the first client render always agree; afterwards it follows the
 * language store.
 */
export function useLanguage(): Language {
  const { locale } = useServerPreferences();
  return useSyncExternalStore(subscribe, getSnapshot, () => locale);
}

export function useTranslation() {
  const language = useLanguage();

  const t = (key: TranslationKey): string => {
    const bucket = translations[language] as Record<string, string>;
    return bucket[key] ?? translations.fr[key] ?? translations.en[key] ?? key;
  };

  return { t, language };
}
