'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

type CircuitState = 'closed' | 'open' | 'half_open';

interface ServiceStatusProps {
  serviceName: string;
  statusEndpoint: string;
  pollingInterval?: number; // in milliseconds
}

export function ServiceStatus({
  serviceName,
  statusEndpoint,
  pollingInterval = 30000, // 30 seconds
}: ServiceStatusProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<CircuitState>('closed');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(statusEndpoint);
        const data = await res.json();
        setState(data.circuitState || 'closed');
      } catch {
        // If status check fails, assume service is down
        setState('open');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [statusEndpoint, pollingInterval]);

  const getStatusColor = () => {
    switch (state) {
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'half_open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'closed':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'half_open':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'open':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'closed':
        return t('serviceHealthy');
      case 'half_open':
        return t('serviceRecovering');
      case 'open':
        return t('serviceUnavailable');
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${getStatusColor()}`}
    >
      {getStatusIcon()}
      <span>
        {serviceName}: {getStatusLabel()}
      </span>
    </div>
  );
}
