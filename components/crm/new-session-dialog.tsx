"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  CheckCircle2,
  Gamepad2,
  Loader2,
  Play,
  Smartphone,
  Layers,
  Tag,
  Timer,
  UserRound,
} from "lucide-react";
import { apiFetch } from "@/lib/offline";
import type {
  CashData,
  CustomerItem,
  DashboardData,
  DeviceWithSession,
  Pkg,
  PaymentMethod,
  PromoItem,
  VrGameItem,
} from "@/lib/crm-types";
import {
  computeSessionPrice,
  deviceLabel,
  formatTenge,
  minutesHuman,
} from "@/lib/crm-types";

type Props = {
  device: DeviceWithSession | null;
  packages: Pkg[];
  promos: PromoItem[];
  customers: CustomerItem[];
  vrGames: VrGameItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (message: string) => void;
  onError: (message: string) => void;
};

type Selection = { kind: "package" | "game"; id: number };

const NO_CUSTOMER = "none";

export function NewSessionDialog({
  device,
  packages,
  promos,
  customers,
  vrGames,
  open,
  onOpenChange,
  onStarted,
  onError,
}: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [customerId, setCustomerId] = useState<string>(NO_CUSTOMER);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashInput, setCashInput] = useState("");
  const [kaspiInput, setKaspiInput] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const isVr = device?.type === "VR";

  const suitablePackages = useMemo(
    () =>
      packages.filter(
        (p) => p.active && (!device || !p.deviceType || p.deviceType === device.type)
      ),
    [packages, device]
  );

  const selectedPackage = useMemo(
    () =>
      selection?.kind === "package"
        ? suitablePackages.find((p) => p.id === selection.id) ?? null
        : null,
    [suitablePackages, selection]
  );
  const selectedGame = useMemo(
    () =>
      selection?.kind === "game" ? vrGames.find((g) => g.id === selection.id) ?? null : null,
    [vrGames, selection]
  );

  const selectedCustomer = useMemo(
    () => (customerId === NO_CUSTOMER ? null : customers.find((c) => String(c.id) === customerId) ?? null),
    [customers, customerId]
  );

  // Базовая цена и расчёт скидки (акция клуба vs персональная скидка клиента —
  // применяется та, что выгоднее клиенту). Сервер считает так же.
  const basePrice = selectedPackage?.price ?? selectedGame?.price ?? 0;
  const priceInfo = useMemo(
    () =>
      selection
        ? computeSessionPrice(basePrice, promos, device?.type ?? null, selectedCustomer, new Date())
        : null,
    [selection, basePrice, promos, device, selectedCustomer]
  );

  const total = priceInfo?.price ?? 0;
  const discounted = Boolean(priceInfo?.discountLabel);

  // Сброс состояния при открытии
  useEffect(() => {
    if (open) {
      setSelection(null);
      setCustomerId(NO_CUSTOMER);
      setPaymentMethod("CASH");
      setCashInput("");
      setKaspiInput("");
      setLoading(false);
    }
  }, [open, device?.id]);

  // При выборе пакета/игры или клиента сбрасываем разбивку оплаты
  useEffect(() => {
    setCashInput("");
    setKaspiInput("");
  }, [selection, customerId, paymentMethod]);

  const cash = parseInt(cashInput || "0", 10) || 0;
  const kaspi = parseInt(kaspiInput || "0", 10) || 0;

  const mixedValid = cash + kaspi === total && (cash > 0 || kaspi > 0);
  const canSubmit = !!device && !!selection && (paymentMethod !== "MIXED" || mixedValid);

  function setCashAuto(value: string) {
    // Смешанная оплата: ввёл наличные — остаток автоматически на Каспи
    const v = parseInt(value || "0", 10) || 0;
    if (v < 0) return;
    setCashInput(value === "" ? "" : String(Math.min(v, total)));
    setKaspiInput(String(Math.max(0, total - Math.min(v, total))));
  }

  function setKaspiAuto(value: string) {
    // Ввёл Каспи — остаток автоматически наличными
    const v = parseInt(value || "0", 10) || 0;
    if (v < 0) return;
    setKaspiInput(value === "" ? "" : String(Math.min(v, total)));
    setCashInput(String(Math.max(0, total - Math.min(v, total))));
  }

  // Разбивка оплаты для сохранения (офлайн-режим: показывает на карточке сразу)
  function paymentSplit(): { cashPart: number; kaspiPart: number } {
    if (paymentMethod === "CASH") return { cashPart: total, kaspiPart: 0 };
    if (paymentMethod === "KASPI") return { cashPart: 0, kaspiPart: total };
    return { cashPart: cash, kaspiPart: kaspi };
  }

  // Офлайн: сеанс ещё не дошёл до сервера, но показываем его сразу,
  // и деньги сразу отображаются в кассе. После синхронизации данные
  // заменятся настоящими.
  function applyOfflineOptimistic() {
    if (!device || !selection) return;
    const duration = selectedGame?.durationMinutes ?? selectedPackage?.durationMinutes ?? 60;
    const startedIso = new Date().toISOString();
    const endIso = new Date(Date.now() + duration * 60_000).toISOString();
    const { cashPart, kaspiPart } = paymentSplit();
    const what = selectedGame?.name ?? selectedPackage?.name ?? "Сеанс";

    queryClient.setQueryData<DashboardData>(["dashboard"], (old) =>
      old
        ? {
            ...old,
            devices: old.devices.map((d) =>
              d.id === device.id
                ? {
                    ...d,
                    activeSession: {
                      id: -Date.now(),
                      packageName: what,
                      durationMinutes: duration,
                      startedAt: startedIso,
                      plannedEndAt: endIso,
                      price: total,
                      paymentMethod,
                      cashAmount: cashPart,
                      kaspiAmount: kaspiPart,
                      notified: false,
                      createdByName: "офлайн · синхронизируется",
                    },
                  }
                : d
            ),
          }
        : old
    );

    if (cashPart > 0 || kaspiPart > 0) {
      queryClient.setQueryData<CashData>(["cash"], (old) =>
        old
          ? {
              ...old,
              cashBalance: old.cashBalance + cashPart,
              kaspiBalance: old.kaspiBalance + kaspiPart,
              today: {
                ...old.today,
                salesCash: old.today.salesCash + cashPart,
                salesKaspi: old.today.salesKaspi + kaspiPart,
              },
              entries: [
                {
                  id: -Date.now(),
                  kind: "SALE" as const,
                  amount: total,
                  cashPart,
                  kaspiPart,
                  note: `${deviceLabel(device.type, device.number)} · ${what} (офлайн)`,
                  userName: "офлайн",
                  createdAt: startedIso,
                },
                ...old.entries,
              ],
            }
          : old
      );
    }
  }

  async function handleStart() {
    if (!device || !selection) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.id,
          packageId: selection.kind === "package" ? selection.id : undefined,
          vrGameId: selection.kind === "game" ? selection.id : undefined,
          customerId: customerId === NO_CUSTOMER ? undefined : Number(customerId),
          paymentMethod,
          cashAmount: paymentMethod === "CASH" || paymentMethod === "MIXED" ? cash : 0,
          kaspiAmount: paymentMethod === "KASPI" || paymentMethod === "MIXED" ? kaspi : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Не удалось запустить сеанс");
        return;
      }
      const what = selectedGame ? selectedGame.name : selectedPackage?.name ?? "";
      if (data.queued) {
        // Нет интернета: сеанс сохранён в телефоне, уедет на сервер при подключении
        applyOfflineOptimistic();
        onStarted(
          `Нет интернета: ${deviceLabel(device.type, device.number)} — ${what}, ${formatTenge(
            total
          )}. Таймер запущен, всё сохранится и отправится автоматически`
        );
        onOpenChange(false);
        return;
      }
      const discountPart = data.discount
        ? `, скидка ${formatTenge(data.discount.amount)} (${data.discount.label})`
        : "";
      onStarted(
        `${deviceLabel(device.type, device.number)} — ${what}, ${formatTenge(
          total
        )}${discountPart}. Таймер запущен!`
      );
      onOpenChange(false);
    } catch {
      onError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  const paymentOptions: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: "CASH", label: "Наличные", icon: <Banknote className="h-4 w-4" /> },
    { value: "KASPI", label: "Каспи", icon: <Smartphone className="h-4 w-4" /> },
    { value: "MIXED", label: "Смешанная", icon: <Layers className="h-4 w-4" /> },
  ];

  const pickCard =
    "rounded-lg border-2 px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Новый сеанс
            {device && (
              <Badge className="bg-header text-header-fg hover:bg-header">
                {deviceLabel(device.type, device.number)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isVr
              ? "Выберите VR-игру или свободный запуск, затем способ оплаты"
              : "Выберите пакет времени, затем способ оплаты"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Шаг 1a: VR-игра (только для VR-кресел) */}
          {isVr && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4" /> 1. VR-игра из каталога
              </Label>
              {vrGames.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  Каталог игр пуст — добавьте игры в Настройки → VR игры, или используйте
                  свободный запуск ниже.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {vrGames.map((g) => {
                    const disc = computeSessionPrice(
                      g.price,
                      promos,
                      device?.type ?? null,
                      selectedCustomer,
                      new Date()
                    );
                    const active = selection?.kind === "game" && selection.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelection({ kind: "game", id: g.id })}
                        className={`${pickCard} ${
                          active ? "border-primary bg-primary/10" : "border-border hover:border-ring"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {g.number > 0 && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] shrink-0">
                              №{g.number}
                            </Badge>
                          )}
                          <span className="text-sm font-semibold leading-tight truncate">{g.name}</span>
                        </div>
                        {g.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {g.description}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <Timer className="h-3 w-3" />
                          {minutesHuman(g.durationMinutes)}
                          {g.minAge > 0 && <span>· {g.minAge}+</span>}
                        </div>
                        <div className="text-base font-bold mt-0.5">
                          {formatTenge(disc.price)}
                          {disc.discount > 0 && (
                            <span className="ml-1 text-[11px] font-medium text-primary line-through">
                              {formatTenge(g.price)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Шаг 1b: пакеты времени (свободный запуск) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              {isVr ? "Или свободный запуск — пакет времени" : "1. Период времени"}
            </Label>
            {suitablePackages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Нет доступных пакетов. Попросите администратора добавить их в настройках.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {suitablePackages.map((p) => {
                  const disc = computeSessionPrice(
                    p.price,
                    promos,
                    device?.type ?? null,
                    selectedCustomer,
                    new Date()
                  );
                  const active = selection?.kind === "package" && selection.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelection({ kind: "package", id: p.id })}
                      className={`${pickCard} ${
                        active ? "border-primary bg-primary/10" : "border-border hover:border-ring"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.name}
                      </div>
                      <div className="text-lg font-bold mt-0.5">
                        {formatTenge(disc.price)}
                      </div>
                      {disc.discount > 0 && (
                        <div className="text-[11px] font-medium text-primary">
                          −{formatTenge(disc.discount)}{" "}
                          <span className="line-through opacity-60">{formatTenge(p.price)}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Постоянный клиент (опционально) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <UserRound className="h-4 w-4" /> Постоянный клиент (необязательно)
            </Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>Без клиента — обычная цена</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.discountPercent > 0 ? ` (−${c.discountPercent}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selection && priceInfo && (
            <>
              {/* Сумма (с учётом скидки) */}
              <div className="rounded-lg bg-header text-header-fg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-75">К оплате</span>
                  <span className="text-2xl font-black tabular-nums">
                    {formatTenge(total)}
                  </span>
                </div>
                {discounted && (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="flex items-center gap-1 opacity-80">
                      <Tag className="h-3 w-3" />
                      {priceInfo.discountLabel}
                    </span>
                    <span className="line-through opacity-60 tabular-nums">
                      {formatTenge(basePrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Шаг 2: способ оплаты */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">2. Способ оплаты</Label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`rounded-lg border-2 px-2 py-2.5 flex flex-col items-center gap-1 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        paymentMethod === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-ring"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Смешанная оплата */}
              {paymentMethod === "MIXED" && (
                <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Введите одну часть — вторая посчитается автоматически. Сумма должна
                    равняться {formatTenge(total)}.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mixed-cash" className="text-xs flex items-center gap-1">
                        <Banknote className="h-3.5 w-3.5" /> Наличные
                      </Label>
                      <Input
                        id="mixed-cash"
                        type="number"
                        min={0}
                        max={total}
                        inputMode="numeric"
                        value={cashInput}
                        onChange={(e) => setCashAuto(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mixed-kaspi" className="text-xs flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5" /> Каспи
                      </Label>
                      <Input
                        id="mixed-kaspi"
                        type="number"
                        min={0}
                        max={total}
                        inputMode="numeric"
                        value={kaspiInput}
                        onChange={(e) => setKaspiAuto(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      Итого:{" "}
                      <span
                        className={
                          mixedValid
                            ? "font-bold text-emerald-600 dark:text-emerald-400"
                            : "font-bold text-red-600 dark:text-red-400"
                        }
                      >
                        {formatTenge(cash + kaspi)}
                      </span>{" "}
                      из {formatTenge(total)}
                    </span>
                    {mixedValid && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Верно
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              <Button
                className="w-full gap-2 h-11 text-base"
                disabled={!canSubmit || loading}
                onClick={handleStart}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                Принять оплату и запустить таймер
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
