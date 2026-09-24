'use client';

/**
 * React entry point for the offline queue: a zustand store kept in sync with
 * IndexedDB via the events bus (events.ts), so every component using this
 * hook — in this tab or another — sees the same queue state.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import {
  discardSubmission as engineDiscard,
  enqueueReport as engineEnqueueReport,
  getLastSyncAt,
  initSyncEngine,
  resumeAfterAuth as engineResumeAfterAuth,
  retrySubmission as engineRetry,
  syncNow as engineSyncNow,
  updateSubmissionPayload as engineUpdatePayload,
} from '@/lib/offline/sync';
import { getAllSubmissions } from '@/lib/offline/store';
import { subscribeOfflineChanges } from '@/lib/offline/events';
import { emptyCounts } from '@/lib/offline/types';
import type { EnqueueReportInput, SubmissionCounts, SubmissionRecord } from '@/lib/offline/types';

interface OfflineQueueInternalState {
  items: SubmissionRecord[];
  counts: SubmissionCounts;
  online: boolean;
  syncing: boolean;
  lastSyncAt?: string;
  _refresh: () => Promise<void>;
  _setOnline: (online: boolean) => void;
  _setSyncing: (syncing: boolean) => void;
}

function computeCounts(items: SubmissionRecord[]): SubmissionCounts {
  const counts = emptyCounts();
  for (const item of items) counts[item.state] += 1;
  return counts;
}

const useOfflineQueueStore = create<OfflineQueueInternalState>((set, get) => ({
  items: [],
  counts: emptyCounts(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  lastSyncAt: undefined,
  _refresh: async () => {
    const items = await getAllSubmissions();
    set({ items, counts: computeCounts(items), lastSyncAt: getLastSyncAt() ?? get().lastSyncAt });
  },
  _setOnline: (online) => set({ online }),
  _setSyncing: (syncing) => set({ syncing }),
}));

let subscribed = false;
let unsubscribeChanges: (() => void) | undefined;

function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  initSyncEngine();
  void useOfflineQueueStore.getState()._refresh();
  unsubscribeChanges = subscribeOfflineChanges((event) => {
    const s = useOfflineQueueStore.getState();
    switch (event.type) {
      case 'submission-updated':
      case 'submission-removed':
        void s._refresh();
        break;
      case 'sync-start':
        s._setSyncing(true);
        break;
      case 'sync-end':
        s._setSyncing(false);
        void s._refresh();
        break;
      case 'online-changed':
        s._setOnline(event.online);
        break;
      default:
        break;
    }
  });
}

export interface UseOfflineQueueResult {
  /** All queued submissions, oldest first. */
  items: SubmissionRecord[];
  /** Count of items per SubmissionState. */
  counts: SubmissionCounts;
  online: boolean;
  syncing: boolean;
  lastSyncAt?: string;
  enqueueReport: (input: EnqueueReportInput, photos: Blob[]) => Promise<string>;
  syncNow: () => Promise<void>;
  /** Manually retries a 'failed' or 'needs_attention' item. */
  retry: (clientSubmissionId: string) => Promise<void>;
  /** Permanently deletes a queued item and its photos. Caller/UI must confirm with the user first. */
  discard: (clientSubmissionId: string) => Promise<void>;
  /** Edits a queued item's report fields (e.g. fixing a validation error) before retrying. */
  updatePayload: (clientSubmissionId: string, patch: Partial<SubmissionRecord['payload']>) => Promise<void>;
  /** Call after the user signs back in to resume anything stuck on a 401. */
  resumeAfterAuth: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueResult {
  const items = useOfflineQueueStore((s) => s.items);
  const counts = useOfflineQueueStore((s) => s.counts);
  const online = useOfflineQueueStore((s) => s.online);
  const syncing = useOfflineQueueStore((s) => s.syncing);
  const lastSyncAt = useOfflineQueueStore((s) => s.lastSyncAt);

  useEffect(() => {
    ensureSubscribed();
    // Pick up anything that changed before this component mounted.
    void useOfflineQueueStore.getState()._refresh();
  }, []);

  return {
    items,
    counts,
    online,
    syncing,
    lastSyncAt,
    enqueueReport: engineEnqueueReport,
    syncNow: engineSyncNow,
    retry: engineRetry,
    discard: engineDiscard,
    updatePayload: engineUpdatePayload,
    resumeAfterAuth: engineResumeAfterAuth,
  };
}

/** Test-only: reset the module-level subscription guard between test cases. */
export function __resetOfflineQueueForTests(): void {
  subscribed = false;
  unsubscribeChanges?.();
  unsubscribeChanges = undefined;
  useOfflineQueueStore.setState({
    items: [],
    counts: emptyCounts(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
    lastSyncAt: undefined,
  });
}
