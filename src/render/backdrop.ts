import { Mesh, Program, Transform, Triangle } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

const skyVert = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const skyFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uTime;
  uniform vec2 uSun;
  uniform vec3 uSunColour;
  uniform float uSunSize;
  uniform float uAspect;
  /** How far the camera has panned, in screen widths, so the sky pans with it. */
  uniform float uPan;
  /** Cloud amount, where the skyline is, and how lit the cloud is. */
  uniform vec3 uCloud;
  /** Distant ridges: how strongly they show, and their colour. */
  uniform float uRidges;
  uniform vec3 uRidgeColour;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }

  /** Value noise, smoothed. Cheap, and at this scale nobody is counting octaves. */
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.1) * 0.28 + noise(p * 4.3) * 0.17;
  }

  /**
   * A ridge line: one horizon of hills, given as the height of the skyline at
   * this column. Two of them are drawn, the far one paler and higher, which is
   * the whole of what aerial perspective needs to say 'miles away'.
   */
  float ridgeLine(float x, float scale, float lift, float amp) {
    return lift + (fbm(vec2(x * scale, scale)) - 0.5) * amp;
  }

  void main() {
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    // A slow band drifting up the backdrop, the way a cheap LCD backlight pulses.
    col += 0.03 * sin(vUv.y * 24.0 - uTime * 0.6) * vec3(0.4, 0.6, 1.0);

    // The sky pans with the camera. Everything on it is drawn against this x
    // rather than against the screen, or the clouds would sit welded to the
    // frame while the ground turned underneath them.
    float x = vUv.x + uPan;

    // Distant ridges, for country you can see out of. They are what makes a
    // hilltop a hilltop: the patch itself is fourteen lengths deep and hazed
    // out well before its far edge, so nothing in the scene can say how far
    // away the far edge of the view is. Two lines, the far one washed most of
    // the way into the sky.
    if (uRidges > 0.001) {
      // Sat on the skyline rather than at a height of their own: a ridge drawn
      // below where the ground ends is simply behind the ground.
      float far = ridgeLine(x, 3.0, uCloud.y + 0.072, 0.070);
      float near = ridgeLine(x + 11.0, 5.5, uCloud.y + 0.030, 0.052);
      float farMask = (1.0 - smoothstep(far - 0.004, far + 0.004, vUv.y)) * uRidges;
      float nearMask = (1.0 - smoothstep(near - 0.003, near + 0.003, vUv.y)) * uRidges;
      // Aerial perspective, which is the only thing that says how far off they
      // are: the far line is washed most of the way into the sky, the near one
      // holds most of its own colour, and neither is anywhere near as dark as
      // the ground in front of the pet.
      col = mix(col, mix(uRidgeColour * 0.66, col, 0.34), farMask);
      col = mix(col, uRidgeColour * 0.40, nearMask);
    }

    // Cloud. Drawn as a band rather than over the whole sky: a flat overcast is
    // the one thing that reads as a bug, and what sells height on a hill is
    // weather you are level with -- a deck of cloud sitting low, with the sky
    // going on above it.
    if (uCloud.x > 0.001) {
      // A deck sitting just above the skyline and thinning out overhead, which
      // is what cloud looks like from under it -- and, on a hill, weather you
      // are nearly level with.
      float deck = uCloud.y + 0.09;
      float band = 1.0 - smoothstep(0.0, 0.26, abs(vUv.y - deck));
      // Cut off below the skyline, where it would be cloud lying on the field.
      band *= smoothstep(uCloud.y - 0.02, uCloud.y + 0.04, vUv.y);
      // Stretched sideways and squashed vertically, because that is what a
      // cloud deck looks like from underneath it.
      vec2 p = vec2(x * 2.6 - uTime * 0.012, vUv.y * 7.0);
      float f = fbm(p);
      float cover = smoothstep(0.52 - uCloud.x * 0.30, 0.74 - uCloud.x * 0.20, f) * band;
      // Lit from wherever the sun is, so the tops catch it and the undersides
      // stay a shade of the sky they hang in. Well clear of the sky's own
      // colour: cloud tinted to within a few per cent of the sky behind it is
      // cloud nobody can see.
      float lit = clamp(0.45 + (vUv.y - deck) * 2.6, 0.0, 1.0);
      vec3 under = mix(uTop, uSunColour, 0.08) * 1.18 + 0.012;
      vec3 tops = under * 1.32 + uSunColour * 0.28;
      col = mix(col, mix(under, tops, lit), cover * uCloud.z);
    }

    // Sun or moon, with a halo. Its position comes from the same arc that
    // drives the lighting, so the shadows always agree with what is in the sky.
    vec2 offset = (vUv - uSun) * vec2(uAspect, 1.0);
    float d = length(offset);
    float disc = 1.0 - smoothstep(uSunSize * 0.85, uSunSize, d);
    float halo = 1.0 - smoothstep(uSunSize, uSunSize * 6.0, d);
    // The halo is faint in linear terms because the frame is encoded for
    // display afterwards, which lifts it a long way; tuned by eye against the
    // sky it sits on rather than by the number.
    col += uSunColour * (disc + halo * halo * 0.06);

    gl_FragColor = vec4(col, 0.0);
  }
`

export interface Backdrop {
  root: Transform
  setPalette(top: [number, number, number], bottom: [number, number, number]): void
  /** Places the sun or moon, in 0..1 screen coordinates. */
  setSun(position: [number, number], colour: [number, number, number], size: number): void
  /**
   * What is in the sky where the pet lives, and how much of the day is in it.
   * `cloud` is how much cover, `horizon` where this place's skyline falls --
   * everything on the backdrop is placed against it -- and `lit` how strongly
   * any of it shows, which goes with the daylight, since cloud picked out at
   * midnight is just fog on the screen.
   */
  setSky(cloud: number, horizon: number, lit: number, ridges: number, ridgeColour: [number, number, number]): void
  /** How far the camera has panned, in screen widths. The sky pans with it. */
  setPan(pan: number): void
  update(time: number): void
}

export function createBackdrop(gl: OGLRenderingContext): Backdrop {
  const root = new Transform()

  const sky = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: skyVert,
      fragment: skyFrag,
      uniforms: {
        uTop: { value: [0.10, 0.13, 0.26] },
        uBottom: { value: [0.03, 0.04, 0.08] },
        uTime: { value: 0 },
        uSun: { value: [0.5, 1.4] },
        uSunColour: { value: [0, 0, 0] },
        uSunSize: { value: 0.05 },
        uAspect: { value: 1.2 },
        uPan: { value: 0 },
        uCloud: { value: [0, 0.6, 0] },
        uRidges: { value: 0 },
        uRidgeColour: { value: [0.3, 0.34, 0.44] },
      },
      depthTest: false,
      depthWrite: false,
    }),
  })
  sky.frustumCulled = false
  sky.renderOrder = -1
  sky.setParent(root)

  return {
    root,
    setPalette(top, bottom) {
      sky.program.uniforms.uTop.value = top
      sky.program.uniforms.uBottom.value = bottom
    },
    setSun(position, colour, size) {
      sky.program.uniforms.uSun.value = position
      sky.program.uniforms.uSunColour.value = colour
      sky.program.uniforms.uSunSize.value = size
    },
    setSky(cloud, horizon, lit, ridges, ridgeColour) {
      sky.program.uniforms.uCloud.value = [cloud, horizon, lit]
      sky.program.uniforms.uRidges.value = ridges
      sky.program.uniforms.uRidgeColour.value = ridgeColour
    },
    setPan(pan) {
      sky.program.uniforms.uPan.value = pan
    },
    update(time) {
      sky.program.uniforms.uTime.value = time
    },
  }
}
