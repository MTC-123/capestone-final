/**
 * The offline sync engine.
 *
 * Reports are always written to IndexedDB first (see store.ts) and synced to
 * the server in the background. Every network call reuses the idempotent
 * contracts the server already exposes:
 *  - photo uploads are keyed `${clientSubmissionId}:${index}`, so a retried
 *    upload after a crash returns the same upload instead of creating a
 *    duplicate;
 *  - the report POST carries the same `clientSubmissionId` every time, so a
 *    retried report POST after the server already accepted it comes back as
 *    `duplicate: true`, which this engine treats as success.
 */
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  deletePhotosFor,
  deleteSubmission,
  getAllSubmissions,
  getPhoto,
  getSubmission,
  putPhoto,
  putSubmission,
  updateSubmission,
} from '@/lib/offline/store';
import { emitOfflineChange } from '@/lib/offline/events';
import { backoffDelayMs } from '@/lib/offline/backoff';
import type { EnqueueReportInput, LastSyncError, SubmissionRecord } from '@/lib/offline/types';

/** Automatic retries stop after this many attempts; the item moves to 'failed' and waits for a manual retry. */
export const MAX_AUTO_RETRIES = 8;
/** How long a 'sent' submission is kept around for the local history view. */
export const SENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const SYNC_LOCK_NAME = 'ricer-offline-sync';
const LEASE_KEY = 'ricer-offline-sync-lease';
const LEASE_TTL_MS = 30_000;
const LEASE_OWNER = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

let lastSyncAt: string | undefined;
export function getLastSyncAt(): string | undefined {
  return lastSyncAt;
}

/** Browser connectivity; Node 21+ servers expose `navigator` without `onLine`, which must read as online. */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

// ── Enqueue ───────────────────────────────────────────────────────────

export async function enqueueReport(input: EnqueueReportInput, photos: Blob[]): Promise<string> {
  const clientSubmissionId =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const now = new Date().toISOString();
  const capturedAt = input.capturedAt ?? now;
  const photoIds = photos.map((_, index) => `${clientSubmissionId}:${index}`);

  // Photos first, submission record last — the submission record is the
  // "commit" point; a crash before it lands just leaves orphaned blobs.
  for (let i = 0; i < photos.length; i += 1) {
    const blob = photos[i];
    await putPhoto({
      id: photoIds[i],
      clientSubmissionId,
      blob,
      contentType: blob.type || 'image/jpeg',
      size: blob.size,
      createdAt: now,
    });
  }

  const record: SubmissionRecord = {
    clientSubmissionId,
    createdAt: now,
    capturedAt,
    payload: {
      latitude: input.latitude,
      longitude: input.longitude,
      description: input.description,
      cause: input.cause,
      anonymous: input.anonymous,
      contactPhone: input.contactPhone,
      characteristics: input.characteristics,
    },
    photoIds,
    uploadedPhotoUrls: {},
    state: 'saved',
    attempts: 0,
  };
  await putSubmission(record);
  emitOfflineChange({ type: 'submission-updated', clientSubmissionId });

  if (isOnline()) void syncAll();

  return clientSubmissionId;
}

// ── Outcome classification ───────────────────────────────────────────

type SyncOutcome =
  | { kind: 'retry'; delayMs: number; lastError: LastSyncError }
  | { kind: 'needs_attention'; lastError: LastSyncError };

async function parseErrorBody(response: Response): Promise<{ code?: number; message: string }> {
  try {
    const body = (await response.json()) as { error?: { code?: number; message?: string; userMessage?: string } };
    return {
      code: body?.error?.code,
      message: body?.error?.userMessage || body?.error?.message || `HTTP ${response.status}`,
    };
  } catch {
    return { message: `HTTP ${response.status}` };
  }
}

async function classifyHttpFailure(response: Response, attempts: number): Promise<SyncOutcome> {
  const { code, message } = await parseErrorBody(response);
  const status = response.status;
  const lastError: LastSyncError = { code, message, status };

  if (status === 429) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : backoffDelayMs(attempts);
    return { kind: 'retry', delayMs, lastError };
  }
  if (status === 401) {
    return { kind: 'needs_attention', lastError: { ...lastError, code: code ?? 2000, message: 'sign_in_again' } };
  }
  if (status === 422 || status === 400 || status === 413 || status === 415) {
    return { kind: 'needs_attention', lastError };
  }
  if (status >= 500) {
    return { kind: 'retry', delayMs: backoffDelayMs(attempts), lastError };
  }
  // Any other 4xx is treated as non-retryable to avoid looping forever on something the user must fix.
  return { kind: 'needs_attention', lastError };
}

function classifyNetworkFailure(err: unknown, attempts: number): SyncOutcome {
  const message = err instanceof Error ? err.message : 'network_error';
  return { kind: 'retry', delayMs: backoffDelayMs(attempts), lastError: { message } };
}

async function applyOutcome(record: SubmissionRecord, outcome: SyncOutcome): Promise<SubmissionRecord> {
  if (outcome.kind === 'retry') {
    const exhausted = record.attempts >= MAX_AUTO_RETRIES;
    return updateSubmission(record.clientSubmissionId, {
      state: exhausted ? 'failed' : 'pending',
      lastError: outcome.lastError,
      nextAttemptAt: exhausted ? undefined : new Date(Date.now() + outcome.delayMs).toISOString(),
    });
  }
  return updateSubmission(record.clientSubmissionId, {
    state: 'needs_attention',
    lastError: outcome.lastError,
    nextAttemptAt: undefined,
  });
}

function extFromContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

// ── Per-submission sync ───────────────────────────────────────────────

async function syncSubmission(initial: SubmissionRecord): Promise<void> {
  let record = initial;

  for (let i = 0; i < record.photoIds.length; i += 1) {
    const photoId = record.photoIds[i];
    if (record.uploadedPhotoUrls[photoId]) continue;

    const photo = await getPhoto(photoId);
    if (!photo) {
      record = await updateSubmission(record.clientSubmissionId, {
        state: 'needs_attention',
        lastError: { message: 'missing_photo_data' },
        nextAttemptAt: undefined,
      });
      emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
      return;
    }

    record = await updateSubmission(record.clientSubmissionId, { attempts: record.attempts + 1 });

    let response: Response;
    try {
      const form = new FormData();
      form.append('file', photo.blob, `${photoId}.${extFromContentType(photo.contentType)}`);
      form.append('key', photoId);
      response = await fetchWithAuth('/api/uploads', { method: 'POST', body: form });
    } catch (err) {
      const outcome = classifyNetworkFailure(err, record.attempts);
      record = await applyOutcome(record, outcome);
      emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
      return;
    }

    if (!response.ok) {
      const outcome = await classifyHttpFailure(response, record.attempts);
      record = await applyOutcome(record, outcome);
      emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
      return;
    }

    const json = (await response.json()) as { url: string };
    record = await updateSubmission(record.clientSubmissionId, {
      uploadedPhotoUrls: { ...record.uploadedPhotoUrls, [photoId]: json.url },
    });
    emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
  }

  record = await updateSubmission(record.clientSubmissionId, {
    attempts: record.attempts + 1,
    state: 'pending',
  });

  let response: Response;
  try {
    response = await fetchWithAuth('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSubmissionId: record.clientSubmissionId,
        latitude: record.payload.latitude,
        longitude: record.payload.longitude,
        description: record.payload.description,
        cause: record.payload.cause,
        anonymous: record.payload.anonymous,
        contactPhone: record.payload.contactPhone,
        characteristics: record.payload.characteristics,
        images: record.photoIds.map((id) => record.uploadedPhotoUrls[id]).filter((url): url is string => Boolean(url)),
        capturedAt: record.capturedAt,
      }),
    });
  } catch (err) {
    const outcome = classifyNetworkFailure(err, record.attempts);
    record = await applyOutcome(record, outcome);
    emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
    return;
  }

  if (!response.ok) {
    const outcome = await classifyHttpFailure(response, record.attempts);
    record = await applyOutcome(record, outcome);
    emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
    return;
  }

  // 200 (duplicate: true) and 201 (duplicate: false) are both success —
  // a crash after the server accepted but before we recorded that locally
  // resolves here on the next sync pass.
  const json = (await response.json()) as { report?: { id?: string }; referenceNumber?: string };
  record = await updateSubmission(record.clientSubmissionId, {
    state: 'sent',
    serverReportId: json.report?.id,
    referenceNumber: json.referenceNumber,
    sentAt: new Date().toISOString(),
    lastError: undefined,
    nextAttemptAt: undefined,
  });
  await deletePhotosFor(record.photoIds);
  emitOfflineChange({ type: 'submission-updated', clientSubmissionId: record.clientSubmissionId });
}

// ── Locking (cross-tab) ───────────────────────────────────────────────

function tryAcquireLease(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const now = Date.now();
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as { owner: string; expiresAt: number };
      if (existing.expiresAt > now && existing.owner !== LEASE_OWNER) return false;
    }
    localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: LEASE_OWNER, expiresAt: now + LEASE_TTL_MS }));
    return true;
  } catch {
    return true; // localStorage unavailable/full — don't block sync over the lease itself
  }
}

function releaseLease(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    if (!raw) return;
    const existing = JSON.parse(raw) as { owner: string };
    if (existing.owner === LEASE_OWNER) localStorage.removeItem(LEASE_KEY);
  } catch {
    // ignore
  }
}

async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) {
    return locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return undefined;
      return fn();
    });
  }
  if (!tryAcquireLease()) return undefined;
  try {
    return await fn();
  } finally {
    releaseLease();
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────

export async function purgeExpiredSentSubmissions(): Promise<void> {
  const all = await getAllSubmissions();
  const now = Date.now();
  await Promise.all(
    all
      .filter((r) => r.state === 'sent' && r.sentAt && now - new Date(r.sentAt).getTime() > SENT_RETENTION_MS)
      .map((r) => deleteSubmission(r.clientSubmissionId))
  );
}

// ── syncAll / syncNow ───────────────────────────────────────────────

function isDue(record: SubmissionRecord, now: number, force: boolean): boolean {
  if (record.state !== 'saved' && record.state !== 'pending') return false;
  if (force) return true;
  if (!record.nextAttemptAt) return true;
  return new Date(record.nextAttemptAt).getTime() <= now;
}

let inFlightSync: Promise<void> | null = null;

function runSync(opts: { force: boolean }): Promise<void> {
  if (inFlightSync) return inFlightSync;

  const run = (async () => {
    emitOfflineChange({ type: 'sync-start' });
    await withCrossTabLock(async () => {
      await purgeExpiredSentSubmissions();
      const now = Date.now();
      const submissions = await getAllSubmissions();
      const due = submissions.filter((r) => isDue(r, now, opts.force));
      for (const record of due) {
        // Re-read: a previous iteration (or another tab, before we held the lock) may have changed it.
        const latest = await getSubmission(record.clientSubmissionId);
        if (!latest || !isDue(latest, Date.now(), opts.force)) continue;
        await syncSubmission(latest);
      }
    });
    lastSyncAt = new Date().toISOString();
    emitOfflineChange({ type: 'sync-end', lastSyncAt });
  })();

  inFlightSync = run.finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}

/** Automatic sync pass — respects each submission's backoff (`nextAttemptAt`). */
export function syncAll(): Promise<void> {
  return runSync({ force: false });
}

/** Manual, user-triggered sync pass — ignores backoff so "Retry"/pull-to-refresh feel immediate. */
export function syncNow(): Promise<void> {
  return runSync({ force: true });
}

// ── User actions ─────────────────────────────────────────────────────

/** Re-queues everything stuck on an auth failure, then syncs. Call after the user signs back in. */
export async function resumeAfterAuth(): Promise<void> {
  const all = await getAllSubmissions();
  const authFailed = all.filter((r) => r.state === 'needs_attention' && r.lastError?.status === 401);
  for (const r of authFailed) {
    await updateSubmission(r.clientSubmissionId, { state: 'pending', nextAttemptAt: undefined });
    emitOfflineChange({ type: 'submission-updated', clientSubmissionId: r.clientSubmissionId });
  }
  if (authFailed.length > 0) await syncNow();
}

/** Manual retry for a 'failed' or 'needs_attention' item (e.g. after the user edited it). */
export async function retrySubmission(clientSubmissionId: string): Promise<void> {
  const record = await getSubmission(clientSubmissionId);
  if (!record || record.state === 'sent') return;
  await updateSubmission(clientSubmissionId, { state: 'pending', nextAttemptAt: undefined });
  emitOfflineChange({ type: 'submission-updated', clientSubmissionId });
  await syncNow();
}

/** Patches the report payload of a queued item (e.g. an "Edit" flow fixing a validation error), without touching photos. */
export async function updateSubmissionPayload(
  clientSubmissionId: string,
  patch: Partial<SubmissionRecord['payload']>
): Promise<void> {
  const record = await getSubmission(clientSubmissionId);
  if (!record) return;
  await updateSubmission(clientSubmissionId, { payload: { ...record.payload, ...patch } });
  emitOfflineChange({ type: 'submission-updated', clientSubmissionId });
}

/** Permanently discards a queued submission and its local photo blobs. UI is responsible for confirming with the user first. */
export async function discardSubmission(clientSubmissionId: string): Promise<void> {
  const record = await getSubmission(clientSubmissionId);
  if (!record) return;
  await deletePhotosFor(record.photoIds);
  await deleteSubmission(clientSubmissionId);
  emitOfflineChange({ type: 'submission-removed', clientSubmissionId });
}

// ── Background triggers ─────────────────────────────────────────────

let initialized = false;
let intervalHandle: ReturnType<typeof setInterval> | undefined;

/**
 * Wires up the automatic triggers: `online`, `visibilitychange`, a 30s
 * poll while items are pending, and Background Sync when supported. Safe to
 * call multiple times (e.g. once per mounted hook instance) — it only
 * attaches listeners once per page load.
 */
export function initSyncEngine(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    emitOfflineChange({ type: 'online-changed', online: true });
    void syncAll();
  });
  window.addEventListener('offline', () => {
    emitOfflineChange({ type: 'online-changed', online: false });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncAll();
  });

  intervalHandle = setInterval(() => {
    void getAllSubmissions().then((all) => {
      const hasPending = all.some((r) => r.state === 'saved' || r.state === 'pending');
      if (hasPending) void syncAll();
    });
  }, 30_000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === 'ricer-offline-sync') void syncAll();
    });
    navigator.serviceWorker.ready
      .then((registration) => {
        const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
          .sync;
        return syncManager?.register(SYNC_LOCK_NAME);
      })
      .catch(() => {
        // Background Sync isn't supported everywhere; the online/visibility/interval triggers cover it.
      });
  }
}

/** Test-only: undo initSyncEngine's module-level guards and timers. */
export function __resetSyncEngineForTests(): void {
  initialized = false;
  inFlightSync = null;
  lastSyncAt = undefined;
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = undefined;
}
