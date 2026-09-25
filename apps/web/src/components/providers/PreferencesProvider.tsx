'use client';

import * as React from 'react';
import type { Locale, Persona, ThemeMode } from '@/lib/i18n/server';

type Preferences = { locale: Locale; theme: ThemeMode; persona: Persona };

const PreferencesContext = React.createContext<Preferences>({ locale: 'fr', theme: 'light', persona: 'civic' });

export function useServerPreferences() {
  return React.useContext(PreferencesContext);
}

/** Exposes the request's resolved locale, theme and persona to client components. */
export function PreferencesProvider({ children, ...prefs }: Preferences & { children: React.ReactNode }) {
  return <PreferencesContext.Provider value={prefs}>{children}</PreferencesContext.Provider>;
}
