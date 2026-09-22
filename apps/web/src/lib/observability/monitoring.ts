type CaptureContext = {
  requestId?: string;
  route?: string;
  method?: string;
  code?: number;
  severity?: string;
  meta?: Record<string, unknown>;
};

let sentryInitialized = false;

async function initSentry() {
  if (sentryInitialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
      enabled: true,
    });
    sentryInitialized = true;
  } catch {
    sentryInitialized = false;
  }
}

export async function captureException(error: unknown, context: CaptureContext) {
  await initSentry();
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.withScope((scope) => {
      if (context.requestId) scope.setTag('requestId', context.requestId);
      if (context.route) scope.setTag('route', context.route);
      if (context.method) scope.setTag('method', context.method);
      if (context.code) scope.setTag('code', String(context.code));
      if (context.severity) scope.setTag('severity', context.severity);
      if (context.meta) scope.setContext('meta', context.meta as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } catch {
    return;
  }
}

