import { GROUNDS } from '../data/grounds'

/**
 * A map of the meadow, drawn the way a booklet's endpapers would draw one.
 *
 * Everything on it is somewhere the game actually puts something: the clearing
 * the pet roams, the band of standing room the visitors use, the lantern row
 * behind it, the shelter off to one side, and the four grounds over the hill.
 * The four are laid out by how far off they are, because distance is what the
 * player is choosing between when they pick one.
 */

const INK = '#3f3357'

/** Where each ground's pin card sits. Laid out by how far the walk is, since
 *  distance is what the player is choosing between when they pick one. */
const PINS: Record<string, [number, number]> = {
  wall: [168, 380],
  hollow: [380, 306],
  creek: [742, 336],
  hill: [618, 178],
}

const tuft = (x: number, y: number, colour = '#7ecf58') =>
  `<path d="M${x} ${y} l3 -8 l3 8" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round"/>`

const tree = (x: number, y: number, scale = 1) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-5" y="-4" width="10" height="24" rx="4" fill="#8a6242" stroke="${INK}" stroke-width="3"/>
    <circle cx="0" cy="-18" r="24" fill="#4fb36b" stroke="${INK}" stroke-width="3"/>
    <circle cx="-13" cy="-6" r="15" fill="#66c47d" stroke="${INK}" stroke-width="3"/>
    <circle cx="14" cy="-8" r="14" fill="#66c47d" stroke="${INK}" stroke-width="3"/>
  </g>`

const toadstool = (x: number, y: number) => `
  <g transform="translate(${x} ${y})">
    <rect x="-3" y="0" width="6" height="11" rx="3" fill="#f6e6c8" stroke="${INK}" stroke-width="2.5"/>
    <path d="M-10 1 a10 8 0 0 1 20 0 Z" fill="#e2604f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  </g>`

const lantern = (x: number, y: number) => `
  <g transform="translate(${x} ${y})">
    <rect x="-2" y="-14" width="4" height="16" rx="2" fill="#4a3b2c"/>
    <circle cx="0" cy="-18" r="7" fill="#ffd66b" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="0" cy="-18" r="13" fill="#ffd66b" opacity="0.22"/>
  </g>`

/** A pin card: the ground's name, who may go, and what the walk costs. */
function pin(x: number, y: number, title: string, note: string, tint: string): string {
  // Wide enough for whichever of the two lines is longer, since the note --
  // who may go, and what the walk costs -- is usually the longer of them.
  const w = Math.max(150, title.length * 10 + 40, note.length * 6.4 + 26)
  return `
  <g transform="translate(${x - w / 2} ${y})">
    <rect x="0" y="0" width="${w}" height="46" rx="14" fill="#fffaf0" stroke="${INK}" stroke-width="3"/>
    <rect x="0" y="0" width="${w}" height="10" rx="5" fill="${tint}"/>
    <text x="${w / 2}" y="27" text-anchor="middle" class="pin-name">${title}</text>
    <text x="${w / 2}" y="39" text-anchor="middle" class="pin-note">${note}</text>
  </g>`
}

const trail = (path: string) =>
  `<path d="${path}" fill="none" stroke="#e8d5a8" stroke-width="9" stroke-linecap="round"/>
   <path d="${path}" fill="none" stroke="#b99b63" stroke-width="9" stroke-linecap="round" stroke-dasharray="2 20"/>`

export function meadowMap(): string {
  const tints: Record<string, string> = {
    wall: '#c9c2b4',
    hollow: '#e2a04f',
    creek: '#7fd6ff',
    hill: '#a4d977',
  }

  const pins = GROUNDS.map((g) => {
    const [x, y] = PINS[g.id]!
    const who = g.from === 'child' ? 'CHILD OR ADULT' : 'ADULT ONLY'
    return pin(x, y, g.name.toUpperCase(), `${who}  ·  ${g.energy} ENERGY`, tints[g.id]!)
  }).join('')

  return `
<svg viewBox="0 0 900 640" role="img" aria-label="A map of the meadow: the yard, and the four grounds over the hill." class="map">
  <defs>
    <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcf2be"/>
      <stop offset="1" stop-color="#a8dd76"/>
    </linearGradient>
    <clipPath id="sheet"><rect x="3" y="3" width="894" height="634" rx="24"/></clipPath>
  </defs>

  <rect x="0" y="0" width="900" height="640" rx="26" fill="url(#far)"/>
  <g clip-path="url(#sheet)">
    ${Array.from({ length: 84 }, (_, i) =>
      tuft(((i * 137) % 860) + 20, ((i * 71) % 560) + 40, i % 4 ? '#8fd964' : '#6cbe4c'),
    ).join('')}

    <!-- the creek, running down out of the hills -->
    <path d="M842 150 q-80 80 -66 150 q14 66 -76 112 q-74 40 -60 108" fill="none" stroke="#7fd6ff" stroke-width="18" stroke-linecap="round"/>
    <path d="M842 150 q-80 80 -66 150 q14 66 -76 112 q-74 40 -60 108" fill="none" stroke="#c6ecff" stroke-width="7" stroke-linecap="round"/>

    <!-- the long hill, with the whole meadow laid out below it -->
    <path d="M486 152 q132 -122 264 0 Z" fill="#9ed46f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M556 116 q62 -54 124 0" fill="none" stroke="#7cbb52" stroke-width="5" stroke-linecap="round"/>
    <circle cx="790" cy="72" r="16" fill="#fff3c4" stroke="${INK}" stroke-width="3"/>
    <path d="M790 48 v-12 M790 96 v12 M766 72 h-12 M814 72 h12" stroke="#e9c35a" stroke-width="4" stroke-linecap="round"/>

    <!-- the hollow: a sheltered dip full of trees -->
    <ellipse cx="380" cy="232" rx="146" ry="62" fill="#8fca6a" stroke="${INK}" stroke-width="3" stroke-dasharray="10 9"/>
    ${tree(310, 244, 0.95)}${tree(382, 226, 1.2)}${tree(452, 246, 0.9)}
    ${toadstool(288, 268)}${toadstool(470, 270)}

    <!-- the old wall -->
    <g transform="translate(78 288)">
      ${Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) =>
          `<rect x="${c * 28 + (r % 2 ? 14 : 0)}" y="${r * 13}" width="25" height="11" rx="4" fill="${
            (r + c) % 3 ? '#cfc7b7' : '#b8ad9b'
          }" stroke="${INK}" stroke-width="2.5"/>`,
        ).join(''),
      ).join('')}
    </g>

    <!-- the trails out, and the ridge with the gap the pet goes through -->
    ${trail('M450 424 q-140 26 -196 -16')}
    ${trail('M450 424 q-44 -50 -58 -84')}
    ${trail('M450 424 q186 26 268 -50')}
    ${trail('M450 424 q98 -104 152 -218')}

    <path d="M40 434 q168 -44 328 -14 M532 420 q168 -30 328 14" fill="none" stroke="#84c85f" stroke-width="16" stroke-linecap="round"/>
    <text x="450" y="416" text-anchor="middle" class="map-whisper">OVER THE HILL</text>

    <!-- the yard -->
    <rect x="196" y="452" width="508" height="170" rx="26" fill="#a5dd6d" stroke="${INK}" stroke-width="4"/>
    <text x="450" y="478" text-anchor="middle" class="map-title">THE YARD</text>

    <ellipse cx="450" cy="558" rx="210" ry="45" fill="#c7ef97" stroke="#7cbb52" stroke-width="3"/>
    <ellipse cx="450" cy="560" rx="176" ry="30" fill="none" stroke="#8fd964" stroke-width="3" stroke-dasharray="8 8"/>

    <!-- the verge: standing room for whatever is visiting -->
    <line x1="240" y1="518" x2="660" y2="518" stroke="#f2e2bb" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 14"/>
    ${lantern(272, 518)}${lantern(324, 518)}${lantern(376, 518)}${lantern(524, 518)}${lantern(576, 518)}${lantern(628, 518)}
    <text x="450" y="506" text-anchor="middle" class="map-whisper">THE VERGE</text>

    <!-- the shelter, on whichever side of the yard the seed put it -->
    <g transform="translate(600 466)">
      <rect x="-42" y="0" width="84" height="44" rx="8" fill="#e8cf9f" stroke="${INK}" stroke-width="3.5"/>
      <path d="M-52 2 L0 -30 L52 2 Z" fill="#a8523a" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <rect x="-16" y="12" width="32" height="32" rx="4" fill="#3f3227" stroke="${INK}" stroke-width="3"/>
    </g>

    <!-- something the family planted, and the pet itself -->
    ${tree(258, 498, 0.58)}
    <g transform="translate(420 550)">
      <ellipse cx="0" cy="17" rx="22" ry="6" fill="#7cbb52"/>
      <circle cx="0" cy="0" r="20" fill="#ffb3d9" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="-7" cy="-3" r="3.4" fill="${INK}"/><circle cx="7" cy="-3" r="3.4" fill="${INK}"/>
      <path d="M-6 7 q6 6 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    </g>
    <text x="450" y="606" text-anchor="middle" class="map-whisper">THE CLEARING — WHERE YOUR PET ROAMS</text>

    ${pins}

    <!-- a compass, because every map has one -->
    <g transform="translate(830 566)">
      <circle cx="0" cy="0" r="32" fill="#fffaf0" stroke="${INK}" stroke-width="3.5"/>
      <path d="M0 -22 L9 6 L0 -2 L-9 6 Z" fill="#e2604f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="0" y="24" text-anchor="middle" class="pin-note">N</text>
    </g>
  </g>
  <rect x="2" y="2" width="896" height="636" rx="25" fill="none" stroke="${INK}" stroke-width="5"/>
</svg>`
}

/** Groups the grounds with a line about each, for the key beside the map. */
export const mapKey = () =>
  GROUNDS.map((g) => ({
    name: g.name,
    note: g.note,
    who: g.from === 'child' ? 'A child can go here, and so can an adult.' : 'An adult only.',
    energy: g.energy,
  }))
