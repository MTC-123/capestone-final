import type { FieldError, RemediationHint } from '@/lib/errors/types';
import { getCatalogEntry } from '@/lib/errors/catalog';

export type AppErrorOptions = {
  message?: string;
  fields?: FieldError[];
  hint?: RemediationHint[];
  meta?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: number;
  readonly fields?: FieldError[];
  readonly hint?: RemediationHint[];
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(code: number, options: AppErrorOptions = {}) {
    const entry = getCatalogEntry(code);
    super(options.message ?? entry.developerMessage);
    this.name = 'AppError';
    this.code = entry.code;
    this.fields = options.fields;
    this.hint = options.hint;
    this.meta = options.meta;
    this.cause = options.cause;
  }
}

export function isAppError(error: unknown): error is AppError {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AppError';
}

export function asAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError(5000, { cause: error });
}

