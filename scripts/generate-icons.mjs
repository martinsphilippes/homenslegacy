// Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs
// Concept: a cross above clasped hands — men under God, in partnership.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = (fullBleed = false) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c1917"/>
      <stop offset="1" stop-color="#0e0c0a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${fullBleed ? 0 : 100}" fill="url(#bg)"/>

  <!-- Cross -->
  <g stroke="#d97706" stroke-width="38" stroke-linecap="round">
    <line x1="256" y1="76" x2="256" y2="268"/>
    <line x1="180" y1="140" x2="332" y2="140"/>
  </g>

  <!-- Left forearm -->
  <g stroke="#b8b2ac" stroke-linecap="round" fill="none">
    <line x1="66" y1="412" x2="180" y2="366" stroke-width="60"/>
  </g>
  <!-- Right forearm -->
  <g stroke="#b8b2ac" stroke-linecap="round" fill="none">
    <line x1="446" y1="412" x2="332" y2="366" stroke-width="60"/>
  </g>

  <!-- Clasped hands: horizontal grip in the center -->
  <g stroke="#e7e5e4" stroke-linecap="round">
    <line x1="188" y1="358" x2="324" y2="358" stroke-width="64"/>
  </g>
  <!-- Thumbs locking over the top -->
  <g stroke="#e7e5e4" stroke-width="24" stroke-linecap="round">
    <line x1="206" y1="332" x2="232" y2="342"/>
    <line x1="306" y1="332" x2="280" y2="342"/>
  </g>
  <!-- Interlocked fingers -->
  <g stroke="#7d766e" stroke-width="12" stroke-linecap="round">
    <line x1="226" y1="342" x2="222" y2="378"/>
    <line x1="248" y1="344" x2="244" y2="380"/>
    <line x1="270" y1="344" x2="266" y2="380"/>
    <line x1="290" y1="342" x2="286" y2="378"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });

const opts = { palette: true, colors: 128, compressionLevel: 9 };
await sharp(Buffer.from(svg())).resize(192, 192).png(opts).toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg())).resize(512, 512).png(opts).toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg(true))).resize(512, 512).png(opts).toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(svg())).resize(48, 48).png(opts).toFile('src/app/icon.png');

console.log('icons generated');
