# SKS PARTS — сайт-каталог (демо)

Чистый HTML/CSS/JS, один файл `index.html`, без библиотек и конструкторов.
Логотип, насосы и иконки нарисованы внутри файла (SVG), поэтому внешних картинок нет.

## Страницы
`#home`, `#about`, `#pick`, `#catalog` (фильтры в адресе: `?type=axial&tech=excavator&q=k3v`),
`#p-<код>` (товар), `#services`, `#contacts`. Ссылку на любую страницу можно отправить клиенту, кнопка «назад» работает.

## Где править данные
В `index.html`, блок `<script>`:
- `PRODUCTS` — каталог (сейчас 18 демо-позиций);
- `PICK` — таблица «машина → насос» (сейчас пример);
- `WA_NUMBER` — номер WhatsApp.

## ИИ-помощник
- `AI_ENDPOINT = ""` → демо-режим, готовые ответы по таблице подбора.
- Боевой режим: развернуть `worker/` на Cloudflare Workers и вписать его адрес в `AI_ENDPOINT`.

```bash
cd worker && npm install
npx wrangler kv namespace create SKS_KV
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

Ключ API хранится только в секретах Worker, в коде страницы его нет.
Лимиты задаются в `wrangler.toml`: `MAX_MSG_PER_HOUR` (с одного IP) и `MONTHLY_LIMIT_USD`.
Модель: Claude Haiku 5.5 (`claude-haiku-5-5`). Счётчики в KV приблизительные (KV обновляется с задержкой), поэтому месячный лимит в консоли Anthropic тоже стоит выставить.

## Выкладка
- Демо (GitHub Pages): загрузить `index.html` и `robots.txt`. В `index.html` стоит `noindex`.
- Финал (sksparts.kz): убрать строку `<meta name="robots" content="noindex, nofollow">` и `robots.txt`.
- PRD и внутренние заметки в репозиторий не класть.
