import { create } from 'zustand';

export type Language = 'ar' | 'fr' | 'en';

interface LanguageState {
  /** null until the user switches language; readers then use the request locale. */
  language: Language | null;
  setLanguage: (lang: Language) => void;
}

/**
 * Current UI language. The `ricer-language` cookie is the source of truth:
 * the server reads it to render the right language and direction, and until
 * the user picks a language here, readers fall back to that request locale
 * (see useLanguage), so no render-time seeding is needed.
 */
export const useLanguageStore = create<LanguageState>()((set) => ({
  language: null,
  setLanguage: (language) => {
    set({ language });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.cookie = `ricer-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  },
}));
