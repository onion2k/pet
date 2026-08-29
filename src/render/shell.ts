import { Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext, Texture } from 'ogl'
import { createFrontDecal, DECAL_SIZE } from './decal'
import { pebbleGeometry } from './shell-geometry'

export type ButtonId = 'a' | 'b' | 'c'

const plasticVert = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying vec3 vTanX;
  varying vec3 vTanY;
  void main() {
    vNormal = normalMatrix * normal;
    // Local X and Y in view space, so a height gradient measured in the decal's
    // own coordinates can be applied to the shaded normal.
    vTanX = normalMatrix * vec3(1.0, 0.0, 0.0);
    vTanY = normalMatrix * vec3(0.0, 1.0, 0.0);
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const plasticFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uGloss;
  uniform float uSpeckle;
  uniform float uRim;
  uniform sampler2D tDecal;
  /** Local-space rect the decal covers: x0, y0, x1, y1. */
  uniform vec4 uDecalRect;
  uniform vec2 uDecalTexel;
  uniform float uDecalZ;
  uniform float uDecalDepth;
  uniform float uHasDecal;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying vec3 vTanX;
  varying vec3 vTanY;

  // Cheap value noise, used only for the moulded-plastic speckle.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 N = normalize(vNormal);

    // Moulded relief. Sampled unconditionally and masked, so the texture fetch
    // never sits in non-uniform control flow.
    vec2 duv = (vLocal.xy - uDecalRect.xy) / (uDecalRect.zw - uDecalRect.xy);
    vec2 uv = clamp(duv, 0.0, 1.0);
    float inRect =
      step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
    float apply = uHasDecal * inRect * step(uDecalZ, vLocal.z);

    float hL = texture2D(tDecal, uv - vec2(uDecalTexel.x, 0.0)).r;
    float hR = texture2D(tDecal, uv + vec2(uDecalTexel.x, 0.0)).r;
    float hD = texture2D(tDecal, uv - vec2(0.0, uDecalTexel.y)).r;
    float hU = texture2D(tDecal, uv + vec2(0.0, uDecalTexel.y)).r;
    // 0.5 in the map is flat plastic; above is proud, below is drilled in.
    float relief = (texture2D(tDecal, uv).r - 0.5) * apply;

    vec3 bump = (vTanX * (hR - hL) + vTanY * (hU - hD)) * uDecalDepth * apply;
    N = normalize(N - bump);

    vec3 V = normalize(-vViewPos);
    vec3 L = normalize(vec3(0.45, 0.85, 0.75));
    vec3 L2 = normalize(vec3(-0.7, 0.1, 0.4));

    float key = max(dot(N, L), 0.0);
    float fill = max(dot(N, L2), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), mix(12.0, 90.0, uGloss)) * mix(0.15, 0.9, uGloss);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 col = uColor * (0.22 + 0.72 * key);
    col += uColor * vec3(0.5, 0.6, 0.95) * fill * 0.30;
    col += vec3(1.0, 0.98, 0.94) * spec;
    col += vec3(0.55, 0.72, 1.0) * fresnel * uRim;

    // Grain keeps large flat plastic areas from banding under the bloom.
    col *= 1.0 + (hash(floor(vLocal * 180.0)) - 0.5) * uSpeckle;

    // Grooves and drilled holes sit in shadow, deeper ones darker.
    col *= 1.0 - max(0.0, -relief) * 0.95;
    col += uColor * max(0.0, relief) * 0.25;

    gl_FragColor = vec4(col, 1.0);
  }
`

const screenVert = /* glsl */ `
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

const screenFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform sampler2D tHud;
  uniform float uTime;
  uniform float uBloom;
  uniform float uPower;
  uniform float uMotion;
  uniform float uLevels;
  uniform float uBarrel;
  uniform float uZoom;
  uniform float uCorner;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Ordered 4x4 dither. Quantising after this is what gives the picture its
  // cheap-LCD texture instead of a smooth modern gradient.
  float bayer(vec2 p) {
    vec2 q = floor(mod(p, 4.0));
    float i = q.y * 4.0 + q.x;
    float m[16];
    m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
    m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
    m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
    for (int k = 0; k < 16; k++) {
      if (float(k) == i) return m[k] / 16.0 - 0.5;
    }
    return 0.0;
  }

  void main() {
    vec2 centred = vUv * 2.0 - 1.0;

    // The lit area is a superellipse, so the picture ends on a moulded-looking
    // curve where it meets the plastic. Everything outside is discarded rather
    // than painted black, leaving no rectangle corners and needing no bezel.
    vec2 q = abs(centred);
    float shape = pow(q.x, uCorner) + pow(q.y, uCorner);
    float alpha = 1.0 - smoothstep(1.0 - 0.05, 1.0, shape);
    if (alpha <= 0.002) discard;

    // Barrel distortion, pre-zoomed by uZoom so the distorted picture still
    // reaches the middle of every edge rather than sitting inset in its frame.
    vec2 c = centred * uZoom;
    float r2 = dot(c, c);
    vec2 uv = clamp((c * (1.0 + uBarrel * r2)) * 0.5 + 0.5, 0.0, 1.0);

    // Chromatic fringing grows toward the corners, as on a cheap lens.
    float ab = 0.0016 + r2 * 0.0026;
    vec3 scene;
    scene.r = texture2D(tScene, uv + vec2(ab, 0.0)).r;
    scene.g = texture2D(tScene, uv).g;
    scene.b = texture2D(tScene, uv - vec2(ab, 0.0)).b;

    vec3 bloom = texture2D(tBloom, uv).rgb;
    vec4 hud = texture2D(tHud, uv);

    // The scene is lit in linear light. The HUD is authored as sRGB hex, so it
    // is linearised on the way in and the whole frame is encoded once at the
    // end -- without that encode every midtone reads far darker than the
    // colour it was picked as, which is what made the meadow look overcast.
    vec3 col = scene + bloom * uBloom;
    col = mix(col, pow(max(hud.rgb, 0.0), vec3(2.2)), hud.a);
    col += bloom * hud.a * 0.25;

    // Scanlines and an aperture grille, both tied to the source resolution so
    // they stay at exactly one line per pixel row however large the screen is.
    float lines = 0.86 + 0.14 * sin(uv.y * uResolution.y * 3.14159265 * 2.0);
    float grille = 0.93 + 0.07 * sin(uv.x * uResolution.x * 3.14159265 * 2.0);
    col *= lines * grille;

    // Slow horizontal roll, disabled when the viewer prefers reduced motion.
    float roll = sin(uv.y * 3.0 - uTime * 0.7) * 0.012 * uMotion;
    col *= 1.0 + roll;

    col *= 1.0 - r2 * 0.22;

    // A soft shoulder above 0.8. The pastel pets sit near the top of the range
    // before the sun has touched them, so without this their lit side clips to
    // flat white; midtones pass through untouched.
    col = max(col, 0.0);
    col = col / (1.0 + max(col - 0.8, 0.0));

    // Into display space. Everything above is light being added up; everything
    // below is applied to the picture as the eye will see it, and the dither
    // quantises where the banding actually lands.
    col = pow(col, vec3(1.0 / 2.2));

    col = floor(col * uLevels + bayer(gl_FragCoord.xy)) / uLevels;

    // A hard diagonal glare across the plastic window.
    float glare = smoothstep(0.62, 0.98, (centred.x * 0.6 - centred.y) * 0.5 + 0.5);
    col += vec3(0.16, 0.19, 0.24) * glare * 0.5;

    // Power-on wipe: the picture snaps open from a horizontal line. The range
    // overshoots 1.0 so a fully powered screen has no dark band left at the edges.
    float open = smoothstep(0.0, 1.0, uPower) * 1.6;
    float band = smoothstep(open, open - 0.25, abs(centred.y));
    col *= band;
    col += vec3(0.6, 0.9, 1.0) * (1.0 - band) * step(abs(centred.y), open + 0.02) * 0.4;

    // The glass is slightly recessed into the plastic, so its rim falls into shadow.
    col *= mix(0.35, 1.0, smoothstep(1.0, 0.62, shape));

    gl_FragColor = vec4(max(col, 0.0), alpha);
  }
`

/** Barrel strength. Enough to read as curved glass without warping the HUD text. */
const BARREL = 0.035

/**
 * The zoom at which a barrel-distorted image still reaches the middle of each
 * edge — the solution of z + k*z^3 = 1. Without it the picture sits visibly
 * inset inside its own frame.
 */
function barrelZoom(k: number): number {
  let z = 1
  for (let i = 0; i < 24; i++) z -= (z + k * z * z * z - 1) / (1 + 3 * k * z * z)
  return z
}

export interface ShellTextures {
  scene: Texture
  bloom: Texture
  hud: Texture
}

export interface Shell {
  root: Transform
  /** Button meshes with their world radius, for hit-testing. */
  buttons: { id: ButtonId; mesh: Mesh; radius: number }[]
  press(id: ButtonId): void
  update(dt: number, time: number): void
  /** Turns the whole device. The idle drift is layered on top of this. */
  setOrbit(yaw: number, pitch: number): void
  /** Recolours the moulded plastic of the case. */
  setBodyColour(colour: [number, number, number]): void
  /** Swaps the textures the screen samples; the bloom target changes each frame. */
  setScreenTextures(scene: Texture, bloomGlow: Texture): void
  setPower(value: number): void
  setBloom(value: number): void
  setMotion(enabled: boolean): void
}

/**
 * Layout solved against the shell's superellipse rather than eyeballed.
 *
 * The front of the shell is flattened hard into a true plateau, so the screen
 * can sit directly on it with no bezel: there is no gap to hide and nothing for
 * the glass to float above. The lit area is a superellipse masked in the
 * shader, so the plastic simply meets the picture on a curve.
 */
const SHELL_DEPTH = 0.7
const SHELL_ROUNDNESS = 0.68
/** Depth of the flat front plateau. Small next to SHELL_DEPTH = a flat face. */
const FRONT_Z = 0.2

const SCREEN_W = 2.08
// Taller than the classic 1.2 ratio: the extra rows carry the news ticker.
const SCREEN_H = SCREEN_W / (192 / 172)
const SCREEN_Y = 0.58
/** Corner curvature of the lit area. Low value = a rounded rectangle. */
const SCREEN_ROUNDNESS = 0.15

/**
 * The mouldings hang directly below the screen and run to just above the
 * buttons, deriving their rect from both so the stack stays evenly spaced if
 * any of it moves.
 */
const DECAL_W = 2
const DECAL_H = DECAL_W * (DECAL_SIZE[1] / DECAL_SIZE[0])
const SCREEN_BOTTOM = SCREEN_Y - SCREEN_H / 2
const DECAL_RECT: [number, number, number, number] = [
  -DECAL_W / 2,
  SCREEN_BOTTOM - DECAL_H,
  DECAL_W / 2,
  SCREEN_BOTTOM,
]
/** How hard the relief tilts the surface normal. */
const DECAL_DEPTH = 1.7

const BUTTON_R = 0.28
const BUTTON_DEPTH = 0.13
const BUTTON_Y = -1.175
const BUTTON_SPACING = 0.7

export function createShell(
  gl: OGLRenderingContext,
  textures: ShellTextures,
  screenPixels: [number, number],
): Shell {
  const root = new Transform()

  const decal = createFrontDecal(gl)

  const plastic = (color: [number, number, number], gloss: number, rim: number, speckle: number) =>
    new Program(gl, {
      vertex: plasticVert,
      fragment: plasticFrag,
      uniforms: {
        uColor: { value: color },
        uGloss: { value: gloss },
        uRim: { value: rim },
        uSpeckle: { value: speckle },
        tDecal: { value: decal },
        uDecalRect: { value: DECAL_RECT },
        uDecalTexel: { value: [1 / DECAL_SIZE[0], 1 / DECAL_SIZE[1]] },
        uDecalZ: { value: FRONT_Z * 0.85 },
        uDecalDepth: { value: 0 },
        uHasDecal: { value: 0 },
      },
      cullFace: gl.BACK,
    })

  const body = new Mesh(gl, {
    geometry: pebbleGeometry(gl, {
      size: [1.38, 2.02, SHELL_DEPTH],
      roundness: SHELL_ROUNDNESS,
      flattenFront: FRONT_Z,
      segments: 80,
    }),
    program: plastic([0.42, 0.28, 0.72], 0.75, 0.35, 0.05),
  })
  body.program.uniforms.uHasDecal.value = 1
  body.program.uniforms.uDecalDepth.value = DECAL_DEPTH
  body.setParent(root)

  const screen = new Mesh(gl, {
    geometry: new Plane(gl, { width: SCREEN_W, height: SCREEN_H }),
    program: new Program(gl, {
      vertex: screenVert,
      fragment: screenFrag,
      uniforms: {
        tScene: { value: textures.scene },
        tBloom: { value: textures.bloom },
        tHud: { value: textures.hud },
        uTime: { value: 0 },
        uBloom: { value: 1 },
        uPower: { value: 0 },
        uMotion: { value: 1 },
        uLevels: { value: 24 },
        uBarrel: { value: BARREL },
        uZoom: { value: barrelZoom(BARREL) },
        uCorner: { value: 1 / SCREEN_ROUNDNESS },
        uResolution: { value: screenPixels },
      },
      // The discarded corners have to blend over the shell behind them.
      transparent: true,
      depthWrite: false,
    }),
  })
  // Barely proud of the plateau: enough to avoid z-fighting, not enough to float.
  screen.position.set(0, SCREEN_Y, FRONT_Z + 0.008)
  screen.setParent(root)

  const buttonGeometry = pebbleGeometry(gl, {
    size: [BUTTON_R, BUTTON_R, BUTTON_DEPTH],
    roundness: 0.62,
    segments: 32,
  })
  const layout: { id: ButtonId; x: number }[] = [
    { id: 'a', x: -BUTTON_SPACING },
    { id: 'b', x: 0 },
    { id: 'c', x: BUTTON_SPACING },
  ]
  const buttons = layout.map(({ id, x }) => {
    const mesh = new Mesh(gl, {
      geometry: buttonGeometry,
      program: plastic(id === 'b' ? [0.85, 0.32, 0.38] : [0.16, 0.17, 0.24], 0.25, 0.4, 0.08),
    })
    mesh.position.set(x, BUTTON_Y, FRONT_Z + 0.045)
    mesh.setParent(root)
    return { id, mesh, radius: BUTTON_R }
  })

  const pressed: Record<ButtonId, number> = { a: 0, b: 0, c: 0 }
  let orbitYaw = 0
  let orbitPitch = 0

  return {
    root,
    buttons,
    press(id) {
      pressed[id] = 1
    },
    setOrbit(yaw, pitch) {
      orbitYaw = yaw
      orbitPitch = pitch
    },
    setBodyColour(colour) {
      body.program.uniforms.uColor.value = colour
    },
    setScreenTextures(scene, bloomGlow) {
      screen.program.uniforms.tScene.value = scene
      screen.program.uniforms.tBloom.value = bloomGlow
    },
    setPower(value) {
      screen.program.uniforms.uPower.value = value
    },
    setBloom(value) {
      screen.program.uniforms.uBloom.value = value
    },
    setMotion(enabled) {
      screen.program.uniforms.uMotion.value = enabled ? 1 : 0
    },
    update(dt, time) {
      screen.program.uniforms.uTime.value = time
      for (const { id, mesh } of buttons) {
        pressed[id] = Math.max(0, pressed[id] - dt * 6)
        // Rubber travel: quick down, springy return.
        mesh.position.z = FRONT_Z + 0.045 - pressed[id] * 0.07
      }
      // The whole device drifts, so the specular highlight is never static. The
      // drift rides on top of however the viewer has turned it.
      root.rotation.y = orbitYaw + Math.sin(time * 0.25) * 0.07
      root.rotation.x = orbitPitch + Math.sin(time * 0.19 + 1.0) * 0.04
    },
  }
}

/**
 * Superellipse exponent of the lit screen area. The HUD uses it to keep content
 * clear of the rounded glass corners.
 */
export const SCREEN_CORNER_POWER = 1 / SCREEN_ROUNDNESS

export { SCREEN_W, SCREEN_H }
