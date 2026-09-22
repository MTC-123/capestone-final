import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'ar' | 'fr' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'fr',
      setLanguage: (language) => {
        set({ language });
        if (typeof document !== 'undefined') {
          const dir = language === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = language;
          document.documentElement.dir = dir;
          document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
        }
      },
    }),
    {
      name: 'ricer-language',
      skipHydration: true,
    }
  )
);
