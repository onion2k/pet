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
  varying vec2 vUv;

  void main() {
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    // A slow band drifting up the backdrop, the way a cheap LCD backlight pulses.
    col += 0.03 * sin(vUv.y * 24.0 - uTime * 0.6) * vec3(0.4, 0.6, 1.0);

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
    update(time) {
      sky.program.uniforms.uTime.value = time
    },
  }
}
