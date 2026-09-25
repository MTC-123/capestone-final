'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

interface ErrorDisplayProps {
  message: string;
  code?: number;
  requestId?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorDisplay({
  message,
  code,
  requestId,
  onRetry,
  retrying = false,
}: ErrorDisplayProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!requestId) return;

    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="rounded-2xl border border-danger/25 bg-danger-muted p-4" role="alert">
      <div className="flex items-start gap-3">
        <Icon name="warning" size={20} className="mt-0.5 shrink-0 text-danger" />

        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-danger-foreground">{message}</p>

          {(code || requestId) && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-medium text-danger-foreground underline decoration-danger/40 underline-offset-2 hover:decoration-danger"
            >
              {showDetails ? t('hideDetails') : t('showDetails')}
            </button>
          )}

          {showDetails && (code || requestId) && (
            <div className="space-y-2 border-t border-danger/20 pt-2">
              {code && (
                <div className="text-xs">
                  <span className="font-semibold text-danger-foreground">{t('errorCode')}:</span>{' '}
                  <span className="font-mono text-danger-foreground/90 tabular">{code}</span>
                  <a
                    href={`/error-codes#${code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-2 text-danger-foreground underline underline-offset-2 hover:no-underline"
                  >
                    {t('learnMore')}
                  </a>
                </div>
              )}

              {requestId && (
                <div className="text-xs">
                  <div className="mb-1 font-semibold text-danger-foreground">
                    {t('requestId')}:
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5">
                    <code className="flex-1 break-all font-mono text-xs text-foreground">
                      {requestId}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="shrink-0 font-medium text-danger-foreground hover:text-danger"
                    >
                      {copied ? t('copied') : t('copyToClipboard')}
                    </button>
                  </div>
                  <p className="mt-1 text-danger-foreground/80">{t('includeRequestIdInSupport')}</p>
                </div>
              )}
            </div>
          )}

          {onRetry && (
            <Button type="button" variant="danger" size="sm" onClick={onRetry} disabled={retrying} isLoading={retrying}>
              {retrying ? t('retrying') : t('retry')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
