import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// MapLibre's bundler-generated worker URL breaks under the Turbopack production
// build. Serve the same worker from /public and point MapLibre at it instead.
const root = process.cwd();
const source = path.join(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const directory = path.join(root, 'public', 'maplibre');
const target = path.join(directory, 'maplibre-gl-worker.mjs');

if (!existsSync(source)) {
  console.warn('MapLibre worker not found, skipping copy.');
  process.exit(0);
}

await mkdir(directory, { recursive: true });
await copyFile(source, target);
console.log('Copied MapLibre worker to public/maplibre/maplibre-gl-worker.mjs');
