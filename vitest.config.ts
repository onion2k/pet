import { defineConfig } from 'vitest/config'

/**
 * The suite runs headless. Everything under `src/game`, `src/data` and the pure
 * parts of `src/engine` is plain logic with its clock, its dice and its storage
 * behind seams, so it needs no DOM at all -- which is what makes a full pet
 * lifetime a few milliseconds rather than a few hours.
 *
 * `src/render` and `src/main.ts` are WebGL, canvas and DOM wiring. They are
 * excluded from coverage rather than stubbed: a fake GL context proves nothing
 * about a shader, and pretending otherwise would make the number a lie. The
 * pure helpers that live among them are covered by their own tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/game/**', 'src/data/**', 'src/engine/random.ts', 'src/engine/clock.ts'],
      // Types only: erased at compile time, so there is nothing to execute.
      exclude: ['src/game/types.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
