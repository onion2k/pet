import { Camera, RenderTarget, Transform } from 'ogl'
import './style.css'

import { speciesOf } from './data/species'
import { App } from './game/app'
import { Beeper } from './engine/audio'
import { createButtonHitTest, createInput } from './engine/input'
import { Orbit } from './engine/orbit'
import { biomeById, knownBiome, LAMP_COUNT, LAMP_PARKED, ROAM_HALF_X, ROAM_HALF_Z } from './data/biome'
import { DAY_MS, tintPalette, worldAt, type Rgb } from './game/world'
import { legacyOf, temperamentFrom } from './game/temperament'
import { evolve, feed, readyToEvolve, recordPlay } from './game/actions'
import { PaletteTexture } from './render/palette'
import { createSea } from './render/sea'
import { createWeather } from './render/weather'
import { createBackdrop } from './render/backdrop'
import { createTerrain } from './render/terrain'
import { createVisitors } from './render/visitors'
import { createBubble } from './render/bubble'
import { faceAnchors } from './render/face'
import { createBloom } from './render/post'
import { createShell, SCREEN_CORNER_POWER } from './render/shell'
import { createStage, watchResize } from './render/core'
import { Hud } from './render/hud'
import { Particles } from './render/particles'
import { PetView } from './render/pet'
import { drawScreen } from './ui/draw'

/** Native resolution of the pet's screen. Everything above it is upscaling.
 *  Twelve rows taller than the classic 192x160, to house the news ticker. */
const SCREEN_PX: [number, number] = [192, 172]

const canvas = document.getElementById('stage') as HTMLCanvasElement | null
if (!canvas) throw new Error('Missing #stage canvas')

const stage = createStage(canvas)
const { gl, renderer } = stage
watchResize(stage)

// --- the world inside the screen -------------------------------------------

const screenScene = new Transform()
/**
 * A longish lens, pulled back far enough to sit the pet in its surroundings
 * rather than filling the frame with it, and framed against the clear band
 * between the two icon strips.
 *
 * The camera does not move: it pans on the spot to follow the pet, the way you
 * would turn your head to watch something cross a field.
 */
const CAMERA_POS: [number, number, number] = [0, 3.9, 9.0]
const CAMERA_TARGET_Y = 1.35
/**
 * Framing is widened rather than dollied back: the terrain's haze starts at a
 * depth of 11 and the pet stands at about 9, so pulling the camera away would
 * walk the pet and the ground it stands on into the fog.
 */
const SCREEN_FOV = 33
/** How far the pan may swing either way. Beyond it the pet leaves the middle
 *  of the frame and walks out toward the edge, which is the point. */
const MAX_PAN = (40 * Math.PI) / 180

const screenCamera = new Camera(gl, {
  fov: SCREEN_FOV,
  near: 0.1,
  far: 60,
  aspect: SCREEN_PX[0] / SCREEN_PX[1],
})
screenCamera.position.set(...CAMERA_POS)
screenCamera.lookAt([0, CAMERA_TARGET_Y, 0])
/** Eased pan angle, so the camera never snaps to a new heading. */
let cameraPan = 0

const backdrop = createBackdrop(gl)
backdrop.root.setParent(screenScene)

/**
 * The saved pet and where it lives, read before the app exists so the ground
 * can be seeded. Both, because the ground is seeded from the pair: moving house
 * and back has to find the same patch it left, or the garden it left there
 * would come back standing on somebody else's hill.
 */
function app0Seed(): { id: string; home: string } {
  try {
    const raw = localStorage.getItem('petz9000.save')
    const saved = raw ? JSON.parse(raw) : null
    return { id: (saved?.pet?.id as string) ?? 'meadow', home: (saved?.home as string) ?? 'meadow' }
  } catch {
    return { id: 'meadow', home: 'meadow' }
  }
}

/** One ground per pet per place, so going back is going back. */
const groundSeed = (id: string, home: string): string => `${id}:${home}`

const booted = app0Seed()
let homeId = booted.home
let biome = biomeById(knownBiome(homeId))
const seasonPalette = new PaletteTexture(gl)
// Seeded from the pet, so every life gets its own patch of ground and its own
// arrangement of scenery.
let terrainSeed = groundSeed(booted.id, homeId)
const terrain = createTerrain(gl, terrainSeed, biome, seasonPalette)
terrain.root.setParent(screenScene)

const sea = createSea(gl)
sea.root.setParent(screenScene)
sea.setShore(biome.shore)

const weather = createWeather(gl)
weather.root.setParent(screenScene)

const visitors = createVisitors(gl, terrain.shape.groundY)
visitors.root.setParent(screenScene)

const bubble = createBubble(gl)
bubble.root.setParent(screenScene)
/**
 * Counts down to the pet's next unprompted thought. Long on purpose: a bubble
 * that turns up every half minute is wallpaper, and stops being worth looking
 * up for. Needs come round more often than musings, because a need is
 * something to act on and a musing is only ever a small surprise.
 */
let museTimer = 40 + Math.random() * 50

const petView = new PetView(gl, speciesOf('egg').model)
petView.root.position.y = terrain.shape.groundY
// Roaming stays inside the level clearing, so the pet's feet never step onto
// terrain that steps up or down beneath them.
petView.setBounds(ROAM_HALF_X, ROAM_HALF_Z)
petView.setShelter({ ...terrain.shape.shelter, lamps: terrain.shape.lamps })
petView.root.setParent(screenScene)

const particles = new Particles(gl)
particles.setScale(SCREEN_PX[1])
particles.root.setParent(screenScene)

const sceneTarget = new RenderTarget(gl, {
  width: SCREEN_PX[0],
  height: SCREEN_PX[1],
  depth: true,
  // Nearest sampling is the whole point: no smoothing between the pet's pixels.
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
const bloom = createBloom(gl, SCREEN_PX[0], SCREEN_PX[1])
const hud = new Hud(gl, SCREEN_PX[0], SCREEN_PX[1], SCREEN_CORNER_POWER)

// --- the device ------------------------------------------------------------

const shell = createShell(
  gl,
  { scene: sceneTarget.texture, bloom: sceneTarget.texture, hud: hud.texture },
  SCREEN_PX,
)
shell.root.setParent(stage.scene)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
shell.setMotion(!reduceMotion.matches)
reduceMotion.addEventListener('change', (event) => shell.setMotion(!event.matches))

// --- game ------------------------------------------------------------------

const beeper = new Beeper(false)

const app = new App({
  sound: (id) => beeper.play(id),
  burst: (kind, count) =>
    particles.emit(
      kind,
      [petView.position.x, terrain.shape.groundY + 1.1, petView.position.z],
      count,
    ),
  pop: (strength) => petView.pop(strength),
  form: (speciesId, animate) => {
    // A fresh egg means a fresh start in the middle of the clearing — the
    // previous occupant has walked off by now.
    if (speciesId === 'egg') petView.resetPosition()
    petView.setModel(speciesOf(speciesId).model, animate)
  },
  depart: () => petView.walkOff(),
  arrive: () => petView.resetPosition(),
})
beeper.setMuted(app.muted)

const hitButton = createButtonHitTest(canvas, stage.camera, shell.buttons)

createInput({
  canvas,
  hit: hitButton,
  onPress: (id) => {
    shell.press(id)
    app.press(id)
  },
  onRelease: (id) => app.release(id),
})

// Drag anywhere off the buttons to turn the device over in your hands.
const orbit = new Orbit({
  canvas,
  isControl: (x, y) => hitButton(x, y) !== null,
  reducedMotion: () => reduceMotion.matches,
})

// --- page chrome -----------------------------------------------------------

const chrome = document.getElementById('hud')
const announce = document.createElement('p')
announce.className = 'sr-only'
announce.setAttribute('role', 'status')

const muteButton = document.createElement('button')
const syncMute = () => {
  muteButton.textContent = app.muted ? 'SOUND OFF' : 'SOUND ON'
  muteButton.setAttribute('aria-pressed', String(app.muted))
}
muteButton.addEventListener('click', () => {
  app.toggleMute()
  beeper.setMuted(app.muted)
  syncMute()
})
syncMute()

// Shell colours are earned by lineage milestones and cycled here.
const shellButton = document.createElement('button')
const syncShell = () => {
  shell.setBodyColour(app.currentShell.colour)
  const extra = app.unlockedShells.length - 1
  shellButton.textContent = `SHELL: ${app.currentShell.name.toUpperCase()}`
  shellButton.title = extra > 0 ? `${extra} earned colour${extra > 1 ? 's' : ''} unlocked` : 'Earn colours by playing'
}
shellButton.addEventListener('click', () => {
  app.cycleShell()
  syncShell()
  beeper.play('confirm')
})

const resetButton = document.createElement('button')
resetButton.textContent = 'NEW PET'
resetButton.addEventListener('click', () => {
  if (
    !window.confirm(
      'Start over completely? This erases your pet AND the whole lineage: album, curios and streak. To pass the torch instead, retire an adult from its status screen.',
    )
  )
    return
  app.restart()
  petView.setModel(speciesOf('egg').model, true)
})

// Only offered once the device has actually been turned, so it stays out of
// the way until it means something.
const recentreButton = document.createElement('button')
recentreButton.textContent = 'RECENTRE'
recentreButton.hidden = true
recentreButton.addEventListener('click', () => orbit.recentre())

function syncRecentre(): void {
  const wanted = orbit.turned
  if (recentreButton.hidden === !wanted) return
  recentreButton.hidden = !wanted
}

syncShell()
chrome?.append(muteButton, shellButton, resetButton, recentreButton, announce)

// Keep the screen-reader summary current without spamming it every frame.
let announceTimer = 0
function updateAnnouncement(dt: number): void {
  announceTimer -= dt
  if (announceTimer > 0 || !app.pet) return
  announceTimer = 5
  const pet = app.pet
  const needs = app.needs
  announce.textContent =
    `${pet.name} the ${app.speciesName}, ${pet.stage}. ` +
    (pet.asleep ? 'Asleep. ' : '') +
    (pet.sick ? 'Unwell. ' : '') +
    (needs.length ? `Needs attention: ${needs.join(', ')}.` : 'Content.')
}

// --- loop ------------------------------------------------------------------

let last = performance.now()
let elapsed = 0
/** Shifts the world clock. Only ever non-zero when a test drives it. */
/**
 * Idle thoughts. Each pairs what the pet says with what the ticker says about
 * it, because the two are shown together and have to agree without repeating.
 */
const MUSINGS = [
  { say: 'hmm', line: 'wonders what is over the hill' },
  { say: 'you came', line: 'is glad you came back' },
  { say: 'la la', line: 'has a tune stuck in its head' },
  { say: 'snacks', line: 'is thinking about snacks' },
  { say: 'aha!', line: 'has had an idea' },
  { say: 'clouds', line: 'is counting the clouds' },
] as const
/** Said out loud when the pet is in a good mood. */
const CHEER = [
  { say: 'hello!', line: 'hello' },
  { say: 'best day', line: 'this is the best day' },
  { say: 'thanks', line: 'thank you' },
  { say: 'again!', line: 'again, again' },
  { say: 'hooray', line: 'hooray' },
] as const

let timeOffset = 0
/** Lantern positions in view space, packed xyz, rewritten every frame. */
const lampView = new Float32Array(LAMP_COUNT * 3)
/** How lit the lanterns are, eased toward the target so bedtime is a fade. */
let lampLevel = 0

function step(dt: number): void {
  elapsed += dt

  app.update(dt, Date.now())
  updateAnnouncement(dt)

  // A new pet gets new ground, and so does a move. Evolution disturbs neither.
  //
  // The rebuild is one very long frame -- the whole 160x80 patch is re-meshed --
  // so a move waits until the pet has walked off and the screen is settling,
  // and a new pet has nothing on screen to stutter yet.
  const wantedSeed = app.pet ? groundSeed(app.pet.id, app.biome.id) : terrainSeed
  if (wantedSeed !== terrainSeed) {
    terrainSeed = wantedSeed
    homeId = app.biome.id
    biome = app.biome
    terrain.rebuild(terrainSeed, biome)
    sea.setShore(biome.shore)
    petView.root.position.y = terrain.shape.groundY
    // New ground means the shelter may have moved to the other side.
    petView.setShelter({ ...terrain.shape.shelter, lamps: terrain.shape.lamps })
  }

  shell.setPower(app.mode === 'boot' ? 1 - app.bootTimer / 1.4 : 1)
  shell.setDim(app.forageDim)
  // Pan to keep the pet in view. Clamped, so once it strays past what the
  // swing can cover it drifts out toward the side of the screen on its own.
  const pet = petView.position
  // A pet that has gone off foraging is over the hill, and following it there
  // would leave the camera staring at an empty verge for three world hours.
  const trackX = petView.away ? 0 : pet.x
  const trackZ = petView.away ? 0 : pet.z
  const wanted = Math.max(
    -MAX_PAN,
    Math.min(MAX_PAN, Math.atan2(trackX - CAMERA_POS[0], CAMERA_POS[2] - trackZ)),
  )
  cameraPan += (wanted - cameraPan) * Math.min(1, dt * 1.8)
  screenCamera.position.set(...CAMERA_POS)
  screenCamera.lookAt([
    CAMERA_POS[0] + Math.sin(cameraPan) * CAMERA_POS[2],
    CAMERA_TARGET_Y,
    CAMERA_POS[2] - Math.cos(cameraPan) * CAMERA_POS[2],
  ])
  screenCamera.updateMatrixWorld()

  petView.update(dt, elapsed, app.visual)
  particles.update(dt)
  backdrop.update(elapsed)

  // --- the world's own clock ------------------------------------------------
  // The pet has to be in bed before the night can be wound past.
  app.petSheltered = petView.sheltered
  app.petAway = petView.away
  app.debugWorldOffset = timeOffset
  // One definition of what time it is in the pet's world, shared by the picture
  // and by the pet itself.
  const world = worldAt(app.worldNow())
  seasonPalette.update(tintPalette(world.palette, biome.id, biome.materials))

  // The sun's direction is in world space; the screen camera never moves, so it
  // is cheaper to rotate it into view space here than in every shader.
  const m = screenCamera.viewMatrix as unknown as number[]
  const [dx, dy, dz] = world.light.direction
  const lightDir: Rgb = [
    m[0]! * dx + m[4]! * dy + m[8]! * dz,
    m[1]! * dx + m[5]! * dy + m[9]! * dz,
    m[2]! * dx + m[6]! * dy + m[10]! * dz,
  ]

  const visual = app.visual
  const lighting = {
    direction: lightDir,
    colour: world.light.colour,
    intensity: world.light.intensity,
    ambientColour: world.ambient.colour,
    ambientIntensity: world.ambient.intensity,
  }
  petView.setLighting(lighting)
  terrain.setLighting({ ...lighting, haze: world.haze })
  terrain.setSick(visual.sick ? 1 : 0)
  // The water takes the sky it is under rather than a colour of its own: the
  // whole trick of the far water is that it agrees with what is above it.
  sea.setLighting({ ...lighting, haze: world.haze, sky: world.sky.top })
  sea.setSick(visual.sick ? 1 : 0)
  sea.update(elapsed)

  // The lanterns come up as the sun goes down, and go out once the pet is in
  // bed -- the yard is lit for the pet, not for the player. Their positions are
  // in world space and the camera turns, so they are transformed into view
  // space here for the same reason the sun's direction is.
  const lamps = terrain.shape.lamps
  // A carved lantern, when one is out, is a light like any other.
  const pumpkin = visitors.pumpkinAt()
  for (let i = 0; i < LAMP_COUNT; i++) {
    const lamp = i < lamps.length ? lamps[i]! : i === lamps.length ? pumpkin : null
    const lx = lamp ? lamp.x : LAMP_PARKED[0]
    const ly = lamp ? terrain.shape.groundY + lamp.y : LAMP_PARKED[1]
    const lz = lamp ? lamp.z : LAMP_PARKED[2]
    lampView[i * 3] = m[0]! * lx + m[4]! * ly + m[8]! * lz + m[12]!
    lampView[i * 3 + 1] = m[1]! * lx + m[5]! * ly + m[9]! * lz + m[13]!
    lampView[i * 3 + 2] = m[2]! * lx + m[6]! * ly + m[10]! * lz + m[14]!
  }
  // Eased rather than switched, so bedtime dims the yard instead of snapping it.
  const lampWanted = (1 - world.daylight) * (app.pet?.asleep ? 0 : 1)
  lampLevel += (lampWanted - lampLevel) * Math.min(1, dt * 1.6)
  petView.setLamps(lampView, lampLevel)
  terrain.setLamps(lampView, lampLevel)
  visitors.setLighting(lighting)
  visitors.setLamps(lampView, lampLevel)

  backdrop.setPalette(world.sky.top, world.sky.bottom)
  // Place the sun on the same arc that lights the scene, so the shadows and the
  // sky always agree. It sinks below the horizon and the moon takes over.
  const nightside = world.sunHeight <= 0
  // Shift the sun by the pan, or it would sit welded to the screen while the
  // world turned underneath it.
  const halfFovH = Math.atan(Math.tan((SCREEN_FOV * Math.PI) / 360) * (SCREEN_PX[0] / SCREEN_PX[1]))
  backdrop.setSun(
    [
      0.5 - world.light.direction[0] * 0.55 - cameraPan / (2 * halfFovH),
      0.12 + Math.abs(world.sunHeight) * 0.62,
    ],
    nightside ? [0.55, 0.62, 0.85] : world.light.colour,
    nightside ? 0.035 : 0.05,
  )

  weather.set(world.weather)
  weather.setColour(nightside ? [0.5, 0.58, 0.8] : [0.85, 0.9, 1])
  weather.update(dt, elapsed)

  // Who is in the yard today. Keyed on the world day, so a visitor stays for
  // the day rather than flickering in and out between frames.
  visitors.update(dt, {
    season: world.season.id,
    day: Math.floor(app.worldNow() / DAY_MS),
    hour: world.hour,
    groundY: terrain.shape.groundY,
    pet: petView.position,
    roam: { x: ROAM_HALF_X, z: ROAM_HALF_Z },
    door: { x: terrain.shape.shelter.lamp.x, z: terrain.shape.shelter.lamp.z },
    announce: (text) => app.pushTicker(text),
    planted: app.planted,
    regulars: app.regulars,
    roster: app.roster,
  })
  petView.setPlaything(visitors.playthingAt())

  // What the pet has to say for itself. Needs come first, then the odd idle
  // thought, so a hungry pet never stands there musing about clouds.
  museTimer -= dt
  const who = app.pet
  if (who && !bubble.busy && !petView.away && museTimer <= 0) {
    // A symbol alone does not say much -- a bowl could be hunger or dinner, a
    // question mark could be anything. So the bubble never goes up on its own:
    // it comes with the words for it on the ticker, and stays up for exactly as
    // long as they take to scroll past.
    const stats = who.stats
    const name = who.name
    const pick = <T,>(list: readonly T[]): T => list[(Math.random() * list.length) | 0]!
    // The bubble is what the pet says; the ticker is what the game says about
    // it. Keeping those apart is what stops the two repeating each other.
    type Mood = { kind: 'thought' | 'speech'; say: string; line: string }
    let humming = false

    // Anything the player could do something about. Those come round more often
    // than idle musings, which are only ever meant as a small surprise.
    const need: Mood | null = who.asleep
      ? { kind: 'thought', say: 'zzz', line: `${name} is fast asleep` }
      : who.sick
        ? { kind: 'speech', say: 'ow', line: `${name} feels poorly` }
        : stats.hunger < 35
          ? { kind: 'speech', say: 'feed me', line: `${name} is hungry` }
          : stats.hygiene < 35
            ? { kind: 'thought', say: 'a bath?', line: `${name} could do with a wash` }
            : stats.energy < 30
              ? { kind: 'thought', say: 'so tired', line: `${name} is getting sleepy` }
              : stats.happiness < 35
                ? { kind: 'thought', say: 'oh dear', line: `${name} is a bit down` }
                : null

    let mood: Mood
    if (need) mood = need
    else if (petView.cheerful) {
      const roll = Math.random()
      if (roll < 0.35) {
        mood = { kind: 'thought', say: 'la la la', line: `${name} is humming to itself` }
        humming = true
      } else if (roll < 0.6) {
        const cheer = pick(CHEER)
        mood = { kind: 'speech', say: cheer.say, line: `${name} says ${cheer.line}` }
      } else mood = { kind: 'thought', say: 'love you', line: `${name} is happy` }
    } else {
      const musing = pick(MUSINGS)
      mood = { kind: 'thought', say: musing.say, line: `${name} ${musing.line}` }
    }
    const seconds = app.speakNow(mood.line)
    bubble.show(mood.kind, mood.say, seconds)
    if (humming) bubble.hum()
    // Measured from when the line finishes, so the ticker gets the world back
    // for a good stretch either way.
    museTimer = seconds + (need ? 80 + Math.random() * 70 : 240 + Math.random() * 270)
  }
  bubble.update(
    dt,
    { x: petView.position.x, y: terrain.shape.groundY, z: petView.position.z },
    { x: CAMERA_POS[0], z: CAMERA_POS[2] },
  )

  renderer.render({ scene: screenScene, camera: screenCamera, target: sceneTarget })
  const glow = bloom.render(renderer, sceneTarget.texture)

  drawScreen(hud, app, world)

  shell.setScreenTextures(sceneTarget.texture, glow)

  orbit.update(dt)
  shell.setOrbit(orbit.yaw, orbit.pitch)
  shell.update(dt, elapsed)
  syncRecentre()
  renderer.render({ scene: stage.scene, camera: stage.camera })
}

function frame(now: number): void {
  // Clamp dt so a backgrounded tab resumes smoothly; offline time is handled
  // separately by the simulation's chunked catch-up.
  step(Math.min((now - last) / 1000, 0.1))
  last = now
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

// The tab going away is the player going away: the app measures the absence
// from here rather than from the last frame it happened to get, since a hidden
// tab is still handed the occasional one.
document.addEventListener('visibilitychange', () => {
  app.setVisible(document.visibilityState === 'visible')
})

if (import.meta.env.DEV) {
  // Lets a test harness advance the game deterministically without waiting on
  // animation frames, which browser panes and headless runs throttle.
  Object.assign(window, {
    __pet: {
      app,
      hud,
      shell,
      orbit,
      terrain,
      sea,
      // A function, not the value: the biome changes when the family moves, and
      // a snapshot taken at boot would go on reporting the meadow forever.
      biome: () => biome,
      petView,
      weather,
      visitors,
      bubble,
      museTimer: () => museTimer,
      temperamentFrom: (m: Parameters<typeof temperamentFrom>[0]) => temperamentFrom(m),
      recordPlay,
      feed,
      readyToEvolve,
      evolve,
      legacyOf,
      cameraPan: () => cameraPan,
      faceAnchors: (id: string) => faceAnchors(speciesOf(id).model, 1.85),
      setSpecies: (id: string) => petView.setModel(speciesOf(id).model, false),
      lampLevel: () => lampLevel,
      world: () => worldAt(app.worldNow()),
      setTimeOffset: (ms: number) => {
        timeOffset = ms
      },
      screenCamera,
      step,
      advance: (frames: number, dt = 1 / 60) => {
        for (let i = 0; i < frames; i++) step(dt)
      },
    },
  })
}
