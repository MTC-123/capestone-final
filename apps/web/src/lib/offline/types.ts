/**
 * Shared types for the offline-first reporting engine.
 *
 * A "submission" is one queued incident report. It is persisted locally the
 * moment the user finishes the wizard, then synced to the server in the
 * background (immediately if online, later otherwise).
 */

export type SubmissionState =
  | 'saved' // written to IndexedDB, sync not yet attempted
  | 'pending' // sync in progress or scheduled (waiting on backoff / due time)
  | 'sent' // server accepted the report (kept around for 7 days of history)
  | 'failed' // automatic retries exhausted; needs a manual retry
  | 'needs_attention'; // non-retryable server response (validation, auth) — needs user action

/** Report fields the offline engine persists, minus images (handled separately as photos). */
export interface SubmissionPayload {
  latitude: number;
  longitude: number;
  description: string;
  cause?: string;
  anonymous?: boolean;
  contactPhone?: string;
  characteristics?: Record<string, unknown>;
}

export interface LastSyncError {
  /** ApiErrorEnvelope.code from the server, when available. */
  code?: number;
  message: string;
  status?: number;
}

export interface SubmissionRecord {
  clientSubmissionId: string;
  /** ISO timestamp: when the submission was queued on this device. */
  createdAt: string;
  /** ISO timestamp: when the report was actually captured (may predate createdAt if queued while offline). */
  capturedAt: string;
  payload: SubmissionPayload;
  /** Local photo record ids, in the order they should appear in the report. */
  photoIds: string[];
  /** Maps a local photo id to the server upload URL once that photo has been uploaded. */
  uploadedPhotoUrls: Record<string, string>;
  state: SubmissionState;
  /** Number of network attempts made (uploads + report POST) across the lifetime of this submission. */
  attempts: number;
  lastError?: LastSyncError;
  /** ISO timestamp: earliest time the engine should retry automatically. Undefined = due immediately. */
  nextAttemptAt?: string;
  serverReportId?: string;
  referenceNumber?: string;
  /** ISO timestamp: when the server accepted the report. */
  sentAt?: string;
}

export interface PhotoRecord {
  id: string;
  clientSubmissionId: string;
  blob: Blob;
  contentType: string;
  size: number;
  createdAt: string;
}

/** Input accepted by enqueueReport — everything createReportSchema needs except clientSubmissionId/images. */
export interface EnqueueReportInput {
  latitude: number;
  longitude: number;
  description: string;
  cause?: string;
  anonymous?: boolean;
  contactPhone?: string;
  characteristics?: Record<string, unknown>;
  /** ISO timestamp of capture. Defaults to now. */
  capturedAt?: string;
}

export type SubmissionCounts = Record<SubmissionState, number>;

export function emptyCounts(): SubmissionCounts {
  return { saved: 0, pending: 0, sent: 0, failed: 0, needs_attention: 0 };
}
