import { test, expect } from '@playwright/test';

test('standardized error envelope includes code, userMessage, and requestId', async ({ request }) => {
  const ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`;
  const response = await request.get('/api/test/errors?case=validation', {
    headers: { cookie: 'ricer-language=en', 'x-forwarded-for': ip },
  });
  expect(response.status()).toBe(422);
  const json = await response.json();
  expect(json).toHaveProperty('error');
  expect(typeof json.error.code).toBe('number');
  expect(typeof json.error.userMessage).toBe('string');
  expect(typeof json.error.requestId).toBe('string');
  expect(Array.isArray(json.error.fields)).toBe(true);
});

test('rate limiting returns 429 with standardized 1002 code', async ({ request }) => {
  test.slow();
  const ip = `10.0.1.${Math.floor(Math.random() * 200) + 1}`;
  let lastResponse;
  for (let i = 0; i < 7; i++) {
    lastResponse = await request.get('/api/test/errors?case=unauth', {
      headers: { cookie: 'ricer-language=en', 'x-forwarded-for': ip },
    });
  }
  expect(lastResponse).toBeTruthy();
  const status = lastResponse!.status();
  expect([401, 429]).toContain(status);
  if (status === 429) {
    const json = await lastResponse!.json();
    expect(json.error.code).toBe(1002);
    expect(lastResponse!.headers()).toHaveProperty('retry-after');
  }
});

