#!/usr/bin/env node
/**
 * Packs the already-generated square 16x16 and 32x32 PNGs into favicon.ico.
 * ICO format reference: https://en.wikipedia.org/wiki/ICO_(file_format)
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'client', 'public');

function readPng(name) {
  return PNG.sync.read(fs.readFileSync(path.join(PUBLIC, name)));
}

function pngToRawPng(png) {
  return PNG.sync.write(png);
}

const icons = [
  { png: readPng('favicon-16x16.png'), size: 16 },
  { png: readPng('favicon-32x32.png'), size: 32 },
];

// Build PNG buffers for each icon
const pngBufs = icons.map(({ png }) => pngToRawPng(png));

// ICO header: RESERVED(2) + TYPE(2)=1 + COUNT(2)
const headerBuf = Buffer.alloc(6);
headerBuf.writeUInt16LE(0, 0);   // reserved
headerBuf.writeUInt16LE(1, 2);   // type = 1 (icon)
headerBuf.writeUInt16LE(icons.length, 4);

// Directory entries: 16 bytes each
const dirEntrySize = 16;
const dirBuf = Buffer.alloc(dirEntrySize * icons.length);
let dataOffset = 6 + dirEntrySize * icons.length;

for (let i = 0; i < icons.length; i++) {
  const { size } = icons[i];
  const imgSize = pngBufs[i].length;
  const entry = dirBuf.slice(i * dirEntrySize, (i + 1) * dirEntrySize);
  entry.writeUInt8(size === 256 ? 0 : size, 0);  // width  (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1);  // height (0 = 256)
  entry.writeUInt8(0, 2);                         // color count (0 = no palette)
  entry.writeUInt8(0, 3);                         // reserved
  entry.writeUInt16LE(1, 4);                      // color planes
  entry.writeUInt16LE(32, 6);                     // bits per pixel
  entry.writeUInt32LE(imgSize, 8);                // size of image data
  entry.writeUInt32LE(dataOffset, 12);            // offset of image data
  dataOffset += imgSize;
}

const out = Buffer.concat([headerBuf, dirBuf, ...pngBufs]);
const dest = path.join(PUBLIC, 'favicon.ico');
fs.writeFileSync(dest, out);
console.log(`wrote ${path.relative(process.cwd(), dest)}  (${out.length} bytes, ${icons.length} images)`);
