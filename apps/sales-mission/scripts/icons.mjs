// Rasterise the app icon with sharp (a Next dependency). Run from the app:
//   node scripts/icons.mjs
import sharp from "sharp"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const out = fileURLToPath(new URL("../public/icons/", import.meta.url))
mkdirSync(out, { recursive: true })

// A rounded square in the brand blue with the map-pin mark in white. The
// pin is the lucide "map-pin" outline, scaled into the centre.
function svg(size, { rounded, inset }) {
  const r = rounded ? size * 0.22 : 0
  const scale = (size * (1 - inset * 2)) / 24
  const offset = size * inset
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#02378D"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
    <circle cx="12" cy="10" r="3"/>
  </g>
</svg>`
}

writeFileSync(`${out}icon.svg`, svg(512, { rounded: true, inset: 0.2 }))
await sharp(Buffer.from(svg(512, { rounded: true, inset: 0.2 }))).png().toFile(`${out}icon-512.png`)
await sharp(Buffer.from(svg(192, { rounded: true, inset: 0.2 }))).png().toFile(`${out}icon-192.png`)
await sharp(Buffer.from(svg(180, { rounded: false, inset: 0.2 }))).png().toFile(`${out}apple-touch-icon.png`)
// Maskable: the mark inside the 80% safe zone, square, full-bleed colour.
await sharp(Buffer.from(svg(512, { rounded: false, inset: 0.28 }))).png().toFile(`${out}maskable-512.png`)
console.log("icons written to", out)
