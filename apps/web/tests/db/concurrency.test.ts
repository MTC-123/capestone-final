import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST as assign } from '@/app/api/dispatch/assign/route';
import { POST as createReport } from '@/app/api/reports/route';
import { POST as upload } from '@/app/api/uploads/route';
import { bearer, createUser, resetDb } from './helpers';

// Routing must fail fast so the haversine fallback is used.
beforeAll(() => {
  process.env.GRAPHHOPPER_URL = 'http://127.0.0.1:9';
});
beforeEach(resetDb);

const IFRANE = { type: 'Point', coordinates: [-5.107, 33.527] };

function post(url: string, body: unknown, auth: string, ip: string) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth, 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('dispatch: one vehicle, many simultaneous officials', () => {
  it('assigns the vehicle exactly once under 12 concurrent requests', async () => {
    const officials = await Promise.all(Array.from({ length: 12 }, (_, i) => createUser('OFFICIAL', `DS${String(i).padStart(6, '0')}`)));
    const incident = await prisma.incident.create({ data: { cause: 'UNKNOWN', severity: 4, status: 'ALERTE', location: { type: 'Point', coordinates: [-5.15, 33.42] } } });
    const vehicle = await prisma.vehicle.create({
      data: { callSign: 'FT-RACE-01', type: 'FIRE_TRUCK', status: 'AVAILABLE', capabilities: [], baseLocation: IFRANE, location: IFRANE, capacity: 4000 },
    });

    const responses = await Promise.all(
      officials.map((o, i) => assign(post('/api/dispatch/assign', { incidentId: incident.id, vehicleIds: [vehicle.id] }, bearer(o), `10.1.0.${i}`)))
    );
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s !== 201).every((s) => s === 409)).toBe(true);
    expect(await prisma.dispatch.count({ where: { vehicleId: vehicle.id } })).toBe(1);
    const after = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(after.status).toBe('EN_ROUTE');
    expect(after.assignedTo).toBe(incident.id);
  });

  it('is all-or-nothing when one of several vehicles is already taken', async () => {
    const official = await createUser('OFFICIAL', 'AN123456');
    const incident = await prisma.incident.create({ data: { cause: 'UNKNOWN', severity: 3, status: 'ALERTE', location: IFRANE } });
    const free = await prisma.vehicle.create({ data: { callSign: 'FT-FREE', type: 'FIRE_TRUCK', status: 'AVAILABLE', capabilities: [], location: IFRANE } });
    const busy = await prisma.vehicle.create({ data: { callSign: 'FT-BUSY', type: 'FIRE_TRUCK', status: 'ON_SCENE', capabilities: [], location: IFRANE } });

    const res = await assign(post('/api/dispatch/assign', { incidentId: incident.id, vehicleIds: [free.id, busy.id] }, bearer(official), '10.2.0.1'));
    expect(res.status).toBe(409);
    expect(await prisma.dispatch.count()).toBe(0);
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: free.id } })).status).toBe('AVAILABLE');
  });
});

describe('reports: offline retries are idempotent', () => {
  it('creates exactly one report for 8 concurrent submissions with the same clientSubmissionId', async () => {
    const civilian = await createUser('CIVILIAN', 'ID123456');
    const clientSubmissionId = crypto.randomUUID();
    const body = { clientSubmissionId, latitude: 33.42, longitude: -5.15, description: 'Fumée au-dessus de la cédraie', capturedAt: new Date().toISOString() };

    const responses = await Promise.all(Array.from({ length: 8 }, () => createReport(post('/api/reports', body, bearer(civilian), '10.3.0.1'))));
    const payloads = await Promise.all(responses.map((r) => r.json()));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(new Set(payloads.map((p) => p.report.id)).size).toBe(1);
    expect(await prisma.report.count({ where: { clientSubmissionId } })).toBe(1);
  });

  it('rejects another user replaying someone else’s submission id', async () => {
    const a = await createUser('CIVILIAN', 'RA123456');
    const b = await createUser('CIVILIAN', 'RB123456');
    const clientSubmissionId = crypto.randomUUID();
    const body = { clientSubmissionId, latitude: 33.42, longitude: -5.15, description: 'Smoke near the road' };
    expect((await createReport(post('/api/reports', body, bearer(a), '10.4.0.1'))).status).toBe(201);
    expect((await createReport(post('/api/reports', body, bearer(b), '10.4.0.2'))).status).toBe(409);
  });

  it('rejects reports outside Morocco and photos the reporter does not own', async () => {
    const a = await createUser('CIVILIAN', 'GE123456');
    const out = await createReport(post('/api/reports', { latitude: 48.85, longitude: 2.35, description: 'Paris is not in scope' }, bearer(a), '10.5.0.1'));
    expect(out.status).toBe(422);

    const stranger = await createUser('CIVILIAN', 'ST123456');
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
    form.append('key', 'stranger-photo-0001');
    const up = await upload(new Request('http://localhost/api/uploads', { method: 'POST', headers: { authorization: bearer(stranger) }, body: form }));
    expect(up.status).toBe(201);
    const { url } = await up.json();

    const stolen = await createReport(post('/api/reports', { latitude: 33.42, longitude: -5.15, description: 'Using a photo I do not own', images: [url] }, bearer(a), '10.5.0.2'));
    expect(stolen.status).toBe(422);
  });

  it('deduplicates uploads by idempotency key and refuses non-images', async () => {
    const a = await createUser('CIVILIAN', 'UP123456');
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
    const send = (bytes: Uint8Array, key: string, type = 'image/png') => {
      const form = new FormData();
      form.append("file", new Blob([bytes as BlobPart], { type }), "f");
      form.append('key', key);
      return upload(new Request('http://localhost/api/uploads', { method: 'POST', headers: { authorization: bearer(a) }, body: form }));
    };
    const [first, retry] = await Promise.all([send(png, 'offline-key-0001'), send(png, 'offline-key-0001')]);
    const ids = [(await first.json()).id, (await retry.json()).id];
    expect(ids[0]).toBe(ids[1]);
    expect(await prisma.upload.count()).toBe(1);

    const html = new TextEncoder().encode('<script>alert(1)</script>');
    expect((await send(html, 'offline-key-0002', 'image/png')).status).toBe(415);
  });
});
