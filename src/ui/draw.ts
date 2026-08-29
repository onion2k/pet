import { textWidth } from '../data/font'
import { FOODS } from '../data/foods'
import { ICON_LABEL, ICON_ORDER } from '../data/icons'
import { speciesOf, SPECIES_COUNT } from '../data/species'
import { MINIGAMES } from '../game/minigames'
import { NAMES, type App } from '../game/app'
import { CRITICAL } from '../game/tuning'
import type { Hud } from '../render/hud'
import type { PetState } from '../game/types'
import type { WorldState } from '../game/world'

const INK = '#dfe7ff'
const DIM = '#5a6180'
const PANEL = '#0a0a12'
const ACCENT = '#ffd93d'
const GOOD = '#8fe36a'
const BAD = '#ff6b4a'
const COOL = '#7fd6ff'

/** Height of the icon strips. The lower one is taller because it carries the label. */
const TOP_BAND = 16
const BOTTOM_BAND = 21

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}M`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}H ${minutes % 60}M`
  return `${Math.floor(hours / 24)}D ${hours % 24}H`
}

/** Half-size of an icon plus its selection frame. */
const ICON_HALF = 8
/** Top of the icon glyphs within their band; the selection frame starts 2px above. */
const ICON_TOP_Y = 4

/** The icon ring: three across the top, three across the bottom. */
function drawRing(hud: Hud, app: App): void {
  const blinkOn = Math.floor(app.blink * 3) % 2 === 0
  hud.rect(0, 0, hud.width, TOP_BAND, PANEL)
  hud.rect(0, hud.height - BOTTOM_BAND, hud.width, BOTTOM_BAND, PANEL)
  hud.rect(0, TOP_BAND, hud.width, 1, '#1c1c2c')
  hud.rect(0, hud.height - BOTTOM_BAND - 1, hud.width, 1, '#1c1c2c')

  const needs = new Set(app.needs)
  const alerts: Record<string, boolean> = {
    feed: needs.has('hunger'),
    play: needs.has('happiness'),
    clean: needs.has('hygiene'),
    sleep: needs.has('energy'),
    medicine: needs.has('health') || (app.pet?.sick ?? false),
    status: false,
  }

  // Spread each row against the outermost row its selection frame touches, so
  // the rounded glass never clips an icon or its frame.
  const topSpread = Math.min(62, hud.safeHalfWidth(ICON_TOP_Y - 2) - ICON_HALF - 1)
  const bottomSpread = Math.min(
    62,
    hud.safeHalfWidth(hud.height - BOTTOM_BAND + ICON_TOP_Y + 7) - ICON_HALF - 1,
  )

  ICON_ORDER.forEach((id, i) => {
    const top = i < 3
    const column = i % 3
    const spread = top ? topSpread : bottomSpread
    const centreX = hud.width / 2 + (column - 1) * spread
    const x = Math.round(centreX - 4)
    const y = top ? ICON_TOP_Y : hud.height - BOTTOM_BAND + ICON_TOP_Y
    const selected = app.iconIndex === i

    if (selected) {
      hud.frame(x - 4, y - 2, 16, 12, blinkOn ? ACCENT : '#4a4a68')
    }
    const colour = selected ? ACCENT : alerts[id] && blinkOn ? BAD : DIM
    hud.icon(x, y, id, colour)
  })

  const label = ICON_LABEL[app.selectedIcon]
  hud.textCentered(hud.width / 2, hud.height - 7, label, blinkOn ? INK : DIM)
}

function drawMessage(hud: Hud, app: App): void {
  if (app.messageTimer <= 0) return
  const y = hud.height - BOTTOM_BAND - 12
  const width = hud.width - 12
  hud.rect(6, y, width, 10, PANEL)
  hud.frame(6, y, width, 10, '#2a2a40')
  hud.textCentered(hud.width / 2, y + 3, app.message, INK)
}

/** A compact row of condition pips down the left edge of the screen. */
function drawVitals(hud: Hud, pet: PetState): void {
  const rows: [string, number, string][] = [
    ['H', pet.stats.hunger, GOOD],
    ['J', pet.stats.happiness, ACCENT],
    ['E', pet.stats.energy, COOL],
    ['C', pet.stats.hygiene, '#b58fff'],
  ]
  const left = Math.round(hud.safeInset(TOP_BAND + 6)) + 2
  rows.forEach(([label, value, colour], i) => {
    const y = TOP_BAND + 6 + i * 8
    const critical = value <= CRITICAL
    hud.text(left, y, label, critical ? BAD : DIM)
    hud.meter(left + 7, y, 18, value, critical ? BAD : colour, '#1c1c2c')
  })
}

function drawMain(hud: Hud, app: App): void {
  const pet = app.pet
  if (!pet) return
  drawVitals(hud, pet)

  if (pet.sick) {
    const pulse = Math.floor(app.blink * 2) % 2 === 0
    hud.text(hud.width - Math.round(hud.safeInset(TOP_BAND + 6)) - 22, TOP_BAND + 6, 'ILL', pulse ? BAD : DIM)
  }
  if (pet.asleep) {
    hud.text(hud.width - Math.round(hud.safeInset(TOP_BAND + 14)) - 24, TOP_BAND + 14, 'ZZZ', COOL)
  }
  if (pet.stage === 'egg') {
    hud.textCentered(hud.width / 2, hud.height - BOTTOM_BAND - 10, 'KEEP IT WARM', DIM)
  }
  drawMessage(hud, app)
  drawRing(hud, app)
}

function drawFeed(hud: Hud, app: App): void {
  const menu = FOODS.filter((f) => f.axis !== null)
  hud.rect(0, 0, hud.width, hud.height, 'rgba(5,5,11,0.93)')
  hud.textCentered(hud.width / 2, 8, 'FEED', ACCENT)

  menu.forEach((food, i) => {
    const y = 24 + i * 22
    const selected = app.foodIndex === i
    if (selected) hud.rect(6, y - 4, hud.width - 12, 20, '#1b2338')
    hud.text(12, y, food.name.toUpperCase(), selected ? INK : DIM)
    hud.text(12, y + 8, food.note.toUpperCase(), selected ? DIM : '#33384d')
    if (selected) hud.text(4, y, '>', ACCENT)
  })

  hud.textCentered(hud.width / 2, hud.height - 24, 'A/C PICK   B EAT', DIM)
}

function drawGames(hud: Hud, app: App): void {
  hud.rect(0, 0, hud.width, hud.height, 'rgba(5,5,11,0.93)')
  hud.textCentered(hud.width / 2, 10, 'GAMES', ACCENT)
  MINIGAMES.forEach((game, i) => {
    const y = 34 + i * 22
    const selected = app.gameIndex === i
    if (selected) hud.rect(8, y - 4, hud.width - 16, 18, '#1b2338')
    hud.text(16, y, game.title, selected ? INK : DIM, selected ? 2 : 1)
    hud.text(16, y + (selected ? 12 : 6), game.hint, '#40465e')
  })
  hud.textCentered(hud.width / 2, hud.height - 24, 'A/C PICK   B START', DIM)
}

function drawStatus(hud: Hud, app: App, world: WorldState): void {
  const pet = app.pet
  const m = app.metrics
  if (!pet || !m) return

  hud.rect(0, 0, hud.width, hud.height, 'rgba(5,5,11,0.95)')
  const left = Math.round(hud.safeInset(10)) + 2
  hud.text(left, 10, pet.name, ACCENT, 2)
  // The world's own clock, so the season and the weather are legible somewhere.
  const clock = `${String(Math.floor(world.hour)).padStart(2, '0')}:${String(
    Math.floor((world.hour % 1) * 60),
  ).padStart(2, '0')}`
  hud.text(hud.width - left - textWidth(clock), 11, clock, DIM)
  hud.text(left, 24, `${speciesOf(pet.speciesId).name.toUpperCase()} / ${pet.stage.toUpperCase()}`, COOL)
  hud.text(6, 32, `AGE ${duration(pet.ageMs)}`, DIM)

  const stats: [string, number][] = [
    ['FULL', pet.stats.hunger],
    ['HAPPY', pet.stats.happiness],
    ['ENERGY', pet.stats.energy],
    ['CLEAN', pet.stats.hygiene],
    ['HEALTH', pet.stats.health],
  ]
  stats.forEach(([label, value], i) => {
    const y = 44 + i * 9
    hud.text(6, y, label, DIM)
    hud.meter(40, y - 1, 40, value, value <= CRITICAL ? BAD : GOOD, '#1c1c2c')
    hud.text(88, y, String(Math.round(value)), INK)
  })

  hud.rect(6, 92, hud.width - 12, 1, '#22283c')
  const traits: [string, number][] = [
    ['CARE', m.care],
    ['PLAY', m.play],
    ['SLEEP', m.sleep],
  ]
  traits.forEach(([label, value], i) => {
    const y = 96 + i * 8
    hud.text(6, y, label, DIM)
    hud.meter(40, y - 1, 40, value * 100, COOL, '#1c1c2c')
  })

  hud.text(6, 122, `${world.season.name.toUpperCase()}  ${world.weather.toUpperCase()}`, COOL)
  const curios = app.curioTally
  hud.text(6, 130, `DIET ${(m.dietLean ?? 'MIXED').toUpperCase()}  STREAK ${app.streakDays}`, DIM)
  hud.text(6, 138, `FOUND ${app.discoveredCount}/${SPECIES_COUNT}  CURIOS ${curios.kinds}/8`, DIM)
  if (pet.stage === 'adult') {
    const progress = app.retireProgress
    if (progress > 0) {
      const width = hud.width - 44
      hud.rect(22, hud.height - 12, width, 3, '#1c1c2c')
      hud.rect(22, hud.height - 12, Math.round(width * progress), 3, ACCENT)
      hud.textCentered(hud.width / 2, hud.height - 20, 'RETIRING...', ACCENT)
    } else {
      hud.textCentered(hud.width / 2, hud.height - 10, 'HOLD B TO RETIRE', '#96a0c8')
    }
  } else {
    hud.textCentered(hud.width / 2, hud.height - 10, 'ANY KEY TO CLOSE', '#3a4058')
  }
}

function drawEvolve(hud: Hud, app: App): void {
  const evolution = app.evolution
  if (!evolution) return
  const flash = Math.floor(app.blink * 6) % 2 === 0

  hud.rect(0, 0, hud.width, 22, PANEL)
  hud.rect(0, hud.height - 34, hud.width, 34, PANEL)
  hud.textCentered(hud.width / 2, 6, evolution.toId === 'blob' ? 'IT HATCHED!' : 'EVOLVED!', flash ? ACCENT : INK, 2)
  hud.textCentered(hud.width / 2, hud.height - 30, `${evolution.fromName.toUpperCase()} > ${evolution.toName.toUpperCase()}`, COOL)
  hud.textCentered(hud.width / 2, hud.height - 20, evolution.because.toUpperCase(), DIM)
  hud.textCentered(hud.width / 2, hud.height - 10, 'PRESS ANY BUTTON', flash ? DIM : '#2a3048')
}

function drawRetire(hud: Hud, app: App): void {
  const retiring = app.retiring
  if (!retiring) return
  const flash = Math.floor(app.blink * 4) % 2 === 0

  hud.rect(0, 0, hud.width, 26, PANEL)
  hud.rect(0, hud.height - 36, hud.width, 36, PANEL)
  hud.textCentered(hud.width / 2, 8, 'FAREWELL', flash ? ACCENT : INK, 2)
  hud.textCentered(
    hud.width / 2,
    hud.height - 32,
    `${retiring.name} THE ${retiring.speciesName.toUpperCase()}`,
    COOL,
  )
  hud.textCentered(hud.width / 2, hud.height - 22, 'WANDERS INTO THE MEADOW', DIM)
  hud.textCentered(hud.width / 2, hud.height - 12, 'PRESS ANY BUTTON', flash ? DIM : '#2a3048')
}

function drawWelcome(hud: Hud, app: App): void {
  const pet = app.pet
  if (!pet) return
  hud.rect(0, 0, hud.width, hud.height, 'rgba(6,6,12,0.88)')
  hud.textCentered(hud.width / 2, 24, 'WELCOME BACK', ACCENT)
  hud.textCentered(hud.width / 2, 44, `AWAY ${duration(app.awayMs)}`, INK)

  const lines: string[] = []
  if (pet.sick) lines.push(`${pet.name} IS UNWELL`)
  if (pet.stats.hunger <= CRITICAL) lines.push('VERY HUNGRY')
  if (pet.stats.hygiene <= CRITICAL) lines.push('NEEDS CLEANING')
  if (pet.stats.happiness <= CRITICAL) lines.push('FEELING LONELY')
  if (lines.length === 0) lines.push('EVERYTHING IS FINE')

  lines.slice(0, 4).forEach((line, i) => {
    hud.textCentered(hud.width / 2, 66 + i * 12, line, i === 0 && pet.sick ? BAD : DIM)
  })
  hud.textCentered(hud.width / 2, hud.height - 20, 'PRESS ANY BUTTON', DIM)
}

function drawName(hud: Hud, app: App): void {
  hud.rect(0, 0, hud.width, hud.height, 'rgba(6,6,12,0.88)')
  hud.textCentered(hud.width / 2, 34, 'NAME YOUR PET', DIM)
  hud.textCentered(hud.width / 2, 62, NAMES[app.nameIndex] ?? '', ACCENT, 3)
  hud.text(20, 64, '<', COOL, 2)
  hud.text(hud.width - 28, 64, '>', COOL, 2)
  hud.textCentered(hud.width / 2, 106, 'A/C CHANGE   B HATCH', DIM)
}

function drawBoot(hud: Hud, app: App): void {
  hud.rect(0, 0, hud.width, hud.height, PANEL)
  const flash = Math.floor(app.blink * 8) % 2 === 0
  hud.textCentered(hud.width / 2, 58, 'PETZ', INK, 3)
  hud.textCentered(hud.width / 2, 78, '9000', flash ? ACCENT : INK, 3)
  hud.textCentered(hud.width / 2, 108, 'V1.0  (C) 1997', DIM)
}

/** How long the quit hint stays up at the start of a game. */
const QUIT_HINT_SECONDS = 3.5

/**
 * The hold-to-back affordance. Every button is spoken for during a game, so
 * backing out is a held press rather than a spare button — which means it has
 * to be both visible while it happens and advertised beforehand.
 */
function drawBackPrompt(hud: Hud, app: App): void {
  const progress = app.backProgress
  const strip = 14
  const y = hud.height - strip

  if (progress > 0) {
    const width = hud.width - 44
    const x = 22
    hud.rect(0, y, hud.width, strip, PANEL)
    hud.textCentered(hud.width / 2, y + 2, 'BACK', ACCENT)
    hud.rect(x, y + 9, width, 3, '#1c1c2c')
    hud.rect(x, y + 9, Math.round(width * progress), 3, ACCENT)
    return
  }

  // Only advertised for the first few seconds, then the game's own hint returns.
  const advertise =
    app.mode === 'playing' ? app.sessionElapsed < QUIT_HINT_SECONDS : true
  if (!advertise) return
  hud.rect(0, y, hud.width, strip, PANEL)
  // Brighter than the usual dim text: this strip sits in the corner of the
  // screen where the vignette and scanlines are darkest.
  hud.textCentered(hud.width / 2, y + 4, 'HOLD C TO GO BACK', '#96a0c8')
}

export function drawScreen(hud: Hud, app: App, world: WorldState): void {
  hud.begin()
  switch (app.mode) {
    case 'boot':
      drawBoot(hud, app)
      break
    case 'name':
      drawName(hud, app)
      break
    case 'welcome':
      drawWelcome(hud, app)
      break
    case 'main':
      drawMain(hud, app)
      break
    case 'feed':
      drawFeed(hud, app)
      drawBackPrompt(hud, app)
      break
    case 'games':
      drawGames(hud, app)
      drawBackPrompt(hud, app)
      break
    case 'status':
      drawStatus(hud, app, world)
      break
    case 'playing':
      app.session?.draw(hud)
      drawBackPrompt(hud, app)
      break
    case 'evolve':
      drawEvolve(hud, app)
      break
    case 'retire':
      drawRetire(hud, app)
      break
  }
  hud.commit()
}
