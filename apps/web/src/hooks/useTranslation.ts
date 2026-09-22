import { useLanguageStore } from '@/store/useLanguageStore';
import { translations, TranslationKey } from '@/i18n/translations';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  
  const t = (key: TranslationKey): string => {
    const bucket = translations[language] as Record<string, string>;
    return bucket[key] ?? translations.fr[key] ?? translations.ar[key] ?? key;
  };

  return { t, language };
}
