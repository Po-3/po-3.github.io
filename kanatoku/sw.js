/* かなトク！ Service Worker — オフライン対応 */
const CACHE = "kanatoku-v23";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./header.png",
  "./iconpay-paypay.png",
  "./iconpay-rakuten.png",
  "./iconpay-d.png",
  "./iconpay-au.png",
  "./iconpay-merpay.png",
  "./iconpay-aeon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // notice.json は常に最新を取りに行く（キャッシュしない／失敗時は告知なし扱い）
  if (new URL(e.request.url).pathname.endsWith("/notice.json")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"active":false}', { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
