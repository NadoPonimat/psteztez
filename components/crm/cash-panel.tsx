"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Coins,
  Loader2,
  PiggyBank,
  Receipt,
  Smartphone,
  Trash2,
  Vault,
} from "lucide-react";
import type { CashData, CashEntryItem, CashEntryKind, CurrentUser } from "@/lib/crm-types";
import { CASH_KIND_LABELS, formatTenge } from "@/lib/crm-types";
import { apiFetch } from "@/lib/offline";

// Офлайн-проводка в кэше кассы: баланс правится сразу, запись помечается «офлайн»
function applyOfflineCashEntry(
  old: CashData,
  entry: Omit<CashEntryItem, "id" | "createdAt" | "userName">,
  note: string
): CashData {
  const iso = new Date().toISOString();
  return {
    ...old,
    cashBalance: old.cashBalance + entry.cashPart,
    kaspiBalance: old.kaspiBalance + entry.kaspiPart,
    today: {
      ...old.today,
      openingCash: old.today.openingCash + (entry.kind === "OPENING_CASH" ? entry.amount : 0),
      openingKaspi: old.today.openingKaspi + (entry.kind === "OPENING_KASPI" ? entry.amount : 0),
      advancesCash: old.today.advancesCash + (entry.kind === "ADVANCE_CASH" ? entry.amount : 0),
      advancesKaspi: old.today.advancesKaspi + (entry.kind === "ADVANCE_KASPI" ? entry.amount : 0),
      expensesCash: old.today.expensesCash + (entry.kind === "EXPENSE" ? -entry.cashPart : 0),
    },
    openingToday: {
      cash: old.openingToday.cash || entry.kind === "OPENING_CASH",
      kaspi: old.openingToday.kaspi || entry.kind === "OPENING_KASPI",
    },
    entries: [
      {
        ...entry,
        id: -Date.now(),
        note: `${note} (офлайн)`,
        userName: "офлайн",
        createdAt: iso,
      },
      ...old.entries,
    ],
  };
}

const KIND_STYLE: Record<CashEntryKind, { sign: string; cls: string }> = {
  OPENING_CASH: { sign: "+", cls: "text-sky-600 dark:text-sky-400" },
  OPENING_KASPI: { sign: "+", cls: "text-sky-600 dark:text-sky-400" },
  SALE: { sign: "+", cls: "text-emerald-600 dark:text-emerald-400" },
  ADVANCE_CASH: { sign: "−", cls: "text-red-600 dark:text-red-400" },
  ADVANCE_KASPI: { sign: "−", cls: "text-amber-600 dark:text-amber-400" },
  EXPENSE: { sign: "−", cls: "text-red-600 dark:text-red-400" },
};

// Живая касса: балансы обновляются сразу после принятия оплаты (SALE пишется
// при старте сеанса), опрос каждые 5 секунд + инвалидация извне.
// Главный аккаунт может удалять ошибочные операции — касса пересчитывается.
export function CashPanel({
  user,
  onToast,
}: {
  user: CurrentUser;
  onToast: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<"opening" | "advance" | "expense" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const isAdmin = user.role === "ADMIN";

  const cashQuery = useQuery<CashData>({
    queryKey: ["cash"],
    queryFn: async () => {
      const res = await fetch("/api/cash");
      if (res.status === 401) throw new Error("unauthorized");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      return data as CashData;
    },
    refetchInterval: 10000, // 10 с: запас по лимитам бесплатного хостинга
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["cash"] });
  }

  // Удаление ошибочной операции (только главный). Баланс = сумма всех
  // проводок, поэтому после удаления касса сразу уменьшается.
  async function deleteEntry(id: number, kind: CashEntryKind) {
    if (kind === "SALE") {
      onToast("Оплату сеанса удаляют вместе с сеансом — в разделе «История»");
      return;
    }
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/cash?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error ?? "Не удалось удалить");
        return;
      }
      if (data.queued) {
        // Офлайн: убираем проводку из кэша — баланс = сумма всех проводок
        queryClient.setQueryData<CashData>(["cash"], (old) => {
          if (!old) return old;
          const e = old.entries.find((x) => x.id === id);
          if (!e) return old;
          return {
            ...old,
            cashBalance: old.cashBalance - e.cashPart,
            kaspiBalance: old.kaspiBalance - e.kaspiPart,
            entries: old.entries.filter((x) => x.id !== id),
          };
        });
        onToast("Нет интернета: удаление сохранено и отправится автоматически");
        return;
      }
      onToast("Операция удалена — касса пересчитана");
      refresh();
    } catch {
      onToast("Ошибка соединения");
    } finally {
      setDeletingId(null);
    }
  }

  const data = cashQuery.data;
  const cash = data?.cashBalance ?? 0;
  const kaspi = data?.kaspiBalance ?? 0;
  const openingDone = data?.openingToday;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Балансы */}
      <div className="flex items-stretch gap-3 flex-wrap">
        <BalanceTile
          icon={<Banknote className="h-5 w-5" />}
          title="Касса наличных"
          value={formatTenge(cash)}
          sub={
            data
              ? `сегодня: +${formatTenge(data.today.salesCash + data.today.openingCash)} / −${formatTenge(data.today.advancesCash + data.today.expensesCash)}`
              : "…"
          }
          loading={cashQuery.isLoading}
        />
        <BalanceTile
          icon={<Smartphone className="h-5 w-5" />}
          title="Касса Каспи"
          value={formatTenge(kaspi)}
          sub={
            data
              ? `сегодня: +${formatTenge(data.today.salesKaspi + data.today.openingKaspi)}`
              : "…"
          }
          loading={cashQuery.isLoading}
        />

        <div className="flex flex-col justify-center gap-2 min-w-44">
          <Button className="gap-2" onClick={() => setOpenDialog("opening")}>
            <Vault className="h-4 w-4" />
            Открыть кассу
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-1.5 px-2" onClick={() => setOpenDialog("advance")}>
              <Coins className="h-4 w-4" />
              Аванс
            </Button>
            <Button variant="outline" className="gap-1.5 px-2" onClick={() => setOpenDialog("expense")}>
              <Receipt className="h-4 w-4" />
              Расход
            </Button>
          </div>
        </div>
      </div>

      {/* Статус открытия */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {openingDone?.cash ? (
          <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
            ✓ касса открыта: {formatTenge(data!.today.openingCash)}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
            касса не открыта — пересчитайте и запишите утреннюю сумму
          </Badge>
        )}
      </div>

      {/* История движений за сегодня */}
      <div>
        <button
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Движения за сегодня ({data?.entries.length ?? 0})
        </button>
        {historyOpen && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border divide-y">
            {cashQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Сегодня движений ещё не было
              </div>
            ) : (
              data.entries.map((e) => {
                const style = KIND_STYLE[e.kind] ?? { sign: "", cls: "" };
                return (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="text-[11px] text-muted-foreground tabular-nums w-10 shrink-0">
                      {new Date(e.createdAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={e.note ?? undefined}>
                      {CASH_KIND_LABELS[e.kind] ?? e.kind}
                      {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground hidden sm:block shrink-0">
                      {e.userName}
                    </span>
                    <span className={`font-bold tabular-nums shrink-0 ${style.cls}`}>
                      {style.sign}
                      {formatTenge(e.amount)}
                    </span>
                    {isAdmin && (
                      <button
                        className="shrink-0 rounded-md p-1 text-muted-foreground/60 hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        title={
                          e.kind === "SALE"
                            ? "Оплату сеанса удаляют вместе с сеансом — в «Истории»"
                            : "Удалить ошибочную операцию (касса пересчитается)"
                        }
                        disabled={deletingId === e.id}
                        onClick={() => deleteEntry(e.id, e.kind)}
                      >
                        {deletingId === e.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        {isAdmin && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Главный аккаунт может удалять ошибочные операции — касса сразу пересчитывается.
            Оплаты сеансов удаляются вместе с сеансом в разделе «История».
          </p>
        )}
      </div>

      <OpeningDialog
        open={openDialog === "opening"}
        onOpenChange={(v) => setOpenDialog(v ? "opening" : null)}
        onSaved={() => {
          setOpenDialog(null);
          refresh();
          onToast("Касса открыта — сумма записана");
        }}
        onError={onToast}
        openingDone={Boolean(openingDone?.cash)}
      />
      <AdvanceDialog
        open={openDialog === "advance"}
        onOpenChange={(v) => setOpenDialog(v ? "advance" : null)}
        cashBalance={cash}
        onSaved={(msg) => {
          setOpenDialog(null);
          refresh();
          onToast(msg);
        }}
        onError={onToast}
      />
      <ExpenseDialog
        open={openDialog === "expense"}
        onOpenChange={(v) => setOpenDialog(v ? "expense" : null)}
        cashBalance={cash}
        onSaved={(msg) => {
          setOpenDialog(null);
          refresh();
          onToast(msg);
        }}
        onError={onToast}
      />
    </div>
  );
}

function BalanceTile({
  icon,
  title,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl bg-header text-header-fg px-4 py-3 flex-1 min-w-52">
      <div className="flex items-center gap-2 text-xs opacity-75">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-black tabular-nums mt-1">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}
      </div>
      <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>
    </div>
  );
}

function OpeningDialog({
  open,
  onOpenChange,
  onSaved,
  onError,
  openingDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  onError: (m: string) => void;
  openingDone: boolean;
}) {
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  async function submit() {
    if (cash === "") {
      onError("Введите пересчитанную сумму наличных");
      return;
    }
    setSaving(true);
    try {
      const num = Number(cash);
      const res = await apiFetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "opening",
          cash: cash === "" ? null : Number(cash),
          kaspi: null,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Ошибка");
        return;
      }
      if (data.queued) {
        queryClient.setQueryData<CashData>(["cash"], (old) =>
          old
            ? applyOfflineCashEntry(
                old,
                { kind: "OPENING_CASH", amount: num, cashPart: num, kaspiPart: 0 },
                note || "Открытие смены"
              )
            : old
        );
        setCash("");
        setNote("");
        onSaved();
        return;
      }
      setCash("");
      setNote("");
      onSaved();
    } catch {
      onError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vault className="h-5 w-5" /> Открыть кассу
          </DialogTitle>
          <DialogDescription>
            Пересчитайте кассу утром и запишите сумму — она станет начальной. Каждая оплата
            будет прибавляться к ней сразу после запуска таймера.
          </DialogDescription>
        </DialogHeader>
        {openingDone && (
          <p className="text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-2">
            Касса уже открыта сегодня. Новая запись прибавится к балансу — используйте для
            корректировки после пересчёта.
          </p>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="opening-cash" className="flex items-center gap-1">
              <Banknote className="h-3.5 w-3.5" /> Наличные на пересчёте, ₸
            </Label>
            <Input
              id="opening-cash"
              type="number"
              min={0}
              inputMode="numeric"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="например 27000"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opening-note" className="text-xs text-muted-foreground">
              Примечание (необязательно)
            </Label>
            <Input
              id="opening-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="утренний пересчёт"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Записать сумму
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceDialog({
  open,
  onOpenChange,
  cashBalance,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cashBalance: number;
  onSaved: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [method, setMethod] = useState<"CASH" | "KASPI">("CASH");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const amountNum = Number(amount);
  const tooMuch = method === "CASH" && amount !== "" && amountNum > cashBalance;

  async function submit() {
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) {
      onError("Введите сумму аванса");
      return;
    }
    if (tooMuch) {
      onError(`В кассе недостаточно наличных: остаток ${formatTenge(cashBalance)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", method, amount: num, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Ошибка");
        return;
      }
      if (data.queued) {
        queryClient.setQueryData<CashData>(["cash"], (old) =>
          old
            ? applyOfflineCashEntry(
                old,
                method === "CASH"
                  ? { kind: "ADVANCE_CASH", amount: num, cashPart: -num, kaspiPart: 0 }
                  : { kind: "ADVANCE_KASPI", amount: num, cashPart: 0, kaspiPart: 0 },
                note || `Аванс (${method === "CASH" ? "наличными" : "перевод Каспи"})`
              )
            : old
        );
        setAmount("");
        setNote("");
        onSaved(
          method === "CASH"
            ? `Нет интернета: аванс ${formatTenge(num)} сохранён и отправится автоматически`
            : `Нет интернета: аванс ${formatTenge(num)} переводом Каспи сохранён и отправится автоматически`
        );
        return;
      }
      setAmount("");
      setNote("");
      onSaved(
        method === "CASH"
          ? `Аванс ${formatTenge(num)} выдан из кассы — остаток ${formatTenge(data.cashBalance)}`
          : `Аванс ${formatTenge(num)} отмечен как перевод Каспи — кассы не тронуты`
      );
    } catch {
      onError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" /> Взять аванс
          </DialogTitle>
          <DialogDescription>
            Аванс наличными уменьшает кассу наличных сразу. Перевод Каспи кассы не трогает —
            в отчёте будет отметка «аванс переводом от главного аккаунта».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Способ</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "CASH" | "KASPI")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Наличными из кассы
                  </span>
                </SelectItem>
                <SelectItem value="KASPI">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Переводом Каспи (от главного)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {method === "CASH" && (
              <p className="text-xs text-muted-foreground">
                Остаток в кассе: <span className="font-bold text-foreground">{formatTenge(cashBalance)}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="advance-amount">Сумма, ₸</Label>
            <Input
              id="advance-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="например 10000"
              aria-invalid={tooMuch || undefined}
              className={tooMuch ? "border-red-500" : ""}
            />
            {tooMuch && (
              <p className="text-xs text-red-600">
                Больше остатка наличных ({formatTenge(cashBalance)})
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="advance-note" className="text-xs text-muted-foreground">
              Примечание (необязательно)
            </Label>
            <Input
              id="advance-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="аванс за первую половину месяца"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving || tooMuch}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {method === "CASH" ? "Выдать из кассы" : "Отметить перевод Каспи"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Расход клуба: шнуры, ремонт и т.п. Оплата из кассы списывает деньги сразу,
// из своего кармана — кассу не трогает (но фиксируется в отчёте).
function ExpenseDialog({
  open,
  onOpenChange,
  cashBalance,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cashBalance: number;
  onSaved: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"CASH" | "POCKET">("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const amountNum = Number(amount);
  const tooMuch = source === "CASH" && amount !== "" && amountNum > cashBalance;

  async function submit() {
    const num = Number(amount);
    if (!name.trim()) {
      onError("Укажите название расхода, например «Шнуры для зарядки»");
      return;
    }
    if (!amount || isNaN(num) || num <= 0) {
      onError("Введите сумму расхода");
      return;
    }
    if (tooMuch) {
      onError(`В кассе недостаточно наличных: остаток ${formatTenge(cashBalance)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense", name: name.trim(), amount: num, source, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Ошибка");
        return;
      }
      if (data.queued) {
        if (source === "CASH") {
          queryClient.setQueryData<CashData>(["cash"], (old) =>
            old
              ? applyOfflineCashEntry(
                  old,
                  { kind: "EXPENSE", amount: num, cashPart: -num, kaspiPart: 0 },
                  name.trim()
                )
              : old
          );
        }
        setName("");
        setAmount("");
        setNote("");
        onSaved(
          `Нет интернета: расход ${formatTenge(num)} сохранён и отправится автоматически`
        );
        return;
      }
      setName("");
      setAmount("");
      setNote("");
      onSaved(
        source === "CASH"
          ? `Расход ${formatTenge(num)} записан — касса наличных: ${formatTenge(data.cashBalance)}`
          : `Расход ${formatTenge(num)} записан (из своего кармана) — касса не менялась`
      );
    } catch {
      onError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Добавить расход
          </DialogTitle>
          <DialogDescription>
            Например: «Шнуры для зарядки джойстиков», 6000 ₸. Если оплачено из кассы —
            в кассе наличных сразу станет меньше на эту сумму.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="expense-name">Что купили</Label>
            <Input
              id="expense-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Шнуры для зарядки"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Сумма, ₸</Label>
            <Input
              id="expense-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="6000"
              aria-invalid={tooMuch || undefined}
              className={tooMuch ? "border-red-500" : ""}
            />
            {tooMuch && (
              <p className="text-xs text-red-600">
                Больше остатка наличных ({formatTenge(cashBalance)})
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Откуда оплатили</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "CASH" | "POCKET")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Из кассы наличных
                  </span>
                </SelectItem>
                <SelectItem value="POCKET">
                  <span className="flex items-center gap-2">
                    <Coins className="h-4 w-4" /> Из своего кармана
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {source === "CASH" && (
              <p className="text-xs text-muted-foreground">
                Остаток в кассе:{" "}
                <span className="font-bold text-foreground">{formatTenge(cashBalance)}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-note" className="text-xs text-muted-foreground">
              Примечание (необязательно)
            </Label>
            <Input
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="5 шнуров USB-C"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving || tooMuch}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {source === "CASH" ? "Записать и списать из кассы" : "Записать расход"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
