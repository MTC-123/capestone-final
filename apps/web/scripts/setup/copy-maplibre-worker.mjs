// Copies MapLibre's module worker (and the shared chunk it imports) into
// public/maplibre so the browser loads it from our own origin. Runs on
// postinstall so the files always match the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'node_modules', 'maplibre-gl', 'dist');
const dest = join(root, 'public', 'maplibre');
mkdirSync(dest, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log('maplibre worker copied to public/maplibre');
