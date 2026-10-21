// 말랑메모: 인터넷이 없어도 앱 화면이 열리도록 앱 파일만 저장 (메모 내용은 저장하지 않음)
const CACHE = 'mallang-v14';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'common.js', 'table.css', 'cloud-core.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'logo.png', 'install-early.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // 항상 새 버전을 먼저 받고, 안 되면 저장해 둔 화면을 보여줌
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
