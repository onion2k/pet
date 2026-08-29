import { Camera, RenderTarget, Transform } from 'ogl'
import './style.css'

import { speciesOf } from './data/species'
import { App } from './game/app'
import { Beeper } from './engine/audio'
import { createButtonHitTest, createInput } from './engine/input'
import { Orbit } from './engine/orbit'
import { MEADOW, ROAM_INSET, TERRAIN_CLEARING } from './data/biome'
import { worldAt, type Rgb } from './game/world'
import { PaletteTexture } from './render/palette'
import { createWeather } from './render/weather'
import { createBackdrop } from './render/backdrop'
import { createTerrain } from './render/terrain'
import { createBloom } from './render/post'
import { createShell, SCREEN_CORNER_POWER } from './render/shell'
import { createStage, watchResize } from './render/core'
import { Hud } from './render/hud'
import { Particles } from './render/particles'
import { PetView } from './render/pet'
import { drawScreen } from './ui/draw'

/** Native resolution of the pet's screen. Everything above it is upscaling. */
const SCREEN_PX: [number, number] = [192, 160]

const canvas = document.getElementById('stage') as HTMLCanvasElement | null
if (!canvas) throw new Error('Missing #stage canvas')

const stage = createStage(canvas)
const { gl, renderer } = stage
watchResize(stage)

// --- the world inside the screen -------------------------------------------

const screenScene = new Transform()
/**
 * A long lens, pulled back far enough to sit the pet in its surroundings rather
 * than filling the frame with it. Framed against the clear band between the two
 * icon strips, with the ground taking the lower third.
 */
const screenCamera = new Camera(gl, { fov: 24, near: 0.1, far: 60, aspect: SCREEN_PX[0] / SCREEN_PX[1] })
screenCamera.position.set(0, 4.35, 10.5)
screenCamera.lookAt([0, 1.53, 0])

const backdrop = createBackdrop(gl)
backdrop.root.setParent(screenScene)

/** The saved pet's id, read before the app exists so the ground can be seeded. */
function app0Seed(): string {
  try {
    const raw = localStorage.getItem('petz9000.save')
    const id = raw ? (JSON.parse(raw)?.pet?.id as string | undefined) : undefined
    return id ?? 'meadow'
  } catch {
    return 'meadow'
  }
}

const biome = MEADOW
const seasonPalette = new PaletteTexture(gl)
// Seeded from the pet, so every life gets its own patch of ground and its own
// arrangement of scenery.
let terrainSeed = app0Seed()
const terrain = createTerrain(gl, terrainSeed, biome, seasonPalette)
terrain.root.setParent(screenScene)

const weather = createWeather(gl)
weather.root.setParent(screenScene)

const petView = new PetView(gl, speciesOf('egg').model)
petView.root.position.y = terrain.shape.groundY
// Roaming stays inside the level clearing, so the pet's feet never step onto
// terrain that steps up or down beneath them.
petView.setBounds(TERRAIN_CLEARING - ROAM_INSET)
petView.setShelter(terrain.shape.shelter)
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
  form: (speciesId, animate) => petView.setModel(speciesOf(speciesId).model, animate),
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

const resetButton = document.createElement('button')
resetButton.textContent = 'NEW PET'
resetButton.addEventListener('click', () => {
  if (!window.confirm('Start over with a new egg? Your current pet will be lost.')) return
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

chrome?.append(muteButton, resetButton, recentreButton, announce)

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
let timeOffset = 0

function step(dt: number): void {
  elapsed += dt

  app.update(dt, Date.now())
  updateAnnouncement(dt)

  // A new pet gets new ground. Evolution does not disturb it.
  if (app.pet && app.pet.id !== terrainSeed) {
    terrainSeed = app.pet.id
    terrain.rebuild(terrainSeed, biome)
    petView.root.position.y = terrain.shape.groundY
    // New ground means the shelter may have moved to the other side.
    petView.setShelter(terrain.shape.shelter)
  }

  shell.setPower(app.mode === 'boot' ? 1 - app.bootTimer / 1.4 : 1)
  petView.update(dt, elapsed, app.visual)
  particles.update(dt)
  backdrop.update(elapsed)

  // --- the world's own clock ------------------------------------------------
  // The pet has to be in bed before the night can be wound past.
  app.petSheltered = petView.sheltered
  const world = worldAt(Date.now() + app.worldOffset + timeOffset)
  seasonPalette.update(world.palette)

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

  backdrop.setPalette(world.sky.top, world.sky.bottom)
  // Place the sun on the same arc that lights the scene, so the shadows and the
  // sky always agree. It sinks below the horizon and the moon takes over.
  const nightside = world.sunHeight <= 0
  backdrop.setSun(
    [0.5 - world.light.direction[0] * 0.55, 0.12 + Math.abs(world.sunHeight) * 0.62],
    nightside ? [0.55, 0.62, 0.85] : world.light.colour,
    nightside ? 0.035 : 0.05,
  )

  weather.set(world.weather)
  weather.setColour(nightside ? [0.5, 0.58, 0.8] : [0.85, 0.9, 1])
  weather.update(dt, elapsed)

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
      biome,
      petView,
      weather,
      world: () => worldAt(Date.now() + app.worldOffset + timeOffset),
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
