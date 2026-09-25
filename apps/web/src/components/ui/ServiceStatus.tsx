'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

type CircuitState = 'closed' | 'open' | 'half_open';

interface ServiceStatusProps {
  serviceName: string;
  statusEndpoint: string;
  pollingInterval?: number; // in milliseconds
}

const STATE_CLASSES: Record<CircuitState, string> = {
  closed: 'border-success/25 bg-success-muted text-success-foreground',
  half_open: 'border-warning/25 bg-warning-muted text-warning-foreground',
  open: 'border-danger/25 bg-danger-muted text-danger-foreground',
};

const STATE_ICONS: Record<CircuitState, IconName> = {
  closed: 'check-circle',
  half_open: 'refresh',
  open: 'warning',
};

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
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
        STATE_CLASSES[state]
      )}
    >
      <Icon name={STATE_ICONS[state]} size={14} aria-hidden />
      <span>
        {serviceName}: {getStatusLabel()}
      </span>
    </div>
  );
}
