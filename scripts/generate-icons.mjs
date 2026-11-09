// Generates public/favicon.svg and the PNG icons from one mark.
// Run: node scripts/generate-icons.mjs  (colours = design tokens --color-bg / --color-accent)
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BG = '#0A0E1A'
const ACCENT = '#C8F135'
// Mark (dumbbell-like "H" of four plates) is drawn in 3..21 of a 24 grid; scale 0.75 keeps it
// inside the 80% maskable safe zone.
const mark = `<g transform="translate(12 12) scale(0.75) translate(-12 -12)" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6.5" cy="6.5" r="3.5"/><circle cx="17.5" cy="6.5" r="3.5"/>
    <circle cx="6.5" cy="17.5" r="3.5"/><circle cx="17.5" cy="17.5" r="3.5"/>
    <path d="M6.5 6.5V17.5M17.5 6.5V17.5M6.5 12H17.5"/>
  </g>`
const svg = (rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <rect width="24" height="24" rx="${rx}" fill="${BG}"/>\n  ${mark}\n</svg>\n`

const rounded = svg(5.5) // favicon + "any" icons
const square = svg(0) // full bleed: maskable + apple-touch (OS applies the shape)
writeFileSync('public/favicon.svg', rounded)

const png = (src, size, out) =>
  sharp(Buffer.from(src), { density: 384 }).resize(size, size).png().toFile(`public/${out}`)
await Promise.all([
  png(rounded, 192, 'pwa-192x192.png'),
  png(rounded, 512, 'pwa-512x512.png'),
  png(square, 512, 'pwa-maskable-512x512.png'),
  png(square, 180, 'apple-touch-icon.png'),
])
