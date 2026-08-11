// Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#12100e"/>
  <g stroke="#d97706" stroke-width="14" stroke-linecap="round">
    <line x1="150" y1="256" x2="256" y2="150"/>
    <line x1="150" y1="256" x2="256" y2="256"/>
    <line x1="150" y1="256" x2="256" y2="362"/>
  </g>
  <circle cx="150" cy="256" r="52" fill="#e7e5e4"/>
  <circle cx="256" cy="150" r="34" fill="#d97706"/>
  <circle cx="256" cy="256" r="34" fill="#d97706"/>
  <circle cx="256" cy="362" r="34" fill="#d97706"/>
  <g stroke="#a8a29e" stroke-width="10" stroke-linecap="round">
    <line x1="290" y1="150" x2="352" y2="118"/>
    <line x1="290" y1="256" x2="352" y2="256"/>
    <line x1="290" y1="362" x2="352" y2="394"/>
  </g>
  <circle cx="374" cy="112" r="22" fill="#a8a29e"/>
  <circle cx="374" cy="256" r="22" fill="#a8a29e"/>
  <circle cx="374" cy="400" r="22" fill="#a8a29e"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });

await sharp(Buffer.from(svg())).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg())).resize(512, 512).png().toFile('public/icons/icon-512.png');
// Maskable: full-bleed background with content in the safe zone.
await sharp(Buffer.from(svg(1))).resize(512, 512).png().toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(svg())).resize(48, 48).png().toFile('src/app/favicon-tmp.png');

console.log('icons generated');
