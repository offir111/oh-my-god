/**
 * remove-bg.mjs
 * Converts login character JPEGs to PNGs with transparent white-background.
 * Run: node scripts/remove-bg.mjs
 */
import { Jimp } from 'jimp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const loginDir = resolve(__dir, '../public/login');

const files = [
  { src: 'atheist-einstein.jpg',       dst: 'atheist-einstein.png' },
  { src: 'believer-two-haredim.jpg',   dst: 'believer-two-haredim.png' },
];

const WHITE_THRESHOLD = 238; // pixels with R,G,B all above this → transparent

for (const { src, dst } of files) {
  const img = await Jimp.read(resolve(loginDir, src));
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
    const r = img.bitmap.data[idx];
    const g = img.bitmap.data[idx + 1];
    const b = img.bitmap.data[idx + 2];
    if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
      img.bitmap.data[idx + 3] = 0; // fully transparent
    }
  });
  await img.write(resolve(loginDir, dst));
  console.log(`✓ ${dst}`);
}
console.log('Done — white backgrounds removed.');
