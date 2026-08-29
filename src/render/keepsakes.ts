import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { LAMP_COUNT } from '../data/biome'
import { CAIRN, TRINKET } from '../data/keepsakes'
import { buildVoxelGeometry } from './voxel-mesh'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;
  attribute float ao;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalMatrix * normal;
    vColor = color;
    vAo = ao;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  #define LAMP_COUNT ${LAMP_COUNT}

  uniform vec3 uLightDir;
  uniform vec3 uLightColour;
  uniform float uLightIntensity;
  uniform vec3 uAmbientColour;
  uniform float uAmbientIntensity;
  uniform vec3 uLampPos[LAMP_COUNT];
  uniform vec3 uLampColour;
  uniform float uLampIntensity;
  uniform float uLampRadius;
  uniform vec3 uTint;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying vec3 vViewPos;

  void main() {
    vec3 base = vColor * uTint;
    vec3 N = normalize(vNormal);
    float key = max(dot(N, uLightDir), 0.0);
    float fill = max(dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0);

    vec3 lit = base * uLightColour * (key * uLightIntensity);
    lit += base * uAmbientColour * (fill * uAmbientIntensity);
    lit *= vAo;

    vec3 lampSum = vec3(0.0);
    for (int i = 0; i < LAMP_COUNT; i++) {
      vec3 toLamp = uLampPos[i] - vViewPos;
      float dist = length(toLamp);
      float falloff = clamp(1.0 - dist / uLampRadius, 0.0, 1.0);
      falloff *= falloff;
      float lampKey = max(dot(N, normalize(toLamp)), 0.0) * 0.75 + 0.25;
      lampSum += uLampColour * (lampKey * falloff);
    }
    lit += base * lampSum * uLampIntensity;

    gl_FragColor = vec4(lit, 0.0);
  }
`

export interface KeepsakeLighting {
  direction: [number, number, number]
  colour: [number, number, number]
  intensity: number
  ambientColour: [number, number, number]
  ambientIntensity: number
}

/** One thing standing in the yard, and what colour it is. */
export interface Placed {
  kind: 'trinket' | 'cairn'
  tint: [number, number, number]
}

export interface Keepsakes {
  root: Transform
  /** Lays out whatever the lineage has to show. Cheap to call; only acts on change. */
  set(items: Placed[], groundY: number): void
  setLighting(lighting: KeepsakeLighting): void
  setLamps(positions: Float32Array, intensity: number): void
  /** Where each one stands, so nothing else is placed on top of them. */
  positions(): { x: number; z: number }[]
}

/**
 * The row they stand in: in front of the band the pet roams rather than behind
 * it, where the lantern row and the visitors already are. Foreground keeps them
 * off the shelter and out of the pet's way, and they are low enough not to
 * block it.
 */
const ROW_Z = 1.3
const SLOTS = [-7.0, -5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2, 5.6, 7.0]

export function createKeepsakes(gl: OGLRenderingContext): Keepsakes {
  const root = new Transform()
  const program = new Program(gl, {
    vertex,
    fragment,
    cullFace: gl.BACK,
    uniforms: {
      uLightDir: { value: [0.4, 0.8, 0.45] },
      uLightColour: { value: [1, 1, 1] },
      uLightIntensity: { value: 1 },
      uAmbientColour: { value: [0.5, 0.6, 0.8] },
      uAmbientIntensity: { value: 0.3 },
      uLampPos: { value: new Float32Array(LAMP_COUNT * 3) },
      uLampColour: { value: [1, 0.82, 0.5] },
      uLampIntensity: { value: 0 },
      uLampRadius: { value: 4.5 },
      uTint: { value: [1, 1, 1] },
    },
  })

  const geometry = {
    trinket: buildVoxelGeometry(gl, TRINKET.model, TRINKET.height).geometry,
    cairn: buildVoxelGeometry(gl, CAIRN.model, CAIRN.height).geometry,
  }

  const pool: { mesh: Mesh; tint: [number, number, number] }[] = []
  let signature = ''
  const placed: { x: number; z: number }[] = []

  return {
    root,
    positions: () => placed,
    setLighting(lighting) {
      const u = program.uniforms
      u.uLightDir.value = lighting.direction
      u.uLightColour.value = lighting.colour
      u.uLightIntensity.value = lighting.intensity
      u.uAmbientColour.value = lighting.ambientColour
      u.uAmbientIntensity.value = lighting.ambientIntensity
    },
    setLamps(positions, intensity) {
      program.uniforms.uLampPos.value = positions
      program.uniforms.uLampIntensity.value = intensity
    },
    set(items, groundY) {
      const next = items.map((i) => `${i.kind}:${i.tint.join(',')}`).join('|')
      if (next === signature) return
      signature = next

      for (const entry of pool) entry.mesh.setParent(null)
      pool.length = 0
      placed.length = 0

      // Curios take the middle of the row and ancestors work outwards from the
      // ends, so a long lineage never crowds out what the pet dug up.
      const trinkets = items.filter((i) => i.kind === 'trinket')
      const cairns = items.filter((i) => i.kind === 'cairn')
      const middle = Math.floor(SLOTS.length / 2)
      const order: number[] = []
      for (let step = 0; step <= middle; step++) {
        if (middle - step >= 0) order.push(middle - step)
        if (step > 0 && middle + step < SLOTS.length) order.push(middle + step)
      }
      const taken = new Set<number>()
      const place = (item: Placed, slot: number): void => {
        if (slot < 0 || slot >= SLOTS.length || taken.has(slot)) return
        taken.add(slot)
        const entry = {
          mesh: new Mesh(gl, { geometry: geometry[item.kind], program }),
          tint: item.tint,
        }
        entry.mesh.position.set(SLOTS[slot]!, groundY, ROW_Z)
        entry.mesh.onBeforeRender(() => {
          program.uniforms.uTint.value = entry.tint
        })
        entry.mesh.setParent(root)
        pool.push(entry)
        placed.push({ x: SLOTS[slot]!, z: ROW_Z })
      }
      trinkets.forEach((item, i) => place(item, order[i] ?? -1))
      // Ancestors fill from the outside in, into whatever the curios left.
      let end = 0
      for (const cairn of cairns) {
        while (end < SLOTS.length && taken.has(end)) end++
        place(cairn, end)
      }
    },
  }
}
