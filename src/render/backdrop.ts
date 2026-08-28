import { Mesh, Plane, Program, Transform, Triangle } from 'ogl'
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
  varying vec2 vUv;

  void main() {
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    // A slow band drifting up the backdrop, the way a cheap LCD backlight pulses.
    col += 0.03 * sin(vUv.y * 24.0 - uTime * 0.6) * vec3(0.4, 0.6, 1.0);
    gl_FragColor = vec4(col, 0.0);
  }
`

const floorVert = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const floorFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    // Derivative-free grid: the line widens with distance instead of using fwidth,
    // which keeps the shader valid on WebGL1 fallbacks.
    vec2 cell = abs(fract(vUv * 20.0 - 0.5) - 0.5);
    float width = 0.03 + vDepth * 0.008;
    float line = 1.0 - smoothstep(width * 0.4, width, min(cell.x, cell.y));
    // Fade the grid out with distance so the floor reads as a room, not a plane.
    float fog = exp(-max(vDepth - 3.0, 0.0) * 0.45);
    vec3 col = uColor * (0.18 + line * 0.9);
    gl_FragColor = vec4(col * fog, line * fog * 0.5);
  }
`

export interface Backdrop {
  root: Transform
  setPalette(top: [number, number, number], bottom: [number, number, number], grid: [number, number, number]): void
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
      },
      depthTest: false,
      depthWrite: false,
    }),
  })
  sky.frustumCulled = false
  sky.renderOrder = -1
  sky.setParent(root)

  const floor = new Mesh(gl, {
    geometry: new Plane(gl, { width: 24, height: 24 }),
    program: new Program(gl, {
      vertex: floorVert,
      fragment: floorFrag,
      uniforms: { uColor: { value: [0.28, 0.42, 0.85] }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    }),
  })
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  floor.setParent(root)

  return {
    root,
    setPalette(top, bottom, grid) {
      sky.program.uniforms.uTop.value = top
      sky.program.uniforms.uBottom.value = bottom
      floor.program.uniforms.uColor.value = grid
    },
    update(time) {
      sky.program.uniforms.uTime.value = time
      floor.program.uniforms.uTime.value = time
    },
  }
}
