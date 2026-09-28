// pwa-assets-generator writes its PNGs next to the source SVG; move them
// (plus a copy of the SVG itself) into public/icons where the app serves them.
import { copyFileSync, readdirSync, renameSync } from 'node:fs'

const src = new URL('./', import.meta.url)
const dest = new URL('../public/icons/', import.meta.url)

for (const name of readdirSync(src)) {
  if (name.endsWith('.png') || name.endsWith('.ico')) renameSync(new URL(name, src), new URL(name, dest))
}
copyFileSync(new URL('icon.svg', src), new URL('icon.svg', dest))
