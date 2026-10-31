// Мост между CRM (веб-частью) и нативной Android-оболочкой (Kotlin).
//
// Оболочка пробрасывает в страницу объект window.PlayZoneNative. Сайт при
// каждом обновлении данных отдаёт ей список активных сеансов — Android
// ставит их в системный будильник (AlarmManager.setAlarmClock). Будильник
// срабатывает в точное время даже если приложение закрыто, интернета нет
// и Firebase молчит: время считает сам телефон, как у приложения «Часы».
//
// В браузере (без APK) все функции — тихие no-op, ничего не ломается.

import { deviceLabel, formatTenge } from "@/lib/crm-types";
import type { DeviceWithSession } from "@/lib/crm-types";

interface PlayZoneNativeBridge {
  /** Сайт → Android: JSON-массив активных сеансов для системных будильников */
  syncAlarms(json: string): void;
}

declare global {
  interface Window {
    PlayZoneNative?: PlayZoneNativeBridge;
  }
}

/** Открыта ли CRM внутри нативного APK (оболочка помечает User-Agent) */
export function isNativeApk(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("PlayZoneNative");
}

/**
 * Синхронизировать будильники активных сеансов с Android-оболочкой.
 * Вызывается при каждом обновлении dashboard — оболочка сама сравнит
 * список с текущим и поменяет только то, что изменилось.
 */
export function syncNativeAlarms(devices: DeviceWithSession[]): void {
  if (!isNativeApk()) return;
  const bridge = window.PlayZoneNative;
  if (!bridge || typeof bridge.syncAlarms !== "function") return;

  const items = devices
    .filter((d) => d.activeSession)
    .map((d) => {
      const s = d.activeSession!;
      return {
        id: s.id,
        endAt: Date.parse(s.plannedEndAt),
        title: "⏰ Время вышло!",
        body: `${deviceLabel(d.type, d.number)} · ${s.packageName} · ${formatTenge(
          s.price
        )} — сеанс нужно завершить`,
        // тот же tag, что у FCM-пуша: уведомления заменяют друг друга, без дублей
        tag: `overdue-${s.id}`,
      };
    });

  try {
    bridge.syncAlarms(JSON.stringify(items));
  } catch {
    // оболочка недоступна — обычный веб-режим, не критично
  }
}
