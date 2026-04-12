/* ══════════════════════════════════
   SERVICE WORKER — Caligo Pt.2
   정적 파일 캐시 + 오프라인 지원
══════════════════════════════════ */
const CACHE_NAME = 'caligo-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './watermark.js',
  './poca_db.json',
  './notices.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Outfit:wght@500;600;700;800&display=swap'
];

// 설치: 핵심 파일만 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// 활성화: 구 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch 전략
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 카드 이미지: Cache First (네트워크 요청 최소화)
  if(url.pathname.includes('/images/cards/')){
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res.ok){
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // poca_db.json, notices.json: Network First (항상 최신 데이터)
  if(url.pathname.endsWith('poca_db.json') || url.pathname.endsWith('notices.json')){
    e.respondWith(
      fetch(e.request).then(res => {
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 나머지 (HTML, JS, CSS): Stale While Revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {});
      return cached || fetchPromise;
    })
  );
});
