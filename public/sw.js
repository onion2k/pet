/**
 * The whole game is a handful of static files with no backend, so the worker
 * has an easy job: keep a copy of everything it serves, and prefer the copy.
 * Bump CACHE when you ship -- the old cache is dropped on activation, and the
 * new one fills itself from the network as the page asks for things.
 */
const CACHE = 'petz-9000-v1'
/** The two pages of the site. Everything else is picked up as it is fetched. */
const SHELL = ['./', './index.html', './how-to-play.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // A miss here (a page renamed, say) must not sink the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations go to the network first so a deploy is picked up on the next
  // launch, and fall back to the cached page when there is no network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html'))),
    )
    return
  }

  // Assets are content-hashed by the build, so a hit is always the right file.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
