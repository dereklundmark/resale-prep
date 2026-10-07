// Renders the app icon at each size it's used: the app's price-tag symbol
// (src/components/TagSymbol.tsx, from Tabler Icons "tag", MIT licence) in ink
// on cream.
//
// Each size gets its own SVG with a whole-number scale, so lines land on the
// pixel grid instead of being shrunk from one big drawing (that blurred the
// edges before).
//
//   node scripts/icons.mjs <dir>     -> writes one SVG per size into <dir>
//   then per SVG: npx -p sharp-cli sharp -i <dir>/<name>.svg -o public/icons/<name>.png
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#2a2723';
const CREAM = '#f6f3ed';
// Same path as TAG_OUTLINE in src/components/TagSymbol.tsx (24 × 24 box).
const TAG =
  'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z';

/**
 * fill = how much of the icon the tag spans. The tag covers x/y 3..21 of
 * its 24 box (18 units), so scale = size × fill / 18, rounded to a whole
 * number of pixels per unit.
 */
export function tagSvg(size, fill = 0.62) {
  const scale = Math.max(1, Math.round((size * fill) / 18));
  const offset = Math.round((size - 18 * scale) / 2 - 3 * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="1"/>
    <path d="${TAG}"/>
  </g>
</svg>
`;
}

// Maskable icons get cropped to circles/squircles on Android, so keep the
// tag well inside the central safe zone there.
export const SIZES = {
  'pwa-64x64': [64, 0.62],
  'pwa-192x192': [192, 0.62],
  'pwa-512x512': [512, 0.62],
  'maskable-icon-512x512': [512, 0.5],
  'apple-touch-icon-180x180': [180, 0.62],
};

const outDir = process.argv[2] ?? 'scripts/build';
mkdirSync(outDir, { recursive: true });
for (const [name, [size, fill]] of Object.entries(SIZES)) {
  writeFileSync(`${outDir}/${name}.svg`, tagSvg(size, fill));
}
writeFileSync('scripts/icon.svg', tagSvg(512));
console.log(`wrote ${Object.keys(SIZES).length} SVGs to ${outDir}`);
