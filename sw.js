const CACHE_NAME = 'sklad-mp-v4'; // Увеличил версию кеша, чтобы перебить старую
const urlsToCache = [
  '/sklad-mp/index.html',
  '/sklad-mp/manifest.json',
  '/sklad-mp/icon.png'
];

// Установка: кешируем только статику (иконки, шрифты), но НЕ HTML
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Кешируем только то, что не меняется
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация: удаляем ВСЕ старые версии кеша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Заставляем новый SW взять управление сразу
  );
});

// Обработка запросов (самое важное)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. HTML-страницы НЕ кешируем. Всегда берем из сети, чтобы видеть обновления.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Если сети нет, можно вернуть заглушку, но лучше не возвращать ничего,
        // чтобы пользователь видел ошибку и обновил страницу, когда появится сеть.
        return caches.match('/sklad-mp/index.html'); 
      })
    );
    return;
  }

  // 2. Google API (ваши таблицы) всегда в сеть
  if (url.hostname === 'script.google.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Для всего остального (картинки, шрифты) — кеш
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Если есть в кеше — отдаем из кеша
        if (cachedResponse) {
          return cachedResponse;
        }
        // Если нет — тянем из сети
        return fetch(event.request).then((networkResponse) => {
          // Кладем в кеш копию ответа
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
  );
});
