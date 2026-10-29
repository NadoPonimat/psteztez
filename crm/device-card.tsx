"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, Play, Smartphone, Square, Timer, Layers } from "lucide-react";
import type { DeviceWithSession } from "@/lib/crm-types";
import { deviceLabel, formatTenge } from "@/lib/crm-types";

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PaymentBadges({
  method,
  cash,
  kaspi,
}: {
  method: string;
  cash: number;
  kaspi: number;
}) {
  if (method === "CASH") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Banknote className="h-3 w-3" /> Наличные
      </Badge>
    );
  }
  if (method === "KASPI") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Smartphone className="h-3 w-3" /> Каспи
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs" title={`Наличные: ${cash} ₸, Каспи: ${kaspi} ₸`}>
      <Layers className="h-3 w-3" /> Смешанная
    </Badge>
  );
}

export function DeviceCard({
  device,
  now,
  onStart,
  onComplete,
}: {
  device: DeviceWithSession;
  now: number;
  onStart: (device: DeviceWithSession) => void;
  onComplete: (device: DeviceWithSession) => void;
}) {
  const session = device.activeSession;
  const label = deviceLabel(device.type, device.number);

  if (!session) {
    return (
      <button
        onClick={() => onStart(device)}
        className="group text-left rounded-xl border-2 border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50 transition-all p-4 min-h-[168px] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Начать сеанс на ${label}`}
      >
        <div className="flex items-start justify-between">
          <span className="text-xl font-bold text-emerald-900">{label}</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Свободно
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-emerald-700/70 group-hover:text-emerald-700 transition-colors">
            <div className="h-11 w-11 rounded-full bg-emerald-200/70 group-hover:bg-emerald-300 flex items-center justify-center transition-colors">
              <Play className="h-5 w-5 ml-0.5" />
            </div>
            <span className="text-xs font-medium">Начать сеанс</span>
          </div>
        </div>
      </button>
    );
  }

  const plannedEnd = Date.parse(session.plannedEndAt);
  const startedAt = Date.parse(session.startedAt);
  const remaining = plannedEnd - now;
  const overdue = remaining < 0;
  const soon = !overdue && remaining < 5 * 60 * 1000;
  const totalMs = Math.max(1, plannedEnd - startedAt);
  const progress = Math.min(100, Math.max(0, ((now - startedAt) / totalMs) * 100));

  return (
    <div
      className={`rounded-xl border-2 p-4 min-h-[168px] flex flex-col transition-all ${
        overdue
          ? "border-red-400 bg-red-50 animate-pulse"
          : soon
            ? "border-amber-300 bg-amber-50/70"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl font-bold">{label}</span>
        <Badge
          className={
            overdue
              ? "bg-red-600 text-white hover:bg-red-600"
              : soon
                ? "bg-amber-500 text-white hover:bg-amber-500"
                : "bg-header text-header-fg hover:bg-header"
          }
        >
          {session.packageName}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col justify-center py-2">
        {overdue ? (
          <>
            <div className="text-3xl font-black tabular-nums text-red-600">
              +{formatCountdown(remaining)}
            </div>
            <div className="text-xs font-bold text-red-600 uppercase tracking-wide">
              Время вышло
            </div>
          </>
        ) : (
          <>
            <div
              className={`text-3xl font-black tabular-nums ${
                soon ? "text-amber-600" : "text-foreground"
              }`}
            >
              {formatCountdown(remaining)}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Освободится в {formatClock(session.plannedEndAt)}
            </div>
          </>
        )}
        <Progress
          value={progress}
          className="h-1.5 mt-2"
          aria-label="Прогресс сеанса"
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold">{formatTenge(session.price)}</span>
          <PaymentBadges
            method={session.paymentMethod}
            cash={session.cashAmount}
            kaspi={session.kaspiAmount}
          />
        </div>
        <Button
          size="sm"
          variant={overdue ? "destructive" : "outline"}
          className="gap-1.5"
          onClick={() => onComplete(device)}
        >
          <Square className="h-3.5 w-3.5" />
          Завершить
        </Button>
      </div>

      <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
        <Timer className="h-3 w-3" />
        Начало {formatClock(session.startedAt)} · {session.createdByName}
      </div>
    </div>
  );
}
