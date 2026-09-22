'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

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
    <div className="border border-red-200 bg-red-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-red-900">{message}</p>

          {(code || requestId) && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-red-700 hover:text-red-800 font-medium underline"
            >
              {showDetails ? t('hideDetails') : t('showDetails')}
            </button>
          )}

          {showDetails && (code || requestId) && (
            <div className="space-y-2 pt-2 border-t border-red-200">
              {code && (
                <div className="text-xs">
                  <span className="font-semibold text-red-900">{t('errorCode')}:</span>{' '}
                  <span className="text-red-700">{code}</span>
                  <a
                    href={`/error-codes#${code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-red-600 hover:text-red-700 underline"
                  >
                    Learn more
                  </a>
                </div>
              )}

              {requestId && (
                <div className="text-xs">
                  <div className="font-semibold text-red-900 mb-1">
                    {t('requestId')}:
                  </div>
                  <div className="flex items-center gap-2 bg-red-100 rounded px-2 py-1.5">
                    <code className="flex-1 text-red-900 font-mono text-xs break-all">
                      {requestId}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 text-red-600 hover:text-red-700 font-medium"
                    >
                      {copied ? '✓' : t('copyToClipboard')}
                    </button>
                  </div>
                  <p className="text-red-600 mt-1">{t('includeRequestIdInSupport')}</p>
                </div>
              )}
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="text-sm bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
            >
              {retrying ? t('retrying') : t('retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
