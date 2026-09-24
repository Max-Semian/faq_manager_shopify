# FAQ Manager — план реализации

Таймбокс: 3 часа. Приоритет: рабочий embedded app → реальные данные → create/edit → деплой → README/видео.

## 1. Требования

**Must**
- Next.js + TypeScript, embedded в Shopify Admin.
- Auth + Shopify GraphQL Admin API.
- Таблица до 50 `faq_item`: question, category, active.
- Create и Edit (модалка или отдельная страница).
- Только реальные данные.
- Состояния: loading, empty, validation, success, API error.
- Polaris.
- Деплой, установка на dev store, секреты в env.
- README (setup, архитектура, ограничения, AI-раздел) + видео 2–3 мин.

**Should (после ядра)**
- Поиск по question.
- Фильтры category / active (client-side).

**Bonus (одно)**: delete/duplicate | пагинация | optimistic UI | один тест.

**Out of scope**: multi-store auth, создание definition, внешняя БД, вебхуки, billing, rich text, bulk.

### Нюансы
- `faq_item` — merchant-owned definition (не `$app:`), нужны scopes `read_metaobjects,write_metaobjects`.
- Значения полей — строки; boolean = `"true"`/`"false"`; пустой category не отправляем.
- `active` — обычное поле, не capability `publishable`. Проверить, включён ли `publishable` у definition.
- БД нет → token exchange (session token из App Bridge → offline access token), managed installation через `shopify.app.toml`.

## 2. Архитектура

```
Shopify Admin (iframe)
 └─ Next.js App Router (Railway)
     ├─ layout: App Bridge (CDN) + <meta shopify-api-key>, Polaris web components (CDN)
     ├─ app/page.tsx                 — таблица + поиск + фильтры
     ├─ components/FaqModal.tsx      — форма create/edit
     ├─ app/api/faqs/route.ts        — GET list / POST create
     ├─ app/api/faqs/[id]/route.ts   — PATCH update
     └─ lib/
         ├─ shopify.ts     — shopifyApi(), verify session token, token exchange, кэш токена
         ├─ faq.ts         — GraphQL + маппинг fields ⇄ FaqItem
         └─ validation.ts  — zod-схема (общая для клиента и сервера)
```

Поток: `fetch('/api/faqs')` → App Bridge добавляет `Authorization: Bearer <session token>` → сервер проверяет JWT
(подпись, `aud`, `exp`, `dest`) → token exchange → Admin GraphQL.

GraphQL:
- list: `metaobjects(type: "faq_item", first: 50)` с алиасами `field(key: ...)`
- create: `metaobjectCreate(metaobject: { type, fields })`
- update: `metaobjectUpdate(id, metaobject: { fields })`
- всегда разбираем `userErrors`.

Security: secret только на сервере; zod-валидация на сервере; проверка формата gid; CSP `frame-ancestors`; `.env` в `.gitignore`.

## 3. Этапы

| # | Этап | Время | Итого | Нужны доступы |
|---|------|-------|-------|---------------|
| 0 | Подготовка: доступы, проверка definition, создание app, репо | 15 мин | 0:15 | да |
| 1 | Каркас Next.js + embedded + auth (token exchange) | 45 мин | 1:00 | код — нет, проверка — да |
| 2 | Чтение: GET + таблица + loading/empty/error | 25 мин | 1:25 | код — нет, проверка — да |
| 3 | Create/Edit: zod, модалка, POST/PATCH, userErrors, toast | 40 мин | 2:05 | код — нет, проверка — да |
| 4 | Поиск + фильтры (client-side) | 15 мин | 2:20 | нет |
| 5 | Деплой (Railway) + `shopify app deploy` + установка | 20 мин | 2:40 | да |
| 6 | README + видео | 20 мин | 3:00 | частично |
| — | Бонус: тест маппинга/валидации (Vitest) | 10 мин | если есть время | нет |

### Критерии готовности
- 0: известны точные ключи полей и наличие `publishable`; есть API key/secret.
- 1: приложение открывается в Admin и показывает `shop.name` из API.
- 2: в таблице реальные sample-записи.
- 3: созданная/изменённая запись видна в Admin → Content → Metaobjects.
- 5: всё работает на проде на dev store.

## 4. Риски и cut-line
- Auth/iframe — главный риск. Если к 1:00 не работает — брать официальный пример token exchange, а не отлаживать своё.
- Проблемы с модалкой → отдельная страница `/faq/[id]`.
- При нехватке времени режем: бонус → фильтры → поиск. Не режем: деплой, create/edit, состояния, README.
- Для AI-раздела README фиксировать реальные эпизоды по ходу (проверка `aud`/`dest` в JWT, сериализация boolean/пустых значений).

## 5. Статус

- [~] 0. Подготовка — доступ к ECORN есть, app `FAQ Manager` создан и задеплоен (`faq-manager-2`).
  Магазин `test-ecorn-sam-nav.myshopify.com`. `faq_item` там не было → создан через `shopify store execute`
  (CLI 3.94.3) по спецификации + 5 тестовых записей (`scripts/seed/`). Спросить компанию про нужный магазин.
- [~] 1. Каркас + auth — код готов, не проверен на реальном магазине
- [~] 2. Чтение — код готов, не проверен на реальных данных
- [~] 3. Create/Edit — код готов, не проверен на реальных данных
- [x] 4. Поиск/фильтры
- [~] 5. Деплой — Railway: проект `shopify-faq-manager`, сервис `faq-manager`,
  https://faq-manager-production-e47e.up.railway.app (health OK). Не заданы `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET`,
  не выполнен `shopify app deploy`, не установлено на dev store.
- [~] 6. README — черновик, дописать после проверки; видео — после деплоя
- [x] Бонус: unit-тесты (маппинг, userErrors, валидация, фильтры)

Проверено локально: `tsc`, eslint, `next build`, 9 тестов, smoke-тест API (401 без токена / с плохой подписью / с чужим `aud`), CSP-заголовок.

### Что нужно после получения доступов
1. `shopify app config link` → заполнится `client_id` в `shopify.app.toml`.
2. Проверить в Admin definition `faq_item`: ключи полей (`question`, `answer`, `category`, `active`) и включён ли `publishable`. При расхождении поправить `lib/faq.ts`.
3. `shopify app dev` → открыть в Admin и проверить:
   - App Bridge грузится (он должен быть первым `<script>` в `<head>`, а Next вставляет свои чанки раньше — возможен warning);
   - модалка открывается/закрывается, поля и checkbox реагируют на ввод;
   - клик по строке таблицы открывает edit;
   - создание/редактирование видно в Admin → Content → Metaobjects;
   - очистка category на update (`""`) действительно очищает поле.
4. `railway variables --set SHOPIFY_API_KEY=... --set SHOPIFY_API_SECRET=...` (перезапустит сервис),
   `shopify app deploy` (URL уже прописан в `shopify.app.toml`), установить на dev store.
5. `git init`, первый коммит, push на GitHub.
6. Дописать AI-раздел README, записать видео.

Оценка оставшегося: ~1–1.5 ч (проверка и правки ~40 мин, деплой ~20 мин, README/видео ~20 мин).
