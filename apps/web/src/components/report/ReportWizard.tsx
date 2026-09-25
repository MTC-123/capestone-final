'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';
import { SubmissionStateChip } from '@/components/offline/SubmissionStateChip';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { clientLogger } from '@/lib/observability/clientLogger';
import { ProgressBar } from '@/components/report/ProgressBar';
import { StepLocation } from '@/components/report/StepLocation';
import { StepDetails } from '@/components/report/StepDetails';
import { StepReview } from '@/components/report/StepReview';
import { ConfirmationScreen } from '@/components/report/ConfirmationScreen';
import type { WizardStep, ReportFormData } from '@/types/report';
import { DEFAULT_FORM_DATA } from '@/types/report';

/** Decodes a base64 data URL without fetch(), which the CSP's connect-src would block for data: URLs. */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [header, base64 = ''] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function ReportWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>('location');
  const [formData, setFormData] = useState<ReportFormData>({ ...DEFAULT_FORM_DATA, characteristics: { ...DEFAULT_FORM_DATA.characteristics } });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<number | undefined>();
  const [requestId, setRequestId] = useState<string | undefined>();
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const { items, online, enqueueReport, retry } = useOfflineQueue();
  const queued = queuedId ? items.find((i) => i.clientSubmissionId === queuedId) : undefined;

  // Validation errors for step 2
  const [detailsErrors, setDetailsErrors] = useState<{ description?: string; cause?: string }>({});

  const updateForm = (partial: Partial<ReportFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    updateForm({ latitude: lat, longitude: lng });
  };

  const goToDetails = () => {
    if (formData.latitude == null || formData.longitude == null) return;
    setStep('details');
  };

  const goToReview = () => {
    const errors: { description?: string; cause?: string } = {};
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errors.description = t('descriptionRequired');
    }
    if (Object.keys(errors).length > 0) {
      setDetailsErrors(errors);
      return;
    }
    setDetailsErrors({});
    setStep('review');
  };

  const goBack = (target: WizardStep) => {
    setError('');
    setStep(target);
  };

  const handleSubmit = async () => {
    setError('');
    setErrorCode(undefined);
    setRequestId(undefined);
    setSubmitting(true);

    try {
      // Saved to IndexedDB first; the sync engine uploads photos and posts
      // the report now if online, or as soon as the network returns.
      const photos = await Promise.all(formData.images.map(dataUrlToBlob));
      const id = await enqueueReport(
        {
          latitude: formData.latitude as number,
          longitude: formData.longitude as number,
          description: formData.description,
          cause: formData.cause || 'UNKNOWN',
          characteristics: formData.characteristics as unknown as Record<string, unknown>,
          contactPhone: formData.contactPhone || undefined,
          anonymous: formData.anonymous,
          capturedAt: new Date().toISOString(),
        },
        photos
      );
      setQueuedId(id);
    } catch (err) {
      const quota = (err as Error)?.name === 'QuotaExceededError' || /quota/i.test((err as Error)?.message ?? '');
      setError(quota ? t('errorPayloadTooLarge') : t('connectionError'));
      clientLogger.error({
        event: 'report_enqueue_failed',
        route: '/report',
        error: { name: (err as Error)?.name, message: (err as Error)?.message },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...DEFAULT_FORM_DATA, characteristics: { ...DEFAULT_FORM_DATA.characteristics } });
    setStep('location');
    setQueuedId(null);
    setError('');
  };

  if (queuedId && queued?.state === 'sent') {
    return (
      <ConfirmationScreen
        reportId={queued.serverReportId ?? ''}
        referenceNumber={queued.referenceNumber ?? ''}
        onReset={handleReset}
      />
    );
  }

  if (queuedId) {
    const attention = queued?.state === 'needs_attention' || queued?.state === 'failed';
    return (
      <div className="flex flex-col items-center px-2 py-10 text-center" role="status" aria-live="polite">
        <span
          className={`grid h-16 w-16 place-items-center rounded-2xl ${attention ? 'bg-warning-muted text-warning' : online ? 'bg-primary-muted text-primary' : 'bg-info-muted text-info'}`}
        >
          <Icon name={attention ? 'warning' : online ? 'loading' : 'wifiOff'} size={28} className={!attention && online ? 'animate-spin' : undefined} />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">{t('reportQueuedTitle')}</h2>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          {attention ? queued?.lastError?.message ?? t('reportQueuedAttention') : online ? t('reportQueuedSending') : t('reportQueuedOffline')}
        </p>
        {queued && (
          <div className="mt-4">
            <SubmissionStateChip state={queued.state} />
          </div>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {attention && queued && (
            <Button variant="primary" onClick={() => retry(queued.clientSubmissionId)}>
              <Icon name="refresh" size={16} />
              {t('reportQueuedRetry')}
            </Button>
          )}
          <Button variant="secondary" onClick={handleReset}>
            {t('newReport')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressBar currentStep={step} />

      {error && (
        <ErrorDisplay
          message={error}
          code={errorCode}
          requestId={requestId}
          onRetry={handleSubmit}
          retrying={submitting}
        />
      )}

      {step === 'location' && (
        <StepLocation
          location={formData.latitude != null && formData.longitude != null ? { lat: formData.latitude, lng: formData.longitude } : null}
          onLocationSelect={handleLocationSelect}
          onNext={goToDetails}
        />
      )}

      {step === 'details' && (
        <StepDetails
          formData={formData}
          onChange={updateForm}
          onNext={goToReview}
          onBack={() => goBack('location')}
          errors={detailsErrors}
        />
      )}

      {step === 'review' && (
        <StepReview
          formData={formData}
          onBack={() => goBack('details')}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
