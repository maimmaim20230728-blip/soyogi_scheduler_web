'use strict';
/* そよぎ式スケジューラー Service Worker
   ・install時に実行ファイルをprecache
   ・HTMLはnetwork-first(更新をすぐ反映・オフライン時はキャッシュ)
   ・その他(css/js/json/icon)はcache-first
   ・開発/検証用ファイル(_始まり)はキャッシュしない
   🔴 更新のたびに CACHE 名を必ず上げる(feedback-always-bump-version) */
const CACHE = 'sched-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './audio.js',
  './tap.js',
  './timer.js',
  './i18n.js',
  './cards.js',
  './app.js',
  './manifest.json',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // 開発・検証用ページ(_で始まるファイル)はキャッシュせず常に最新を返す
  if (u.origin === location.origin && u.pathname.split('/').pop().startsWith('_')) return;

  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // HTML は network-first
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && u.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // その他は cache-first
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && u.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
