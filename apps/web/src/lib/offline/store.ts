/**
 * IndexedDB persistence layer for the offline reporting engine.
 *
 * db `ricer-offline`, stores `submissions` (keyed by clientSubmissionId) and
 * `photos` (keyed by id, blobs). See storageAdapter.ts for the underlying
 * native-IndexedDB / in-memory backend selection.
 */
import { getStorageAdapter, OfflineQuotaError, isQuotaExceededError } from '@/lib/offline/storageAdapter';
import type { PhotoRecord, SubmissionRecord } from '@/lib/offline/types';

export { OfflineQuotaError, isQuotaExceededError } from '@/lib/offline/storageAdapter';
export { __setStorageAdapterForTests, MemoryStorageAdapter } from '@/lib/offline/storageAdapter';

async function guardQuota<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OfflineQuotaError) throw err;
    if (isQuotaExceededError(err)) throw new OfflineQuotaError('Storage quota exceeded', { cause: err });
    throw err;
  }
}

// ── Submissions ────────────────────────────────────────────────────────

export async function putSubmission(record: SubmissionRecord): Promise<void> {
  await guardQuota(() => getStorageAdapter().put('submissions', record));
}

export async function getSubmission(clientSubmissionId: string): Promise<SubmissionRecord | undefined> {
  return getStorageAdapter().get<SubmissionRecord>('submissions', clientSubmissionId);
}

export async function getAllSubmissions(): Promise<SubmissionRecord[]> {
  const all = await getStorageAdapter().getAll<SubmissionRecord>('submissions');
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteSubmission(clientSubmissionId: string): Promise<void> {
  await getStorageAdapter().delete('submissions', clientSubmissionId);
}

/** Read-modify-write helper. Throws if the record no longer exists. */
export async function updateSubmission(
  clientSubmissionId: string,
  patch: Partial<SubmissionRecord>
): Promise<SubmissionRecord> {
  const current = await getSubmission(clientSubmissionId);
  if (!current) throw new Error(`No submission ${clientSubmissionId}`);
  const next: SubmissionRecord = { ...current, ...patch };
  await putSubmission(next);
  return next;
}

// ── Photos ─────────────────────────────────────────────────────────────

export async function putPhoto(record: PhotoRecord): Promise<void> {
  await guardQuota(() => getStorageAdapter().put('photos', record));
}

export async function getPhoto(id: string): Promise<PhotoRecord | undefined> {
  return getStorageAdapter().get<PhotoRecord>('photos', id);
}

export async function deletePhoto(id: string): Promise<void> {
  await getStorageAdapter().delete('photos', id);
}

export async function deletePhotosFor(photoIds: string[]): Promise<void> {
  await Promise.all(photoIds.map((id) => deletePhoto(id)));
}

// ── Storage lifetime ──────────────────────────────────────────────────

/**
 * Asks the browser to treat this origin's storage as persistent (best
 * effort — not honoured on all browsers/contexts). Returns whether it was
 * granted; a `false`/unsupported result is not an error, it just means the
 * data is subject to normal eviction under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
