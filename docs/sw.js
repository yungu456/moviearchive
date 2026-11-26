import { saveSharedSource } from "./js/db.js?v=13";
import { fillReelTitle } from "./js/reel-title.js?v=13";
import { extractSharedSource } from "./js/reel-url.js";

const root = new URL(self.registration.scope);
const home = new URL("./", root).href;
const index = new URL("./index.html", root).href;
const sharePath = new URL("./share-target", root).pathname;
const cachePrefix = `moviearchive:${root.pathname}:`;
const cacheName = cachePrefix + "v15";
const assets = new Set([
  "./", "./index.html", "./manifest.webmanifest", "./css/styles.css?v=13",
  "./js/app.js?v=15", "./js/backup.js?v=13", "./js/db.js?v=13", "./js/poster.js",
  "./js/reel-url.js", "./js/reel-title.js?v=13", "./js/settings.js", "./js/poster-lookup.js?v=14", "./js/film-details.js?v=14",
  "./icons/icon-192.png", "./icons/icon-512.png",
].map((path) => new URL(path, root).href));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function shareResult(status) {
  const url = new URL(home);
  url.searchParams.set("share", status);
  return Response.redirect(url, 303);
}

async function receiveShare(request) {
  let reelUrl;
  try {
    const fields = await request.formData();
    reelUrl = extractSharedSource([fields.get("url"), fields.get("text"), fields.get("title")]);
  } catch {
    return shareResult("invalid");
  }
  if (!reelUrl) return shareResult("invalid");

  try {
    const { movie, created } = await saveSharedSource(reelUrl);
    if (!created && movie.title) return shareResult("duplicate");
    const resolved = await fillReelTitle(movie);
    return shareResult(resolved.title ? "saved" : created ? "untitled" : "duplicate");
  } catch {
    return shareResult("error");
  }
}

async function loadPage(request, cacheKey) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) return response;
  } catch {
    // The installed copy remains available offline.
  }
  const cache = await caches.open(cacheName);
  return (await cache.match(cacheKey)) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== root.origin) return;
  if (request.method === "POST" && url.pathname === sharePath) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== "GET") return;
  const page = url.origin + url.pathname;
  if (request.mode === "navigate" && (page === home || page === index)) {
    event.respondWith(loadPage(request, page));
  } else if (assets.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(request)) || fetch(request)));
  }
});
