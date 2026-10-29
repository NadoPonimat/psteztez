// FCM (Firebase Cloud Messaging) для нативного APK-приложения: доставляет
// «время вышло» напрямую от Google — со стандартным системным запросом
// разрешения при первом запуске, надёжно даже когда приложение убито из памяти.
//
// Нужны переменные окружения (из JSON сервисного аккаунта Firebase):
//   FIREBASE_PROJECT_ID   — project_id
//   FIREBASE_CLIENT_EMAIL — client_email
//   FIREBASE_PRIVATE_KEY  — private_key (вставлять целиком, как есть, с \n)
// Если переменных нет — модуль безвредно отключён (FCM не отправляется),
// Web Push (VAPID) продолжает работать независимо.

import { db } from "@/lib/db";

export function fcmConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

type AdminMessaging = import("firebase-admin/messaging").Messaging;
let cached: AdminMessaging | null = null;

async function getMessaging(): Promise<AdminMessaging> {
  if (cached) return cached;
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getMessaging: gm } = await import("firebase-admin/messaging");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID as string,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY as string).replace(
          /\\n/g,
          "\n"
        ),
      }),
    });
  }
  cached = gm();
  return cached;
}

export type OverduePayload = {
  title: string;
  body: string;
  tag: string;
  sessionId: number;
  url: string;
};

/** Отправить data-сообщение высокого приоритета на все зарегистрированные APK. */
export async function sendFcmToAll(payload: OverduePayload): Promise<number> {
  if (!fcmConfigured()) return 0;
  try {
    const messaging = await getMessaging();
    const tokens = (await db.fcmToken.findMany()).map((t) => t.token);
    if (tokens.length === 0) return 0;

    const res = await messaging.sendEach(
      tokens.map((token) => ({
        token,
        data: {
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          sessionId: String(payload.sessionId),
          url: payload.url,
        },
        android: { priority: "high" as const },
      }))
    );

    // Протухшие токены (приложение удалено, токен отозван) удаляем из базы
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = String(r.error?.code ?? "");
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length > 0) {
      await db.fcmToken
        .deleteMany({ where: { token: { in: dead } } })
        .catch(() => {});
    }
    return res.successCount;
  } catch (err) {
    console.error("[fcm] отправка не удалась:", err);
    return 0;
  }
}
