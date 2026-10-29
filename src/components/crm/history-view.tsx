"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Banknote, CalendarDays, Coins, Loader2, Receipt, Smartphone, Tag, Trash2 } from "lucide-react";
import type { CurrentUser, HistoryData } from "@/lib/crm-types";
import { deviceLabel, formatTenge, PAYMENT_LABELS } from "@/lib/crm-types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTimeStr(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryView({
  currentUser,
  onToast,
}: {
  currentUser: CurrentUser;
  onToast: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    label: string;
    price: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = currentUser.role === "ADMIN";

  const historyQuery = useQuery<HistoryData>({
    queryKey: ["history", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/history?from=${from}&to=${to}`);
      if (!res.ok) {
        onToast("Не удалось загрузить историю");
        throw new Error("Ошибка загрузки истории");
      }
      return res.json();
    },
    refetchInterval: 15000,
  });

  const sessions = historyQuery.data?.sessions ?? [];
  const totals = historyQuery.data?.totals;

  const paymentSummary = useMemo(() => {
    if (!sessions.length) return null;
    const cash = sessions.reduce((a, s) => a + s.cashAmount, 0);
    const kaspi = sessions.reduce((a, s) => a + s.kaspiAmount, 0);
    return { cash, kaspi };
  }, [sessions]);

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["history"] });
    void queryClient.invalidateQueries({ queryKey: ["cash"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["report"] });
  }

  // Удаление ошибочного сеанса: сеанс + проводка кассы удаляются,
  // касса наличных и Каспи автоматически уменьшаются.
  async function deleteSession() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${pendingDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error ?? "Не удалось удалить сеанс");
        return;
      }
      onToast(data.message ?? "Сеанс удалён, касса пересчитана");
      refreshAll();
    } catch {
      onToast("Ошибка соединения");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Фильтр по датам */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="history-from" className="text-xs flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> С даты
          </Label>
          <Input
            id="history-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="history-to" className="text-xs">
            По дату
          </Label>
          <Input
            id="history-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        {isAdmin && (
          <p className="text-xs text-muted-foreground mb-1.5">
            Ошибочные сеансы можно удалить — касса пересчитается автоматически.
          </p>
        )}
      </div>

      {/* Итоги */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-header text-header-fg p-4">
            <div className="text-xs opacity-75 flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> Выручка за период
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {formatTenge(totals.revenue)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Banknote className="h-3.5 w-3.5" /> Наличные
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {formatTenge(paymentSummary?.cash ?? totals.cash)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" /> Каспи
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {formatTenge(paymentSummary?.kaspi ?? totals.kaspi)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5" /> Сеансов
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">{totals.count}</div>
          </div>
        </div>
      )}

      {/* Таблица */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur">
              <TableRow>
                <TableHead>Устройство</TableHead>
                <TableHead>Пакет</TableHead>
                <TableHead>Начало</TableHead>
                <TableHead>Завершён</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Сотрудник</TableHead>
                {isAdmin && <TableHead className="text-right">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    За выбранный период сеансов нет
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s) => {
                  const active = s.status === "ACTIVE";
                  return (
                    <TableRow key={s.id} className={active ? "bg-amber-500/5" : undefined}>
                      <TableCell className="font-medium">
                        {deviceLabel(s.deviceType, s.deviceNumber)}
                        {active && (
                          <Badge className="ml-2 bg-amber-500 text-white hover:bg-amber-500">
                            идёт
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.packageName}</Badge>
                        {s.discountLabel && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 gap-1 text-primary border-primary/40"
                            title={`Было ${formatTenge(s.originalPrice ?? s.price)}`}
                          >
                            <Tag className="h-3 w-3" />
                            {s.discountLabel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {dateTimeStr(s.startedAt)}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {s.endedAt ? timeStr(s.endedAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          {s.paymentMethod === "CASH" && (
                            <Badge variant="outline" className="gap-1">
                              <Banknote className="h-3 w-3" /> Наличные
                            </Badge>
                          )}
                          {s.paymentMethod === "KASPI" && (
                            <Badge variant="outline" className="gap-1">
                              <Smartphone className="h-3 w-3" /> Каспи
                            </Badge>
                          )}
                          {s.paymentMethod === "MIXED" && (
                            <Badge variant="outline">
                              Смешанная: нал. {s.cashAmount} + Каспи {s.kaspiAmount}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatTenge(s.price)}
                        {s.discountLabel && (
                          <span className="block text-[11px] font-normal text-muted-foreground line-through">
                            {formatTenge(s.originalPrice ?? 0)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.createdByName}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <button
                            className="inline-flex rounded-md p-1.5 text-muted-foreground/60 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                            title="Удалить сеанс и вернуть сумму из кассы"
                            onClick={() =>
                              setPendingDelete({
                                id: s.id,
                                label: `${deviceLabel(s.deviceType, s.deviceNumber)} · ${s.packageName}`,
                                price: s.price,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {PAYMENT_LABELS.MIXED} — часть суммы наличными, часть через Каспи.
      </p>

      {/* Подтверждение удаления сеанса */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сеанс?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  {pendingDelete.label} на {formatTenge(pendingDelete.price)} будет удалён вместе
                  с проводкой кассы. Касса наличных и касса Каспи автоматически уменьшатся на
                  оплаченные суммы. Действие необратимо.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void deleteSession();
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Удалить сеанс
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
