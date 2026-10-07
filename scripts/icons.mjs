// Renders the app icon (an ink price tag on cream) at each size it's used.
//
// Each size gets its own SVG with every straight edge on a whole pixel.
// Scaling one big drawing down puts edges between pixels (e.g. at 36.56 px),
// which anti-aliasing turns into a soft grey line, so the icon looks blurry.
//
//   node scripts/icons.mjs                 -> writes public/icons/*.svg sources for checking
//   npx -p sharp-cli sharp ...             -> see README for turning them into PNGs
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#2a2723';
const CREAM = '#f6f3ed';

/** The tag, proportionally, as fractions of the icon size (from the 512 design). */
export function tagSvg(size) {
  const px = (f) => Math.round(f * size);
  const left = px(104 / 512);
  const right = px(326 / 512); // where the point starts
  const tip = px(416 / 512);
  const top = px(164 / 512);
  let bottom = px(348 / 512);
  if ((bottom - top) % 2) bottom += 1; // even height, so the tip's middle is a whole pixel
  const mid = (top + bottom) / 2;
  const holeX = px(156 / 512);
  const holeR = Math.max(1, px(26 / 512));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <path d="M${left} ${top} H${right} L${tip} ${mid} L${right} ${bottom} H${left} Z" fill="${INK}"/>
  <circle cx="${holeX}" cy="${mid}" r="${holeR}" fill="${CREAM}"/>
</svg>
`;
}

export const SIZES = {
  'pwa-64x64': 64,
  'pwa-192x192': 192,
  'pwa-512x512': 512,
  'maskable-icon-512x512': 512,
  'apple-touch-icon-180x180': 180,
};

const outDir = process.argv[2] ?? 'scripts/build';
mkdirSync(outDir, { recursive: true });
for (const [name, size] of Object.entries(SIZES)) {
  writeFileSync(`${outDir}/${name}.svg`, tagSvg(size));
}
writeFileSync('scripts/icon.svg', tagSvg(512));
console.log(`wrote ${Object.keys(SIZES).length} SVGs to ${outDir}`);
