'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { clientLogger } from '@/lib/observability/clientLogger';

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

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                Something went wrong
              </h1>
            </div>

            <p className="text-sm text-gray-600">
              An unexpected error occurred. Please try reloading the page.
            </p>

            {this.state.requestId && (
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">
                  Request ID:
                </p>
                <div className="flex items-center justify-between bg-white rounded border border-gray-200 px-3 py-2">
                  <code className="text-xs text-gray-800 font-mono">
                    {this.state.requestId}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(this.state.requestId || '');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Include this ID when contacting support
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.resetError}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-gray-600 font-medium">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
