import { Mesh, Plane, Program, Texture, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { GLYPH_H, GLYPH_W, glyph, textWidth } from '../data/font'

const W = 72
/**
 * Tall enough to leave air around what is in it. At 40 the paper was exactly
 * as tall as the symbol drawn on it, so every bubble read as crammed into its
 * own frame.
 */
const H = 50
const NOTE_W = 12
const NOTE_H = 14

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tMap, vUv);
    if (c.a * uFade < 0.04) discard;
    gl_FragColor = vec4(c.rgb, c.a * uFade);
  }
`

/**
 * What the pet is putting above its head. There was a held placard here too,
 * but a sign has to look held, and these creatures have no arm in view to hold
 * one with -- it read as a rectangle floating beside them. Anything it would
 * have said is said instead.
 */
export type BubbleKind = 'thought' | 'speech'

export interface Bubble {
  root: Transform
  /** Puts something up. Text is drawn small; a symbol is drawn large. */
  show(kind: BubbleKind, text: string, seconds?: number): void
  /** True while something is already up, so nothing talks over itself. */
  get busy(): boolean
  update(
    dt: number,
    at: { x: number; y: number; z: number },
    camera: { x: number; z: number },
  ): void
  /** Starts a little run of notes rising from the pet. */
  hum(): void
}

/** The one bit of pixel art left: a quaver, for the notes a hum sends up. */
const NOTE_ART = ['....##.', '....##.', '...###.', '.#####.', '###..#.', '.#.....']

/**
 * Turns a quad to face the camera, about its own position rather than the
 * pet's. A quad with a +z normal turned by t has the normal (sin t, 0, cos t),
 * so t is the bearing from the quad to the camera -- not the camera's own pan,
 * which is the bearing the other way and turns the quad away by twice the error
 * as the pet moves off centre.
 */
function faceCamera(
  mesh: Mesh,
  origin: { x: number; z: number },
  camera: { x: number; z: number },
): void {
  const x = origin.x + mesh.position.x
  const z = origin.z + mesh.position.z
  mesh.rotation.y = Math.atan2(camera.x - x, camera.z - z)
}

export function createBubble(gl: OGLRenderingContext): Bubble {
  const root = new Transform()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const texture = new Texture(gl, { image: canvas, generateMipmaps: false, flipY: true })

  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    depthWrite: false,
    cullFace: null,
    uniforms: { tMap: { value: texture }, uFade: { value: 0 } },
  })
  const panel = new Mesh(gl, { geometry: new Plane(gl, { width: 1, height: H / W }), program })
  panel.setParent(root)

  // Notes get their own little texture and their own quads, so a hum can run
  // while a bubble is up.
  const noteCanvas = document.createElement('canvas')
  noteCanvas.width = NOTE_W
  noteCanvas.height = NOTE_H
  const noteCtx = noteCanvas.getContext('2d')!
  const noteTexture = new Texture(gl, { image: noteCanvas, generateMipmaps: false, flipY: true })
  const noteProgram = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    depthWrite: false,
    cullFace: null,
    uniforms: { tMap: { value: noteTexture }, uFade: { value: 0 } },
  })

  const notes = Array.from({ length: 4 }, () => {
    const mesh = new Mesh(gl, {
      geometry: new Plane(gl, { width: 0.2, height: (0.2 * NOTE_H) / NOTE_W }),
      program: noteProgram,
    })
    mesh.visible = false
    mesh.setParent(root)
    return { mesh, life: 0, delay: 0, x: 0, drift: 0 }
  })

  drawNote()

  function drawNote(): void {
    noteCtx.clearRect(0, 0, NOTE_W, NOTE_H)
    noteCtx.fillStyle = '#fff0c0'
    const art = NOTE_ART
    const s = 2
    for (let y = 0; y < art.length; y++) {
      const row = art[y]!
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') noteCtx.fillRect(x * s, y * s + 1, s, s)
      }
    }
    noteTexture.needsUpdate = true
  }

  /** Characters that fit on one line at a size, leaving a margin either side. */
  function lineBudget(scale: number): number {
    return Math.max(1, Math.floor((W - 20) / ((GLYPH_W + 1) * scale)))
  }

  /** Breaks a phrase to a character width, splitting a word only if it must. */
  function fitLines(text: string, width: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
      if (!line && word.length > width) {
        // A single word too long for the bubble is cut rather than overflowing.
        for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
        continue
      }
      if (line && line.length + 1 + word.length > width) {
        lines.push(line)
        line = word
      } else line = line ? `${line} ${word}` : word
    }
    if (line) lines.push(line)
    return lines
  }

  /** Draws a pixel string into the bubble canvas at a given scale. */
  function pixelText(text: string, cx: number, cy: number, scale: number, colour: string): void {
    ctx.fillStyle = colour
    let x = cx - textWidth(text, scale) / 2
    for (const ch of text) {
      const rows = glyph(ch)
      for (let gy = 0; gy < GLYPH_H; gy++) {
        const row = rows[gy] ?? ''
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (row[gx] === '#') ctx.fillRect(x + gx * scale, cy + gy * scale, scale, scale)
        }
      }
      x += (GLYPH_W + 1) * scale
    }
  }

  /** Paints the frame and its contents. */
  function paint(kind: BubbleKind, text: string): void {
    ctx.clearRect(0, 0, W, H)
    const ink = '#14121c'
    const paper = '#f6f2e6'

    {
      ctx.fillStyle = ink
      roundRect(2, 2, W - 4, H - 12, 8)
      ctx.fill()
      ctx.fillStyle = paper
      roundRect(4, 4, W - 8, H - 16, 6)
      ctx.fill()
      if (kind === 'thought') {
        // Trailing puffs, which is what makes it a thought and not a shout.
        for (const [bx, by, r] of [
          [W / 2 - 6, H - 12, 3.5],
          [W / 2 - 11, H - 6, 2.4],
        ] as const) {
          ctx.fillStyle = ink
          circle(bx, by, r + 1.2)
          ctx.fillStyle = paper
          circle(bx, by, r)
        }
      } else {
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.moveTo(W / 2 - 7, H - 15)
        ctx.lineTo(W / 2 + 3, H - 15)
        ctx.lineTo(W / 2 - 9, H - 2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = paper
        ctx.beginPath()
        ctx.moveTo(W / 2 - 6, H - 17)
        ctx.lineTo(W / 2 + 1, H - 17)
        ctx.lineTo(W / 2 - 7, H - 5)
        ctx.closePath()
        ctx.fill()
      }
    }

    const midY = (H - 16) / 2 + 4
    // Broken to fit rather than run off the side, set as large as will fit, and
    // a size down again if the words need more lines than the paper has room
    // for: "this is the best day" wants four lines at the larger size.
    const paperH = H - 16
    let scale = 2
    let lines = fitLines(text.toUpperCase(), lineBudget(scale))
    if (lines.length * (GLYPH_H * scale + 2) > paperH - 6) {
      scale = 1
      lines = fitLines(text.toUpperCase(), lineBudget(scale))
    }
    const lineHeight = GLYPH_H * scale + 2
    const top = midY - (lines.length * lineHeight) / 2
    lines.forEach((line, i) => {
      pixelText(line, W / 2, top + i * lineHeight, scale, ink)
    })
    texture.needsUpdate = true
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function circle(x: number, y: number, r: number): void {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  let timer = 0
  let fade = 0

  return {
    root,
    get busy() {
      return timer > 0
    },
    show(kind, text, seconds = 3.4) {
      paint(kind, text)
      timer = seconds
    },
    hum() {
      let delay = 0
      for (const note of notes) {
        if (note.life > 0) continue
        note.life = 1.9
        note.delay = delay
        note.x = (Math.random() * 2 - 1) * 0.12
        note.drift = (Math.random() * 2 - 1) * 0.35
        delay += 0.28
        if (delay > 0.9) break
      }
    },
    update(dt, at, camera) {
      timer = Math.max(0, timer - dt)
      fade += ((timer > 0 ? 1 : 0) - fade) * Math.min(1, dt * 6)
      program.uniforms.uFade.value = fade
      panel.visible = fade > 0.02

      // Off to one side and well in front of the pet: level with it and only a
      // little aside, the quad simply sits inside the head and is never seen.
      panel.scale.set(1.28)
      panel.position.set(1.02, 2.02, 0.75)
      // The root carries position only. Turning it would swing the panel around
      // the pet on an arc rather than turning it where it stands.
      root.position.set(at.x, at.y, at.z)
      root.rotation.y = 0
      faceCamera(panel, at, camera)

      let anyNote = false
      for (const note of notes) {
        if (note.life <= 0) {
          note.mesh.visible = false
          continue
        }
        anyNote = true
        if (note.delay > 0) {
          note.delay -= dt
          note.mesh.visible = false
          continue
        }
        note.life -= dt
        const t = 1 - note.life / 1.9
        note.mesh.visible = true
        note.mesh.position.set(
          -0.62 + note.x + note.drift * t,
          1.45 + t * 0.85,
          0.75,
        )
        faceCamera(note.mesh, at, camera)
        note.mesh.rotation.z = Math.sin(t * 7) * 0.3
      }
      noteProgram.uniforms.uFade.value = anyNote ? 1 : 0
    },
  }
}
