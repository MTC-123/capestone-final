const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const accessToken = process.env.ACCESS_TOKEN ?? '';

async function timedGet(path: string) {
  const url = `${baseUrl}${path}`;
  const started = performance.now();
  const res = await fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const durationMs = Math.round(performance.now() - started);
  return { url, res, durationMs };
}

async function assertOk(path: string, maxMs: number) {
  const { url, res, durationMs } = await timedGet(path);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FAIL ${url} -> ${res.status} in ${durationMs}ms\n${text}`);
  }
  if (durationMs > maxMs) {
    throw new Error(`SLOW ${url} -> ${res.status} in ${durationMs}ms (max ${maxMs}ms)`);
  }
  return { url, status: res.status, durationMs };
}

async function main() {
  const results: Array<{ url: string; status: number; durationMs: number }> = [];

  results.push(await assertOk('/api/health', 1000));
  results.push(await assertOk('/api/metrics', 1000));

  results.push(await assertOk('/api/tiles/osm/5/16/11', 100));
  results.push(
    await assertOk(
      '/api/tiles/gibs?layer=MODIS_Terra_CorrectedReflectance_TrueColor&bbox=0,0,1000,1000&width=256&height=256&format=image/jpeg',
      1000
    )
  );

  if (process.env.FIRMS_MAP_KEY) {
    results.push(await assertOk('/api/tiles/firms?layer=fires_viirs&bbox=0,0,1000,1000&width=256&height=256&format=image/png', 1000));
  }

  results.push(await assertOk('/api/tiles/effis?layer=ecmwf007.fwi&bbox=0,0,1000,1000&width=256&height=256&format=image/png', 1000));

  process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(String((error as Error)?.stack ?? error) + '\n');
  process.exitCode = 1;
});

