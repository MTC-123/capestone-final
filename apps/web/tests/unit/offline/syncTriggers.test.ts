import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorageAdapter, __setStorageAdapterForTests } from '@/lib/offline/storageAdapter';
import { enqueueReport, syncAll, initSyncEngine, __resetSyncEngineForTests } from '@/lib/offline/sync';
import { getSubmission } from '@/lib/offline/store';
import { FakeApiServer } from './testServer';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

describe('offline sync engine triggers', () => {
  let server: FakeApiServer;
  let uninstall: () => void;

  beforeEach(() => {
    __setStorageAdapterForTests(new MemoryStorageAdapter());
    server = new FakeApiServer();
    uninstall = server.install();
    __resetSyncEngineForTests();
  });

  afterEach(() => {
    uninstall();
    __resetSyncEngineForTests();
  });

  it('syncs exactly once when the online event fires, even if it fires more than once', async () => {
    setOnline(false);
    const id = await enqueueReport({ latitude: 33.5, longitude: -5.1, description: 'ridge fire' }, []);
    expect((await getSubmission(id))?.state).toBe('saved');

    initSyncEngine();
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online')); // a flaky connection can fire this more than once

    await syncAll(); // join whichever pass is already in flight
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(server.reportCount).toBe(1);
    const stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
  });
});
