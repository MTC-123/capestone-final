'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { getRiskInfo, getRiskTone } from '@/lib/map/riskLevel';
import type { WeatherData } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

export function EmptyState() {
  const { t } = useTranslation();
  const [risk, setRisk] = useState<{ labelKey: string; tone: 'success' | 'warning' | 'danger' } | null>(null);

  useEffect(() => {
    fetch('/api/weather')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WeatherData | null) => {
        const info = getRiskInfo(data);
        if (info) {
          setRisk({ labelKey: info.labelKey, tone: getRiskTone(info.level) });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Card tone="subtle" className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-muted">
        <Icon name="fire" size={32} className="text-success-foreground" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-foreground">{t('noFireDetections')}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('noFireDetectionsDesc')}
      </p>
      {risk && (
        <Badge tone={risk.tone}>
          {t('riskIndex')}: {t(risk.labelKey as TranslationKey)}
        </Badge>
      )}
    </Card>
  );
}
