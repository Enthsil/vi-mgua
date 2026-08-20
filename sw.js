/*
  ============================================================
   ВИ МГЮА — офлайновый режим для версии в браузере и на телефоне
   Автор: Иванова М.М.
   © 2026. Все права защищены.
   Контакты: ma193@vk.com | Telegram https://t.me/enthsil | VK https://vk.ru/enthsil1
  ============================================================

  Как это работает.

  Оболочка — главная страница, тренажёр и иконки — сохраняется сразу при
  первом заходе. Это около двух мегабайт, загружается почти мгновенно.

  Крупные модули по 11–15 МБ сразу не тянутся: человек может прийти за одной
  темой, и заставлять его ждать пятьдесят мегабайт невежливо. Каждый модуль
  сохраняется в тот момент, когда его открыли, и со следующего раза работает
  без интернета.

  Кнопка «сохранить всё для офлайна» на главной странице скачивает оставшееся
  разом — для тех, кто собирается заниматься в дороге.
*/

const ВЕРСИЯ = 'vi-mgua-1.1.0';
const КЭШ = ВЕРСИЯ;

// Оболочка: то, без чего приложение не откроется вообще.
const ОБОЛОЧКА = [
  './',
  './index.html',
  './trainer.html',
  './app.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// Крупные модули: сохраняются по мере открытия или по кнопке.
const МОДУЛИ = [
  './gp_gpp_interactive.html',
  './up_upp_interactive.html',
  './readiness_interactive.html',
  './judicial_practice.html',
];

self.addEventListener('install', (event) => {
  // Каждый файл кладём отдельно. Если один почему-то не отдался, остальные
  // всё равно сохранятся: иначе одна опечатка в списке ломала бы офлайн целиком.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(КЭШ);
      for (const адрес of ОБОЛОЧКА) {
        try {
          await cache.add(адрес);
        } catch (ошибка) {
          /* пропускаем: не критично */
        }
      }
      await self.skipWaiting();
    })()
  );
});

// При смене версии старые кэши удаляются, чтобы не копить мегабайты.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((имена) =>
        Promise.all(имена.filter((имя) => имя !== КЭШ).map((имя) => caches.delete(имя)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const запрос = event.request;

  if (запрос.method !== 'GET') return;
  if (new URL(запрос.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(запрос, { ignoreSearch: true }).then((изКэша) => {
      if (изКэша) return изКэша;

      return fetch(запрос)
        .then((ответ) => {
          // Кладём в кэш только удачные ответы своего сайта.
          if (ответ && ответ.status === 200 && ответ.type === 'basic') {
            const копия = ответ.clone();
            caches.open(КЭШ).then((cache) => cache.put(запрос, копия));
          }
          return ответ;
        })
        .catch(() => {
          // Сети нет и в кэше пусто: для переходов между страницами
          // отдаём главную, чтобы человек не упёрся в пустой экран.
          if (запрос.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Нет сети' });
        });
    })
  );
});

// Команда со страницы: сохранить всё оставшееся, докладывая о ходе работы.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.тип !== 'сохранить-всё') return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(КЭШ);
      const источник = event.source;
      let готово = 0;

      for (const адрес of МОДУЛИ) {
        try {
          const уже = await cache.match(адрес, { ignoreSearch: true });
          if (!уже) {
            const ответ = await fetch(адрес, { cache: 'reload' });
            if (ответ.ok) await cache.put(адрес, ответ);
          }
          готово += 1;
          if (источник) {
            источник.postMessage({ тип: 'прогресс', готово, всего: МОДУЛИ.length });
          }
        } catch (ошибка) {
          if (источник) {
            источник.postMessage({ тип: 'ошибка', адрес: адрес });
          }
          return;
        }
      }

      if (источник) источник.postMessage({ тип: 'готово' });
    })()
  );
});
