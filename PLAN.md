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

- [x] 0. Подготовка — app `FAQ Manager` в организации ECORN, магазин `test-ecorn-sam-nav.myshopify.com`.
  `faq_item` в магазине не было → создан через `shopify store execute` по спецификации + 5 тестовых записей
  (`scripts/seed/`).
- [x] 1. Каркас + auth — embedded, token exchange, проверено в Admin.
- [x] 2. Чтение — реальные записи в таблице.
- [x] 3. Create/Edit — проверено на живом магазине; очистка category через `""` подтверждена.
- [x] 4. Поиск/фильтры.
- [x] 5. Деплой — Railway, https://faq-manager-production-e47e.up.railway.app; `shopify app deploy`; установлено.
- [x] 6. README.
- [ ] 6. Видео 2–3 мин.
- [x] Бонус: delete + 26 автотестов (маппинг, валидация, фильтры, роуты, CSP) + CI.

### Решённые по ходу проблемы
- `create-next-app` и `npm install` падали в песочнице / на vitest 5 → каркас вручную, vitest 3.
- `@shopify/shopify-api@15` требует Node 22 → 13.1.0.
- App Bridge грузился позже гидрации React → ожидание `shopify` перед `idToken()`.
- Definition не сохранялся через UI → создан через CLI.

### Не сделано (осознанно)
- Пагинация: грузим 50 последних по `updated_at`.
- Хранилище сессий: токены в памяти, достаточно для одного dev store.
