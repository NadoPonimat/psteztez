# Project Worklog

---
Task ID: 1
Agent: Z.ai (main agent)
Task: CRM система для PlayStation клуба с VR креслами (по ТЗ пользователя)

Work Log:
- Инициализирован fullstack-проект (Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Спроектирована схема БД: User (сотрудники/админ), AuthSession (cookie-сессии), Device (PS/VR), Package (пакеты времени с ценой), Session (сеансы с оплатой), Setting (пароль завершения, название клуба)
- Реализована аутентификация: scrypt-хеширование паролей, httpOnly cookie, API /api/auth/{login,logout,me}, роли ADMIN/STAFF
- API кассы: /api/dashboard (поллинг 5с, серверное время, статистика), POST /api/sessions (старт сеанса с валидацией оплаты), /api/sessions/[id]/complete (завершение по паролю), /api/sessions/[id]/acknowledge (глушение сирены), /api/sessions/history (фильтры по датам + итоги)
- API админа (только главный аккаунт, 403 дляstaff): CRUD пакетов/устройств/сотрудников, смена пароля завершения, смена названия клуба, смена своего пароля
- UI: экран входа, касса с сеткой устройств (PS1-6, VR1-3) и живыми таймерами (синхронизация времени с сервером, тик 1с), карточки: свободно/занято/скоро конец (янтарный)/переработка (красный пульс)
- Диалог новой сессии: пакет → сумма → способ оплаты (Наличные/Каспи/Смешанная с авторасчётом второй части)
- Уведомление «время вышло»: сирена через Web Audio API (без внешних файлов), модальное окно с кнопками Принять/Завершить, красная пульсирующая карточка со счётчиком переработки, индикатор в шапке, переключатель звука
- История: таблица с фильтром по датам, итоги (выручка/наличные/Каспи/сеансов), разбивка смешанных оплат
- Настройки: вкладки Пакеты/Устройства/Сотрудники/Пароли; защита от удаления используемых данных (деактивация), защита последнего админа
- Сидинг: admin/admin, kassir/1234, 6 PS + 3 VR, 7 пакетов, пароль завершения 0000
- E2E-тестирование через agent-browser: вход обоими ролями, старт сеанса, смешанная оплата (1000 нал + 1500 Каспи авто), неверный/верный пароль, сирена через 70с (тестовый 1-мин пакет), acknowledge, смена пароля завершения (0000→7777→0000), ограничения staff (нет вкладки Настройки, API 403), мобильная версия 390px
- Ошибок в консоли браузера и dev.log нет, ESLint чистый
- Тестовые данные очищены (сеансы и тестовый пакет удалены)

Stage Summary:
- CRM полностью соответствует ТЗ: пакеты с ценами, выбор устройства и номера, расчёт суммы, 3 способа оплаты со смешанной (авторасчёт), таймер с уведомлением-сиреной, завершение по паролю 0000 (меняется в настройках), личные аккаунты сотрудников, все настройки только у главного аккаунта
- Демо-доступы: admin/admin (главный), kassir/1234 (сотрудник)
- Ключевые файлы: prisma/schema.prisma, src/lib/{auth,alarm,crm-types}.ts, src/app/api/**, src/components/crm/**

---
Task ID: 2
Agent: Z.ai (main agent)
Task: График работы сотрудников с зарплатой (ставка + %) и отчёты с выгрузкой PDF/PNG/Excel

Work Log:
- Схема БД расширена: User.dailyRate/bonusPercent/bonusThreshold + модель WorkDay (уникальный индекс userId+day)
- API /api/admin/schedule: GET графика за месяц, POST toggle рабочего дня (только админ)
- API /api/earnings?month=YYYY-MM: расчёт зарплаты (ставка × рабочие дни + Σ % от кассы дней, где выручка ≥ порога); админ видит всех, сотрудник только себя
- API /api/report: отчёт за день/период (сводка, разбивка по типам устройств, по дням, список сеансов); сотрудник — жёстко только сегодняшний день (403 на остальное), админ — любые даты
- Расширен PATCH /api/admin/users/[id] (ставка, процент, порог); колонка «Условия оплаты» в таблице сотрудников
- Установлены библиотеки экспорта: xlsx (SheetJS), jspdf, html-to-image
- Новая вкладка «Зарплата»: переключение месяцев, карточки сотрудников с календарём графика (клик отмечает день; в клетках — касса дня), диалог «Условия» (ставка/%/порог с живым примером расчёта), итоги: рабочие дни, заработок ставки, заработок %, ИТОГО
- Новая вкладка «Отчёты»: выбор «за день»/«за период» (админ), печать-совместимый документ с подписями, кнопки PDF (jsPDF, нарезка на страницы A4), PNG (html-to-image), Excel (xlsx, листы «Сводка»+«Сеансы»)
- Перезапущен dev-сервер для подхвата нового Prisma-клиента (WorkDay)
- E2E-тесты: отметка 6 дней kassir → ставка 90 000 ₸; снижение порога до 9 000 ₸ → бонус 500 ₸ (касса дня 10 000 ₸), ИТОГО 90 500 ₸; отчёт за день (10 000 ₸: нал 5 500 + Каспи 4 500, 3 сеанса, ср.чек 3 333); отчёт за период с таблицей по дням; скачивания PDF/PNG/Excel с подтверждением тостами; права kassir: период/вчера → 403, сегодня → 200, зарплата только своя, schedule API → 403; мобильная версия; консоль без ошибок; ESLint чистый
- Тестовые данные оставлены как демо: 3 сеанса за сегодня, график kassir (20–26 окт), условия 15 000₸/5%/9 000₸

Stage Summary:
- График работы: главный аккаунт выставляет рабочие дни кликами по календарю, ставку за день, % и порог кассы
- Зарплата за месяц: итог по ставке, итог по %, общий итог — считаются автоматически
- Отчёты: за день (все) и за период (только главный); выгрузка PDF/PNG/Excel одним кликом

## Этап: PWA + подготовка к APK (октябрь 2026)

Цель: сделать CRM устанавливаемой как приложение (Android APK / iPhone).

Сделано:
- scripts/make-icons.ts — генерация иконок (sharp): icon-192/512, maskable-512, favicon (src/app/icon.png), apple-icon 180
- public/manifest.json — PWA-манифест (standalone, theme #18181b, lang ru)
- public/sw.js — service worker: network-first, /api/* не кэшируется, офлайн-фолбэк
- src/components/crm/pwa.tsx — PwaInstaller: кнопка «Установить» (beforeinstallprompt), useSyncExternalStore для display-mode
- src/components/crm/providers.tsx — глобальная регистрация SW (на всех экранах)
- src/app/layout.tsx — metadata: manifest, applicationName, appleWebApp, viewport themeColor, lang="ru"
- app-shell.tsx — PwaInstaller в шапке

Проверено: SW registered+active, manifest/icons 200, lint clean, app renders.

Путь к APK: развернуть на HTTPS-хостинге → pwabuilder.com → Android package → APK/AAB.

## Этап: График смен с часами + PNG (октябрь 2026)

Запрос: главный не видел конструктор графика. Нужны: день = 2 смены с разными сотрудниками и часами, либо один на весь день; скачивание графика в PNG; управление только у главного.

Сделано:
- Prisma: модель Shift {day, slot 1|2, isFullDay, userId?, startsAt, endsAt} + User.shifts; db:push
- API: GET /api/schedule?from&to (все авторизованные — shifts + employees), PUT /api/admin/shifts (ADMIN; замена смен в диапазоне + опция syncWorkDays → автосинхронизация WorkDay для зарплаты)
- crm-types: ScheduleShift/ScheduleData/DayDraft + хелперы weekStart/addDays/weekDays/weekdayShort/shiftMinutes/minutesHuman
- schedule-view.tsx: навигация по неделям (Пн-Вс), на каждый день режим «Выходной | Весь день | 2 смены», выбор сотрудника (Radix Select) + time-инпуты, поддержка смен через полночь, «Копировать прошлую неделю», «Очистить», Switch «смены = рабочие дни», счётчик часов
- Документ «ГРАФИК РАБОТЫ» (id=schedule-document): таблица День | Смена 1 | Смена 2 | Часы, весь день colSpan=2, выходные подсвечены, итоги по сотрудникам (смены/часы), экспорт PNG через html-to-image (все роли)
- app-shell: вкладка «График» для всех; у STAFF — только просмотр + PNG + замок
- Исправлено: skipDuplicates не поддерживается SQLite (убран), логирование ошибок в API

Тесты: заполнение (Чт весь день Айдар 10-22, Пт 2 смены Айдар/главный 10-18+18-02), сохранение → WorkDay 29-30 созданы, документ корректен (итоги 20ч/8ч), PNG скачан, staff: просмотр+PNG, PUT → 403, «Копировать прошлую» → dirty-индикатор. Lint clean.

## Этап: Касса наличных с авансами + 18 тем + звуки + зарплата в графике (октябрь 2026)

Запрос: касса наличных (утренний пересчёт → приход СРАЗУ при «принять оплату и запустить таймер», не после таймера; аванс наличными уменьшает кассу; аванс переводом Каспи кассы не трогает, только отметка в отчёте); 15+ тем оформления на каждый аккаунт; разные звуки уведомлений; сотрудник видит свои дни и зарплату в графике («27 октября — 10 000 + 5% от кассы»).

Сделано:
- Prisma: модель CashEntry {kind: OPENING_CASH|OPENING_KASPI|SALE|ADVANCE_CASH|ADVANCE_KASPI, amount, cashPart±, kaspiPart±, note, userId, sessionId} + User.theme/User.alarmSound; db:push
- POST /api/sessions: сеанс + запись SALE (cashPart/kaspiPart) в одной $transaction → касса пополняется мгновенно после принятия оплаты
- API /api/cash: GET (балансы = Σ cashPart/kaspiPart, движения за сегодня, флаг открытия) + POST {action: opening | advance}; аванс наличными проверяет остаток (400 «недостаточно наличных»), перевод Каспи — только запись
- PATCH /api/user/prefs (тема+звук, валидация по реестрам, любая роль); login/me/auth.ts отдают theme+alarmSound
- /api/report: блок cash (открытия, приход от сеансов, авансы, остаток на конец периода = накопительный итог) + cashEntries (открытия и авансы)
- lib/themes.ts: 18 тем (2 стандартные + 16: изумрудная/океан/небесная/закат/роза/виноград/лес/кофе/контраст/чёрная/неон/песок/кримсон + тёмные варианты) с превью-свотчами; applyTheme → data-theme + .dark; globals.css: --header/--header-fg + блоки [data-theme] после .dark
- lib/sounds.ts + alarm.ts: 6 звуков (сирена, классический, мелодичный, тревожный, низкий гудок, аркадный), startAlarm(soundId), previewSound
- cash-panel.tsx: живая касса (опрос 5с + инвалидация при старте сеанса), плитки «Касса наличных/Каспи», статус открытия, диалоги «Открыть кассу» и «Взять аванс» (способ/сумма/примечание), история движений за сегодня; видна всем ролям
- theme-sound-menu.tsx в шапке (иконка палитры): выбор темы (свотчи) и звука (клик = выбрать + прослушать); применяется мгновенно, хранится на сервере; staff тоже
- schedule-view: карточка «Мои смены на этой неделе» — ставка + «+ N% от кассы (порог)», по дням часы, для прошедших дней «касса дня → бонус, итого X ₸»
- reports-view: в документе блок «Касса» (две таблицы: наличные/Каспи с остатком на конец) + таблица «Открытия смены и авансы»; Excel: секция КАССА в «Сводке» + лист «Касса»
- providers.tsx: мгновенное применение темы из localStorage на экране входа

Тесты (API+UI, только что проверено на живых данных): Бектас сам прогнал сценарий — открытие 50 000 → оплата 2 500 сразу в кассе → аванс −10 000 → остаток 42 500 (панель + отчёт сходятся); превышение аванса 400 и disabled-кнопка; перевод Каспи баланс не меняет; отчёт за день: блок КАССА корректен; тема «Глубина» применена, пережила reload (сервер), палитра 18 тем в шапке; staff testqa: касса видна, Настроек нет, «Мои смены»: 29.10 · 10:00–18:00 · 8 ч · 10 000 ₸ + 5% от кассы (касса ≥ 9 000) + «касса 12 000 → бонус, итого 10 600 ₸», PNG «График скачан в PNG», PUT shifts → 403, период-отчёт → 403; зарплата testqa: календарь + ИТОГО 30 600 ₸; lint clean, dev.log без ошибок.

Примечания: для e2e создан аккаунт «Тест QA» (testqa/1234, ставка 10 000/5%/9 000) — главный может удалить/отключить его в Настройках → Сотрудники; тестовые записи авансов (2 шт.) удалены из журнала, аккаунт kassir (Айдар) был отключён главным вручную.

## Этап: Удаление операций, расходы, акции, тепловая карта, громкий сигнал, починка тем + APK через GitHub (октябрь 2026)

Запрос: главный удаляет ошибочные операции (касса наличных и Каспи пересчитываются — «было 50 000, ошибочно +10 000, удалили → снова 50 000»); тепловая карта продаж; APK через GitHub; громкий сигнал на телефоне при окончании времени; акции и скидки (время/дни/устройства, управляет главный); категория расходов (из кассы наличных или из своего кармана — из кассы сразу минус); проверить темы (почти все не работали); Каспи на начало дня не нужен.

Сделано:
- Prisma: Promo {name, discountType PERCENT|FIXED, discountValue, timeFrom, timeTo (через полночь), days "0=Вс..6=Сб", deviceType null|PLAYSTATION|VR, active}, Expense {name, amount, source CASH|POCKET, userId, cashEntryId? @unique (Cascade)}, Session.originalPrice/discountLabel; db:push
- API: DELETE /api/sessions/[id] (ADMIN: сеанс + проводка кассы удаляются атомарно, баланс = Σ проводок → касса уменьшается сама); DELETE /api/cash?id= (ADMIN; SALE → 400 «удаляйте вместе с сеансом»); POST /api/cash action=expense (CASH → проверка остатка + CashEntry EXPENSE cashPart=−N + Expense; POCKET → только Expense); GET /api/cash + expensesCash; POST /api/sessions применяет лучшую активную акцию серверно (finalPrice, originalPrice, discountLabel), MIXED валидируется от finalPrice; /api/dashboard + promos; CRUD /api/admin/promos (requireAdmin, валидация времени/дней/процента≤100); /api/report + expenses (все + expensesCash, Only CASH влияет на кассу) ; GET /api/report/heatmap?days=7|30|90 (ADMIN; dow 0=Пн × hour, revenue/count, maxRevenue); history API отдаёт ACTIVE сеансы + status/originalPrice/discountLabel
- crm-types: PromoItem + activePromoDiscount()/promoDiscountLabel() (единая логика клиент/сервер), HeatmapData, ExpenseItem, kind EXPENSE, CashSummary.expensesCash, HistorySession.status/originalPrice/discountLabel
- cash-panel: кнопка «Расход» + диалог (что купили/сумма/источник «Из кассы наличных | Из своего кармана»/примечание), удаление записей (ADMIN, иконка корзины; SALE → подсказка), подытог «сегодня: +X / −Y» вкл. расходы; OpeningDialog БЕЗ Каспи (только пересчёт наличных)
- history-view: показываются и ACTIVE сеансы (бейдж «идёт»), ADMIN удаляет сеанс через AlertDialog (сообщение с суммами возврата), бейдж скидки + зачёркнутая цена; инвалидация history/cash/dashboard/report
- new-session-dialog: кнопки пакетов и «К оплате» показывают цену со скидкой (перечёркнутый оригинал, название акции), MIXED от finalPrice, тост со скидкой
- promos-manager.tsx (новый) + вкладка «Акции» в настройках: таблица (акция/скидка/время/дни/устройства/switch), форма: name, PERCENT|FIXED, value, timeFrom/timeTo (через полночь → предупреждение), чекбоксы дней Пн–Вс, устройства, active
- reports-view: SalesHeatmap (ADMIN): сетка Пн–Вс × 0–23 ч, intensity через color-mix(var(--primary)), период Неделя/30/90, легенда + итоги; в документе отчёта строки «Расходы (оплачено из кассы)» + таблица «Расходы» (всего); Excel: расходы в «Сводке» + строка в КАССА (НАЛИЧНЫЕ)
- Аларм (громкий сигнал на телефоне): alarm.ts unlockAudio() (pointerdown/touchstart/keydown на document — Android/PWA требует жест), вибрация [600,250,600,250] циклом, notifyOverdue() через SW showNotification (requireInteraction, vibrate, иконка), closeOverdueNotification(tag), requestNotifyPermission() при старте AlarmCenter; AlarmCenter: при document.hidden дублирует системными уведомлениями, закрывает по tag; app-shell вызывает unlockAudio() на mount
- ТЕМЫ ПОЧИНЕНЫ: root cause — компоненты использовали жёсткие zinc/white классы, темы меняли только переменные. Токенизация всех CRM-компонентов (app-shell, cash-panel, history-view, new-session-dialog, settings-view, settings-manage, device-card, schedule-view, salary-view, reports-view (панель), login-view, page.tsx, pwa.tsx, theme-sound-menu, complete-session-dialog): bg-white dark:bg-zinc-900 → bg-card, bg-zinc-900 text-white → bg-header text-header-fg (добавлены --color-header/-fg в @theme), bg-zinc-100 dark:bg-zinc-950 → bg-background, text/border-zinc-* → muted/foreground/ring/white-альфы; белые «бумажные» документы отчёта/графика сохранены (экспорт PNG/PDF)
- APK: .github/workflows/build-apk.yml (workflow_dispatch pwa_url/app_name/app_id; JDK17 + Node20 + Android SDK + @bubblewrap/cli; init по manifest.json, build --skipPwaValidation, артефакт PlayZone-APK: app-release-signed.apk + aab + android.keystore + assetlinks.json) + docs/APK_GUIDE.md (копия в download/КАК_ПОЛУЧИТЬ_APK.md): VPS+Caddy или Cloudflare Tunnel → GitHub → Secrets ANDROID_KEYSTORE_PASSWORD/ANDROID_KEY_ALIAS_PASSWORD → Run workflow → скачать APK; сохранить keystore; RuStore/APKPure/Telegram; альтернатива PWABuilder.com

Тесты (agent-browser, живой сервер): расход «Шнуры для зарядки» 6 000 → 45 000→39 000; удаление расхода корзиной → 45 000; акция «Счастливые часы» −20% (00:00–23:59, Пн–Пт, все) → в диалоге сеанса «1 час 2 000 ₸ (−500 ₸) вместо 2 500 ₸»; «Принять оплату» → касса +2 000 МГНОВО (не 2 500); история: бейдж «Счастливые часы −20%» + зачёркнутые 2 500, удаление сеанса → касса 47 000→45 000; пак 1 мин → модалка «Время вышло!» ровно через ~60 с, «Принять» гасит, завершение паролем ок; тепловая карта рендерится (ячейки, легенда, итог 40 500 ₸/12 сеансов, переключатели 7/30/90); темы: emerald и ocean-dark применяются по всему UI (скриншоты); Kaspi-строка в открытии убрана; STAFF: 403 на DELETE sessions/cash, heatmap, POST promos; расход POCKET от сотрудника разрешён (кассу не трогает). Lint clean, dev.log чист; тестовые данные удалены (сеанс/акция/расход), пак «Тест 1 мин» и qa456 отключены.

## Этап: Телефоны сотрудников (звонок/WhatsApp), постоянные клиенты, VR-игры + ответы о языке и хранении (октябрь 2026)

Запрос: номера телефонов сотрудников вносит главный; у сотрудников кнопки «Связаться со сменщиком / с главным» → выбор «позвонить с телефона» или «написать в WhatsApp»; вопрос — на каком языке написан CRM и можно ли переписать на «самый быстрый»; где хранятся данные; постоянные клиенты со своими ценами (добавляет главный); список VR-игр (длительность, возраст 6+, цена) + «свободный запуск» без конкретной игры по изначальной цене.

Сделано:
- Prisma: User.phone?, Customer {name, phone?, discountPercent 0–100, note?, active}, VrGame {name, durationMinutes, minAge(0=любой), price, active, sortOrder}; Session.vrGameId/customerId; индексы Session(startedAt), Session(status,startedAt), CashEntry(createdAt), CashEntry(kind,createdAt), Customer(active); db:push
- crm-types: CustomerItem/VrGameItem; phoneDigits/telLink/waLink (wa.me)/phonePretty; computeSessionPrice (акция vs персональная скидка клиента — применяется лучшая, label подписывает источник)
- API: /api/admin/customers CRUD (+[id]: used → deactivate), /api/admin/vrgames CRUD (+[id]), /api/contacts (все роли: активные пользователи, ADMIN первыми), /api/admin/users +phone (GET/POST/PATCH), /api/dashboard + customers(active)+vrGames(active); auth.ts CurrentUser+phone; POST /api/sessions: packageId ИЛИ vrGameId (VR-игра только на VR-устройстве), customerId → цена/длительность от игры или пакета, скидка серверно (computeSessionPrice), MIXED от finalPrice
- contacts-dialog.tsx: кнопка «Связаться» в шапке (все роли) → диалог «Главный» + «Сменщики»: имя, роль, телефон, ссылки tel:+… (звонок с телефона) и https://wa.me/… (WhatsApp), «номер не указан» если пусто; hint «номера добавляет главный: Настройки → Сотрудники»
- StaffManager: колонка «Телефон» с инлайн-редактированием (blur/Enter → PATCH), поле телефона в форме добавления
- customers-manager.tsx + вкладка «Клиенты»: имя/телефон/скидка%/примечание/активен, удаление used → deactivate
- vrgames-manager.tsx + вкладка «VR игры»: название/длительность/возраст/цена/активна
- new-session-dialog: для VR два блока — «VR-игра из каталога» (карточки: название, длительность, 6+, цена со скидкой) и «Или свободный запуск — пакет времени» (тот же список пакетов); для PS — пакеты как раньше; новый Select «Постоянный клиент (необязательно)» — «Без клиента» или клиенты с «(−N%)»; сумма через computeSessionPrice (скидка клиента или акции, зачёркнутый оригинал); payload packageId/vrGameId/customerId
- scripts/backup-db.sh: бэкап SQLite (db/custom.db → backups/custom_СТАМП.db, хранить 30) + cron-пример; ответ в чате: язык TypeScript/Next.js (переписывать на Rust/Go смысла нет — узкое место не язык, а сеть; запросы уже мс), данные — один файл db/custom.db на сервере + бэкапы

Тесты (agent-browser + API): телефон главного «+7 701 123 45 67» сохранён инлайн (blur → PATCH); клиент «Ерасыл» −10% и игра «Beat Saber» 20 мин/6+/2000 ₸ созданы; диалог VR 1: карточка «Beat Saber 0 ч 20 мин · 6+ 2 000 ₸» + «Без клиента»/«Ерасыл (−10%)»; выбор игры+клиента → «К оплате 1 800 ₸, Постоянный клиент −10%, 2 000 ₸»; оплата → касса +1 800 МГНОВО; «Связаться»: главный с телефоном, ссылки tel:+77011234567 и https://wa.me/77011234567; API: PS1 «1 час»+клиент → 2250 (2500−10%), удаление сеанса → касса вернулась (46 800→45 000 / Каспи 17 000); lint clean, dev.log без ошибок. Тестовые сеансы удалены; «Ерасыл» и «Beat Saber» оставлены как примеры (главный может отредактировать/удалить).

## Этап: Турниры, VR-каталог, оплата в момент клика, «Освободится в HH:MM», офлайн-режим (октябрь 2026)

Запрос: деньги должны прибавляться сразу после «оплатить и запустить таймер» (не после окончания); аренда на час в 10:00 → на карточке «освободится в 11:00»; будет ли работать без интернета (пропажа сети, клиенты в зале, установлен APK).

Сделано:
- Проверено и подтверждено тестами: POST /api/sessions пишет CashEntry(SALE) в той же транзакции, что и сеанс — деньги в кассе в момент клика (45 000→45 900 при MIXED 900+600; Kaspi 25 500→26 100). Complete кассу не трогает. Удаление сеанса ADMIN → откат (45 900→45 000).
- device-card: подпись под таймером теперь «Освободится в 11:00» (было «до 11:00»)
- ОФЛАЙН-РЕЖИМ (полная работа без интернета после установки):
  - sw.js v2: network-first с кэш-фолбэком для ВСЕХ GET, включая /api/* (раньше API не кэшировался вовсе). Кэшируются только res.ok; 401 /api/auth/me вычищает кэш (разлогин не «восстанавливается» офлайн). Отдельно: вход остаётся после закрытия приложения (cookie 14 дней)
  - src/lib/offline.ts: IndexedDB-очередь «outbox» (db playzone-offline) + apiFetch() — обёртка fetch: POST/DELETE при отсутствии сети (navigator.onLine=false или TypeError) сохраняются в очередь и возвращают фиктивный успешный Response {queued:true} (250). flushOutbox(): FIFO-отправка при online/visibilitychange/каждые 30 с; 2xx → запись удаляется; 401 → стоп (нужен вход, данные храним); прочие 4xx/5xx → запись удаляется + toast с ошибкой сервера (например 409 «сеанс уже идёт»); сетевая ошибка → стоп, остаток ждёт
  - Онлайновая оптимистика: запуск сеанса офлайн → карточка занята мгновенно (сеанс-заглушка, таймер тикает локально), касса пополняется локально (проводка «(офлайн)»); завершение офлайн → устройство освобождается сразу (пароль проверится при синхронизации); открытие кассы/аванс/расход/удаление проводки → балансы правятся сразу, записи «офлайн»; после синхронизации queryClient.invalidateQueries(['dashboard'],['cash']) — данные заменяются серверными
  - Шапка: красный бейдж «Нет интернета · N» (офлайн) / янтарный «Отправить · N» (онлайн, есть не отправленное) — клик = ручная отправка; тост «Интернет вернулся — данные синхронизированы»
  - login-view: понятная ошибка при офлайне («вход требует подключения; приложение помнит вход 14 дней»); alarm-center acknowledge через apiFetch (очередь офлайн)
  - Работает офлайн: касса с последними данными, запуск/завершение сеансов, таймеры, громкая сирена по окончании времени (Web Audio, страница открыта), системные уведомления, авансы/расходы/открытие кассы, удаление ошибочных проводок. Нужен интернет: первый вход на устройстве, повторный вход после logout, push-уведомления при закрытом приложении, отчёты/экспорт
- Сборка: lint clean, build ок; сквозной тест API: старт MIXED 900+600 → касса мгновенно, complete, удаление → откат верный

## Исправление: «деньги записываются только после окончания» — причина найдена и устранена (октябрь 2026)

Жалоба: деньги появляются в учёте не сразу после «Принять оплату и запустить таймер», а после окончания сеанса.

Root cause: касса пополнялась сразу (CashEntry(SALE) в транзакции создания сеанса — это работало), НО три агрегата считали выручку только по status=COMPLETED, поэтому для начальника «деньги в учёте» появлялись лишь после завершения сеанса:
- /api/dashboard adminStats (карточки «Выручка сегодня / Наличные / Каспи / Сеансов сегодня»): where status=COMPLETED → убран фильтр, считаются ВСЕ сеансы, запущенные сегодня (включая идущие)
- /api/report (дневной/периодовый отчёт, итоги и список сеансов): тот же фильтр убран
- /api/earnings (дневная выручка для бонуса сотрудникам): тот же фильтр убран
Тепловая карта и история уже считали без фильтра. Удалённый сеанс исчезает из всех агрегатов (запись удаляется), двойного учёта нет.

Тесты (живой UI, agent-browser): до — касса 45 000 / выручка 43 500 / нал. сегодня 5 000 / сеансов 15; клик «Принять оплату и запустить таймер» (наличные 1 000, пак «Тест 1 мин») → через 0,8 с: касса 46 000, выручка 44 500, нал. сегодня 6 000, сеансов 16. Завершение (пароль 0000) + удаление сеанса → откат к 45 000 / 29 000 Каспи. Lint clean.

## Этап: удаление сотрудников (только главный аккаунт) (октябрь 2026)

Запрос: добавить возможность удалять сотрудников; удалять может только главный.

Сделано:
- API: DELETE /api/admin/users/[id] (requireAdmin): нельзя удалить себя; нельзя удалить последнего активного главного; в одной транзакции история переписывается на удаляющего главного (session.updateMany createdById/completedById, cashEntry, expense), затем user.delete — authSessions и WorkDay каскадно, смены графика SetNull (освобождаются). Ответ: {ok, sessions, cash, expenses} — счётчики переписанного.
- UI (StaffManager, Настройки → Сотрудники): красная кнопка-корзина в строке каждого сотрудника КРОМЕ собственного аккаунта; AlertDialog с точным текстом («аккаунт и вход удалятся на всех устройствах, смены освободятся, история останется в отчётах за главным»); после удаления — тост со счётчиками (сеансов/записей кассы/расходов) + инвалидация списка.
- Логин удалённого сотрудника сразу невозможен (401), его cookie-сессии удалены (Cascade) — выход на всех устройствах.

Тесты (API + живой UI): STAFF DELETE → 403; self-delete → 400 «Нельзя удалить собственный аккаунт»; удаление сотрудника с историей → ok {sessions:1, cash:1}, сеанс в истории теперь «Главный администратор», статус ACTIVE и деньги на месте; вход удалённого → 401, старая cookie → 401; UI: корзина не рендерится для себя, диалог подтверждения, тост «Сотрудник testui удалён», логин после удаления 401. Lint clean, build ok. Тестовые сотрудники (testdel, testui) и их сеанс удалены.

## Этап: APK — детерминированная сборка через GitHub Actions (октябрь 2026)

Запрос: «переходим к апк». Прежний workflow на Bubblewrap имел два риска:
интерактивные промпты (в CI без TTY мог зависнуть) и НОВЫЙ ключ подписи на
каждый запуск (обновление APK потребовало бы удаления старого на всех
телефонах). Заменён на проверенный вручную детерминированный конвейер.

Сделано:
- android/ — полноценный TWA-проект (Trusted Web Activity, обёртка над сайтом):
  settings/build.gradle (AGP 8.9.2, Gradle 8.11.1), app/build.gradle — все
  параметры из ENV (APP_ID, PWA_HOST, APP_NAME, VERSION_CODE/NAME, ключ),
  автосоздание ключа подписи keytool'ом при первой сборке (RSA 2048, 30 лет),
  AndroidManifest: LauncherActivity (androidbrowserhelper 2.7.4) + DEFAULT_URL +
  цвета статус-бара/splash + DelegationService (системные уведомления из web) +
  deep-link autoVerify на домен CRM; res: adaptive-иконки (foreground из
  maskable-512) через scripts/make-android-icons.ts (sharp, mipmap 5 плотностей),
  config.xml (appName/launchUrl/assetStatements) — генерируется при сборке.
- Подпись: приоритет ANDROID_KEYSTORE_BASE64 (секрет) > actions/cache
  (android-keystore-v1) > автосоздание; versionCode = номер запуска workflow
  (авто-рост → обновление поверх старой версии без удаления; данные не
  теряются — живут на сайте).
- asset_statements (отпечаток SHA-256 сертификата) вычисляется на этапе
  сборки из ключа → в APK и в assetlinks.json попадает ОДИН и тот же отпечаток.
- .github/workflows/build-apk.yml переписан: проверка секретов с понятной
  ошибкой, предупреждение если сайт недоступен, JDK17 + Gradle 8.11.1 +
  android-actions/setup-android, генерация config.xml и assetlinks.json через
  python3, артефакт PlayZone-APK: PlayZone-CRM.apk + assetlinks.json +
  android.keystore.
- docs/APK_GUIDE.md (копия download/КАК_ПОЛУЧИТЬ_APК.md) переписана под новую
  схему: деплой (VPS+Caddy / Cloudflare Tunnel) → GitHub → 2 секрета →
  Run workflow → assetlinks.json в public/.well-known/ → установка/обновления;
  запасной вариант PWABuilder, FAQ.
- .gitignore: android build-артефакты, ключ, .android-tmp.

Локальная валидация (полная симуляция CI, Android SDK 34/36 в песочнице):
- Итерации сборки: конфликт имени переменной versionCode в Groovy (переименовано);
  androidbrowserhelper 2.5.2 не существует → 2.7.4 требует AGP 8.9+/compileSdk 36 →
  AGP 8.9.2 + Gradle 8.11.1 + platforms;android-36 + minSdk 24 (требование
  библиотеки). Финальная сборка УСПЕШНА: app-release.apk 4 МБ,
  aapt badging: kz.playzone.crm v42 (1.42.0), label «PlayZone CRM»;
  apksigner verify: подпись CN=PlayZone CRM, SHA-256 07e03c…994b;
  aapt2 dump: asset_statements внутри APK = отпечаток этого же ключа,
  DEFAULT_URL из config.xml.
- Отпечаток ключа извлекается (keytool -list -v, нужен -v — добавлено),
  python-генерация config.xml/assetlinks.json проверена на реальном выводе.

## Этап: автодеплой на VPS с GitHub («опыт Netlify», октябрь 2026)

Запрос: пользователь хочет деплой как на Netlify (push → обновилось), без
установки приложений на свой компьютер, и чтобы это работало с APK.
Netlify/Vercel напрямую невозможны: SQLite-файл на диске + постоянный
Node-сервер + опрос каждые 5 с (сжигает лимиты serverless-функций).

Сделано:
- scripts/server-setup.sh — одноразовая настройка VPS (Ubuntu/Debian, root):
  swap для сборки, apt-пакеты, Bun, .env с DATABASE_URL=file:/opt/playzone/db/custom.db,
  bun install + db:push + build, systemd-юнит playzone.service (Restart=always,
  автозапуск), Caddy + HTTPS-сертификат для домена, cron-бэкап базы 04:00
  (scripts/backup-db.sh). Проверен bash -n.
- .github/workflows/deploy.yml — «Deploy to VPS»: на каждый push в main
  (или вручную) заходит по SSH (секреты SSH_HOST/SSH_USER/SSH_PRIVATE_KEY,
  без сторонних экшенов: ssh + heredoc), git pull → bun install → db:push →
  build → systemctl restart playzone, проверка is-active. concurrency-группа.
- docs/APK_GUIDE.md (и копия в download): Вариант A переписан в «VPS +
  автодеплой как Netlify»: браузерный терминал VPS (на комп ничего не
  ставится), одна команда setup-скрипта, два ssh-ключа (gh_deploy → секреты,
  github_ro → Deploy keys read-only), таблица секретов; FAQ «можно ли прямо
  на Netlify» + предложение миграции базы в облако (Turso/Neon) по запросу.

## Этап: бесплатный деплой (0 ₸) — Neon Postgres + Vercel, APK без изменений (октябрь 2026)

Запрос: «бюджет строго 0» — деплой без VPS и без установки чего-либо на
компьютер, с APK. Проверены лимиты (web): Vercel Hobby = 1M вызовов/мес,
Turso перешла под Supabase (смена движка — риск для кассы) → выбран Neon
Postgres (free, не «засыпает», официальный паттерн Prisma) + Vercel.

Сделано:
- prisma/schema.prisma: provider sqlite → postgresql. Аудит совместимости:
  contains-поисков нет, Float/Int/DateTime/@@unique — переносимы. Схема
  применена к Postgres без правок моделей.
- .env: DATABASE_URL=postgresql://... (локальный тест-Postgres), TZ учитывается.
- package.json: postinstall = prisma generate (нужно Vercel); build стал
  условным (cp standalone-копий только если .next/standalone существует —
  VERCEL=1 ветка проверена), next.config: output standalone отключается при VERCEL.
- Опрос dashboard/cash 5с → 10с (запас по лимиту 1M вызовов; при свёрнутом
  окне TanStack и так не опрашивает).
- db.ts: в production лог только error (иначе спам query-логов на Vercel).
- scripts/migrate-sqlite-to-postgres.ts — разовый перенос старой SQLite
  (FK-порядок 16 таблиц, Boolean/DateTime-конвертация, setval sequence после
  вставки явных id, --fresh через TRUNCATE ... RESTART IDENTITY CASCADE).
- .github/workflows/init-db.yml — «Init Neon database»: bun install →
  prisma db push (секрет DATABASE_URL_DIRECT = прямая строка Neon) →
  опционально seed. Пользователь всё делает в браузере.
- scripts/server-setup.sh (VPS-вариант A) переведён на Postgres: третий аргумент
  DATABASE_URL (Neon), .env = DATABASE_URL + TZ=Asia/Almaty, prisma db push.
  deploy.yml: source .env перед db:push.
- docs/APK_GUIDE.md (+ download-копия): новая структура — таблица выбора
  (C бесплатно / A VPS / B туннель), Вариант C пошагово (Neon → Vercel import
  с env DATABASE_URL(pooled)+TZ → Init workflow → APK), FAQ «бесплатно — надёжно?».

ТЕСТИРОВАНИЕ (реальный Postgres 16 в песочнице, zonky-бинарники, :5433):
- db push схемы ✓; перенос данных из db/custom.db: все 16 таблиц, счётчики
  сошлись (User 4, Device 8, Package 8, Session 21, CashEntry 17, турниры 6/27/41...),
  sequence обновлены (новый сеанс получил id 31 без конфликта).
- E2E на живом dev-сервере (TZ=Asia/Almaty): login admin/admin по перенесённому
  хэшу ✓ (theme/phone на месте); MIXED 1000+500 → касса 51000→52000/36000→36500
  МГНОВЕННО ✓; complete по паролю ✓; DELETE → откат 51000/36000 ✓;
  heatmap за 7 дней ✓.
- bun run lint ✓; bun run build (standalone для VPS) ✓; VERCEL=1 build ✓.
- bun add -d: @libsql/client (чтение старой SQLite в миграторе), embedded-postgres+pg
  (тестовое окружение, в прод-код не входит).

## Этап: поддержка iPhone (iOS) — та же ссылка, PWA на «Домой» (октябрь 2026)

Запрос: «будет ли ссылка для айфонов? APK же только для Android, вдруг у
сотрудника iPhone». Ответ: CRM — сайт, одна и та же HTTPS-ссылка открывается
и в Safari; режим «как приложение» на iPhone — Safari → Поделиться →
«На экран „Домой“» (standalone, без адресной строки, иконка PlayZone).

Сделано:
- public/icons/apple-touch-icon.png (180×180, sharp из icon-512) — iOS
  игнорирует manifest.json и берёт иконку только из <link rel="apple-touch-icon">.
- src/app/layout.tsx: metadata.icons.apple (+ комментарии почему); уже были
  appleWebApp.capable/statusBarStyle/title, viewportFit cover, manifest
  display standalone — iOS-режим «как приложение» готов целиком.
- docs/APK_GUIDE.md (+ копия download/КАК_ПОЛУЧИТЬ_APК.md): новый раздел
  «А если у сотрудника iPhone?» (шаги добавления на Домой, честные нюансы:
  фоновых push на iOS у сайта нет — сирена надёжна при открытом приложении;
  очистка кэша Safari после 7+ дней = только повторный вход, данные на
  сервере), Шаг 6 переименован в «...(Android)», FAQ-пункт про iPhone.
- Удалён устаревший дубль download/КАК_ПОЛУЧИТЬ_APK.md (осталась одна
  актуальная копия, синхрон с docs/APK_GUIDE.md).

## Этап: фикс «непонятной ошибки» сборки APK на GitHub (октябрь 2026)

Запрос: у пользователя падает сборка APK на GitHub с непонятной ошибкой.
Лога нет — прогон actionlint 1.7.7 (.tools/) по всем workflows нашёл ровно
одну ошибку: build-apk.yml:78 `if: ${{ secrets.ANDROID_KEYSTORE_BASE64
!= '' }}` — GitHub НЕ разрешает контекст secrets в if:-условиях шагов,
файл целиком признаётся невалидным («Unrecognized named-value:
'secrets'»), запуск падает мгновенно без единого шага — отсюда
«непонятность» (подтверждено docs.github.com «Context availability»,
actions/runner#520).

Исправление (стандартный env-приём):
- job-level env: HAS_KEYSTORE_SECRET: ${{ secrets.ANDROID_KEYSTORE_BASE64 != '' }}
- шаг: if: env.HAS_KEYSTORE_SECRET == 'true' (env в if разрешён).
- actionlint повторно: 0 ошибок по всем .github/workflows/*.yml.

Градл-часть не менялась (локальная сборка ранее пройдена); если у
пользователя не заданы секреты подписи — после фикса он увидит уже
понятную русскую ошибку шага «Check signing secrets are set».

## Этап: падение шага «Setup Android SDK» — убран сторонний action (октябрь 2026)

Скрин от пользователя (репозиторий NadoPonimat/pstettez): секреты ✓ (Check
signing secrets зелёный), workflow после фикса парсится и стартует, но
упал за 9 с шаг android-actions/setup-android@v3. Проверка: у action
известные проблемы 2026 (issues #539 Project Health Concerns, #546 Missing
build-tools); при этом SDK уже ПРЕДУСТАНОВЛЕН на ubuntu-24.04 раннерах
(официальный Readme: ANDROID_HOME=/usr/local/lib/android/sdk, cmdline-tools
12.0, build-tools 34–37) — action избыточен.

Исправление: шаг заменён на run-скрипт без сторонних действий —
ANDROID_HOME фиксируется в GITHUB_ENV, `yes | sdkmanager --licenses`
(чтобы AGP мог докачать недостающее), явно ставится platforms;android-36
(для compileSdk 36; build-tools 35 уже предустановлен — дефолт AGP 8.9.2).
actionlint ✓, bash -n ✓. Шаги сборки Gradle не менялись.

## Этап: Web Push «время вышло» при свёрнутом приложении (октябрь 2026)

Запрос: APK установлен, но уведомления о конце времени приходят только
при открытом приложении. Причина: сирену звенит сам сайт (опрос каждые 10 с
+ AlarmCenter), а в фоне Android/Chrome усыпляет страницу (таймеры
throttлятся, TanStack не опрашивает при visibility hidden — сделано ради
лимитов Vercel). Решение — серверный Web Push (VAPID), который доходит
в свёрнутый/закрытый APK через DelegationService.

Реализовано:
- prisma/schema.prisma: Session.pushedAt (push отправлен, не влияет на
  диалог AlarmCenter — в отличие от notified) + модель PushSubscription
  (endpoint unique, p256dh, auth, label, lastError).
- src/lib/push.ts (сервер): sendToAll (web-push, TTL 3600, urgency high,
  timeout 10 c; 404/410 → удаление подписки), flushOverduePushes (ACTIVE +
  plannedEndAt < now + pushedAt null, take 20; текст как в AlarmCenter:
  «⏰ Время вышло! PS 3 · 1 час · 1000 ₸…», tag overdue-<id>), 
  hasPendingOverduePushes (дешёвый count для горячего пути).
- API: /api/push/public-key (GET, ключ из env), /api/push/subscribe
  (upsert, auth), /api/push/unsubscribe (delete, auth), /api/push/tick
  (публичный идемпотентный flush для внешнего cron). Все force-dynamic.
- /api/dashboard: попутный flush (count → рассылка) — пока CRM открыта
  хоть на одном устройстве, push уходят мгновенно без внешнего cron.
- public/sw.js: обработчики push (если окно видно → postMessage в страницу
  вместо системного уведомления, чтобы не дублировать сирену; иначе
  showNotification: icon/badge, tag, renotify, vibrate [500,200,500],
  requireInteraction) + notificationclick (focus/openWindow).
- src/lib/push-client.ts: статус/enable/disable, urlBase64ToUint8Array,
  ensurePushSubscribed (тихая подписка если permission уже granted),
  isIosSafariTab (подсказка про «Домой», iOS 16.4+).
- theme-sound-menu.tsx: блок «Уведомления на телефоне» (включить/выключить,
  подсказки). app-shell: ensurePushSubscribed на монтировании + listener
  сообщений SW (push-overdue/push-open → invalidate dashboard).
- bun add web-push; devDep @types/web-push. VAPID-ключи сгенерированы и
  выданы пользователю (в git не попадают — только env Vercel).

ТЕСТИРОВАНИЕ (scripts/test-push.ts, реальный Postgres 16 embedded :5433,
standalone-сервер с VAPID env): public-key ✓; login admin/admin ✓;
subscribe (фейковый FCM endpoint) ✓; tick → ok, подписка помечена lastError,
session.pushedAt проставлен ✓; повторный tick — без повторной рассылки ✓;
dashboard 200 с push-модулем ✓; unsubscribe ✓. bun run build ✓;
tsc: 0 новых ошибок. Заметки: bun блокирует postinstall (@embedded-postgres
нужно `bun pm trust`); embedded-postgres понижен до 16.14.0-beta.17 — PG18
бинарники требуют libicuuc.so.60, которого в песочнице нет.

docs/APK_GUIDE.md (+ копия): раздел «Уведомления при свёрнутом приложении
(Web Push)» — VAPID env в Vercel (3 переменные), повторный «Init Neon
database» С seed=OFF (seed.ts использует create — на живой базе упадёт/
задублирует), включение на телефонах, cron-job.org каждые 1 мин → /api/push/tick
для доставки когда всё закрыто, FAQ «не приходят в свёрнутом».

## Этап: повторная выдача VAPID-ключей (29.10.2026)

Прежняя пара утеряна в переписке — сгенерирована свежая
(web-push.generateVAPIDKeys) и сохранена пользователю в
download/VAPID_ключи.txt (3 переменные для Vercel env).
Подписок в базе ещё нет (push ни разу не включался на устройствах),
поэтому смена ключей безболезненна.
