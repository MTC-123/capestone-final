'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';

function LocationPickerLoading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-muted rounded-lg">
      {t('loadingMap')}
    </div>
  );
}

const LocationPicker = dynamic(
  () => import('@/components/map/LocationPicker'),
  { ssr: false, loading: () => <LocationPickerLoading /> }
);

interface StepLocationProps {
  location: { lat: number; lng: number } | null;
  onLocationSelect: (lat: number, lng: number) => void;
  onNext: () => void;
}

export function StepLocation({ location, onLocationSelect, onNext }: StepLocationProps) {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const textAlign = isRTL ? 'text-right' : 'text-left';

  return (
    <div className="space-y-4">
      <LocationPicker
        onLocationSelect={onLocationSelect}
        selectedLocation={location || undefined}
        expanded
      />

      {location && (
        <div className={`text-sm text-muted-foreground ${textAlign}`}>
          {t('locationSelected')}: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!location}
          onClick={onNext}
          className="w-full sm:w-auto"
        >
          {t('nextStep')}
        </Button>
      </div>
    </div>
  );
}
