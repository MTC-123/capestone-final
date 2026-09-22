'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { PhotoUpload } from '@/components/report/PhotoUpload';
import { FIRE_CAUSE_KEYS } from '@/config/constants';
import type { TranslationKey } from '@/i18n/translations';
import type { ReportFormData, NearbyThreat } from '@/types/report';
import {
  FIRE_SIZE_OPTIONS,
  SMOKE_LEVEL_OPTIONS,
  FIRE_TYPE_OPTIONS,
  WIND_CONDITION_OPTIONS,
  NEARBY_THREAT_OPTIONS,
} from '@/types/report';

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

const SIZE_LABELS: Record<string, TranslationKey> = {
  small: 'sizeSmall',
  medium: 'sizeMedium',
  large: 'sizeLarge',
  very_large: 'sizeVeryLarge',
};
const SMOKE_LABELS: Record<string, TranslationKey> = {
  none: 'smokeNone',
  light: 'smokeLight',
  moderate: 'smokeModerate',
  heavy: 'smokeHeavy',
};
const TYPE_LABELS: Record<string, TranslationKey> = {
  ground: 'typeGround',
  surface: 'typeSurface',
  crown: 'typeCrown',
  unknown: 'typeUnknown',
};
const WIND_LABELS: Record<string, TranslationKey> = {
  calm: 'windCalm',
  light: 'windLight',
  moderate: 'windModerate',
  strong: 'windStrong',
};
const THREAT_LABELS: Record<string, TranslationKey> = {
  structures: 'threatStructures',
  roads: 'threatRoads',
  powerlines: 'threatPowerlines',
  forest: 'threatForest',
  people: 'threatPeople',
};

interface StepDetailsProps {
  formData: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  errors: { description?: string; cause?: string };
}

export function StepDetails({ formData, onChange, onNext, onBack, errors }: StepDetailsProps) {
  const { t } = useTranslation();

  const handleThreatToggle = (threat: NearbyThreat) => {
    const current = formData.characteristics.nearbyThreats;
    const next = current.includes(threat)
      ? current.filter((th) => th !== threat)
      : [...current, threat];
    onChange({
      characteristics: { ...formData.characteristics, nearbyThreats: next },
    });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="report-desc" className="text-sm font-semibold text-foreground">
          {t('fireDescription')} <span className="text-danger">*</span>
        </label>
        <textarea
          id="report-desc"
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background placeholder:text-muted-foreground"
          rows={4}
          placeholder={t('descriptionPlaceholder')}
          required
        />
        {errors.description && (
          <p role="alert" className="text-sm font-semibold text-danger">{errors.description}</p>
        )}
      </div>

      {/* Cause */}
      <SelectField
        id="report-cause"
        label={t('probableCause')}
        value={formData.cause}
        onChange={(e) => onChange({ cause: e.target.value })}
        options={[
          { value: '', label: t('selectCause') },
          ...FIRE_CAUSE_KEYS.map((key) => ({
            value: key,
            label: t(CAUSE_LABEL_MAP[key] ?? 'unknown'),
          })),
        ]}
        errorText={errors.cause}
      />

      {/* Fire Characteristics */}
      <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-bold text-foreground">{t('fireSize')}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            id="char-size"
            label={t('fireSize')}
            value={formData.characteristics.fireSize}
            onChange={(e) =>
              onChange({
                characteristics: { ...formData.characteristics, fireSize: e.target.value as typeof formData.characteristics.fireSize },
              })
            }
            options={FIRE_SIZE_OPTIONS.map((v) => ({ value: v, label: t(SIZE_LABELS[v]) }))}
          />

          <SelectField
            id="char-smoke"
            label={t('smokeLevel')}
            value={formData.characteristics.smokeLevel}
            onChange={(e) =>
              onChange({
                characteristics: { ...formData.characteristics, smokeLevel: e.target.value as typeof formData.characteristics.smokeLevel },
              })
            }
            options={SMOKE_LEVEL_OPTIONS.map((v) => ({ value: v, label: t(SMOKE_LABELS[v]) }))}
          />

          <SelectField
            id="char-type"
            label={t('fireType')}
            value={formData.characteristics.fireType}
            onChange={(e) =>
              onChange({
                characteristics: { ...formData.characteristics, fireType: e.target.value as typeof formData.characteristics.fireType },
              })
            }
            options={FIRE_TYPE_OPTIONS.map((v) => ({ value: v, label: t(TYPE_LABELS[v]) }))}
          />

          <SelectField
            id="char-wind"
            label={t('windCondition')}
            value={formData.characteristics.windCondition}
            onChange={(e) =>
              onChange({
                characteristics: { ...formData.characteristics, windCondition: e.target.value as typeof formData.characteristics.windCondition },
              })
            }
            options={WIND_CONDITION_OPTIONS.map((v) => ({ value: v, label: t(WIND_LABELS[v]) }))}
          />
        </div>

        {/* Nearby Threats — checkboxes */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t('nearbyThreats')}</p>
          <div className="flex flex-wrap gap-2">
            {NEARBY_THREAT_OPTIONS.map((threat) => {
              const checked = formData.characteristics.nearbyThreats.includes(threat);
              return (
                <label
                  key={threat}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    checked
                      ? 'border-primary bg-primary-muted text-primary'
                      : 'border-border bg-surface text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleThreatToggle(threat)}
                    className="sr-only"
                  />
                  {t(THREAT_LABELS[threat])}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{t('addPhotos')}</p>
        <PhotoUpload
          images={formData.images}
          onChange={(images) => onChange({ images })}
        />
      </div>

      {/* Contact Phone */}
      <TextField
        id="report-phone"
        type="tel"
        label={t('contactPhone')}
        helperText={t('contactPhoneHelper')}
        value={formData.contactPhone}
        onChange={(e) => onChange({ contactPhone: e.target.value })}
        leadingIcon="phone"
      />

      {/* Anonymous Toggle */}
      <div className="flex items-start gap-3">
        <input
          id="report-anonymous"
          type="checkbox"
          checked={formData.anonymous}
          onChange={(e) => onChange({ anonymous: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
        />
        <label htmlFor="report-anonymous" className="cursor-pointer">
          <span className="text-sm font-semibold text-foreground">{t('reportAnonymously')}</span>
          <p className="text-xs text-muted-foreground">{t('anonymousHelper')}</p>
        </label>
      </div>

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack} className="w-full sm:w-auto">
          {t('previousStep')}
        </Button>
        <Button variant="primary" onClick={onNext} className="w-full sm:w-auto">
          {t('nextStep')}
        </Button>
      </div>
    </div>
  );
}
