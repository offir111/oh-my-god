/**
 * Last-resort: crop panel thumbnails from a *photo of a screen* (moiré, may duplicate labels).
 * Prefer APK originals copied into public/login (see backups/.../apk-raw-from-install).
 */
const path = require('path');
const { Jimp } = require('jimp');

const src = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, '../public/login');

const PORTRAIT = {
  y0: 0.392,
  y1: 0.518,
  leftX: 0.055,
  leftW: 0.37,
  rightX: 0.575,
  rightW: 0.37,
};

/** Wider screenshots (e.g. 1024×575 browser / tablet) — cards sit center; ignore side margins. */
const LANDSCAPE = {
  y0: 0.26,
  y1: 0.76,
  leftX: 0.1,
  leftW: 0.34,
  rightX: 0.56,
  rightW: 0.34,
};

(async () => {
  if (!src) {
    console.error('Usage: node extract-login-panels-from-screenshot.cjs <screenshot.png> [outDir]');
    process.exit(1);
  }

  const img = await Jimp.read(src);
  const W = img.width;
  const H = img.height;
  console.error(`Source ${W}x${H}`);

  const CROP = W > H ? LANDSCAPE : PORTRAIT;
  console.error(`Using ${W > H ? 'LANDSCAPE' : 'PORTRAIT'} crop preset`);

  const y0 = Math.round(H * CROP.y0);
  const y1 = Math.round(H * CROP.y1);
  const ch = Math.max(80, y1 - y0);

  const lx = Math.round(W * CROP.leftX);
  const lw = Math.round(W * CROP.leftW);
  const rx = Math.round(W * CROP.rightX);
  const rw = Math.round(W * CROP.rightW);

  const leftPanel = img.clone().crop({ x: lx, y: y0, w: lw, h: ch });
  const rightPanel = img.clone().crop({ x: rx, y: y0, w: rw, h: ch });

  const outA = path.join(outDir, 'atheist-einstein.jpg');
  const outB = path.join(outDir, 'believer-two-haredim.jpg');

  await leftPanel.write(outA);
  await rightPanel.write(outB);

  console.error(`Wrote ${outA}`);
  console.error(`Wrote ${outB}`);
})();
