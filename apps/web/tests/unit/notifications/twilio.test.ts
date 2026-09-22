/**
 * Unit Tests: Twilio client helper
 *
 * Covers:
 *   - isTwilioConfigured() env-var detection
 *   - getTwilioClient() singleton + error when missing creds
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// Mock the twilio npm module before importing the SUT
const mockTwilioInstance = { messages: { create: vi.fn() } };
vi.mock('twilio', () => ({
  __esModule: true,
  default: vi.fn(() => mockTwilioInstance),
}));

// We need a fresh module for each test because getTwilioClient caches a singleton
async function freshImport() {
  vi.resetModules();
  // Re-register the twilio mock after resetModules
  vi.doMock('twilio', () => ({
    __esModule: true,
    default: vi.fn(() => mockTwilioInstance),
  }));
  return import('@/lib/notifications/twilio');
}

describe('Twilio helper', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ---- isTwilioConfigured ----

  describe('isTwilioConfigured()', () => {
    it('returns true when all three env vars are set', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC_test';
      process.env.TWILIO_AUTH_TOKEN = 'token_test';
      process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
      const { isTwilioConfigured } = await freshImport();
      expect(isTwilioConfigured()).toBe(true);
    });

    it('returns false when TWILIO_ACCOUNT_SID is missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
      const { isTwilioConfigured } = await freshImport();
      expect(isTwilioConfigured()).toBe(false);
    });

    it('returns false when TWILIO_AUTH_TOKEN is missing', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC_test';
      delete process.env.TWILIO_AUTH_TOKEN;
      process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
      const { isTwilioConfigured } = await freshImport();
      expect(isTwilioConfigured()).toBe(false);
    });

    it('returns false when TWILIO_WHATSAPP_NUMBER is missing', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC_test';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      delete process.env.TWILIO_WHATSAPP_NUMBER;
      const { isTwilioConfigured } = await freshImport();
      expect(isTwilioConfigured()).toBe(false);
    });
  });

  // ---- getTwilioClient ----

  describe('getTwilioClient()', () => {
    it('throws when credentials are missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      const { getTwilioClient } = await freshImport();
      expect(() => getTwilioClient()).toThrow('Twilio credentials not configured');
    });

    it('returns a singleton client on repeated calls', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC_test';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      const { getTwilioClient } = await freshImport();

      const first = getTwilioClient();
      const second = getTwilioClient();
      expect(first).toBe(second);
    });
  });
});
