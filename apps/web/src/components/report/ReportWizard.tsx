'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { getApiErrorUserMessage } from '@/lib/errors/sdk';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { clientLogger } from '@/lib/observability/clientLogger';
import { ProgressBar } from '@/components/report/ProgressBar';
import { StepLocation } from '@/components/report/StepLocation';
import { StepDetails } from '@/components/report/StepDetails';
import { StepReview } from '@/components/report/StepReview';
import { ConfirmationScreen } from '@/components/report/ConfirmationScreen';
import type { WizardStep, ReportFormData } from '@/types/report';
import { DEFAULT_FORM_DATA } from '@/types/report';

export function ReportWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>('location');
  const [formData, setFormData] = useState<ReportFormData>({ ...DEFAULT_FORM_DATA, characteristics: { ...DEFAULT_FORM_DATA.characteristics } });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<number | undefined>();
  const [requestId, setRequestId] = useState<string | undefined>();
  const [submittedReport, setSubmittedReport] = useState<{ id: string; referenceNumber: string } | null>(null);

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
      const response = await fetchWithAuth('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: formData.latitude,
          longitude: formData.longitude,
          description: formData.description,
          cause: formData.cause || 'UNKNOWN',
          characteristics: formData.characteristics,
          images: formData.images,
          contactPhone: formData.contactPhone || undefined,
          anonymous: formData.anonymous,
        }),
      });

      const responseRequestId = response.headers.get('x-request-id');
      const data = await response.json();

      if (!response.ok) {
        setError(getApiErrorUserMessage(data, t('errorServer')));
        setErrorCode(data.error?.code);
        setRequestId(data.error?.requestId || responseRequestId || undefined);

        clientLogger.error({
          event: 'report_submission_failed',
          route: '/api/reports',
          requestId: responseRequestId || undefined,
          meta: { errorCode: data.error?.code, status: response.status },
        });
        return;
      }

      const reportId = typeof data.report?.id === 'string' ? data.report.id : '';
      setSubmittedReport({
        id: reportId,
        referenceNumber: data.referenceNumber ?? data.report?.referenceNumber ?? '',
      });
    } catch (err) {
      setError(t('connectionError'));

      clientLogger.error({
        event: 'report_submission_exception',
        route: '/api/reports',
        error: {
          name: (err as Error)?.name,
          message: (err as Error)?.message,
          stack: (err as Error)?.stack,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...DEFAULT_FORM_DATA, characteristics: { ...DEFAULT_FORM_DATA.characteristics } });
    setStep('location');
    setSubmittedReport(null);
    setError('');
  };

  // After successful submission — show confirmation
  if (submittedReport !== null) {
    return (
      <ConfirmationScreen
        reportId={submittedReport.id}
        referenceNumber={submittedReport.referenceNumber}
        onReset={handleReset}
      />
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
