# Как получить APK (Android) для PlayZone CRM — через GitHub

Приложение — это «обёртка» (TWA) вокруг вашего работающего сайта: телефон
открывает ту же CRM, что и браузер, но на весь экран, с вашей иконкой, без
адресной строки. Оффлайн-режим, сирена и очередь операций работают так же,
потому что внутри — Chrome.

Весь путь: **развернуть сайт по HTTPS → залить код на GitHub → запустить
готовый workflow → скачать APK**. На компьютер ничего устанавливать не нужно —
сборка идёт на серверах GitHub бесплатно.

---

## Шаг 0. Что уже готово в проекте

* `android/` — готовый Android-проект (TWA-обёртка): манифест, иконки,
  подпись, splash-экран. Собирается командой Gradle без единого вопроса.
* `.github/workflows/build-apk.yml` — workflow сборки: сам подставляет ваш
  адрес, название и packageId, создаёт/подписывает ключом, выпускает
  `PlayZone-CRM.apk` + `assetlinks.json` + ключ подписи.
* `public/manifest.json`, иконки, service worker — на месте (PWA готова).

## Шаг 1. Развернуть CRM по HTTPS (обязательно)

APK открывает ваш сайт, поэтому адрес должен работать по `https://...`.

### Вариант A (рекомендуется): дешёвый VPS + Caddy

1. Возьмите любой VPS за ~3–5 $/мес (2 GB RAM достаточно: например, PS.kz,
   Hostinger, Timeweb).
2. Установите Node.js 20+ (или Bun) и скопируйте проект на сервер:
   ```bash
   git clone https://github.com/ВАШ_ЛОГИН/playzone-crm.git
   cd playzone-crm
   bun install            # или npm install
   bun run db:push        # создать базу
   bun run build
   bun run start          # CRM на localhost:3000
   ```
3. Купите домен (или возьмите бесплатный `xxx.duckdns.org`) и направьте его
   на IP сервера.
4. Поставьте Caddy (он сам получает HTTPS-сертификат) и укажите в Caddyfile:
   ```
   crm.ваш-домен.kz {
       reverse_proxy localhost:3000
   }
   ```
   `sudo systemctl reload caddy` — теперь CRM открывается по
   `https://crm.ваш-домен.kz`.
5. Автозапуск CRM: `pm2 start "bun run start" --name playzone` + `pm2 save`.
6. Бэкап базы раз в день: `scripts/backup-db.sh` (cron).

### Вариант B: без VPS — Cloudflare Tunnel (бесплатно)

CRM работает на вашем компьютере/мини-ПК (он должен быть включён во время
работы клуба; спящий режим отключить). Кратко:

1. Установите Node.js 20+ (или Bun) и cloudflared
   (github.com/cloudflare/cloudflared/releases → cloudflared-windows-amd64.exe).
2. Запустите CRM: `bun install && bun run db:push && bun run build && bun run start`
   (на Windows — в Git Bash из комплекта Git for Windows).
3. Быстрый тест без аккаунта (адрес меняется при каждом запуске — для APK
   НЕ годится): `cloudflared tunnel --url http://localhost:3000` → откройте
   выданный `https://…trycloudflare.com`.
4. Постоянный адрес: купите дешёвый домен → добавьте в Cloudflare
   (dash.cloudflare.com → Add site → Free) → смените NS у регистратора →
   `cloudflared tunnel login` → `cloudflared tunnel create playzone` →
   `cloudflared tunnel route dns playzone crm.ваш-домен` → в
   `~/.cloudflared/config.yml` пропишите туннель и
   `service: http://localhost:3000` → `cloudflared tunnel run playzone`.
5. Автозапуск: Windows — `start.bat` (CRM) и `tunnel.bat` (туннель) в папку
   автозагрузки (Win+R → shell:startup); Linux — `pm2` для CRM и
   `sudo cloudflared service install` для туннеля.
6. Бэкап: файл `db/custom.db` — единственное хранилище данных, копируйте
   раз в день в облако (`scripts/backup-db.sh` — для Linux).

> ⚠️ Проверка: откройте адрес с телефона в Chrome — CRM должна открываться
> и работать (вход admin/admin и т.д.).

## Шаг 2. Залить код на GitHub

```bash
git init                     # если ещё не репозиторий
git add .
git commit -m "PlayZone CRM + APK build"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/playzone-crm.git
git push -u origin main
```

(`db/custom.db` с реальными данными пушить не нужно — база создаётся
`bun run db:push` на сервере; он уже в `.gitignore`.)

## Шаг 3. Секреты подписи (один раз)

В репозитории: **Settings → Secrets and variables → Actions → New repository
secret**:

| Имя секрета                   | Значение                                            |
|-------------------------------|-----------------------------------------------------|
| `ANDROID_KEYSTORE_PASSWORD`   | придумайте пароль 8+ символов и сохраните           |
| `ANDROID_KEY_ALIAS_PASSWORD`  | тот же пароль                                       |

Без них сборка остановится с понятной ошибкой — это защита от того, чтобы
каждая сборка подписывалась новым ключом.

## Шаг 4. Запустить сборку APK

1. Вкладка **Actions** репозитория → слева **«Build Android APK»**.
2. **Run workflow** → заполните поля:
   * `pwa_url` — ваш HTTPS-адрес, например `https://crm.ваш-домен.kz`;
   * `app_name` — название на телефоне (по умолчанию «PlayZone CRM»);
   * `app_id` — не меняйте (`kz.playzone.crm`), менять только если понимаете зачем;
   * `version_code` — оставьте пустым (номер версии растёт сам с каждым запуском).
3. **Run workflow** → ждите ~5 минут (зелёная галочка).
4. Откройте завершившийся запуск → внизу **Artifacts** → скачайте
   **PlayZone-APK**. Внутри три файла:
   * `PlayZone-CRM.apk` — **тот самый файл для Android**;
   * `assetlinks.json` — положите на сервер (шаг 5);
   * `android.keystore` — ключ подписи. **Сохраните навсегда** (облако,
     флешка): все будущие версии должны подписываться им же.

## Шаг 5. Убрать адресную строку (assetlinks.json)

Из артефакта возьмите `assetlinks.json` и положите на сервер в проект:

```bash
mkdir -p public/.well-known
# скопируйте файл в public/.well-known/assetlinks.json
git add public/.well-known/assetlinks.json
git commit -m "assetlinks"
git push
# на сервере: git pull && bun run build && pm2 restart playzone
```

Проверка: `https://ваш-адрес/.well-known/assetlinks.json` должен открыть JSON.
Теперь при запуске APK не будет адресной строки (может понадобиться
перезапустить приложение 1–2 раза — Chrome проверяет связь с задержкой).

## Шаг 6. Установить и раздать сотрудникам

* Отправьте `PlayZone-CRM.apk` в Telegram/WhatsApp — на телефоне открывают
  и устанавливают (Android попросит разрешить установку из этого источника).
* Требование: Android 7.0+ (2016+), любой, где есть Chrome (он предустановлен).
* Для громких уведомлений о конце времени: **настройки Android → Приложения →
  PlayZone CRM → Уведомления: разрешить, звук, вибрация**; отключите
  экономию батареи для приложения (иначе Android «усыпляет» сирену в фоне).

## Обновления приложения

Данные живут на сайте (сервер + кэш браузера), а не в APK, поэтому обновления
простые:

1. Код обновили на сервере → телефон получает новую версию CRM сам (просто
   закройте и откройте приложение; кэш обновляется автоматически).
2. Поменялась обёртка (адрес, иконка, название) → запустите workflow ещё раз:
   версия (versionCode) вырастет автоматически, APK ставится поверх старого
   **без удаления** — данные клиентов и настройки не теряются.
3. Если первая сборка была давно: скачайте из нового артефакта
   `android.keystore` и загрузите в секрет `ANDROID_KEYSTORE_BASE64`
   (команда `base64 -w 0 android.keystore`) — тогда ключ точно не потеряется,
   даже если кэш GitHub очистится.

## Запасной вариант: PWABuilder (без GitHub)

Откройте `pwabuilder.com`, вставьте HTTPS-адрес CRM → **Package for stores →
Android** → скачайте APK. Результат тот же, но без вашего ключа подписи и без
автоматизации.

## Частые вопросы

**Сменился адрес сайта.** Запустите workflow с новым `pwa_url` и обновите
`assetlinks.json` на сервере. Старый APK продолжит открывать старый адрес,
пока не установите новый.

**Ошибка сборки «Не задан секрет ANDROID_KEYSTORE_PASSWORD».** Выполните
шаг 3.

**Приложение открывается, но с адресной строкой.** Не выполнен шаг 5, либо
Chrome ещё не проверил assetlinks (подождите, перезапустите приложение).

**Можно ли в RuStore / APKPure?** Да: RuStore принимает APK без регистрации
юрлица (rustedev.rustore.ru), APKPure — тоже. Google Play — 25 $ один раз,
нужен AAB (можно собрать тем же workflow, добавив задачу `:app:bundleRelease`).
