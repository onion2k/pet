import { Geometry, Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import type { WeatherId } from '../data/seasons'

/**
 * Volume the weather falls through, centred on the scene. Far wider than it is
 * deep: the yard runs the whole width of the meadow and the camera turns forty
 * degrees to follow the pet across it, so a volume square in plan left the
 * weather stopping short well inside the frame at either extreme.
 */
const SPAN_X = 28
const SPAN_Z = 12
const HEIGHT = 6
/**
 * Counts are derived from a density rather than written down, so widening the
 * volume cannot quietly thin the rain out.
 */
const RAIN_PER_AREA = 520 / (9 * 9)
const SNOW_PER_AREA = 260 / (9 * 9)
const RAIN_DROPS = Math.round(RAIN_PER_AREA * SPAN_X * SPAN_Z)
const SNOW_FLAKES = Math.round(SNOW_PER_AREA * SPAN_X * SPAN_Z)

const shared = /* glsl */ `
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uAmount;
  uniform vec3 uColour;
`

const rainVertex = /* glsl */ `
  attribute vec3 seed;
  /** 0 at the head of the streak, 1 at the tail. */
  attribute float tail;
  ${shared}
  uniform float uFall;
  uniform float uStreak;
  varying float vFade;

  void main() {
    // Wrap each drop through the volume; nothing is ever spawned or retired.
    float y = mod(seed.y - uTime * uFall, ${HEIGHT}.0);
    vec3 p = vec3(seed.x, y, seed.z);
    // Slanted, and the tail trails back up the fall line.
    p.x += y * 0.12;
    p.y += tail * uStreak;
    p.x -= tail * uStreak * 0.12;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Fade with distance so the far edge of the volume is never a hard wall.
    vFade = uAmount * (1.0 - smoothstep(9.0, 16.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const rainFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColour;
  varying float vFade;
  void main() {
    if (vFade <= 0.01) discard;
    gl_FragColor = vec4(uColour, vFade * 0.55);
  }
`

const snowVertex = /* glsl */ `
  attribute vec3 seed;
  ${shared}
  uniform float uFall;
  uniform float uScale;
  varying float vFade;

  void main() {
    float y = mod(seed.y - uTime * uFall, ${HEIGHT}.0);
    // Each flake drifts on its own phase, so the fall never looks like a grid.
    float phase = seed.x * 3.7 + seed.z * 2.3;
    vec3 p = vec3(
      seed.x + sin(uTime * 0.7 + phase) * 0.35,
      y,
      seed.z + cos(uTime * 0.5 + phase) * 0.25
    );
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = uAmount * (1.0 - smoothstep(9.0, 16.0, -mv.z));
    gl_PointSize = uScale * (1.0 + fract(phase) * 0.8) / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`

const snowFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColour;
  varying float vFade;
  void main() {
    if (vFade <= 0.01) discard;
    gl_FragColor = vec4(uColour, vFade * 0.7);
  }
`

function scatter(count: number, perParticle: number): Float32Array {
  const data = new Float32Array(count * perParticle * 3)
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * SPAN_X
    const y = Math.random() * HEIGHT
    const z = (Math.random() - 0.5) * SPAN_Z
    for (let v = 0; v < perParticle; v++) {
      const at = (i * perParticle + v) * 3
      data[at] = x
      data[at + 1] = y
      data[at + 2] = z
    }
  }
  return data
}

export interface Weather {
  root: Transform
  /** Cross-fades to a new kind of weather; the swap happens while invisible. */
  set(kind: WeatherId): void
  setColour(colour: [number, number, number]): void
  update(dt: number, time: number): void
  /** 0..1, for pulling the terrain's haze in during a downpour. */
  readonly amount: number
  readonly showing: WeatherId
}

export function createWeather(gl: OGLRenderingContext): Weather {
  const root = new Transform()

  const rain = new Mesh(gl, {
    geometry: new Geometry(gl, {
      seed: { size: 3, data: scatter(RAIN_DROPS, 2) },
      tail: {
        size: 1,
        data: new Float32Array(
          Array.from({ length: RAIN_DROPS * 2 }, (_, i) => (i % 2 === 0 ? 0 : 1)),
        ),
      },
    }),
    program: new Program(gl, {
      vertex: rainVertex,
      fragment: rainFragment,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uColour: { value: [0.72, 0.82, 1] },
        uFall: { value: 7.5 },
        uStreak: { value: 0.42 },
      },
      transparent: true,
      depthWrite: false,
    }),
    mode: gl.LINES,
  })
  rain.frustumCulled = false
  rain.setParent(root)

  const snow = new Mesh(gl, {
    geometry: new Geometry(gl, { seed: { size: 3, data: scatter(SNOW_FLAKES, 1) } }),
    program: new Program(gl, {
      vertex: snowVertex,
      fragment: snowFragment,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uColour: { value: [1, 1, 1] },
        uFall: { value: 1.1 },
        // In screen pixels at unit depth. The screen is only 192 wide, so a
        // flake worth a couple of pixels is already snow.
        uScale: { value: 17 },
      },
      transparent: true,
      depthWrite: false,
    }),
    mode: gl.POINTS,
  })
  snow.frustumCulled = false
  snow.setParent(root)

  let showing: WeatherId = 'clear'
  let wanted: WeatherId = 'clear'
  let amount = 0

  return {
    root,
    get amount() {
      return amount
    },
    get showing() {
      return showing
    },
    set(kind) {
      wanted = kind
    },
    setColour(colour) {
      rain.program.uniforms.uColour.value = colour
      snow.program.uniforms.uColour.value = [
        Math.min(1, colour[0] * 1.15),
        Math.min(1, colour[1] * 1.15),
        Math.min(1, colour[2] * 1.15),
      ]
    },
    update(dt, time) {
      // Fade out before swapping, so one kind of weather never cuts to another.
      const target = wanted === showing && wanted !== 'clear' ? 1 : 0
      amount += (target - amount) * Math.min(1, dt * 0.7)
      if (amount < 0.02 && wanted !== showing) {
        showing = wanted
        amount = 0
      }
      rain.program.uniforms.uTime.value = time
      snow.program.uniforms.uTime.value = time
      rain.program.uniforms.uAmount.value = showing === 'rain' ? amount : 0
      snow.program.uniforms.uAmount.value = showing === 'snow' ? amount : 0
      rain.visible = showing === 'rain' && amount > 0.01
      snow.visible = showing === 'snow' && amount > 0.01
    },
  }
}
