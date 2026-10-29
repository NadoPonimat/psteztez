"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import type { DashboardData, DeviceWithSession } from "@/lib/crm-types";
import { deviceLabel, formatTenge, PAYMENT_LABELS } from "@/lib/crm-types";
import { apiFetch } from "@/lib/offline";

type Props = {
  device: DeviceWithSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (message: string) => void;
  onError: (message: string) => void;
};

export function CompleteSessionDialog({
  device,
  open,
  onOpenChange,
  onCompleted,
  onError,
}: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setPassword("");
      setLoading(false);
    }
  }, [open]);

  async function handleComplete() {
    if (!device?.activeSession) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/sessions/${device.activeSession.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Не удалось завершить сеанс");
        setPassword("");
        return;
      }
      if (data.queued) {
        // Офлайн: освобождаем устройство сразу, операция уедет на сервер при подключении
        const doneId = device.activeSession.id;
        queryClient.setQueryData<DashboardData>(["dashboard"], (old) =>
          old
            ? {
                ...old,
                devices: old.devices.map((d) =>
                  d.activeSession && d.activeSession.id === doneId
                    ? { ...d, activeSession: null }
                    : d
                ),
              }
            : old
        );
        onCompleted(
          `Нет интернета: завершение сеанса на ${deviceLabel(
            device.type,
            device.number
          )} сохранено и отправится автоматически`
        );
        onOpenChange(false);
        return;
      }
      onCompleted(
        `Сеанс на ${deviceLabel(device.type, device.number)} завершён. ${formatTenge(
          device.activeSession.price
        )} — ${PAYMENT_LABELS[device.activeSession.paymentMethod] ?? ""}`
      );
      onOpenChange(false);
    } catch {
      onError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  const session = device?.activeSession;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Завершение сеанса
            {device && (
              <Badge className="bg-header text-header-fg hover:bg-header">
                {deviceLabel(device.type, device.number)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Для завершения введите пароль подтверждения
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Пакет</span>
                <span className="font-medium">{session.packageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Стоимость</span>
                <span className="font-bold">{formatTenge(session.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Оплата</span>
                <span className="font-medium">
                  {PAYMENT_LABELS[session.paymentMethod]}
                  {session.paymentMethod === "MIXED" &&
                    ` (нал. ${session.cashAmount} + Каспи ${session.kaspiAmount})`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="complete-password" className="flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" />
                Пароль подтверждения
              </Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="complete-password"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  className="pl-9 text-center text-lg tracking-[0.4em] font-mono"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password) void handleComplete();
                  }}
                  placeholder="0000"
                  maxLength={12}
                />
              </div>
            </div>

            <Button
              className="w-full h-11"
              disabled={!password || loading}
              onClick={handleComplete}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Подтвердить завершение
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
