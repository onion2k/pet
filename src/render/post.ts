import { Mesh, Program, RenderTarget, Triangle } from 'ogl'
import type { OGLRenderingContext, Renderer, Texture } from 'ogl'

const fullscreenVert = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const thresholdFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uThreshold;
  uniform float uSoftness;
  varying vec2 vUv;

  void main() {
    vec4 src = texture2D(tMap, vUv);
    float luma = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
    // The scene writes an explicit bloom mask into alpha, so emissive voxels
    // glow even when they aren't the brightest thing on screen.
    float keep = max(smoothstep(uThreshold, uThreshold + uSoftness, luma), src.a);
    gl_FragColor = vec4(src.rgb * keep, 1.0);
  }
`

const blurFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uDirection;
  varying vec2 vUv;

  void main() {
    // Nine-tap gaussian, folded into five bilinear samples.
    vec3 sum = texture2D(tMap, vUv).rgb * 0.2270270270;
    vec2 off1 = uDirection * 1.3846153846;
    vec2 off2 = uDirection * 3.2307692308;
    sum += texture2D(tMap, vUv + off1).rgb * 0.3162162162;
    sum += texture2D(tMap, vUv - off1).rgb * 0.3162162162;
    sum += texture2D(tMap, vUv + off2).rgb * 0.0702702703;
    sum += texture2D(tMap, vUv - off2).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`

function pass(gl: OGLRenderingContext, fragment: string, uniforms: Record<string, { value: unknown }>): Mesh {
  const mesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: fullscreenVert, fragment, uniforms, depthTest: false, depthWrite: false }),
  })
  mesh.frustumCulled = false
  return mesh
}

function target(gl: OGLRenderingContext, width: number, height: number): RenderTarget {
  return new RenderTarget(gl, {
    width,
    height,
    depth: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
  })
}

export interface Bloom {
  /** Runs threshold + separable blur and returns the glow texture. */
  render(renderer: Renderer, source: Texture): Texture
  resize(width: number, height: number): void
  strength: number
}

/**
 * Half-resolution bloom with two blur widths. The wide pass is what gives the
 * screen that overdriven CRT halo rather than a tight highlight.
 */
export function createBloom(gl: OGLRenderingContext, width: number, height: number): Bloom {
  let w = Math.max(2, Math.floor(width / 2))
  let h = Math.max(2, Math.floor(height / 2))

  let bright = target(gl, w, h)
  let pingA = target(gl, w, h)
  let pingB = target(gl, w, h)

  const thresholdPass = pass(gl, thresholdFrag, {
    tMap: { value: null },
    uThreshold: { value: 0.62 },
    uSoftness: { value: 0.3 },
  })
  const blurPass = pass(gl, blurFrag, {
    tMap: { value: null },
    uDirection: { value: [0, 0] },
  })

  const blur = (renderer: Renderer, src: Texture, dst: RenderTarget, dx: number, dy: number) => {
    blurPass.program.uniforms.tMap.value = src
    blurPass.program.uniforms.uDirection.value = [dx / w, dy / h]
    renderer.render({ scene: blurPass, target: dst, clear: true })
  }

  return {
    strength: 1,
    render(renderer, source) {
      thresholdPass.program.uniforms.tMap.value = source
      renderer.render({ scene: thresholdPass, target: bright, clear: true })

      // Tight pass, then a wider one over the result, for a two-tier falloff.
      blur(renderer, bright.texture, pingA, 1, 0)
      blur(renderer, pingA.texture, pingB, 0, 1)
      blur(renderer, pingB.texture, pingA, 2.5, 0)
      blur(renderer, pingA.texture, pingB, 0, 2.5)
      return pingB.texture
    },
    resize(nextWidth, nextHeight) {
      w = Math.max(2, Math.floor(nextWidth / 2))
      h = Math.max(2, Math.floor(nextHeight / 2))
      for (const rt of [bright, pingA, pingB]) rt.setSize(w, h)
    },
  }
}

export { fullscreenVert }
