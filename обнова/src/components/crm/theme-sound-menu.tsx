"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BellOff, BellRing, Check, Palette, Volume2 } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { SOUNDS } from "@/lib/sounds";
import { previewSound } from "@/lib/alarm";
import {
  disablePush,
  enablePush,
  getPushStatus,
  isIosSafariTab,
  pushSupported,
  type PushStatus,
} from "@/lib/push-client";

// Блок «Уведомления на телефоне»: подписка этого устройства на Web Push —
// уведомления о конце времени приходят даже когда CRM свёрнута или закрыта.
function PushToggle() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    void getPushStatus().then(setStatus);
  }, []);

  async function toggle() {
    setBusy(true);
    setHint(null);
    try {
      const next = status?.subscribed ? await disablePush() : await enablePush("Телефон");
      setStatus(next);
      if (!next.subscribed && next.permission === "denied") {
        setHint("Разрешение заблокировано — разрешите уведомления в настройках браузера/приложения");
      } else if (!next.subscribed && next.permission === "granted") {
        setHint("На сервере не заданы VAPID-ключи — скажите администратору");
      } else if (next.subscribed) {
        setHint("Готово — уведомления будут приходить и в свёрнутом приложении");
      }
    } catch {
      setHint("Не получилось — попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.supported) {
    return (
      <div className="px-2 py-1.5">
        <DropdownMenuLabel className="px-0">Уведомления на телефоне</DropdownMenuLabel>
        <p className="text-[11px] text-muted-foreground">
          {isIosSafariTab()
            ? "На iPhone работает после добавления CRM на экран «Домой» (Safari → Поделиться → На экран «Домой») — iOS 16.4+."
            : "Этот браузер не поддерживает push-уведомления."}
        </p>
      </div>
    );
  }

  const on = status?.subscribed ?? false;
  return (
    <div className="px-2 py-1.5">
      <DropdownMenuLabel className="px-0">Уведомления на телефоне</DropdownMenuLabel>
      <button
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
        onClick={toggle}
        disabled={busy || !pushSupported() || status === null}
      >
        {on ? (
          <BellRing className="h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1">{on ? "Включены — отключить" : "Включить (свернуто тоже)"}</span>
        {on && <Check className="h-4 w-4 shrink-0" />}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {hint ??
          "Push приходят от системы даже когда CRM свёрнута. Звук и вибрация — в настройках Android: Приложения → PlayZone CRM → Уведомления."}
      </p>
    </div>
  );
}

// Выбор темы оформления и звука уведомлений — доступен каждому аккаунту.
// Сохраняется на сервере (User.theme / User.alarmSound), применяется сразу.
export function ThemeSoundMenu({
  theme,
  sound,
  onTheme,
  onSound,
}: {
  theme: string;
  sound: string;
  onTheme: (id: string) => void;
  onSound: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-header-fg/80 hover:text-header-fg hover:bg-white/10"
          aria-label="Тема и звук"
          title="Тема оформления и звук уведомлений"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
        <PushToggle />

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Тема оформления</DropdownMenuLabel>
        {THEMES.map((t) => (
          <button
            key={t.id || "default"}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
              theme === t.id ? "font-bold" : ""
            }`}
            onClick={() => onTheme(t.id)}
          >
            <span
              className="h-5 w-5 rounded-md border border-black/10 shrink-0 flex overflow-hidden"
              style={{ backgroundColor: t.swatch.bg }}
              aria-hidden
            >
              <span className="h-full w-2.5" style={{ backgroundColor: t.swatch.primary }} />
              <span className="h-full flex-1" style={{ backgroundColor: t.swatch.accent }} />
            </span>
            <span className="flex-1 truncate">{t.name}</span>
            {theme === t.id && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Звук уведомления</DropdownMenuLabel>
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
              sound === s.id ? "font-bold" : ""
            }`}
            onClick={() => {
              onSound(s.id);
              previewSound(s.id);
            }}
          >
            <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{s.name}</span>
            {sound === s.id && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
        <p className="px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground">
          Клик по звуку — выбрать и прослушать. Тема и звук сохраняются для вашего аккаунта.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
