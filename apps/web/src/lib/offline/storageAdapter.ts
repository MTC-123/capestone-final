/**
 * Storage abstraction for the offline engine.
 *
 * `IndexedDbAdapter` is the real, browser implementation (db `ricer-offline`,
 * stores `submissions` keyed by clientSubmissionId and `photos` keyed by id).
 * `MemoryStorageAdapter` is a tiny in-memory stand-in used automatically
 * whenever `indexedDB` isn't available (jsdom in unit tests doesn't provide
 * it, and `fake-indexeddb` isn't installed in this project), or explicitly
 * via `__setStorageAdapterForTests` when a test wants full control (e.g. to
 * simulate a quota error).
 */

export type StoreName = 'submissions' | 'photos';

export interface StorageAdapter {
  get<T>(storeName: StoreName, key: string): Promise<T | undefined>;
  getAll<T>(storeName: StoreName): Promise<T[]>;
  put<T>(storeName: StoreName, value: T): Promise<void>;
  delete(storeName: StoreName, key: string): Promise<void>;
}

const DB_NAME = 'ricer-offline';
const DB_VERSION = 1;

const STORE_KEY_PATH: Record<StoreName, string> = {
  submissions: 'clientSubmissionId',
  photos: 'id',
};

/** Raised when a write fails because local storage is full. The caller's data is still in memory and must not be dropped silently. */
export class OfflineQuotaError extends Error {
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'OfflineQuotaError';
    this.cause = options?.cause;
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: unknown })?.name;
  if (name === 'QuotaExceededError') return true;
  // Firefox uses a slightly different name in some versions.
  if (typeof name === 'string' && name.toLowerCase().includes('quota')) return true;
  return false;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('submissions')) {
          db.createObjectStore('submissions', { keyPath: STORE_KEY_PATH.submissions });
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: STORE_KEY_PATH.photos });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
  }
  return dbPromise;
}

export class IndexedDbAdapter implements StorageAdapter {
  async get<T>(storeName: StoreName, key: string): Promise<T | undefined> {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readonly');
    const result = await promisifyRequest<T | undefined>(tx.objectStore(storeName).get(key));
    return result ?? undefined;
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readonly');
    const result = await promisifyRequest<T[]>(tx.objectStore(storeName).getAll());
    return result ?? [];
  }

  async put<T>(storeName: StoreName, value: T): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readwrite');
    try {
      await promisifyRequest(tx.objectStore(storeName).put(value));
    } catch (err) {
      if (isQuotaExceededError(err)) throw new OfflineQuotaError('Storage quota exceeded', { cause: err });
      throw err;
    }
  }

  async delete(storeName: StoreName, key: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readwrite');
    await promisifyRequest(tx.objectStore(storeName).delete(key));
  }
}

/** In-memory backend used in tests (jsdom has no indexedDB) and as a graceful fallback. */
export class MemoryStorageAdapter implements StorageAdapter {
  private stores: Record<StoreName, Map<string, unknown>> = {
    submissions: new Map(),
    photos: new Map(),
  };

  /** Test-only hook: make the next N `put` calls throw a quota error. */
  private quotaFailuresRemaining = 0;

  simulateQuotaExceeded(times = 1) {
    this.quotaFailuresRemaining = times;
  }

  async get<T>(storeName: StoreName, key: string): Promise<T | undefined> {
    return this.stores[storeName].get(key) as T | undefined;
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    return Array.from(this.stores[storeName].values()) as T[];
  }

  async put<T>(storeName: StoreName, value: T): Promise<void> {
    if (this.quotaFailuresRemaining > 0) {
      this.quotaFailuresRemaining -= 1;
      const err = new Error('Quota exceeded (simulated)');
      err.name = 'QuotaExceededError';
      throw new OfflineQuotaError('Storage quota exceeded', { cause: err });
    }
    const key = (value as Record<string, unknown>)[STORE_KEY_PATH[storeName]] as string;
    this.stores[storeName].set(key, value);
  }

  async delete(storeName: StoreName, key: string): Promise<void> {
    this.stores[storeName].delete(key);
  }

  /** Test-only helper to reset all data between tests. */
  clearAll() {
    this.stores.submissions.clear();
    this.stores.photos.clear();
  }
}

let adapter: StorageAdapter | null = null;

function createDefaultAdapter(): StorageAdapter {
  if (typeof indexedDB !== 'undefined') return new IndexedDbAdapter();
  return new MemoryStorageAdapter();
}

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) adapter = createDefaultAdapter();
  return adapter;
}

/** Test-only: inject a specific adapter (e.g. a MemoryStorageAdapter primed to throw quota errors). */
export function __setStorageAdapterForTests(next: StorageAdapter | null): void {
  adapter = next;
  dbPromise = null;
}
