import { test as setup, expect } from '@playwright/test';
import { OFFICIAL_STATE, RESIDENT_STATE } from './fixtures';

const personas = [
  { file: OFFICIAL_STATE, cin: 'CD789012' },
  { file: RESIDENT_STATE, cin: 'AB123456' },
];

for (const persona of personas) {
  setup(`sign in ${persona.cin}`, async ({ request }) => {
    const res = await request.post('/api/auth/signin', { data: { cin: persona.cin, password: 'password123' } });
    expect(res.status(), await res.text()).toBe(200);
    await request.storageState({ path: persona.file });
  });
}
