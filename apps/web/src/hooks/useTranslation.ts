import { useLanguageStore } from '@/store/useLanguageStore';
import { translations, TranslationKey } from '@/i18n/translations';
import { useServerPreferences } from '@/components/providers/PreferencesProvider';

export function useTranslation() {
  const storeLanguage = useLanguageStore((state) => state.language);
  const { locale } = useServerPreferences();
  // During the server render the global store is shared between requests,
  // so the per-request locale from context is authoritative there.
  const language = typeof window === 'undefined' ? locale : storeLanguage;

  const t = (key: TranslationKey): string => {
    const bucket = translations[language] as Record<string, string>;
    return bucket[key] ?? translations.fr[key] ?? translations.en[key] ?? key;
  };

  return { t, language };
}
