import { cookies, headers } from 'next/headers';

export type Locale = 'ar' | 'fr' | 'en';
export type ThemeMode = 'light' | 'dark';
export type Persona = 'civic' | 'ops';

function pickFromAcceptLanguage(value: string | null): Locale | null {
  if (!value) return null;
  for (const token of value.split(',')) {
    const lang = token.split(';')[0]?.trim().toLowerCase() ?? '';
    if (lang.startsWith('ar')) return 'ar';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('en')) return 'en';
  }
  return null;
}

/**
 * Resolves language, direction and theme for the server render so the first
 * paint is already correct (no flash of the wrong language, direction or
 * colour scheme, and no inline bootstrap script to exempt from the CSP).
 */
export async function getRequestPreferences(): Promise< { locale: Locale; dir: 'rtl' | 'ltr'; theme: ThemeMode; persona: Persona; nonce?: string }> {
  const jar = await cookies();
  const hdrs = await headers();
  const cookieLang = jar.get('ricer-language')?.value;
  const locale: Locale =
    cookieLang === 'ar' || cookieLang === 'fr' || cookieLang === 'en'
      ? cookieLang
      : pickFromAcceptLanguage(hdrs.get('accept-language')) ?? 'fr';

  const persona: Persona = jar.get('ricer-role')?.value === 'OFFICIAL' ? 'ops' : 'civic';
  const cookieTheme = jar.get('ricer-theme')?.value;
  const theme: ThemeMode = cookieTheme === 'light' || cookieTheme === 'dark' ? cookieTheme : persona === 'ops' ? 'dark' : 'light';

  return { locale, dir: locale === 'ar' ? 'rtl' : 'ltr', theme, persona, nonce: hdrs.get('x-nonce') ?? undefined };
}
