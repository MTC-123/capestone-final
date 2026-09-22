import type { ApiErrorResponse, FieldError } from '@/lib/errors/types';

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const userMessage = (error as { userMessage?: unknown }).userMessage;
  return typeof code === 'number' && typeof userMessage === 'string';
}

export function getApiErrorUserMessage(value: unknown, fallback: string): string {
  return isApiErrorResponse(value) ? value.error.userMessage : fallback;
}

export function getApiFieldErrors(value: unknown): FieldError[] {
  return isApiErrorResponse(value) && Array.isArray(value.error.fields) ? value.error.fields : [];
}

export function getApiErrorCode(value: unknown): number | undefined {
  return isApiErrorResponse(value) ? value.error.code : undefined;
}

export function getApiRequestId(value: unknown): string | undefined {
  return isApiErrorResponse(value) ? value.error.requestId : undefined;
}

