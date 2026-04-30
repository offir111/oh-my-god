/**
 * Builds launcher mipmaps from client/public/earth-ring-logo-integrated.png (לוגו הרשת + טבעת).
 * החלף את קובץ המקור בשכבה אחת (ריבוע, עדיף 512px ומעלה) והרץ מחדש.
 * Run from repo root: node scripts/generate-android-launcher-icons.mjs
 */
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { Jimp } = await import(
  pathToFileURL(join(__dirname, '../client/node_modules/jimp/dist/esm/index.js')).href
);
const root = join(__dirname, '..');
const srcLogo = join(root, process.env.OMG_LAUNCHER_SRC || 'client/public/earth-ring-logo-integrated.png');
const resRoot = join(root, 'android/app/src/main/res');

const BG = 0x000000ff; // שחור תואם רקע בלוגו

const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FG = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function main() {
  const base = await Jimp.read(await readFile(srcLogo));

  for (const density of Object.keys(FG)) {
    const fgSize = FG[density];
    const legSize = LEGACY[density];
    const folder = join(resRoot, `mipmap-${density}`);

    const fg = base.clone();
    await fg.cover({ w: fgSize, h: fgSize });
    await fg.write(join(folder, 'ic_launcher_foreground.png'));

    const legacy = new Jimp({ width: legSize, height: legSize, color: BG });
    const thumb = base.clone();
    await thumb.cover({ w: legSize, h: legSize });
    legacy.composite(thumb, 0, 0);
    await legacy.write(join(folder, 'ic_launcher.png'));
    await legacy.clone().write(join(folder, 'ic_launcher_round.png'));
  }

  console.log('Wrote launcher mipmaps from', srcLogo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
