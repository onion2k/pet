import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    target: 'es2022',
    // The game and its instructions booklet are two pages of one site.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        howto: resolve(import.meta.dirname, 'how-to-play.html'),
      },
    },
  },
})
