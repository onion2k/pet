import { Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { modelSource } from './voxel-mesh'
import type { VoxelModel } from '../data/voxel-format'

/**
 * The dark patch under a thing standing on the ground.
 *
 * Not a shadow in any real sense -- nothing is cast, and the sun's direction
 * is ignored entirely. It is a contact patch, and what it buys is the one
 * thing the lighting cannot say on its own: that a thing is *on* the grass
 * rather than hovering a little above it. The pet has had one since it could
 * walk; everything else in the yard was floating.
 *
 * One program, many patches. Each hands the program its own strength on the
 * way past, the same way the visitors hand it their own fade.
 */

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
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    // Soft round contact patch. Blended over the ground, the result is roughly
    // grass * (1 - alpha), so alpha is what controls how dark it gets.
    float d = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.45, 1.0, d)) * uStrength;
    gl_FragColor = vec4(0.02, 0.03, 0.02, a);
  }
`

/** Just clear of the ground, so it never z-fights with the terrain surface. */
export const SHADOW_LIFT = 0.012

/** How much wider than its caster a patch is drawn, so it reads as soft. */
const SPREAD = 1.15

/**
 * How high a thing can get before its shadow is gone. A gull on the wing has
 * nothing under it worth drawing; a rabbit mid-hop still does.
 */
const FADE_HEIGHT = 1.3

export interface ShadowCaster {
  mesh: Mesh
  /** Sets how dark it is, 0 to 1. Read on the way past, so it may change. */
  strength: number
}

export function createShadows(gl: OGLRenderingContext) {
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: { uStrength: { value: 1 } },
    transparent: true,
    depthWrite: false,
  })

  return {
    /**
     * A patch the given world width across, laid flat and parented where it is
     * told. Its own transform: a shadow belongs to the ground, not to the
     * thing above it, which hops and banks and turns.
     */
    add(parent: Transform, width: number): ShadowCaster {
      const size = width * SPREAD
      const mesh = new Mesh(gl, { geometry: new Plane(gl, { width: size, height: size }), program })
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = SHADOW_LIFT
      mesh.setParent(parent)
      const caster: ShadowCaster = { mesh, strength: 1 }
      mesh.onBeforeRender(() => {
        program.uniforms.uStrength.value = caster.strength
      })
      return caster
    },
  }
}

/**
 * How wide a thing is on the ground, from the model it is drawn from. The
 * wider of its two footprint axes, so a shadow covers what is above it.
 */
export function footprintOf(model: VoxelModel, height: number): number {
  const source = modelSource(model)
  return (Math.max(source.w, source.d) / source.h) * height
}

/**
 * What a shadow is worth for something this far off the ground: full on the
 * grass, gone by the time it is a pet's height up.
 */
export function liftFade(height: number): number {
  return Math.max(0, 1 - height / FADE_HEIGHT)
}
