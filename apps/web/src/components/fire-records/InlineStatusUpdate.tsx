'use client';

import type { RecordStatus } from '@/types';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { useAuthStore } from '@/store/useAuthStore';
import { RecordStatusBadge } from './RecordStatusBadge';

interface InlineStatusUpdateProps {
  recordId: string;
  status: RecordStatus;
}

export function InlineStatusUpdate({ recordId, status }: InlineStatusUpdateProps) {
  const { user } = useAuthStore();
  const { updateRecordStatus } = useFireRecordStore();

  const canVerify = user?.role === 'OFFICIAL' && status === 'DRAFT';

  const handleClick = () => {
    if (canVerify) {
      updateRecordStatus(recordId, 'VERIFIED');
    }
  };

  return (
    <RecordStatusBadge
      status={status}
      interactive={canVerify}
      onClick={canVerify ? handleClick : undefined}
    />
  );
}
