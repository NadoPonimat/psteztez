// Web Push (VAPID) на сервере: доставляет «время вышло» на телефоны даже
// когда приложение свёрнуто или закрыто. Слышимость обеспечивает сама
// Android-система (уведомление от приложения PlayZone CRM); в открытом
// приложении сирена продолжает работать как раньше через AlarmCenter.
//
// Нужно задать переменные окружения:
//   VAPID_PUBLIC_KEY  — публичный ключ (его получает браузер)
//   VAPID_PRIVATE_KEY — приватный ключ (только сервер)
//   VAPID_SUBJECT     — необязательно, "mailto:you@example.com"
// Если ключей нет — весь модуль безвредно отключён (push не отправляется).

import { db } from "@/lib/db";
import { deviceLabel } from "@/lib/crm-types";
import { fcmConfigured, sendFcmToAll } from "@/lib/fcm";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require("web-push");

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export function vapidPublicKey(): string | null {
  return pushConfigured() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

type OverduePayload = {
  title: string;
  body: string;
  tag: string;
  sessionId: number;
  url: string;
};

/** Отправить сообщение на все подписанные устройства. */
async function sendToAll(payload: OverduePayload): Promise<number> {
  if (!pushConfigured()) return 0;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:playzone-crm@example.com",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );

  const subs = await db.pushSubscription.findMany();
  const data = JSON.stringify(payload);
  let sent = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
        { TTL: 3600, urgency: "high", timeout: 10000 }
      );
      sent++;
      if (s.lastError) {
        await db.pushSubscription
          .update({ where: { id: s.id }, data: { lastError: null } })
          .catch(() => {});
      }
    } catch (err) {
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      // 404/410 — подписка больше не существует (переустановка APK,
      // очистка Chrome): удаляем её из базы
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription
          .delete({ where: { id: s.id } })
          .catch(() => {});
      } else {
        await db.pushSubscription
          .update({
            where: { id: s.id },
            data: { lastError: String(err).slice(0, 300) },
          })
          .catch(() => {});
      }
    }
  }
  return sent;
}

/**
 * Найти сеансы, у которых время вышло, а push ещё не отправлялся, и
 * отправить его на все устройства. Отмечает pushedAt, поэтому один сеанс
 * уведомляется ровно один раз (повторный вызов — безопасен).
 * Вызывается из /api/push/tick (внешний cron) и «попутно» из /api/dashboard
 * (пока любой экран CRM открыт, уведомления уходят без внешнего cron).
 */
export async function flushOverduePushes(): Promise<number> {
  if (!pushConfigured() && !fcmConfigured()) return 0;

  const pending = await db.session.findMany({
    where: {
      status: "ACTIVE",
      plannedEndAt: { lt: new Date() },
      pushedAt: null,
    },
    include: { device: { select: { type: true, number: true } } },
    take: 20,
  });
  if (pending.length === 0) return 0;

  let sent = 0;
  for (const s of pending) {
    const label = deviceLabel(s.device.type, s.device.number);
    const payload = {
      title: "⏰ Время вышло!",
      body: `${label} · ${s.packageName} · ${s.price} ₸ — сеанс нужно завершить`,
      tag: `overdue-${s.id}`,
      sessionId: s.id,
      url: "/",
    };
    if (pushConfigured()) sent += await sendToAll(payload); // Web Push (TWA/браузер)
    sent += await sendFcmToAll(payload); // FCM (нативный APK)
    await db.session
      .update({ where: { id: s.id }, data: { pushedAt: new Date() } })
      .catch(() => {});
  }
  return sent;
}

/** Дёшево проверить, есть ли сеансы, ждущие push (для горячего пути). */
export async function hasPendingOverduePushes(): Promise<boolean> {
  if (!pushConfigured() && !fcmConfigured()) return false;
  const count = await db.session.count({
    where: {
      status: "ACTIVE",
      plannedEndAt: { lt: new Date() },
      pushedAt: null,
    },
  });
  return count > 0;
}
