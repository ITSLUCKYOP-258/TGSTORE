/**
 * Rasterises public/icons/icon.svg into all PWA / browser icon sizes.
 * Requires: sharp  (dev-only, already in devDependencies)
 * Run once: node generate-icons.mjs
 *
 * Outputs in public/icons/:
 *   favicon-32.png          – <link rel="icon">  32 × 32
 *   apple-touch-icon.png    – iOS home-screen    180 × 180
 *   icon-192.png            – PWA manifest       192 × 192
 *   icon-512.png            – PWA manifest       512 × 512  (maskable)
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = resolve(__dirname, 'public/icons');
mkdirSync(dir, { recursive: true });

const svgPath = resolve(dir, 'icon.svg');
const svg = readFileSync(svgPath);

const sizes = [
  { name: 'favicon-32.png',       size: 32  },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(dir, name));
  console.log(`✅  ${name}  (${size}×${size})`);
}

console.log('\nAll icons written to client/public/icons/');

