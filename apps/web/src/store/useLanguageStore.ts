import { create } from 'zustand';

export type Language = 'ar' | 'fr' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

/**
 * Current UI language. The `ricer-language` cookie is the source of truth:
 * the server reads it to render the right language and direction, and
 * PreferencesProvider seeds this store from it on the client.
 */
export const useLanguageStore = create<LanguageState>()((set) => ({
  language: 'fr',
  setLanguage: (language) => {
    set({ language });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  },
}));
