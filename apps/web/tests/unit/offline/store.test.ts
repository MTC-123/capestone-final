import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __setStorageAdapterForTests,
  MemoryStorageAdapter,
} from '@/lib/offline/storageAdapter';
import {
  putSubmission,
  getSubmission,
  getAllSubmissions,
  updateSubmission,
  deleteSubmission,
  putPhoto,
  getPhoto,
  deletePhoto,
  requestPersistentStorage,
  OfflineQuotaError,
} from '@/lib/offline/store';
import type { SubmissionRecord } from '@/lib/offline/types';

function makeRecord(id: string): SubmissionRecord {
  return {
    clientSubmissionId: id,
    createdAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    payload: { latitude: 33.5, longitude: -5.1, description: 'test fire' },
    photoIds: [],
    uploadedPhotoUrls: {},
    state: 'saved',
    attempts: 0,
  };
}

describe('offline store', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
    __setStorageAdapterForTests(adapter);
  });

  it('round-trips a submission record', async () => {
    const record = makeRecord('sub-1');
    await putSubmission(record);
    const loaded = await getSubmission('sub-1');
    expect(loaded).toEqual(record);
  });

  it('lists all submissions', async () => {
    await putSubmission(makeRecord('sub-1'));
    await putSubmission(makeRecord('sub-2'));
    const all = await getAllSubmissions();
    expect(all).toHaveLength(2);
  });

  it('updateSubmission merges a patch and persists it', async () => {
    await putSubmission(makeRecord('sub-1'));
    const updated = await updateSubmission('sub-1', { state: 'pending', attempts: 1 });
    expect(updated.state).toBe('pending');
    expect(updated.attempts).toBe(1);
    const reloaded = await getSubmission('sub-1');
    expect(reloaded?.state).toBe('pending');
  });

  it('updateSubmission throws for a missing record', async () => {
    await expect(updateSubmission('missing', { state: 'pending' })).rejects.toThrow();
  });

  it('deletes a submission', async () => {
    await putSubmission(makeRecord('sub-1'));
    await deleteSubmission('sub-1');
    expect(await getSubmission('sub-1')).toBeUndefined();
  });

  it('round-trips a photo blob', async () => {
    const blob = new Blob(['fake-bytes'], { type: 'image/jpeg' });
    await putPhoto({ id: 'sub-1:0', clientSubmissionId: 'sub-1', blob, contentType: 'image/jpeg', size: blob.size, createdAt: new Date().toISOString() });
    const loaded = await getPhoto('sub-1:0');
    expect(loaded?.contentType).toBe('image/jpeg');
    expect(loaded?.size).toBe(blob.size);
    await deletePhoto('sub-1:0');
    expect(await getPhoto('sub-1:0')).toBeUndefined();
  });

  it('surfaces a quota error without silently dropping the write', async () => {
    adapter.simulateQuotaExceeded(1);
    await expect(putSubmission(makeRecord('sub-1'))).rejects.toBeInstanceOf(OfflineQuotaError);
    // The record must NOT have been silently written partially.
    expect(await getSubmission('sub-1')).toBeUndefined();
  });

  it('requestPersistentStorage delegates to navigator.storage.persist and tolerates its absence', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalled();

    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
