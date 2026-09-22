import type { Page } from '@playwright/test';

type Role = 'CIVILIAN' | 'OFFICIAL';

export async function setLanguage(page: Page, language: 'en' | 'fr' | 'ar') {
  await page.addInitScript((lang) => {
    const value = JSON.stringify({ state: { language: lang }, version: 0 });
    window.localStorage.setItem('ricer-language', value);
    document.cookie = `ricer-language=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, language);
}

export async function mockAuthMe(page: Page, role: Role = 'CIVILIAN') {
  const user =
    role === 'OFFICIAL'
      ? {
          id: 'official-1',
          cin: 'OFFICIAL123',
          phone: '+212600000001',
          role: 'OFFICIAL',
          department: 'Operations',
          position: 'Chief',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: 'civilian-1',
          cin: 'CIVILIAN123',
          phone: '+212600000002',
          role: 'CIVILIAN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

export async function mockGeoRoutes(page: Page) {
  const now = new Date().toISOString();

  // Incidents GeoJSON
  await page.route('**/api/geo/incidents', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.105, 33.531] },
            properties: { id: 'inc-1', cause: 'CIGARETTE', severity: 3, status: 'ALERTE', description: 'Forest fire near main road', createdAt: now },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.112, 33.528] },
            properties: { id: 'inc-2', cause: 'LIGHTNING', severity: 2, status: 'ETEINT', description: 'Small brush fire', createdAt: now },
          },
        ],
      }),
    });
  });

  // Resources GeoJSON (empty for civilians)
  await page.route('**/api/geo/resources', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });
  });

  // Infrastructure GeoJSON
  await page.route('**/api/geo/infrastructure', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });
  });

  // Risk basins GeoJSON
  await page.route('**/api/geo/risk-basins', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });
  });

  // Block MapTiler tile requests with 1px blank PNG
  const blankPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );
  await page.route('**/tiles.maptiler.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
  await page.route('**/tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
}

export type MockReport = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  description: string;
  images: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  cause?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    cin: string;
    phone: string;
    role: Role;
    department?: string;
    position?: string;
    createdAt: string;
    updatedAt: string;
  };
};

export async function mockReports(page: Page, initialReports: MockReport[]) {
  let reports = [...initialReports];

  await page.route(/\/api\/reports\/[^/]+\/pdf(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="report-test.pdf"' },
      body: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf8'),
    });
  });

  await page.route(/\/api\/reports(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const cause = url.searchParams.get('cause');
    const filteredReports = reports.filter((report) => {
      if (status && report.status !== status) return false;
      if (cause && report.cause !== cause) return false;
      return true;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: filteredReports, pagination: { cursor: null, hasMore: false, total: filteredReports.length } }),
    });
  });

  await page.route(/\/api\/reports\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    let body: { status?: unknown } | null = null;
    try {
      body = route.request().postDataJSON() as { status?: unknown };
    } catch {
      body = null;
    }
    const status = typeof body?.status === 'string' ? body.status : null;
    if (!id || !status) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { userMessage: 'Invalid request.' } }) });
      return;
    }

    reports = reports.map((r) => (r.id === id ? { ...r, status: status as MockReport['status'] } : r));
    const report = reports.find((r) => r.id === id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ report }),
    });
  });
}

export async function mockWeather(page: Page) {
  await page.route('**/api/weather', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        temperature: 22,
        windSpeed: 14,
        windDirection: 90,
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

export async function mockAnalytics(page: Page) {
  await page.route('**/api/analytics', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timeline: [{ date: new Date().toISOString().slice(0, 10), count: 1 }],
        causes: [{ cause: 'CIGARETTE', count: 1 }],
        stats: { totalIncidents: 1, daysWithFires: 1, dailyAverage: '1.0' },
      }),
    });
  });
}

export async function mockNotifications(page: Page) {
  await page.route('**/api/notifications', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notifications: [
          {
            id: 'notif-1',
            type: 'NEW_REPORT',
            title: 'New fire detected',
            body: 'A fire has been detected near Ifrane forest.',
            read: false,
            createdAt: new Date().toISOString(),
            referenceId: 'report-42',
            referenceUrl: '/reports-list?report=report-42',
          },
          {
            id: 'notif-2',
            type: 'STATUS_CHANGE',
            title: 'Report approved',
            body: 'Your report #42 has been approved by an official.',
            read: true,
            createdAt: new Date(Date.now() - 3600_000).toISOString(),
            referenceId: 'report-42',
            referenceUrl: '/reports-list?report=report-42',
          },
        ],
      }),
    });
  });
}

export async function mockTokenRefresh(page: Page) {
  await page.route('**/api/auth/token', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
}

export async function mockEquipment(page: Page) {
  const now = new Date().toISOString();

  // Equipment API
  await page.route('**/api/equipment', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'eq-1',
              type: 'VPI',
              name: 'VPI-01',
              status: 'OPERATIONNEL',
              quantity: 2,
              department: 'DPEFLCD',
              latitude: 33.53,
              longitude: -5.11,
              lastMaintenance: null,
              notes: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          item: { id: 'eq-new', ...body, createdAt: now, updatedAt: now },
        }),
      });
    } else {
      return route.fallback();
    }
  });

  await page.route('**/api/equipment/*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: { id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 3, department: 'DPEFLCD', createdAt: now, updatedAt: now },
        }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      return route.fallback();
    }
  });

  // Retardant API
  await page.route('**/api/retardant', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'ret-1',
            name: 'Mousse A',
            type: 'MOUSSE',
            quantity: 500,
            unit: 'L',
            storageLocation: 'Dépôt Ifrane',
            storageLat: null,
            storageLng: null,
            expiryDate: null,
            acquisitionDate: '2025-06-01T00:00:00.000Z',
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    });
  });

  // Infrastructure API
  await page.route('**/api/infrastructure', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'infra-1',
            type: 'WATCHTOWER',
            name: 'Tour Nord',
            latitude: 33.54,
            longitude: -5.10,
            status: 'OPERATIONNEL',
            capacity: null,
            capacityUnit: null,
            lastInspectionDate: null,
            notes: 'Near main road',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    });
  });
}

