'use client';

import React, { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import { clientLogger } from '@/lib/observability/clientLogger';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

function ErrorBoundaryFallback({ requestId, onReset }: { requestId: string | null; onReset: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!requestId) return;
    navigator.clipboard.writeText(requestId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-elev-2">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger-muted text-danger">
            <Icon name="warning" size={22} />
          </span>
          <h1 className="text-lg font-semibold text-foreground">{t('errorBoundaryTitle')}</h1>
        </div>

        <p className="text-sm text-muted-foreground">{t('errorBoundaryBody')}</p>

        {requestId && (
          <div className="space-y-2 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-semibold text-muted-foreground">{t('requestId')}:</p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <code className="font-mono text-xs text-foreground">{requestId}</code>
              <button type="button" onClick={handleCopy} className="shrink-0 text-xs font-medium text-primary hover:underline">
                {copied ? t('copied') : t('copyToClipboard')}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t('errorBoundarySupportHint')}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" onClick={() => window.location.reload()}>
            {t('errorBoundaryReload')}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            {t('errorBoundaryTryAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
  fallback?: (error: Error, requestId: string, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  requestId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      requestId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const requestId = crypto.randomUUID();

    this.setState({ requestId });

    // Log error with structured format
    clientLogger.error({
      event: 'react_error_boundary',
      requestId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      meta: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      requestId: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.requestId || 'unknown',
          this.resetError
        );
      }

      return (
        <>
          <ErrorBoundaryFallback requestId={this.state.requestId} onReset={this.resetError} />
          {process.env.NODE_ENV === 'development' && (
            <details className="mx-auto max-w-md px-4 pb-6">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Error details (development only)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-foreground">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </>
      );
    }

    return this.props.children;
  }
}
