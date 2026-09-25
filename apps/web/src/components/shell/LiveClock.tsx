'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useNow } from '@/lib/client/browserStores';

const LOCALES = { ar: 'ar-MA', fr: 'fr-MA', en: 'en-GB' } as const;

/** Ifrane local time, updated every 15 s. Renders nothing until mounted to avoid hydration drift. */
export function LiveClock() {
  const { t, language } = useTranslation();
  const timestamp = useNow(15_000);

  if (timestamp === null) return <span className="inline-block h-4 w-24" aria-hidden />;
  const now = new Date(timestamp);

  const time = new Intl.DateTimeFormat(LOCALES[language], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Casablanca',
  }).format(now);
  const date = new Intl.DateTimeFormat(LOCALES[language], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Casablanca',
  }).format(now);

  return (
    <span className="flex items-baseline gap-2 text-xs text-muted-foreground" title={t('localTime')}>
      <span className="font-mono text-[13px] font-medium text-foreground tabular">{time}</span>
      <span className="hidden xl:inline">{date}</span>
    </span>
  );
}
