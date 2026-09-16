/* Mappr service worker.
 *
 * Built from src/sw.js by build.py, which stamps the version in. It exists for
 * one reason: so that someone who opens the hosted app once can keep using it
 * with no network, and can install it to their dock or home screen.
 *
 * Navigations are stale-while-revalidate: the cached page paints immediately,
 * a fresh copy is fetched in the background, and if it differs the page is told
 * so it can offer a reload. Everything else is cache-first, since the icons and
 * the manifest never change within a version.
 */
var VERSION = "0.13.0";
var CACHE = "mappr-v" + VERSION;
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function tellClients(msg) {
  return self.clients.matchAll({ type: "window" }).then(function (cs) {
    cs.forEach(function (c) { c.postMessage(msg); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match("./index.html").then(function (hit) {
          var net = fetch(req).then(function (res) {
            if (!res || !res.ok) return res;
            var copy = res.clone();
            // Only announce an update when the bytes actually changed.
            return Promise.all([copy.text(), hit ? hit.clone().text() : Promise.resolve(null)])
              .then(function (pair) {
                if (pair[1] !== null && pair[0] !== pair[1]) tellClients({ type: "mappr-update" });
                return c.put("./index.html", res.clone()).then(function () { return res; });
              })
              .catch(function () { return res; });
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
