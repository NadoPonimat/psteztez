"use client";

import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlarmClock, BellOff, Square } from "lucide-react";
import {
  startAlarm,
  stopAlarm,
  requestNotifyPermission,
  notifyOverdue,
  closeOverdueNotification,
} from "@/lib/alarm";
import type { DeviceWithSession } from "@/lib/crm-types";
import { deviceLabel, formatTenge } from "@/lib/crm-types";
import { apiFetch } from "@/lib/offline";

type Props = {
  devices: DeviceWithSession[];
  now: number;
  muted: boolean;
  sound: string;
  onComplete: (device: DeviceWithSession) => void;
  onRefresh: () => void;
  onToast: (message: string) => void;
};

// Глобальный обработчик «время вышло»: выбранный аккаунтом звук + модальное окно
export function AlarmCenter({ devices, now, muted, sound, onComplete, onRefresh, onToast }: Props) {
  const overdueDevices = useMemo(
    () =>
      devices.filter((d) => {
        const s = d.activeSession;
        if (!s) return false;
        return Date.parse(s.plannedEndAt) < now && !s.notified;
      }),
    [devices, now]
  );

  const ringing = overdueDevices.length > 0 && !muted;

  useEffect(() => {
    if (ringing) {
      startAlarm(sound);
    } else {
      stopAlarm();
    }
    return () => stopAlarm();
  }, [ringing, sound]);

  // Запрашиваем разрешение на системные уведомления один раз
  useEffect(() => {
    void requestNotifyPermission();
  }, []);

  // Пока приложение свёрнуто — дублируем сигнал системными уведомлениями
  // (звук телефона + вибрация). В открытом приложении они не нужны.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const hidden = document.hidden;
    if (hidden) {
      for (const d of overdueDevices) {
        const s = d.activeSession!;
        void notifyOverdue(
          "⏰ Время вышло!",
          `${deviceLabel(d.type, d.number)} · ${s.packageName} · ${formatTenge(s.price)} — сеанс нужно завершить`,
          `overdue-${s.id}`
        );
      }
    } else {
      for (const d of overdueDevices) {
        void closeOverdueNotification(`overdue-${d.activeSession!.id}`);
      }
    }
  }, [overdueDevices]);

  async function acknowledge(sessionId: number, label: string) {
    try {
      await apiFetch(`/api/sessions/${sessionId}/acknowledge`, { method: "POST" });
      stopAlarm();
      void closeOverdueNotification(`overdue-${sessionId}`);
      onToast(`Уведомление по ${label} принято — завершите сеанс`);
      onRefresh();
    } catch {
      // игнорируем
    }
  }

  return (
    <Dialog open={overdueDevices.length > 0}>
      <DialogContent
        className="sm:max-w-md border-red-300"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlarmClock className="h-5 w-5 animate-bounce" />
            Время вышло!
          </DialogTitle>
          <DialogDescription>
            Истёк оплаченный период на следующих устройствах:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {overdueDevices.map((d) => {
            const s = d.activeSession!;
            const label = deviceLabel(d.type, d.number);
            const overtimeMin = Math.floor((now - Date.parse(s.plannedEndAt)) / 60000);
            return (
              <div
                key={d.id}
                className="rounded-lg border-2 border-red-300 bg-red-50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{label}</span>
                  <Badge className="bg-red-600 text-white hover:bg-red-600">
                    +{overtimeMin} мин
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.packageName} · {formatTenge(s.price)}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => acknowledge(s.id, label)}
                  >
                    <BellOff className="h-3.5 w-3.5" />
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => {
                      stopAlarm();
                      void closeOverdueNotification(`overdue-${s.id}`);
                      onComplete(d);
                    }}
                  >
                    <Square className="h-3.5 w-3.5" />
                    Завершить сеанс
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Нажмите «Принять», чтобы отключить сирену, или «Завершить сеанс» с паролем
          подтверждения.
        </p>
      </DialogContent>
    </Dialog>
  );
}
