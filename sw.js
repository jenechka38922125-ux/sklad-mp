const CACHE_NAME = 'sklad-mp-v3';

// Базовые файлы оболочки приложения с учетом пути репозитория /sklad-mp/
const ASSETS_TO_CACHE = [
  '/sklad-mp/',
  '/sklad-mp/index.html',
  '/sklad-mp/manifest.json',
  '/sklad-mp/icon.png'
];

// Установка: кешируем каркас приложения и активируем сразу
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Активация: удаляем старые версии кеша и перехватываем управление вкладками
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Все запросы к Google Apps Script / Google API направляем только в сеть
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. POST, PUT, DELETE запросы нельзя кэшировать — отправляем напрямую в сеть
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Для остальных GET-запросов: Network First (сначала сеть, при сбое — кэш)
  // Это гарантирует, что пользователь всегда видит актуальные данные из GitHub
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Если ответ валидный, сохраняем копию в кэш
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Если нет интернета или ошибка сети — отдаём из кэша
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Если запрашивалась HTML-страница, возвращаем главный экран
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/sklad-mp/index.html');
          }
        });
      })
  );
});
