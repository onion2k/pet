/**
 * Draws the PWA icons the same way the game draws everything else: in code.
 * The picture is a tiny handheld -- purple shell, dark screen, a pet in it --
 * laid out on a 32x32 grid and then scaled up to whatever size is asked for,
 * so the edges stay crisp at 192 and honest at 512.
 *
 *   node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SHELL = [0x6b, 0x47, 0xb8]
const SHELL_DARK = [0x4a, 0x2f, 0x87]
const BEZEL = [0x2a, 0x1d, 0x4c]
const SCREEN = [0x10, 0x10, 0x14]
const SKY = [0x1b, 0x2c, 0x4a]
const GROUND = [0x2f, 0x6b, 0x4e]
const PET = [0xcd, 0xef, 0xfb]
const EYE = [0x10, 0x10, 0x14]
const BTN_B = [0xd9, 0x52, 0x61]
const BTN = [0x29, 0x2b, 0x3d]
const BACKDROP = [0x08, 0x08, 0x0c]

/** One 32x32 cell of the picture, or null where the icon is transparent. */
function cell(x, y, bleed) {
  // A rounded shell, inset from the edge unless the icon is maskable, in which
  // case it grows to fill the safe zone's worth of room it has been given.
  const inset = bleed ? 1 : 3
  const lo = inset
  const hi = 31 - inset
  if (x < lo || x > hi || y < lo || y > hi) return null
  const r = 4
  const dx = Math.max(lo + r - x, x - (hi - r), 0)
  const dy = Math.max(lo + r - y, y - (hi - r), 0)
  if (dx * dx + dy * dy > r * r) return null

  // Screen: a landscape window in the top two thirds.
  const sx0 = 7
  const sx1 = 24
  const sy0 = 7
  const sy1 = 20
  if (x >= sx0 - 1 && x <= sx1 + 1 && y >= sy0 - 1 && y <= sy1 + 1) {
    if (x < sx0 || x > sx1 || y < sy0 || y > sy1) return BEZEL
    // Inside the screen: sky over ground, with the pet stood on it.
    const horizon = 16
    let c = y > horizon ? GROUND : SKY
    // A blob with two feet and a pair of eyes -- the pet, at this size.
    const bodyX = x >= 13 && x <= 18
    if (bodyX && y >= 11 && y <= horizon) c = PET
    if ((x === 12 || x === 19) && y >= 13 && y <= 15) c = PET
    if (y === horizon + 1 && (x === 14 || x === 17)) c = PET
    if (y === 13 && (x === 14 || x === 17)) c = EYE
    return c
  }

  // Three rubber buttons along the bottom, B in the middle and larger.
  // Squares with their corners knocked off: circles this small come out as
  // plus signs.
  const inButton = (cx, cy, half) => {
    const ax = Math.abs(x - cx)
    const ay = Math.abs(y - cy)
    return ax <= half && ay <= half && ax + ay <= half * 1.6
  }
  if (inButton(9, 26, 2)) return BTN
  if (inButton(16, 26, 3)) return BTN_B
  if (inButton(23, 26, 2)) return BTN

  // The shell itself, lit slightly from above.
  return y < 6 ? SHELL : y > 28 ? SHELL_DARK : SHELL
}

function png(size, bleed, solid) {
  const scale = size / 32
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0 // no filter
    for (let x = 0; x < size; x++) {
      const c = cell(Math.floor(x / scale), Math.floor(y / scale), bleed)
      const p = row + 1 + x * 4
      // iOS squares off its icon and paints the gaps black, so that one is
      // drawn on the site's own background rather than on nothing.
      const d = c ?? (solid ? BACKDROP : null)
      raw[p] = d ? d[0] : 0
      raw[p + 1] = d ? d[1] : 0
      raw[p + 2] = d ? d[2] : 0
      raw[p + 3] = d ? 255 : 0
    }
  }
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12)
    out.writeUInt32BE(body.length, 0)
    out.write(type, 4, 'ascii')
    body.copy(out, 8)
    out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)), 8 + body.length)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const here = resolve(import.meta.dirname, '..', 'public', 'icons')
const files = [
  ['icon-192.png', 192, false, false],
  ['icon-512.png', 512, false, false],
  ['icon-maskable-512.png', 512, true, false],
  ['apple-touch-icon.png', 180, true, true],
]
for (const [name, size, bleed, solid] of files) {
  writeFileSync(resolve(here, name), png(size, bleed, solid))
  console.log(`${name} ${size}x${size}`)
}
