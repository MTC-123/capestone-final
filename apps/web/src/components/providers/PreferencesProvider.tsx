'use client';

import * as React from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import type { Locale, Persona, ThemeMode } from '@/lib/i18n/server';

type Preferences = { locale: Locale; theme: ThemeMode; persona: Persona };

const PreferencesContext = React.createContext<Preferences>({ locale: 'fr', theme: 'light', persona: 'civic' });

export function useServerPreferences() {
  return React.useContext(PreferencesContext);
}

/**
 * Seeds client stores with the language resolved on the server, before any
 * child renders, so server HTML and the first client render agree.
 */
export function PreferencesProvider({ children, ...prefs }: Preferences & { children: React.ReactNode }) {
  // Runs once, before any child renders on the client.
  React.useState(() => {
    if (typeof window !== 'undefined' && useLanguageStore.getState().language !== prefs.locale) {
      useLanguageStore.setState({ language: prefs.locale });
    }
    return true;
  });
  return <PreferencesContext.Provider value={prefs}>{children}</PreferencesContext.Provider>;
}
