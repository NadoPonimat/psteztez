// Звуки уведомления «время вышло» через Web Audio API (без внешних файлов).
// Паттерны звуков описаны в lib/sounds.ts, выбор звука — настройка аккаунта.

import { DEFAULT_SOUND_ID, SOUNDS, soundById } from "@/lib/sounds";
import type { SoundDef } from "@/lib/sounds";

let ctx: AudioContext | null = null;
let alarmTimer: ReturnType<typeof setInterval> | null = null;
let vibrationTimer: ReturnType<typeof setInterval> | null = null;
let currentSoundId: string = DEFAULT_SOUND_ID;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

function playBeep(
  freq: number,
  duration: number,
  delay: number,
  type: OscillatorType = "square"
) {
  const c = ensureCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = c.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // игнорируем ошибки аудио
  }
}

function playPattern(sound: SoundDef) {
  for (const n of sound.notes) {
    playBeep(n.f, n.d, n.t, n.type ?? "square");
  }
}

/**
 * Разблокировка звука первым касанием пользователя: мобильные браузеры
 * (Android Chrome, PWA) разрешают Web Audio только после жеста. Вызывается
 * на каждом касании — контекст создаётся/возобновляется заранее, чтобы
 * сирена гарантированно прозвучала, когда время сеанса выйдет.
 */
export function unlockAudio(): void {
  if (typeof document === "undefined") return;
  const handler = () => {
    const c = ensureCtx();
    if (c && c.state === "suspended") void c.resume();
  };
  document.addEventListener("pointerdown", handler, { capture: true });
  document.addEventListener("touchstart", handler, { capture: true });
  document.addEventListener("keydown", handler, { capture: true });
}

function soundFor(id?: string): SoundDef {
  return soundById(id ?? "") ?? soundById(DEFAULT_SOUND_ID) ?? SOUNDS[0];
}

/** Запустить непрерывное оповещение выбранным звуком: сирена + вибрация телефона */
export function startAlarm(soundId?: string) {
  if (typeof soundId === "string") {
    currentSoundId = soundId;
  }
  if (alarmTimer) return;
  const sound = soundFor(currentSoundId);
  playPattern(sound);
  alarmTimer = setInterval(() => playPattern(sound), sound.loopMs);
  startVibration();
}

export function stopAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  stopVibration();
}

export function isAlarmRinging(): boolean {
  return alarmTimer !== null;
}

// ---- Вибрация телефона (Android/PWA) ----

function startVibration() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  stopVibration();
  const pattern = [600, 250, 600, 250];
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
  vibrationTimer = setInterval(() => {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }, 2000);
}

function stopVibration() {
  if (vibrationTimer) {
    clearInterval(vibrationTimer);
    vibrationTimer = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}

// ---- Системные уведомления (когда приложение свёрнуто) ----

/** Разрешение на уведомления: «default» — запросить, иначе вернуть текущее */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    if (Notification.permission === "default") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return "denied";
  }
}

/** Показать системное уведомление «время вышло» (со звуком и вибрацией телефона) */
export async function notifyOverdue(title: string, body: string, tag: string): Promise<void> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const options: NotificationOptions = {
      tag,
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      requireInteraction: true,
    };
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { ...options, vibrate: [500, 200, 500] });
    } else {
      new Notification(title, { ...options, vibrate: [500, 200, 500] });
    }
  } catch {
    // игнорируем ошибки уведомлений
  }
}

/** Закрыть уведомление по тегу (после «Принять»/завершения сеанса) */
export async function closeOverdueNotification(tag: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const list = (await reg?.getNotifications({ tag })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    // ignore
  }
}

/** Разовое проигрывание звука (прослушать в настройках) */
export function previewSound(soundId: string) {
  stopAlarm();
  playPattern(soundFor(soundId));
}
