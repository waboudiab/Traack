const CACHE = "traack-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/", "/login", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Traack", body: "Something new arrived.", url: "/leads" };
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) };
  } catch {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Traack", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/leads" },
    })
  );
});

function openPath(value) {
  const path = String(value || "/leads");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/leads";
  return path;
}

async function openApp(path) {
  const target = new URL(path, self.location.origin).href;
  const opened = await self.clients.openWindow(target);
  if (opened) return opened;
  const home = new URL("/", self.location.origin);
  home.searchParams.set("open", path);
  return self.clients.openWindow(home.href);
}

self.addEventListener("notificationclick", (event) => {
  const path = openPath(event.notification.data?.url);
  const target = new URL(path, self.location.origin).href;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      const ours = list.filter((client) => client.url.startsWith(self.location.origin));
      for (const client of ours) {
        try {
          const focused = await client.focus();
          if (!focused || (focused.visibilityState !== "visible" && !focused.focused)) continue;
          if (typeof focused.navigate === "function") {
            await focused.navigate(target);
            return focused;
          }
          focused.postMessage({ type: "traack-open", url: path });
          return focused;
        } catch {
          // This window could not be brought forward. Try the next one, then open the app.
        }
      }
      return openApp(path);
    })
  );
});
