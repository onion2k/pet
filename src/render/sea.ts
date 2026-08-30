import { Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { TERRAIN_COLS, TERRAIN_VOXEL, type Shore } from '../data/biome'

/**
 * The water at the back of a shore.
 *
 * One flat plane rather than anything simulated. What sells water at this
 * resolution is not the surface -- it is four pixels tall by the time the haze
 * has it -- but the three things around it: that the ground goes under it, that
 * it takes the sky's colour where it is far away, and that the sun lies on it
 * in a line. So the plane is cheap and the shading does the work.
 *
 * It reads the same haze the terrain does, from the same uniforms, because the
 * horizon is where the two have to agree. A sea that hazed on its own schedule
 * would draw a seam across the frame exactly where it was supposed to disappear.
 */

const vertex = /* glsl */ `
  attribute vec3 position;

  uniform mat4 modelMatrix;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  varying vec3 vWorld;
  varying float vDepth;

  void main() {
    // Through the model matrix rather than straight off the attribute: the
    // plane is authored standing up and laid flat by a rotation, so its own
    // coordinates are not the world's. The ripples and the distance from the
    // shore are both figured in world space, so that the swell stays put on the
    // water while the camera pans across it.
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uHaze;
  uniform vec3 uSky;
  uniform vec2 uFog;
  uniform float uShoreZ;
  uniform vec3 uLightColour;
  uniform float uLightIntensity;
  uniform vec3 uAmbientColour;
  uniform float uAmbientIntensity;
  uniform float uSick;

  varying vec3 vWorld;
  varying float vDepth;

  /**
   * Three sine trains at angles to one another. Not noise: a swell wants to
   * read as travelling, and three periodic terms beat against each other for
   * long enough that the eye never finds the loop.
   */
  float swell(vec2 p, float t) {
    return sin(p.x * 1.6 + t * 0.85) * 0.5
         + sin(p.y * 2.7 - t * 1.20) * 0.32
         + sin((p.x + p.y * 0.6) * 3.9 + t * 0.55) * 0.18;
  }

  void main() {
    vec2 p = vWorld.xz;
    float w = swell(p, uTime);

    // Shallow over the sand, deep once the seabed has dropped away.
    float away = clamp((uShoreZ - vWorld.z) / 5.0, 0.0, 1.0);
    vec3 albedo = mix(uShallow, uDeep, away * away);
    albedo *= 0.88 + 0.16 * w;

    // Lit like everything else, so the water goes with the day rather than
    // staying a bright band after dark.
    vec3 lit = albedo * (uLightColour * uLightIntensity * 0.55
                       + uAmbientColour * uAmbientIntensity);

    // Water seen at a glancing angle is a mirror, and from a fixed camera over
    // a flat plane how glancing the angle is *is* how far away it is. So the
    // sky comes in with distance rather than with a normal nobody would see.
    // Held well under half: past that the sea stops being a colour of its own
    // and becomes a second piece of sky lying on the ground.
    float grazing = smoothstep(8.0, 26.0, vDepth);
    lit = mix(lit, uSky, grazing * 0.35);

    // The sun lying on the water. Only the crests catch it, which is what makes
    // it a line of sparks rather than a sheet.
    float crest = max(w, 0.0);
    float glint = pow(crest, 7.0) * uLightIntensity;
    lit += uLightColour * glint * 0.5;

    lit = mix(lit, mix(vec3(dot(lit, vec3(0.33))), vec3(0.40, 0.44, 0.30), 0.5) * 0.8, uSick);

    // Water does not fade out the way the land does, and this is the whole
    // difference between a sea and a bank of fog.
    //
    // The patch's far edge is meant to disappear, so the terrain hazes all the
    // way to the sky over seven units of depth. Water given the same treatment
    // vanishes completely -- almost everything the player can see of a sea is
    // the far part, beyond where the sand stops, and hazed to sky that part is
    // sky. A real sea keeps most of its colour right up to the horizon and then
    // stops at a line. So the water settles toward a horizon tint rather than
    // toward the sky, and never gets all the way there.
    float haze = smoothstep(uFog.x, uFog.y, vDepth) * 0.85;
    vec3 horizon = mix(uHaze, uDeep, 0.7);
    // Alpha is the bloom mask, so the sparks bloom the way the lantern glass
    // does -- and stop blooming once the distance has taken them.
    gl_FragColor = vec4(mix(lit, horizon, haze), glint * 0.6 * (1.0 - haze));
  }
`

export interface SeaLighting {
  colour: [number, number, number]
  intensity: number
  ambientColour: [number, number, number]
  ambientIntensity: number
  haze: [number, number, number]
  /** What the water reflects where it is far enough off to be a mirror. */
  sky: [number, number, number]
}

export interface Sea {
  root: Transform
  /** Puts the water where this place keeps it, or takes it away entirely. */
  setShore(shore: Shore | undefined): void
  setLighting(lighting: SeaLighting): void
  setSick(amount: number): void
  update(time: number): void
}

/**
 * Wider and deeper than the patch. The camera turns forty degrees to follow the
 * pet, so water that stopped at the patch's edge would end mid-frame at either
 * extreme -- and the far edge has to be past where the haze finishes, or the
 * horizon would have a lip on it.
 */
const SPAN_X = TERRAIN_COLS * TERRAIN_VOXEL * 2.5
const SPAN_Z = 60

export function createSea(gl: OGLRenderingContext): Sea {
  const root = new Transform()

  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: [0.3, 0.55, 0.6] },
      uDeep: { value: [0.1, 0.28, 0.4] },
      uHaze: { value: [0.06, 0.09, 0.16] },
      uSky: { value: [0.4, 0.6, 0.85] },
      // The terrain's, exactly. The two have to vanish together.
      uFog: { value: [11.0, 18.0] },
      uShoreZ: { value: 0 },
      uLightColour: { value: [1, 1, 1] },
      uLightIntensity: { value: 1 },
      uAmbientColour: { value: [0.5, 0.6, 0.8] },
      uAmbientIntensity: { value: 0.4 },
      uSick: { value: 0 },
    },
    cullFace: null,
  })

  // Two triangles. Everything that moves is in the fragment stage, so there is
  // nothing for a denser grid to carry.
  const mesh = new Mesh(gl, {
    geometry: new Plane(gl, { width: SPAN_X, height: SPAN_Z }),
    program,
  })
  // Plane comes up standing; lay it flat.
  mesh.rotation.x = -Math.PI / 2
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.setParent(root)

  const u = program.uniforms

  return {
    root,
    setShore(shore) {
      mesh.visible = shore !== undefined
      if (!shore) return
      mesh.position.y = shore.level * TERRAIN_VOXEL
      // Reaches a little in front of where the ground starts falling, so the
      // dry sand is always the thing that hides the water's near edge and the
      // seam is never something the player can be shown.
      mesh.position.z = shore.from + 1 - SPAN_Z / 2
      u.uShoreZ!.value = shore.from
      u.uShallow!.value = hexToLinear(shore.shallow)
      u.uDeep!.value = hexToLinear(shore.deep)
    },
    setLighting(lighting) {
      u.uLightColour!.value = lighting.colour
      u.uLightIntensity!.value = lighting.intensity
      u.uAmbientColour!.value = lighting.ambientColour
      u.uAmbientIntensity!.value = lighting.ambientIntensity
      u.uHaze!.value = lighting.haze
      u.uSky!.value = lighting.sky
    },
    setSick(amount) {
      u.uSick!.value = amount
    },
    update(time) {
      u.uTime!.value = time
    },
  }
}

/** sRGB hex to linear, matching the way every other colour reaches a shader. */
function hexToLinear(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  const to = (byte: number) => Math.pow(byte / 255, 2.2)
  return [to((value >> 16) & 255), to((value >> 8) & 255), to(value & 255)]
}
