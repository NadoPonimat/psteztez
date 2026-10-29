"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, ChevronLeft, ChevronRight, Coins, Loader2, Percent, Pencil, Wallet } from "lucide-react";
import type { CurrentUser, EarningsData, EmployeeEarnings } from "@/lib/crm-types";
import { currentMonth, formatTenge, monthNameRU, shiftMonth } from "@/lib/crm-types";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function SalaryView({
  currentUser,
  onToast,
}: {
  currentUser: CurrentUser;
  onToast: (m: string) => void;
}) {
  const [month, setMonth] = useState(currentMonth());
  const isAdmin = currentUser.role === "ADMIN";

  const earningsQuery = useQuery<EarningsData>({
    queryKey: ["earnings", month],
    queryFn: async () => {
      const res = await fetch(`/api/earnings?month=${month}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* Переключение месяца */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-bold min-w-44 text-center">{monthNameRU(month)}</span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground max-w-md">
          {isAdmin
            ? "Отмечайте рабочие дни в календаре, задавайте ставку за день и процент от кассы. Итоги считаются автоматически."
            : "Ваш график и заработок за месяц. Условия оплаты задаёт главный аккаунт."}
        </p>
      </div>

      {earningsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !earningsQuery.data?.employees.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Нет данных
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {earningsQuery.data.employees.map((emp) => (
            <EmployeeSalaryCard
              key={emp.userId}
              emp={emp}
              month={month}
              isAdmin={isAdmin}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeSalaryCard({
  emp,
  month,
  isAdmin,
  onToast,
}: {
  emp: EmployeeEarnings;
  month: string;
  isAdmin: boolean;
  onToast: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dailyRate: emp.dailyRate,
    bonusPercent: emp.bonusPercent,
    bonusThreshold: emp.bonusThreshold,
  });

  const revenueByDay = useMemo(() => {
    const map = new Map<string, number>();
    emp.dayRevenues.forEach((d) => map.set(d.day, d.revenue));
    return map;
  }, [emp.dayRevenues]);

  const workDaySet = useMemo(() => new Set(emp.workDays), [emp.workDays]);

  async function toggleDay(day: string) {
    if (!isAdmin) return;
    try {
      await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: emp.userId, day }),
      });
      void queryClient.invalidateQueries({ queryKey: ["earnings", month] });
    } catch {
      onToast("Не удалось обновить график");
    }
  }

  async function saveConditions() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${emp.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error ?? "Ошибка сохранения");
        return;
      }
      onToast(`Условия оплаты для ${emp.name} сохранены`);
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["earnings", month] });
    } catch {
      onToast("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  const bonusDays = emp.dayRevenues.filter(
    (d) => emp.bonusThreshold > 0 && d.revenue >= emp.bonusThreshold
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Шапка карточки */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
              {emp.name}
              {emp.role === "ADMIN" ? (
                <Badge variant="outline" className="text-xs">Главный</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Сотрудник</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono">@{emp.username}</div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setForm({
                  dailyRate: emp.dailyRate,
                  bonusPercent: emp.bonusPercent,
                  bonusThreshold: emp.bonusThreshold,
                });
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Условия
            </Button>
          )}
        </div>

        {/* Условия оплаты */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/40 px-2 py-2">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Wallet className="h-3 w-3" /> Ставка/день
            </div>
            <div className="text-sm font-bold tabular-nums">{formatTenge(emp.dailyRate)}</div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-2">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Percent className="h-3 w-3" /> Процент
            </div>
            <div className="text-sm font-bold tabular-nums">{emp.bonusPercent}%</div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-2">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Coins className="h-3 w-3" /> Порог кассы
            </div>
            <div className="text-sm font-bold tabular-nums">{formatTenge(emp.bonusThreshold)}</div>
          </div>
        </div>

        {/* Календарь графика */}
        <MonthCalendar
          month={month}
          workDaySet={workDaySet}
          revenueByDay={revenueByDay}
          bonusThreshold={emp.bonusThreshold}
          isAdmin={isAdmin}
          onToggle={toggleDay}
        />

        {/* Итоги за месяц */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <SummaryCell label="Рабочих дней" value={String(emp.workDays.length)} />
          <SummaryCell label="Заработок ставки" value={formatTenge(emp.rateEarned)} />
          <SummaryCell
            label={`Заработок ${emp.bonusPercent}%`}
            value={formatTenge(emp.bonusEarned)}
            hint={bonusDays.length > 0 ? `в ${bonusDays.length} дн. с кассой ≥ порога` : "порог не достигнут"}
          />
          <SummaryCell label="ИТОГО за месяц" value={formatTenge(emp.totalEarned)} accent />
        </div>
      </CardContent>

      {/* Диалог условий оплаты */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Условия оплаты — {emp.name}</DialogTitle>
            <DialogDescription>
              Ставка платится за каждый отмеченный в графике день. Процент начисляется от
              кассы дня, когда выручка достигла порога.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cond-rate">Ставка за день (₸)</Label>
              <Input
                id="cond-rate"
                type="number"
                min={0}
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cond-percent">Процент от кассы (%)</Label>
                <Input
                  id="cond-percent"
                  type="number"
                  min={0}
                  max={100}
                  value={form.bonusPercent}
                  onChange={(e) => setForm({ ...form, bonusPercent: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cond-threshold">Порог кассы за день (₸)</Label>
                <Input
                  id="cond-threshold"
                  type="number"
                  min={0}
                  value={form.bonusThreshold}
                  onChange={(e) => setForm({ ...form, bonusThreshold: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              Пример: порог 60 000 ₸, процент 5% — если касса за день 80 000 ₸, сотрудник
              получит +{Math.round((80000 * (form.bonusPercent || 0)) / 100).toLocaleString("ru-RU")} ₸
              бонуса за этот день.
            </p>
            <Button className="w-full" onClick={saveConditions} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить условия
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SummaryCell({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-2 ${
        accent ? "bg-header text-header-fg border-transparent" : "bg-card"
      }`}
    >
      <div className={`text-[11px] ${accent ? "opacity-75" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
      {hint && (
        <div className={`text-[10px] ${accent ? "opacity-60" : "text-muted-foreground"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

function MonthCalendar({
  month,
  workDaySet,
  revenueByDay,
  bonusThreshold,
  isAdmin,
  onToggle,
}: {
  month: string;
  workDaySet: Set<string>;
  revenueByDay: Map<string, number>;
  bonusThreshold: number;
  isAdmin: boolean;
  onToggle: (day: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        График работы {isAdmin ? "(кликните по дню, чтобы отметить/снять)" : ""}
      </div>
      <div className="grid grid-cols-7 gap-1 select-none">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold text-muted-foreground py-0.5">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dayNum = Number(day.slice(8));
          const weekend = i % 7 >= 5;
          const worked = workDaySet.has(day);
          const revenue = revenueByDay.get(day);
          const hitsBonus = revenue !== undefined && bonusThreshold > 0 && revenue >= bonusThreshold;
          return (
            <button
              key={day}
              disabled={!isAdmin}
              onClick={() => onToggle(day)}
              className={`rounded-md border text-center py-1 px-0.5 min-h-11 transition-all ${
                isAdmin ? "hover:border-ring cursor-pointer" : "cursor-default"
              } ${
                worked
                  ? hitsBonus
                    ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40"
                    : "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                  : weekend
                    ? "bg-muted/40"
                    : "bg-card"
              } ${day === todayStr ? "ring-2 ring-ring/60" : ""}`}
              title={
                worked
                  ? `Рабочий день${revenue !== undefined ? ` · касса: ${formatTenge(revenue)}` : ""}`
                  : "Не рабочий день"
              }
            >
              <div className={`text-xs font-bold ${day === todayStr ? "underline" : ""}`}>
                {dayNum}
              </div>
              {worked && (
                <div className="text-[9px] leading-tight text-emerald-700 font-semibold">
                  {revenue !== undefined && revenue > 0
                    ? `${(revenue / 1000).toFixed(0)}к₸`
                    : "·"}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-400 inline-block" />
          рабочий день
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border-2 border-emerald-500 inline-block" />
          касса ≥ порога (+%)
        </span>
        <span>зелёные числа — касса дня в тысячах ₸</span>
      </div>
    </div>
  );
}
