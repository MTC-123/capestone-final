import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('notification adapters', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllEnvs();
  });

  it('ably/resend/twilio adapters report unconfigured when their env vars are missing', async () => {
    delete process.env.ABLY_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_NUMBER;
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.NOTIFICATIONS_MODE;

    const { ablyAdapter, resendAdapter, twilioAdapter } = await import('@/lib/notifications/adapters');
    expect(ablyAdapter.isConfigured()).toBe(false);
    expect(resendAdapter.isConfigured()).toBe(false);
    expect(twilioAdapter.isConfigured()).toBe(false);
  });

  it('twilioAdapter requires all three env vars', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    delete process.env.TWILIO_WHATSAPP_NUMBER;

    const { twilioAdapter } = await import('@/lib/notifications/adapters');
    expect(twilioAdapter.isConfigured()).toBe(false);

    process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
    const { twilioAdapter: reloaded } = await import('@/lib/notifications/adapters');
    expect(reloaded.isConfigured()).toBe(true);
  });

  it('resendAdapter.send fails fast without a network call when unconfigured', async () => {
    delete process.env.RESEND_API_KEY;
    const { resendAdapter } = await import('@/lib/notifications/adapters');
    const result = await resendAdapter.send({ recipient: 'user@example.com', text: 'hi' });
    expect(result).toEqual({ ok: false, error: 'resend_not_configured' });
  });

  it('getAdapter selects the test adapter set when NOTIFICATIONS_MODE=test', async () => {
    process.env.NOTIFICATIONS_MODE = 'test';
    const { getAdapter } = await import('@/lib/notifications/adapters');
    expect(getAdapter('WHATSAPP').name).toBe('test');
    expect(getAdapter('EMAIL').name).toBe('test');
    expect(getAdapter('IN_APP').name).toBe('test');
  });

  it('getAdapter selects the real adapter set outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.NOTIFICATIONS_MODE;
    const { getAdapter } = await import('@/lib/notifications/adapters');
    expect(getAdapter('WHATSAPP').name).toBe('twilio');
    expect(getAdapter('EMAIL').name).toBe('resend');
    expect(getAdapter('IN_APP').name).toBe('ably');
  });

  it('the test adapter records every message sent through it, tagged with its channel', async () => {
    process.env.NOTIFICATIONS_MODE = 'test';
    const { getAdapter, testOutbox, resetTestOutbox } = await import('@/lib/notifications/adapters');
    resetTestOutbox();

    const result = await getAdapter('WHATSAPP').send({ recipient: 'whatsapp:+212600000001', text: 'hello' });

    expect(result.ok).toBe(true);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ channel: 'WHATSAPP', recipient: 'whatsapp:+212600000001', text: 'hello' });
  });

  it('test adapters are always configured', async () => {
    process.env.NOTIFICATIONS_MODE = 'test';
    const { getAdapter } = await import('@/lib/notifications/adapters');
    expect(getAdapter('EMAIL').isConfigured()).toBe(true);
  });
});
