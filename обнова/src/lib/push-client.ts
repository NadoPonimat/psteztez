// Клиент Web Push: подписка устройства на уведомления «время вышло».
// Работает в Chrome/APK (Android) и в iOS 16.4+ — но на iPhone только если
// CRM добавлена на экран «Домой» (ограничение Apple, не наше).

export type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushSupported(): boolean {
  return supported();
}

/** Текущее состояние: поддерживается / разрешение / подписано ли уже. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!supported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, permission, subscribed: Boolean(sub) };
  } catch {
    return { supported: true, permission, subscribed: false };
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Включить push на этом устройстве: запросить разрешение (если ещё не дано),
 * подписаться на сервере и сохранить подписку в базе CRM.
 */
export async function enablePush(label?: string): Promise<PushStatus> {
  if (!supported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") {
    return { supported: true, permission, subscribed: false };
  }

  const keyRes = await fetch("/api/push/public-key");
  const { key } = (await keyRes.json()) as { key: string | null };
  if (!key) {
    // На сервере не заданы VAPID-ключи — push недоступен
    return { supported: true, permission, subscribed: false };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Uint8Array совместим с BufferSource рантайма; приведение для типов TS
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), label }),
  });

  return { supported: true, permission, subscribed: true };
}

/** Выключить push на этом устройстве. */
export async function disablePush(): Promise<PushStatus> {
  if (!supported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return { supported: true, permission: Notification.permission, subscribed: false };
}

/**
 * Тихо подписать устройство, если разрешение уже выдано (например, его
 * раньше запросил AlarmCenter) — чтобы push заработал сам, без кнопки.
 */
export async function ensurePushSubscribed(): Promise<void> {
  if (!supported()) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) return; // уже подписано
    await enablePush();
  } catch {
    // тихо игнорируем — включить можно кнопкой в меню
  }
}

/** Подсказка для iOS: push работает только у CRM на экране «Домой». */
export function isIosSafariTab(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return ios && !standalone;
}
