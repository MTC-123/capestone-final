'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { ReportFormData } from '@/types/report';
import type { TranslationKey } from '@/i18n/translations';

const CAUSE_LABEL_MAP: Record<string, TranslationKey> = {
  CAMPFIRE_UNATTENDED: 'campfireUnattended',
  CIGARETTE: 'cigarette',
  AGRICULTURAL_BURNING: 'agriculturalBurning',
  ELECTRICAL: 'electrical',
  LIGHTNING: 'lightning',
  ARSON: 'arson',
  EQUIPMENT_MALFUNCTION: 'equipmentMalfunction',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const SIZE_LABELS: Record<string, TranslationKey> = { small: 'sizeSmall', medium: 'sizeMedium', large: 'sizeLarge', very_large: 'sizeVeryLarge' };
const SMOKE_LABELS: Record<string, TranslationKey> = { none: 'smokeNone', light: 'smokeLight', moderate: 'smokeModerate', heavy: 'smokeHeavy' };
const TYPE_LABELS: Record<string, TranslationKey> = { ground: 'typeGround', surface: 'typeSurface', crown: 'typeCrown', unknown: 'typeUnknown' };
const WIND_LABELS: Record<string, TranslationKey> = { calm: 'windCalm', light: 'windLight', moderate: 'windModerate', strong: 'windStrong' };
const THREAT_LABELS: Record<string, TranslationKey> = { structures: 'threatStructures', roads: 'threatRoads', powerlines: 'threatPowerlines', forest: 'threatForest', people: 'threatPeople' };

interface StepReviewProps {
  formData: ReportFormData;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepReview({ formData, onBack, onSubmit, submitting }: StepReviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card tone="elevated" className="p-5 space-y-4">
        {/* Location */}
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t('fireLocation')}</p>
          <p className="text-sm text-foreground">
            {formData.latitude?.toFixed(6)}, {formData.longitude?.toFixed(6)}
          </p>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t('fireDescription')}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{formData.description}</p>
        </div>

        {/* Cause */}
        {formData.cause && (
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t('probableCause')}</p>
            <Badge tone="warning">{t(CAUSE_LABEL_MAP[formData.cause] ?? 'unknown')}</Badge>
          </div>
        )}

        {/* Characteristics */}
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t('fireSize')}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="danger">{t(SIZE_LABELS[formData.characteristics.fireSize])}</Badge>
            <Badge tone="neutral">{t(SMOKE_LABELS[formData.characteristics.smokeLevel])}</Badge>
            <Badge tone="neutral">{t(TYPE_LABELS[formData.characteristics.fireType])}</Badge>
            <Badge tone="neutral">{t(WIND_LABELS[formData.characteristics.windCondition])}</Badge>
          </div>
          {formData.characteristics.nearbyThreats.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {formData.characteristics.nearbyThreats.map((th) => (
                <Badge key={th} tone="danger">{t(THREAT_LABELS[th])}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Photos */}
        {formData.images.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t('addPhotos')}</p>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((src, i) => (
                <div key={i} className="h-16 w-16 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {formData.contactPhone && (
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t('contactPhone')}</p>
            <p className="text-sm text-foreground">{formData.contactPhone}</p>
          </div>
        )}

        {/* Anonymous */}
        {formData.anonymous && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="check-circle" size={16} aria-hidden className="text-primary" />
            {t('reportAnonymously')}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack} disabled={submitting} className="w-full sm:w-auto">
          {t('previousStep')}
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full bg-danger hover:bg-danger/90 sm:w-auto"
        >
          {submitting ? (
            t('submitting')
          ) : (
            <span className="inline-flex items-center gap-2">
              <Icon name="siren" aria-hidden size={18} />
              {t('submitReport')}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
