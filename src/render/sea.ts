import { Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { TERRAIN_COLS, TERRAIN_VOXEL, type Relief, type Shore } from '../data/biome'

/**
 * The water at the front of a shore: the near band of the patch, under the pet
 * and running off the bottom of the frame.
 *
 * One flat plane rather than anything simulated. Everything that sells it is in
 * the fragment stage, and at this range there is enough of it on screen for
 * that to be worth doing: the swell travels, the crests take the sun, the
 * shallows over the sand are a different colour from the water past them, and
 * the surf runs up the beach and slides back. None of which survived being a
 * hazed strip at the horizon, which is what this was before.
 *
 * It reads the same haze the terrain does, from the same uniforms -- the water
 * is near enough now that the haze barely touches it, but a shore that put its
 * water further off would still want the two to agree.
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
   *
   * Pitched for water a couple of lengths from the camera. At the wavelengths
   * this had while it was the horizon, one crest now fills the whole visible
   * band and the sea heaves rather than ripples.
   */
  float swell(vec2 p, float t) {
    return sin(p.x * 3.1 + t * 0.85) * 0.5
         + sin(p.y * 5.2 - t * 1.20) * 0.32
         + sin((p.x + p.y * 0.6) * 7.4 + t * 0.55) * 0.18;
  }

  void main() {
    vec2 p = vWorld.xz;
    float w = swell(p, uTime);

    // The surf line: how far up the sand the water has run at this moment.
    //
    // Two slow sines rather than one, so the wash does not keep time, and the
    // faster of the two carries a little of x so the line is never straight
    // across the frame. The water is discarded above the line, which puts the
    // wet sand the terrain already paints back on show as it drains -- the
    // retreat is the half of the motion that reads, and it costs nothing.
    //
    // At its furthest in the line sits above the natural waterline and the sand
    // itself hides the plane's edge, so the wash never overruns onto dry beach.
    float wave = sin(uTime * 0.42) * 0.65 + sin(uTime * 0.67 + vWorld.x * 0.90) * 0.35;
    float edge = uShoreZ + 0.25 + 0.22 * (1.0 + wave);
    if (vWorld.z < edge) discard;

    // Shallow against the sand, deep once the seabed has dropped away toward
    // the camera.
    float away = clamp((vWorld.z - uShoreZ) / 4.0, 0.0, 1.0);
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
    // The far side of this water is the waterline, six or seven lengths off,
    // and the near side runs under the camera -- so the range is the near one
    // the shore actually occupies, not the horizon's.
    float grazing = smoothstep(5.0, 9.5, vDepth);
    lit = mix(lit, uSky, grazing * 0.28);

    // The sun lying on the water. Only the crests catch it, which is what makes
    // it a line of sparks rather than a sheet.
    float crest = max(w, 0.0);
    float glint = pow(crest, 7.0) * uLightIntensity;
    lit += uLightColour * glint * 0.5;

    // Foam along the surf line. Lit rather than white: a white lip would still
    // be white at midnight, which is the one thing that would give the plane
    // away as a plane.
    float lip = smoothstep(0.22, 0.0, vWorld.z - edge);
    vec3 foam = uLightColour * uLightIntensity * 0.62 + uAmbientColour * uAmbientIntensity * 1.1;
    lit = mix(lit, foam, lip * 0.5);

    lit = mix(lit, mix(vec3(dot(lit, vec3(0.33))), vec3(0.40, 0.44, 0.30), 0.5) * 0.8, uSick);

    // Water does not fade out the way the land does, and this is the whole
    // difference between a sea and a bank of fog. It settles toward a horizon
    // tint rather than toward the sky, and never gets all the way there.
    //
    // In front of the pet almost none of this bites -- the far edge of the
    // water is the waterline, well inside the depth the haze starts at. It is
    // kept because it is what a shore with its water further off would need,
    // and because the terrain it meets is hazed on exactly these numbers.
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
  /**
   * Puts the water where this place keeps it, or takes it away entirely. Both
   * halves are needed: the shore says how high the water stands and what
   * colour it is, and the relief says where the ground breaks away under it.
   */
  setShore(shore: Shore | undefined, relief: Relief | undefined): void
  setLighting(lighting: SeaLighting): void
  setSick(amount: number): void
  update(time: number): void
}

/**
 * Wider than the patch, and deep enough to run out past the camera. The camera
 * turns forty degrees to follow the pet, so water that stopped at the patch's
 * edge would end mid-frame at either extreme; and the near edge has to be
 * behind the lens, or the bottom of the frame would show where the sea stops.
 */
const SPAN_X = TERRAIN_COLS * TERRAIN_VOXEL * 2.5
const SPAN_Z = 30

/**
 * How far above its nominal level the water actually sits, in voxels.
 *
 * The seabed is voxels and the water is a plane, and the plane's level is given
 * in the same units the columns are stacked in -- so a column that comes out
 * exactly `level` high has its top face in exactly the water's plane. That is
 * the whole wet band, since the wet sand is the sand at or under the waterline,
 * and two coplanar surfaces are a field of tearing pixels rather than a shore.
 * Lifting the water a fraction of a voxel puts the sand decisively under it.
 * Small enough that the waterline does not move: a sixth of a voxel is three
 * centimetres of a surface seen almost edge-on.
 */
const LIFT = 1 / 6

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
    setShore(shore, relief) {
      mesh.visible = shore !== undefined && relief?.fall !== undefined
      if (!shore || !relief?.fall) return
      mesh.position.y = (shore.level + LIFT) * TERRAIN_VOXEL
      // Reaches a little behind where the ground starts falling, so the dry
      // sand is always the thing that hides the water's far edge and the seam
      // is never something the player can be shown.
      mesh.position.z = relief.fall.from - 1 + SPAN_Z / 2
      u.uShoreZ!.value = relief.fall.from
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
