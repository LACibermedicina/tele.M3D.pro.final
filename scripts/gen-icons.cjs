#!/usr/bin/env node
/**
 * Generates square favicon/icon assets and a social preview image from
 * the existing wordmark PNGs, centering them on a branded square canvas.
 *
 * Output files written to client/public/:
 *   favicon-16x16.png, favicon-32x32.png, favicon-192x192.png,
 *   favicon-512x512.png, apple-touch-icon.png, social-preview.png (1200x630)
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'client', 'public');

// Brand colors (dark indigo/slate theme)
const BG_COLOR = { r: 15, g: 23, b: 42, a: 255 };   // #0f172a (slate-900)
const ACCENT   = { r: 99, g: 102, b: 241, a: 255 };  // #6366f1 (indigo-500)

// ── helpers ──────────────────────────────────────────────────────────────────

function createCanvas(w, h, fill = BG_COLOR) {
  const png = new PNG({ width: w, height: h, filterType: -1 });
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    png.data[off]     = fill.r;
    png.data[off + 1] = fill.g;
    png.data[off + 2] = fill.b;
    png.data[off + 3] = fill.a;
  }
  return png;
}

/**
 * Nearest-neighbour downscale of `src` to (dw x dh).
 */
function resize(src, dw, dh) {
  const dst = createCanvas(dw, dh, { r: 0, g: 0, b: 0, a: 0 });
  const xr = src.width / dw;
  const yr = src.height / dh;
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(Math.floor(dx * xr), src.width - 1);
      const sy = Math.min(Math.floor(dy * yr), src.height - 1);
      const si = (sy * src.width + sx) * 4;
      const di = (dy * dw + dx) * 4;
      dst.data[di]     = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

/**
 * Alpha-composite `src` onto `dst` at offset (ox, oy).
 */
function blit(dst, src, ox, oy) {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const dx = ox + sx;
      const dy = oy + sy;
      if (dx < 0 || dx >= dst.width || dy < 0 || dy >= dst.height) continue;
      const si = (sy * src.width + sx) * 4;
      const di = (dy * dst.width + dx) * 4;
      const sa = src.data[si + 3] / 255;
      const da = dst.data[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) { dst.data[di + 3] = 0; continue; }
      dst.data[di]     = Math.round((src.data[si]     * sa + dst.data[di]     * da * (1 - sa)) / oa);
      dst.data[di + 1] = Math.round((src.data[si + 1] * sa + dst.data[di + 1] * da * (1 - sa)) / oa);
      dst.data[di + 2] = Math.round((src.data[si + 2] * sa + dst.data[di + 2] * da * (1 - sa)) / oa);
      dst.data[di + 3] = Math.round(oa * 255);
    }
  }
}

function savePng(png, filePath) {
  const buf = PNG.sync.write(png);
  fs.writeFileSync(filePath, buf);
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}  (${png.width}x${png.height})`);
}

/**
 * Draw a simple rounded-rectangle background on `png`.
 * Used for the social preview gradient band.
 */
function fillRect(png, x, y, w, h, color) {
  for (let ry = y; ry < y + h; ry++) {
    for (let rx = x; rx < x + w; rx++) {
      if (rx < 0 || rx >= png.width || ry < 0 || ry >= png.height) continue;
      const i = (ry * png.width + rx) * 4;
      png.data[i]     = color.r;
      png.data[i + 1] = color.g;
      png.data[i + 2] = color.b;
      png.data[i + 3] = color.a;
    }
  }
}

// ── load source wordmark ──────────────────────────────────────────────────────

// The shipped wordmark is 512×137 — we use it as source for all icons.
const wmSrc = PNG.sync.read(fs.readFileSync(path.join(PUBLIC, 'favicon-512x512.png')));
// Also try to load the 192 variant as a higher-quality source for small sizes.
let wmSrc192;
try {
  wmSrc192 = PNG.sync.read(fs.readFileSync(path.join(PUBLIC, 'favicon-192x192.png')));
} catch (_) {
  wmSrc192 = wmSrc;
}

// ── generate square icons ────────────────────────────────────────────────────

/**
 * Create a square icon of `size` x `size` with the wordmark centered.
 * The wordmark occupies ~70 % of the square width, preserving aspect ratio.
 */
function makeSquareIcon(size, src) {
  const canvas = createCanvas(size, size, BG_COLOR);

  // target width for wordmark = 70% of square size
  const wmTargetW = Math.round(size * 0.70);
  const wmAspect  = src.width / src.height;
  const wmTargetH = Math.round(wmTargetW / wmAspect);

  const scaledWm = resize(src, wmTargetW, wmTargetH);

  const ox = Math.round((size - wmTargetW) / 2);
  const oy = Math.round((size - wmTargetH) / 2);
  blit(canvas, scaledWm, ox, oy);

  return canvas;
}

const iconSizes = [
  { size: 16,  name: 'favicon-16x16.png',   src: wmSrc192 },
  { size: 32,  name: 'favicon-32x32.png',   src: wmSrc192 },
  { size: 180, name: 'apple-touch-icon.png', src: wmSrc },
  { size: 192, name: 'favicon-192x192.png', src: wmSrc },
  { size: 512, name: 'favicon-512x512.png', src: wmSrc },
];

console.log('\nGenerating square icon assets…');
for (const { size, name, src } of iconSizes) {
  savePng(makeSquareIcon(size, src), path.join(PUBLIC, name));
}

// ── generate social preview (1200 × 630) ─────────────────────────────────────

console.log('\nGenerating social preview (1200×630)…');
const social = createCanvas(1200, 630, BG_COLOR);

// subtle accent stripe at top
fillRect(social, 0, 0, 1200, 6, ACCENT);
// subtle accent stripe at bottom
fillRect(social, 0, 624, 1200, 6, ACCENT);

// Center the wordmark at ~55 % of card width
const swW = Math.round(1200 * 0.55);
const swAspect = wmSrc.width / wmSrc.height;
const swH = Math.round(swW / swAspect);
const scaledSocial = resize(wmSrc, swW, swH);
const sox = Math.round((1200 - swW) / 2);
const soy = Math.round((630 - swH) / 2);
blit(social, scaledSocial, sox, soy);

savePng(social, path.join(PUBLIC, 'social-preview.png'));

console.log('\nDone.\n');
