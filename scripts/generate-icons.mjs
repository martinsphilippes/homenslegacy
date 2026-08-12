// Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs
// Concept: the cross at the center of the home — a family under God.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = (fullBleed = false) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#221e1a"/>
      <stop offset="1" stop-color="#0e0c0a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${fullBleed ? 0 : 100}" fill="url(#bg)"/>

  <!-- Roof -->
  <path d="M 96 268 L 256 128 L 416 268" fill="none" stroke="#e7e5e4"
    stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Walls -->
  <path d="M 142 292 V 436 H 370 V 292" fill="none" stroke="#a8a29e"
    stroke-width="30" stroke-linecap="round"/>
  <!-- Cross at the heart of the home -->
  <g stroke="#d97706" stroke-width="34" stroke-linecap="round">
    <line x1="256" y1="240" x2="256" y2="408"/>
    <line x1="192" y1="300" x2="320" y2="300"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });

const opts = { palette: true, colors: 128, compressionLevel: 9 };
await sharp(Buffer.from(svg())).resize(192, 192).png(opts).toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg())).resize(512, 512).png(opts).toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg(true))).resize(512, 512).png(opts).toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(svg())).resize(48, 48).png(opts).toFile('src/app/icon.png');

console.log('icons generated');
