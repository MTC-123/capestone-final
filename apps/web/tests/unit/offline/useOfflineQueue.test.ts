import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryStorageAdapter, __setStorageAdapterForTests } from '@/lib/offline/storageAdapter';
import { __resetSyncEngineForTests } from '@/lib/offline/sync';
import { useOfflineQueue, __resetOfflineQueueForTests } from '@/lib/offline/useOfflineQueue';
import { FakeApiServer } from './testServer';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

describe('useOfflineQueue', () => {
  let server: FakeApiServer;
  let uninstall: () => void;

  beforeEach(() => {
    __setStorageAdapterForTests(new MemoryStorageAdapter());
    server = new FakeApiServer();
    uninstall = server.install();
    __resetSyncEngineForTests();
    __resetOfflineQueueForTests();
    setOnline(true);
  });

  afterEach(() => {
    uninstall();
    __resetSyncEngineForTests();
    __resetOfflineQueueForTests();
  });

  it('reflects an enqueued report and its counts, then reaches sent after syncing', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.items).toHaveLength(0);
    expect(result.current.counts.saved).toBe(0);

    await act(async () => {
      await result.current.enqueueReport(
        { latitude: 33.5, longitude: -5.1, description: 'Fire near the reservoir' },
        []
      );
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.state).toBe('sent');
    });

    expect(result.current.counts.sent).toBe(1);
    expect(server.reportCount).toBe(1);
  });

  it('discard removes a queued item', async () => {
    server.queueOverride('/api/reports', { networkError: true, times: 5 });
    const { result } = renderHook(() => useOfflineQueue());

    let id = '';
    await act(async () => {
      id = await result.current.enqueueReport(
        { latitude: 33.5, longitude: -5.1, description: 'Fire near the reservoir' },
        []
      );
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    await act(async () => {
      await result.current.discard(id);
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
    });
  });
});
