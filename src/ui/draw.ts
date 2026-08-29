import { CURIOS, CURIO_COUNT } from '../data/curios'
import { textWidth } from '../data/font'
import { FOODS } from '../data/foods'
import { ICON_LABEL, ICON_ORDER } from '../data/icons'
import { speciesOf, SPECIES_COUNT, SPECIES_LIST } from '../data/species'
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
/** The news crawl, sitting just above the lower icon strip. */
const TICKER_BAND = 11

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

/** The scrolling news line. Ambient world messaging, one line at a time. */
function drawTicker(hud: Hud, app: App): void {
  const y = hud.height - BOTTOM_BAND - TICKER_BAND
  hud.rect(0, y, hud.width, TICKER_BAND, PANEL)
  hud.rect(0, y, hud.width, 1, '#1c1c2c')
  if (app.tickerText) {
    hud.text(Math.round(hud.width - app.tickerOffset), y + 3, app.tickerText, COOL)
  }
}

function drawMessage(hud: Hud, app: App): void {
  if (app.messageTimer <= 0) return
  // Above the ticker, so a toast never sits on top of the crawl.
  const y = hud.height - BOTTOM_BAND - TICKER_BAND - 12
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
    hud.textCentered(hud.width / 2, hud.height - BOTTOM_BAND - TICKER_BAND - 10, 'KEEP IT WARM', DIM)
  }
  drawTicker(hud, app)
  drawMessage(hud, app)
  drawRing(hud, app)
}

function drawFeed(hud: Hud, app: App): void {
  const menu = FOODS.filter((f) => f.axis !== null)
  hud.rect(0, 0, hud.width, hud.height, panel(0.045))
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

/**
 * A backing panel, given how much of the world should show through it as the
 * eye sees it. The frame is encoded for display after the HUD is mixed in, so
 * a panel's leftover scene contribution is lifted by that curve on its way to
 * the screen: at 0.88 alpha, twelve percent of linear scene arrives looking
 * like thirty-eight. Asking for the look and solving back for the alpha keeps
 * these honest.
 */
function panel(showThrough: number, ink = '5,5,11'): string {
  return `rgba(${ink},${1 - Math.pow(showThrough, 2.2)})`
}

function drawGames(hud: Hud, app: App): void {
  hud.rect(0, 0, hud.width, hud.height, panel(0.045))
  hud.textCentered(hud.width / 2, 10, 'GAMES', ACCENT)
  MINIGAMES.forEach((game, i) => {
    const y = 34 + i * 22
    const selected = app.gameIndex === i
    if (selected) hud.rect(8, y - 4, hud.width - 16, 18, '#1b2338')
    hud.text(16, y, game.title, selected ? INK : DIM, selected ? 2 : 1)
    hud.text(16, y + (selected ? 12 : 6), game.hint, '#40465e')
  })
  // Already counted in the save and shown nowhere until now.
  const play = app.playRecord
  if (play.gamesPlayed > 0) {
    hud.rect(8, hud.height - 42, hud.width - 16, 1, '#22283c')
    hud.textCentered(
      hud.width / 2,
      hud.height - 36,
      `BEST RUN ${play.bestStreak}   WON ${play.gamesWon}/${play.gamesPlayed}`,
      DIM,
    )
  }
  hud.textCentered(hud.width / 2, hud.height - 24, 'A/C PICK   B START', DIM)
}

/** Breaks a phrase onto lines of at most `width` characters, on word breaks. */
function wrapped(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

function drawStatus(hud: Hud, app: App, world: WorldState): void {
  const pet = app.pet
  const m = app.metrics
  if (!pet || !m) return

  hud.rect(0, 0, hud.width, hud.height, panel(0.035))
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

  // Stops short of the curio board, which keeps its own column.
  hud.rect(6, 92, 92, 1, '#22283c')
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
  hud.text(6, 130, `DIET ${(m.dietLean ?? 'MIXED').toUpperCase()}  STREAK ${app.streakDays}`, DIM)

  // Where the pet is currently headed, in the words the evolution screen will
  // use when it gets there. Named on its own line because it is the one thing
  // on this screen the player can still change.
  const leaning = app.leaning
  const character = app.temperament
  if (!leaning) {
    // A grown pet has nowhere left to go, but it has turned out a particular
    // way, and that is worth rather more than saying it has stopped.
    if (character) {
      hud.text(6, 139, character.name.toUpperCase(), ACCENT)
      wrapped(character.blurb.toUpperCase(), 16).forEach((line, i) => {
        hud.text(6, 147 + i * 7, line, COOL)
      })
    } else if (pet.stage === 'adult') hud.text(6, 139, 'FULLY GROWN', DIM)
  } else {
    hud.text(6, 139, 'BECOMING', ACCENT)
    // Sixteen characters is what fits between the margin and the boards, and
    // every reason in the game falls in two lines at that width.
    wrapped(leaning.toUpperCase(), 16).forEach((line, i) => {
      hud.text(6, 147 + i * 7, line, COOL)
    })
  }

  drawCurioBoard(hud, app)
  drawSpeciesBoard(hud, app)
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

/**
 * The two collection boards, filling the right-hand column of the status
 * screen. Everything findable has a slot, so the gaps show what is still out
 * there; unfound entries are drawn as flat silhouettes rather than hidden,
 * because a board with holes in it is what makes a set worth finishing.
 */
const BOARD_X = 104
const BOARD_W = 76
const CELL = 20
const MISSING = '#252b40'

function drawBoardHeading(hud: Hud, y: number, label: string): void {
  hud.text(BOARD_X, y, label, DIM)
  hud.rect(BOARD_X, y + 8, BOARD_W, 1, '#22283c')
}

function drawCurioBoard(hud: Hud, app: App): void {
  const counts = app.curioCounts
  drawBoardHeading(hud, 38, `CURIOS ${app.curioTally.kinds}/${CURIO_COUNT}`)
  CURIOS.forEach((curio, i) => {
    const x = BOARD_X + (i % 4) * CELL
    const y = 50 + Math.floor(i / 4) * 18
    const found = counts[curio.id] ?? 0
    hud.glyph(x, y, curio.glyph.split('/'), found > 0 ? curio.colour : MISSING, 2)
    // The duplicate count sits on the artwork rather than costing the board a
    // row, so it needs its own backing to stay readable over the bright ones.
    if (found > 1) {
      hud.rect(x + 10, y + 9, 7, 8, '#05050b')
      hud.text(x + 11, y + 10, String(Math.min(9, found)), '#8b95c0')
    }
  })
}

/** The album. Each form is drawn in its own body colour, straight off its model. */
function drawSpeciesBoard(hud: Hud, app: App): void {
  const found = new Set(app.discoveredIds)
  drawBoardHeading(hud, 88, `FORMS ${app.discoveredCount}/${SPECIES_COUNT}`)
  // Four by four. Three rows held the twelve forms the game shipped with; the
  // elders take it past that, and the grid has to grow with the list rather
  // than quietly dropping whatever will not fit.
  SPECIES_LIST.forEach((species, i) => {
    const x = BOARD_X + (i % 4) * CELL
    const y = 96 + Math.floor(i / 4) * 16
    const colour = found.has(species.id) ? (species.model.palette.b ?? INK) : MISSING
    hud.glyph(x, y, species.glyph.split('/'), colour, 2)
  })
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
  hud.rect(0, 0, hud.width, hud.height, panel(0.08, '6,6,12'))
  hud.textCentered(hud.width / 2, 24, 'WELCOME BACK', ACCENT)
  hud.textCentered(hud.width / 2, 44, `AWAY ${duration(app.awayMs)}`, INK)

  const lines: string[] = []
  if (pet.sick) lines.push(`${pet.name} IS UNWELL`)
  if (pet.stats.hunger <= CRITICAL) lines.push('VERY HUNGRY')
  if (pet.stats.hygiene <= CRITICAL) lines.push('NEEDS CLEANING')
  if (pet.stats.happiness <= CRITICAL) lines.push('FEELING LONELY')
  if (lines.length === 0) lines.push('EVERYTHING IS FINE')

  lines.slice(0, 3).forEach((line, i) => {
    hud.textCentered(hud.width / 2, 66 + i * 12, line, i === 0 && pet.sick ? BAD : DIM)
  })
  if (app.found) {
    hud.textCentered(hud.width / 2, 108, `IT FOUND A ${app.found.name.toUpperCase()}!`, ACCENT)
  }
  hud.textCentered(hud.width / 2, hud.height - 20, 'PRESS ANY BUTTON', DIM)
}

function drawName(hud: Hud, app: App): void {
  hud.rect(0, 0, hud.width, hud.height, panel(0.08, '6,6,12'))
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
