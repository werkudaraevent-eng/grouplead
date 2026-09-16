/*
  Sales Activity service worker.

  Versioned by the ?v= query in its registration URL, so each deploy is a
  new worker. It caches only hashed, immutable static assets and the app
  icons; navigations and data always go to the network. When it activates
  it deletes every cache from a previous version.
*/
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev"
const CACHE = `sa-static-${VERSION}`

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === "navigate") return // pages: network, always
  const immutable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")
  if (!immutable) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request)
      if (hit) return hit
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    })
  )
})
