/**
 * Installing the site as an app.
 *
 * The worker is what makes the browser offer the install, and what lets the
 * pet be opened again on a train. It is registered only in a real build:
 * in dev it would sit in front of Vite's module graph and serve yesterday's
 * code back to you.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  // Relative to the page, so the site still works from a subdirectory.
  const url = new URL('sw.js', document.baseURI)
  const scope = new URL('./', document.baseURI)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url.href, { scope: scope.href }).catch(() => {
      // An unregisterable worker (file://, a private window) costs nothing but
      // the offline copy -- the game itself needs no network at all.
    })
  })
}
