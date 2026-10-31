/**
 * Офлайн-режим PlayZone CRM.
 *
 * Работает в паре с service worker (public/sw.js):
 *  - SW кэширует GET-ответы API (сеть в приоритете) — при пропаже интернета
 *    приложение показывает последние данные, таймеры тикают локально;
 *  - этот модуль ставитmutations (POST/DELETE) в очередь IndexedDB, когда
 *    сети нет, и автоматически отправляет их при подключении.
 *
 * Сотрудник может продолжать работать без интернета:
 *  - запускать сеансы (оплата попадает в кассу — сначала локально, потом синхронизируется);
 *  - завершать сеансы (пароль проверяется на сервере при синхронизации);
 *  - открывать кассу, выдавать авансы, записывать расходы;
 *  - таймер и громкий сигнал по окончании времени работают локально.
 */

const DB_NAME = "playzone-offline";
const DB_VERSION = 1;
const STORE = "outbox";

export type OutboxEntry = {
  id?: number;
  url: string;
  method: string;
  body?: string;
  createdAt: number;
};

// ---------- IndexedDB ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAll(): Promise<OutboxEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as OutboxEntry[]).slice().sort((a, b) => {
        const ai = a.id ?? 0;
        const bi = b.id ?? 0;
        return ai - bi;
      });
      resolve(rows);
      db.close();
    };
    req.onerror = () => {
      reject(req.error);
      db.close();
    };
  });
}

async function dbAdd(entry: Omit<OutboxEntry, "id">): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function dbDelete(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// ---------- Мини-стор для UI (кол-во ожидающих, онлайн) ----------

let pendingCount = 0;
const pendingListeners = new Set<() => void>();

function setPending(n: number) {
  if (n === pendingCount) return;
  pendingCount = n;
  pendingListeners.forEach((l) => l());
}

export function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function getPendingSnapshot(): number {
  return pendingCount;
}

export function getServerPending(): number {
  return 0;
}

function onlineSubscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function onlineSnapshot(): boolean {
  return navigator.onLine;
}

export function getServerOnline(): boolean {
  return true;
}

export function useOfflineExternals() {
  return { onlineSubscribe, onlineSnapshot, getServerOnline };
}

// ---------- Реакция на результат синхронизации ----------

export type SyncResult = { synced: number; failed: number; error?: string };

const syncHandlers = new Set<(r: SyncResult) => void>();

/** Подписка на завершение синхронизации (для тостов и обновления кэша) */
export function onSyncResult(
  handler: (r: SyncResult) => void
): () => void {
  syncHandlers.add(handler);
  return () => syncHandlers.delete(handler);
}

// ---------- apiFetch: прозрачная очередь для mutations ----------

function isOfflineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function queueAndFake(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "POST").toUpperCase();
  await dbAdd({
    url,
    method,
    body: typeof init?.body === "string" ? init.body : undefined,
    createdAt: Date.now(),
  });
  const all = await dbAll();
  setPending(all.length);
  // На случай, если связь уже вернулась — пробуем сразу отправить
  void flushOutbox();
  return new Response(JSON.stringify({ queued: true }), {
    status: 250,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Замена fetch для запросов к API.
 * GET — обычный fetch (офлайн-данные отдаёт service worker из кэша).
 * POST/DELETE — при отсутствии сети операция сохраняется в IndexedDB
 * и возвращает фейковый успешный ответ { queued: true }, статус 250.
 * Когда интернет вернётся, операция уедет на сервер автоматически.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const mutable = method !== "GET";

  if (mutable && isOfflineNow()) {
    return queueAndFake(url, init);
  }

  try {
    return await fetch(url, init);
  } catch (err) {
    // TypeError — сетевая ошибка (сервер недоступен). Кладём в очередь.
    if (mutable && err instanceof TypeError) {
      return queueAndFake(url, init);
    }
    throw err;
  }
}

// ---------- Отправка очереди ----------

let syncing = false;

export async function flushOutbox(): Promise<boolean> {
  if (syncing) return false;
  if (typeof window !== "undefined" && !navigator.onLine) return false;
  syncing = true;
  let synced = 0;
  let failed = 0;
  let error: string | undefined;
  try {
    let entries = await dbAll();
    setPending(entries.length);
    for (const e of entries) {
      if (e.id == null) continue;
      try {
        const res = await fetch(e.url, {
          method: e.method,
          headers: e.body ? { "Content-Type": "application/json" } : undefined,
          body: e.body,
        });
        if (res.ok) {
          await dbDelete(e.id);
          synced += 1;
        } else if (res.status === 401) {
          // Сессия истекла — прекращаем, чтобы сотрудник вошёл заново,
          // данные остаются в очереди
          error = "Нужен повторный вход — данные сохранены";
          break;
        } else {
          // Сервер осознанно отклонил (409 — сеанс уже запущен и т.п.):
          // запись удаляем, чтобы очередь не застряла навсегда
          let serverError = "операция отклонена сервером";
          try {
            const data = await res.json();
            if (data?.error) serverError = data.error;
          } catch {}
          await dbDelete(e.id);
          failed += 1;
          error = serverError;
        }
      } catch {
        // Сеть снова пропала — оставляем остаток очереди на потом
        break;
      }
    }
    entries = await dbAll();
    setPending(entries.length);
    if (synced > 0 || failed > 0) {
      const result: SyncResult = { synced, failed, error };
      syncHandlers.forEach((h) => h(result));
    }
    return entries.length === 0;
  } finally {
    syncing = false;
  }
}

// ---------- Инициализация (один раз, из providers) ----------

let initialized = false;

export function initOfflineSync(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Восстановить счётчик после перезагрузки приложения
  void dbAll().then((rows) => setPending(rows.length)).catch(() => {});

  window.addEventListener("online", () => {
    void flushOutbox();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushOutbox();
  });
  window.setInterval(() => {
    void flushOutbox();
  }, 30_000);
}
