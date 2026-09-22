import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/AppError';
import { getCatalogEntry } from '@/lib/errors/catalog';
import { mapUnknownToAppError } from '@/lib/errors/mapError';
import type { ApiErrorEnvelope, ApiErrorResponse } from '@/lib/errors/types';
import { translations } from '@/i18n/translations';
import { logger } from '@/lib/observability/logger';
import { captureException } from '@/lib/observability/monitoring';
import { checkErrorRateLimit, getClientIp } from '@/lib/errors/rateLimit';

type SupportedLocale = keyof typeof translations;
type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error: ApiErrorEnvelope;
};

function pickLocaleFromAcceptLanguage(value: string | null): SupportedLocale | null {
  if (!value) return null;
  const tokens = value.split(',').map((t) => t.trim().toLowerCase());
  for (const token of tokens) {
    const lang = token.split(';')[0]?.trim();
    if (lang === 'ar' || lang.startsWith('ar-')) return 'ar';
    if (lang === 'fr' || lang.startsWith('fr-')) return 'fr';
    if (lang === 'en' || lang.startsWith('en-')) return 'en';
  }
  return null;
}

function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  const out: Record<string, string> = {};
  const parts = headerValue.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export function getRequestLocale(request: Request): SupportedLocale {
  const cookies = parseCookies(request.headers.get('cookie'));
  const cookieLang = cookies['ricer-language'];
  if (cookieLang === 'ar' || cookieLang === 'fr' || cookieLang === 'en') return cookieLang;
  return pickLocaleFromAcceptLanguage(request.headers.get('accept-language')) ?? 'en';
}

function translate(locale: SupportedLocale, key: string): string {
  const bucket = translations[locale] as Record<string, string>;
  return bucket[key] ?? (translations.en as Record<string, string>)[key] ?? key;
}

function isDebugEnabled(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return request.headers.get('x-debug') === '1';
}

function toProblemDetails(request: Request, entry: ReturnType<typeof getCatalogEntry>, envelope: ApiErrorEnvelope): ProblemDetails {
  const status = entry.httpStatus;
  return {
    type: `https://ricer.app/problems/${entry.code}`,
    title: entry.developerMessage,
    status,
    detail: envelope.userMessage,
    instance: new URL(request.url).pathname,
    error: envelope,
  };
}

export type ApiHandlerContext = { params?: Record<string, string> };

export type ApiHandler<TCtx extends ApiHandlerContext = ApiHandlerContext> = (
  request: Request,
  context?: TCtx
) => Promise<Response>;

export function withApiHandler<TCtx extends ApiHandlerContext>(
  handler: ApiHandler<TCtx>
): ApiHandler<TCtx> {
  return async (request: Request, context?: TCtx) => {
    const requestId =
      request.headers.get('x-request-id') ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`);
    const startedAt = performance.now();
    const locale = getRequestLocale(request);
    const safeContext = (context ?? ({} as TCtx)) as TCtx;

    try {
      const response = await handler(request, safeContext);
      if (response instanceof NextResponse) {
        response.headers.set('x-request-id', requestId);
        response.headers.set('x-response-time-ms', `${Math.max(0, Math.round(performance.now() - startedAt))}`);
        return response;
      }

      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-response-time-ms', `${Math.max(0, Math.round(performance.now() - startedAt))}`);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (err) {
      const appError = mapUnknownToAppError(err);
      const originalEntry = getCatalogEntry(appError.code);
      let entry = originalEntry;
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const route = request.url;
      const ip = getClientIp(request);
      // Skip rate limiting for auth errors (401, 403)
      const shouldRateLimit = entry.httpStatus !== 401 && entry.httpStatus !== 403;
      const limitKey = `${ip}:${entry.code}`;
      const rateLimit = shouldRateLimit
        ? checkErrorRateLimit(limitKey)
        : { limited: false, retryAfterSeconds: 0 };
      const isRateLimited = rateLimit.limited;
      if (isRateLimited) entry = getCatalogEntry(1002);

      const envelope: ApiErrorEnvelope = {
        code: entry.code,
        message: isRateLimited ? entry.developerMessage : appError.message,
        userMessage: translate(locale, entry.userMessageKey),
        severity: entry.severity,
        timestamp: new Date().toISOString(),
        requestId,
        hint: isRateLimited ? entry.remediationHints : appError.hint ?? entry.remediationHints,
        fields: isRateLimited ? undefined : appError.fields,
        meta: isRateLimited ? { originalCode: originalEntry.code } : appError.meta,
      };

      if (isDebugEnabled(request)) {
        envelope.debug = {
          stack: (err as { stack?: unknown })?.stack ? String((err as { stack?: unknown }).stack) : undefined,
          cause: err instanceof AppError ? err.cause : undefined,
        };
      }

      logger.error({
        event: 'api_error',
        requestId,
        route,
        method: request.method,
        code: entry.code,
        severity: entry.severity,
        durationMs,
        meta: appError.meta,
        error: {
          name: (err as { name?: unknown })?.name ? String((err as { name?: unknown }).name) : undefined,
          message: (err as { message?: unknown })?.message ? String((err as { message?: unknown }).message) : undefined,
          stack: (err as { stack?: unknown })?.stack ? String((err as { stack?: unknown }).stack) : undefined,
        },
      });
      void captureException(err, {
        requestId,
        route,
        method: request.method,
        code: entry.code,
        severity: entry.severity,
        meta: appError.meta,
      });

      const body: ApiErrorResponse = { error: envelope };
      const problem = toProblemDetails(request, entry, envelope);
      const responseBody = JSON.stringify({ ...problem, ...body });
      const retryAfterFromMeta =
        entry.code === 1002 && typeof (envelope.meta as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds === 'number'
          ? String((envelope.meta as { retryAfterSeconds: number }).retryAfterSeconds)
          : undefined;
      const headers = new Headers({
        'content-type': 'application/problem+json; charset=utf-8',
        'x-request-id': requestId,
        'x-response-time-ms': `${durationMs}`,
        ...(isRateLimited
          ? { 'retry-after': String(rateLimit.retryAfterSeconds) }
          : retryAfterFromMeta
            ? { 'retry-after': retryAfterFromMeta }
            : {}),
      });

      return new Response(responseBody, { status: entry.httpStatus, headers });
    }
  };
}

