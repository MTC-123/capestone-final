import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryStorageAdapter, __setStorageAdapterForTests } from '@/lib/offline/storageAdapter';
import { getSubmission, updateSubmission, OfflineQuotaError } from '@/lib/offline/store';
import {
  enqueueReport,
  syncAll,
  syncNow,
  resumeAfterAuth,
  __resetSyncEngineForTests,
} from '@/lib/offline/sync';
import type { EnqueueReportInput } from '@/lib/offline/types';
import { FakeApiServer } from './testServer';

const input: EnqueueReportInput = {
  latitude: 33.53,
  longitude: -5.11,
  description: 'Smoke visible near the ridge',
  cause: 'UNKNOWN',
};

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

describe('offline sync engine', () => {
  let adapter: MemoryStorageAdapter;
  let server: FakeApiServer;
  let uninstall: () => void;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
    __setStorageAdapterForTests(adapter);
    server = new FakeApiServer();
    uninstall = server.install();
    __resetSyncEngineForTests();
    setOnline(true);
  });

  afterEach(() => {
    uninstall();
    __resetSyncEngineForTests();
    vi.useRealTimers();
  });

  it('persists the submission locally even when the network is unreachable', async () => {
    server.queueOverride('/api/reports', { networkError: true, times: 5 });

    const id = await enqueueReport(input, []);
    await syncAll();

    const stored = await getSubmission(id);
    expect(stored).toBeDefined();
    expect(stored?.payload.description).toBe(input.description);
    expect(stored?.state).toBe('pending');
    expect(server.reportCount).toBe(0);
  });

  it('resumes after a crash between the photo upload and the report POST, without re-uploading the photo', async () => {
    const photo = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
    server.queueOverride('/api/reports', { networkError: true, times: 1 });

    const id = await enqueueReport(input, [photo]);
    await syncAll(); // uploads the photo, then "crashes" before the report POST completes

    expect(server.uploadCount).toBe(1);
    let stored = await getSubmission(id);
    expect(stored?.uploadedPhotoUrls[`${id}:0`]).toBeDefined();
    expect(stored?.state).toBe('pending');

    await syncNow(); // resume: only the report POST should run this time
    expect(server.uploadCount).toBe(1); // unchanged — the same key was not re-uploaded
    expect(server.reportCount).toBe(1);
    stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
  });

  it('treats a server duplicate:true response as success (crash after accept, before local update)', async () => {
    const id = await enqueueReport(input, []);
    await syncAll();
    expect(server.reportCount).toBe(1);
    let stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');

    // Simulate the device crashing after the server accepted the report but
    // before the local record was marked 'sent'.
    await updateSubmission(id, { state: 'pending', nextAttemptAt: undefined, sentAt: undefined });
    await syncAll();

    expect(server.reportCount).toBe(1); // no second report created
    stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
  });

  it('422 moves the submission to needs_attention and it is never auto-retried', async () => {
    server.queueOverride('/api/reports', {
      status: 422,
      body: { error: { code: 1001, message: 'Validation failed', userMessage: 'Fix the highlighted fields.' } },
    });

    const id = await enqueueReport(input, []);
    await syncAll();

    let stored = await getSubmission(id);
    expect(stored?.state).toBe('needs_attention');
    expect(stored?.lastError?.code).toBe(1001);

    await syncAll(); // automatic pass must never retry a needs_attention item
    expect(server.reportCount).toBe(0);
    stored = await getSubmission(id);
    expect(stored?.state).toBe('needs_attention');
  });

  it('401 moves to needs_attention, and resumeAfterAuth resumes it once the user signs back in', async () => {
    server.refreshOk = false; // fetchWithAuth's own refresh attempt also fails, so the 401 surfaces
    server.queueOverride('/api/reports', { status: 401, body: { error: { code: 2000, message: 'Authentication required' } } });

    const id = await enqueueReport(input, []);
    await syncAll();

    let stored = await getSubmission(id);
    expect(stored?.state).toBe('needs_attention');
    expect(stored?.lastError?.status).toBe(401);

    server.refreshOk = true; // user signed back in
    await resumeAfterAuth();

    stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
    expect(server.reportCount).toBe(1);
  });

  it('429 honours the retry-after header and does not retry before it elapses', async () => {
    vi.useFakeTimers();
    server.queueOverride('/api/reports', {
      status: 429,
      headers: { 'retry-after': '2' },
      body: { error: { code: 1002, message: 'Too many requests' } },
    });

    const id = await enqueueReport(input, []);
    await syncAll();

    let stored = await getSubmission(id);
    expect(stored?.state).toBe('pending');
    expect(stored?.nextAttemptAt).toBeDefined();
    const delayMs = new Date(stored!.nextAttemptAt!).getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(1900);
    expect(delayMs).toBeLessThanOrEqual(2000);

    await syncAll(); // not due yet
    expect(server.reportCount).toBe(0);

    vi.advanceTimersByTime(2001);
    await syncAll();

    expect(server.reportCount).toBe(1);
    stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
  });

  it('does not double-send when syncAll is called concurrently (lock)', async () => {
    setOnline(false);
    const id = await enqueueReport(input, []); // stays 'saved' — no auto-sync while offline
    setOnline(true);

    await Promise.all([syncAll(), syncAll()]);

    expect(server.reportCount).toBe(1);
    const stored = await getSubmission(id);
    expect(stored?.state).toBe('sent');
  });

  it('surfaces a storage quota error from enqueueReport instead of silently dropping the report', async () => {
    adapter.simulateQuotaExceeded(1);
    await expect(enqueueReport(input, [])).rejects.toBeInstanceOf(OfflineQuotaError);
  });

  it('exactly one report is ever created per clientSubmissionId across retries, duplicates and crashes', async () => {
    server.queueOverride('/api/reports', { networkError: true, times: 1 });
    const id = await enqueueReport(input, []);
    await syncAll(); // fails
    await syncNow(); // succeeds
    await updateSubmission(id, { state: 'pending', nextAttemptAt: undefined, sentAt: undefined }); // simulate crash after accept
    await syncAll(); // sees duplicate:true

    expect(server.reportCount).toBe(1);
    expect(server.reportsByClientId.size).toBe(1);
  });
});
