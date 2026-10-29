"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileImage,
  Gamepad2,
  Loader2,
  Lock,
  Moon,
  Save,
  Sun,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type { CurrentUser, DayDraft, EarningsData, ScheduleData, ScheduleEmployee, ScheduleShift, ShiftDraft } from "@/lib/crm-types";
import {
  addDays,
  dateRU,
  formatTenge,
  minutesHuman,
  shiftMinutes,
  todayStr,
  weekDays,
  weekdayShort,
  weekStart,
} from "@/lib/crm-types";

const DEFAULT_FULL: ShiftDraft = { userId: "", startsAt: "10:00", endsAt: "22:00" };
const DEFAULT_S1: ShiftDraft = { userId: "", startsAt: "10:00", endsAt: "18:00" };
const DEFAULT_S2: ShiftDraft = { userId: "", startsAt: "18:00", endsAt: "02:00" };

function emptyDay(): DayDraft {
  return {
    mode: "off",
    full: { ...DEFAULT_FULL },
    s1: { ...DEFAULT_S1 },
    s2: { ...DEFAULT_S2 },
  };
}

/** Собрать черновики из данных сервера */
function draftsFromData(data: ScheduleData): Record<string, DayDraft> {
  const map: Record<string, DayDraft> = {};
  for (const d of weekDays(data.from)) map[d] = emptyDay();
  for (const s of data.shifts) {
    const draft = map[s.day];
    if (!draft) continue;
    const payload = { userId: s.userId ?? "", startsAt: s.startsAt, endsAt: s.endsAt };
    if (s.isFullDay) {
      draft.mode = "full";
      draft.full = payload;
    } else if (s.slot === 1) {
      draft.mode = "split";
      draft.s1 = payload;
    } else if (s.slot === 2) {
      draft.mode = "split";
      draft.s2 = payload;
    }
  }
  return map;
}

/** Черновики → payload для PUT */
function payloadFromDrafts(
  drafts: Record<string, DayDraft>,
  days: string[]
): { day: string; slot: number; isFullDay: boolean; userId: string; startsAt: string; endsAt: string }[] {
  const out: {
    day: string;
    slot: number;
    isFullDay: boolean;
    userId: string;
    startsAt: string;
    endsAt: string;
  }[] = [];
  for (const day of days) {
    const d = drafts[day];
    if (!d) continue;
    if (d.mode === "full" && d.full.userId) {
      out.push({ day, slot: 1, isFullDay: true, ...d.full });
    } else if (d.mode === "split") {
      if (d.s1.userId) out.push({ day, slot: 1, isFullDay: false, ...d.s1 });
      if (d.s2.userId) out.push({ day, slot: 2, isFullDay: false, ...d.s2 });
    }
  }
  return out;
}

export function ScheduleView({
  currentUser,
  clubName,
  onToast,
}: {
  currentUser: CurrentUser;
  clubName: string;
  onToast: (m: string) => void;
}) {
  const isAdmin = currentUser.role === "ADMIN";
  const queryClient = useQueryClient();
  const today = todayStr();
  const [weekFrom, setWeekFrom] = useState(() => weekStart(today));
  const [syncWorkDays, setSyncWorkDays] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, DayDraft>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dirtyRef = useRef(false);

  const days = useMemo(() => weekDays(weekFrom), [weekFrom]);
  const weekTo = addDays(weekFrom, 6);

  const query = useQuery<ScheduleData>({
    queryKey: ["schedule", weekFrom],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?from=${weekFrom}&to=${weekTo}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      return data as ScheduleData;
    },
  });

  // Загруженные данные → черновики (если нет несохранённых правок)
  useEffect(() => {
    if (query.data && !dirtyRef.current) {
      setDrafts(draftsFromData(query.data));
    }
  }, [query.data]);

  function markDirty() {
    dirtyRef.current = true;
    setDirty(true);
  }

  function goWeek(delta: number) {
    if (
      dirtyRef.current &&
      !window.confirm("Есть несохранённые изменения. Перейти на другую неделю без сохранения?")
    ) {
      return;
    }
    dirtyRef.current = false;
    setDirty(false);
    setWeekFrom((w) => addDays(w, delta * 7));
  }

  function goCurrentWeek() {
    const target = weekStart(today);
    if (target === weekFrom) return;
    if (
      dirtyRef.current &&
      !window.confirm("Есть несохранённые изменения. Перейти без сохранения?")
    ) {
      return;
    }
    dirtyRef.current = false;
    setDirty(false);
    setWeekFrom(target);
  }

  function updateDay(day: string, patch: Partial<DayDraft>) {
    setDrafts((prev) => ({ ...prev, [day]: { ...(prev[day] ?? emptyDay()), ...patch } }));
    markDirty();
  }

  function updateSlot(
    day: string,
    slot: "full" | "s1" | "s2",
    patch: Partial<ShiftDraft>
  ) {
    setDrafts((prev) => {
      const cur = prev[day] ?? emptyDay();
      return { ...prev, [day]: { ...cur, [slot]: { ...cur[slot], ...patch } } };
    });
    markDirty();
  }

  function setMode(day: string, mode: DayDraft["mode"]) {
    updateDay(day, { mode });
  }

  const shifts = useMemo(() => payloadFromDrafts(drafts, days), [drafts, days]);
  const hasZeroShift = shifts.some((s) => s.startsAt === s.endsAt);

  async function save() {
    if (hasZeroShift) {
      onToast("Время начала и конца смены не могут совпадать");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: weekFrom, to: weekTo, syncWorkDays, shifts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      onToast(data.message ?? "График сохранён");
      dirtyRef.current = false;
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["schedule", weekFrom] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevWeek() {
    try {
      const prevFrom = addDays(weekFrom, -7);
      const res = await fetch(`/api/schedule?from=${prevFrom}&to=${addDays(weekFrom, -1)}`);
      if (!res.ok) throw new Error();
      const data: ScheduleData = await res.json();
      const src = draftsFromData(data);
      const prevDays = weekDays(prevFrom);
      setDrafts((prev) => {
        const next = { ...prev };
        prevDays.forEach((d, i) => {
          next[days[i]] = src[d] ?? emptyDay();
        });
        return next;
      });
      markDirty();
      onToast("Смены прошлой недели скопированы. Проверьте и нажмите «Сохранить»");
    } catch {
      onToast("Не удалось скопировать прошлую неделю");
    }
  }

  function clearWeek() {
    if (!window.confirm("Очистить все смены на этой неделе?")) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const d of days) next[d] = emptyDay();
      return next;
    });
    markDirty();
  }

  async function exportPng() {
    const el = document.getElementById("schedule-document");
    if (!el) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `grafik_${weekFrom}_${weekTo}.png`;
      a.click();
      onToast("График скачан в PNG");
    } catch {
      onToast("Ошибка экспорта PNG");
    } finally {
      setExporting(false);
    }
  }

  const employees = query.data?.employees ?? [];
  const activeEmployees = employees.filter((e) => e.active);
  const draftsReady = Boolean(drafts[days[0]]);

  return (
    <div className="space-y-4">
      {/* Навигация по неделям */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => goWeek(-1)}
              aria-label="Предыдущая неделя"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-56 text-center">
              <div className="font-bold leading-tight">
                {dateRU(weekFrom)} — {dateRU(weekTo)}
              </div>
              <div className="text-xs text-muted-foreground">неделя · Пн — Вс</div>
            </div>
            <Button size="icon" variant="outline" onClick={() => goWeek(1)} aria-label="Следующая неделя">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={goCurrentWeek}
              disabled={weekFrom === weekStart(today)}
              className="hidden sm:inline-flex"
            >
              Текущая
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={exportPng}
              disabled={!draftsReady || exporting || query.isLoading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
              Скачать PNG
            </Button>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={copyPrevWeek}
                  disabled={query.isLoading}
                >
                  <Copy className="h-4 w-4" />
                  Копировать прошлую
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-600 hover:text-red-700"
                  onClick={clearWeek}
                  disabled={query.isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  Очистить
                </Button>
                <Button size="sm" className="gap-1.5" onClick={save} disabled={saving || hasZeroShift}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {dirty ? "Сохранить*" : "Сохранить"}
                </Button>
              </>
            )}
          </div>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Switch
              id="sync-workdays"
              checked={syncWorkDays}
              onCheckedChange={setSyncWorkDays}
            />
            <Label htmlFor="sync-workdays" className="cursor-pointer">
              Смены отмечаются как рабочие дни для зарплаты
            </Label>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Редактирование графика доступно только главному аккаунту
          </div>
        )}
      </div>

      {/* Мои смены и зарплата за неделю (видит каждый аккаунт) */}
      {query.data && query.data.shifts.some((s) => s.userId === currentUser.id) && (
        <MyShiftsCard
          days={days}
          shifts={query.data.shifts}
          userId={currentUser.id}
          month={weekFrom.slice(0, 7)}
        />
      )}

      {/* Редактор (только главный) */}
      {isAdmin && (
        <div className="space-y-3 max-w-3xl">
          {query.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            days.map((day) => {
              const d = drafts[day] ?? emptyDay();
              return (
                <div
                  key={day}
                  className={`rounded-xl border bg-card p-4 ${
                    day === today ? "ring-2 ring-ring/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        {weekdayShort(day)}, {dateRU(day)}
                      </span>
                      {day === today && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">сегодня</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <ModeButton
                        active={d.mode === "off"}
                        onClick={() => setMode(day, "off")}
                      >
                        Выходной
                      </ModeButton>
                      <ModeButton
                        active={d.mode === "full"}
                        onClick={() => setMode(day, "full")}
                      >
                        Весь день
                      </ModeButton>
                      <ModeButton
                        active={d.mode === "split"}
                        onClick={() => setMode(day, "split")}
                      >
                        2 смены
                      </ModeButton>
                    </div>
                  </div>

                  {d.mode === "full" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <EmployeeSelect
                        value={d.full.userId}
                        employees={activeEmployees}
                        onChange={(v) => updateSlot(day, "full", { userId: v })}
                        placeholder="Сотрудник на весь день"
                      />
                      <TimeInput
                        value={d.full.startsAt}
                        onChange={(v) => updateSlot(day, "full", { startsAt: v })}
                        ariaLabel="Начало"
                      />
                      <span className="text-muted-foreground">—</span>
                      <TimeInput
                        value={d.full.endsAt}
                        onChange={(v) => updateSlot(day, "full", { endsAt: v })}
                        ariaLabel="Конец"
                      />
                      <span className="text-xs text-muted-foreground ml-auto">
                        {d.full.userId && d.full.startsAt !== d.full.endsAt
                          ? minutesHuman(shiftMinutes(d.full.startsAt, d.full.endsAt))
                          : ""}
                      </span>
                    </div>
                  )}

                  {d.mode === "split" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground w-16 shrink-0">
                          <Sun className="h-3.5 w-3.5" /> 1 смена
                        </span>
                        <EmployeeSelect
                          value={d.s1.userId}
                          employees={activeEmployees}
                          onChange={(v) => updateSlot(day, "s1", { userId: v })}
                          placeholder="Сотрудник"
                        />
                        <TimeInput
                          value={d.s1.startsAt}
                          onChange={(v) => updateSlot(day, "s1", { startsAt: v })}
                          ariaLabel="Начало первой смены"
                        />
                        <span className="text-muted-foreground">—</span>
                        <TimeInput
                          value={d.s1.endsAt}
                          onChange={(v) => updateSlot(day, "s1", { endsAt: v })}
                          ariaLabel="Конец первой смены"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground w-16 shrink-0">
                          <Moon className="h-3.5 w-3.5" /> 2 смена
                        </span>
                        <EmployeeSelect
                          value={d.s2.userId}
                          employees={activeEmployees}
                          onChange={(v) => updateSlot(day, "s2", { userId: v })}
                          placeholder="Сотрудник"
                        />
                        <TimeInput
                          value={d.s2.startsAt}
                          onChange={(v) => updateSlot(day, "s2", { startsAt: v })}
                          ariaLabel="Начало второй смены"
                        />
                        <span className="text-muted-foreground">—</span>
                        <TimeInput
                          value={d.s2.endsAt}
                          onChange={(v) => updateSlot(day, "s2", { endsAt: v })}
                          ariaLabel="Конец второй смены"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <p className="text-xs text-muted-foreground">
            «2 смены» — день делится на две части, у каждой свой сотрудник и часы. Конец раньше
            начала (например 18:00 — 02:00) означает смену через полночь. Сохранённые смены
            отмечаются как рабочие дни — зарплата считается во вкладке «Зарплата».
          </p>
        </div>
      )}

      {/* Документ графика (превью и источник PNG) */}
      {query.isLoading || !draftsReady ? (
        !query.isLoading && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Нет данных
          </div>
        )
      ) : (
        <div className="overflow-x-auto pb-2">
          <ScheduleDocument
            clubName={clubName}
            composedBy={currentUser.name}
            weekFrom={weekFrom}
            weekTo={weekTo}
            days={days}
            drafts={drafts}
            employees={employees}
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className={`h-8 px-3 ${active ? "" : "text-muted-foreground"}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function EmployeeSelect({
  value,
  employees,
  onChange,
  placeholder,
}: {
  value: string;
  employees: { id: string; name: string; role: string }[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger className="w-44 h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— не работает —</SelectItem>
        {employees.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
            {e.role === "ADMIN" ? " (главный)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TimeInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="w-[104px] h-9"
    />
  );
}

// ---------- Документ графика (PNG) ----------

function ScheduleDocument({
  clubName,
  composedBy,
  weekFrom,
  weekTo,
  days,
  drafts,
  employees,
}: {
  clubName: string;
  composedBy: string;
  weekFrom: string;
  weekTo: string;
  days: string[];
  drafts: Record<string, DayDraft>;
  employees: ScheduleEmployee[];
}) {
  const today = todayStr();
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.name);
    return map;
  }, [employees]);

  // Итоги по сотрудникам за неделю
  const totals = useMemo(() => {
    const nameOf = (userId: string) => nameById.get(userId) ?? "Сотрудник";
    const map = new Map<string, { name: string; shifts: number; minutes: number }>();
    for (const day of days) {
      const d = drafts[day];
      if (!d) continue;
      const slots: ShiftDraft[] =
        d.mode === "full"
          ? d.full.userId
            ? [d.full]
            : []
          : d.mode === "split"
            ? [d.s1, d.s2].filter((s) => s.userId)
            : [];
      for (const s of slots) {
        const rec = map.get(s.userId) ?? { name: nameOf(s.userId), shifts: 0, minutes: 0 };
        rec.shifts += 1;
        rec.minutes += shiftMinutes(s.startsAt, s.endsAt);
        map.set(s.userId, rec);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [drafts, days, nameById]);

  const nameOf = (userId: string) => nameById.get(userId) ?? "Сотрудник";

  return (
    <div
      id="schedule-document"
      className="bg-white text-zinc-900 border border-zinc-200 shadow-sm mx-auto"
      style={{ width: 860, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="px-10 py-8">
        {/* Шапка */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Gamepad2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-black">{clubName}</div>
              <div className="text-xs text-zinc-500">График работы сотрудников</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black tracking-wide">ГРАФИК РАБОТЫ</div>
            <div className="text-sm font-semibold">
              {dateRU(weekFrom)} — {dateRU(weekTo)}
            </div>
          </div>
        </div>

        {/* Таблица смен */}
        <table className="w-full text-sm border-collapse mt-5">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border px-3 py-2 text-left w-28">День</th>
              <th className="border px-3 py-2 text-left">Смена 1</th>
              <th className="border px-3 py-2 text-left">Смена 2</th>
              <th className="border px-3 py-2 text-right w-24">Часы</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const d = drafts[day];
              const weekend = weekdayShort(day) === "Сб" || weekdayShort(day) === "Вс";
              const isFull = d?.mode === "full" && d.full.userId;
              const s1 = d?.mode === "split" && d.s1.userId ? d.s1 : null;
              const s2 = d?.mode === "split" && d.s2.userId ? d.s2 : null;
              const minutes =
                (isFull ? shiftMinutes(d.full.startsAt, d.full.endsAt) : 0) +
                (s1 ? shiftMinutes(s1.startsAt, s1.endsAt) : 0) +
                (s2 ? shiftMinutes(s2.startsAt, s2.endsAt) : 0);
              const cell = (s: ShiftDraft) =>
                `${nameOf(s.userId)} · ${s.startsAt}–${s.endsAt}`;
              return (
                <tr key={day} className={weekend ? "bg-zinc-50" : ""}>
                  <td className="border px-3 py-2 whitespace-nowrap font-semibold">
                    {weekdayShort(day)}, {dateRU(day).slice(0, 5)}
                    {day === today && (
                      <span className="ml-1 text-[10px] font-bold text-emerald-600">●</span>
                    )}
                  </td>
                  {isFull ? (
                    <td className="border px-3 py-2 font-semibold" colSpan={2}>
                      {cell(d.full)}{" "}
                      <span className="text-zinc-500">· весь день</span>
                    </td>
                  ) : (
                    <>
                      <td className="border px-3 py-2">{s1 ? cell(s1) : "—"}</td>
                      <td className="border px-3 py-2">{s2 ? cell(s2) : "—"}</td>
                    </>
                  )}
                  <td className="border px-3 py-2 text-right tabular-nums">
                    {minutes > 0 ? minutesHuman(minutes) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Итоги по сотрудникам */}
        <div className="mt-5">
          <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Итого за неделю
          </div>
          {totals.length === 0 ? (
            <div className="border rounded-lg px-3 py-4 text-center text-sm text-zinc-500">
              Смены на эту неделю не назначены
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {totals.map(([userId, t]) => (
                <div
                  key={userId}
                  className="border rounded-lg px-3 py-2 flex justify-between items-center text-sm"
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="tabular-nums text-zinc-600">
                    {t.shifts}{" "}
                    {t.shifts === 1 ? "смена" : t.shifts < 5 ? "смены" : "смен"} ·{" "}
                    {minutesHuman(t.minutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-zinc-400 mt-5">
          Составил: {composedBy} · {new Date().toLocaleDateString("ru-RU")}. Конец смены раньше
          начала — смена через полночь.
        </div>
      </div>
    </div>
  );
}

// ---------- Мои смены + зарплата за неделю ----------

function MyShiftsCard({
  days,
  shifts,
  userId,
  month,
}: {
  days: string[];
  shifts: ScheduleShift[];
  userId: string;
  month: string;
}) {
  const earningsQuery = useQuery<EarningsData>({
    queryKey: ["earnings", month],
    queryFn: async () => {
      const res = await fetch(`/api/earnings?month=${month}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  const me = earningsQuery.data?.employees.find((e) => e.userId === userId);

  const mine = useMemo(() => {
    const set = new Set(days);
    return shifts.filter((s) => s.userId === userId && set.has(s.day));
  }, [shifts, userId, days]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleShift[]>();
    for (const s of mine) {
      const arr = map.get(s.day) ?? [];
      arr.push(s);
      map.set(s.day, arr);
    }
    return map;
  }, [mine]);

  if (mine.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 font-bold">
        <Wallet className="h-4.5 w-4.5 text-emerald-500" />
        Мои смены на этой неделе
      </div>
      {me && (
        <p className="text-xs text-muted-foreground">
          Ваша ставка: {formatTenge(me.dailyRate)} за рабочий день
          {me.bonusPercent > 0
            ? ` + ${me.bonusPercent}% от кассы${
                me.bonusThreshold > 0 ? ` (касса ≥ ${formatTenge(me.bonusThreshold)})` : ""
              }`
            : ""}
          . Итоги месяца — во вкладке «Зарплата».
        </p>
      )}
      <div className="space-y-1.5">
        {days
          .filter((d) => byDay.has(d))
          .map((day) => {
            const list = byDay.get(day)!;
            const minutes = list.reduce((sum, s) => sum + shiftMinutes(s.startsAt, s.endsAt), 0);
            const revenue = me?.dayRevenues.find((r) => r.day === day)?.revenue;
            const bonusHit =
              me && revenue !== undefined && me.bonusThreshold > 0 && revenue >= me.bonusThreshold;
            const dayEarn =
              me && revenue !== undefined
                ? Math.round(me.dailyRate + (bonusHit ? (revenue * me.bonusPercent) / 100 : 0))
                : null;
            return (
              <div
                key={day}
                className="flex items-center gap-2 flex-wrap rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-semibold min-w-36">
                  {weekdayShort(day)}, {dateRU(day)}
                </span>
                <span className="text-muted-foreground">
                  {list
                    .map((s) => `${s.startsAt}–${s.endsAt}${s.isFullDay ? " (весь день)" : ""}`)
                    .join(" + ")}
                  {" · "}
                  {minutesHuman(minutes)}
                </span>
                {me && (
                  <span className="ml-auto font-bold tabular-nums text-emerald-600">
                    {formatTenge(me.dailyRate)}
                    {me.bonusPercent > 0 && (
                      <span className="text-foreground"> + {me.bonusPercent}% от кассы</span>
                    )}
                  </span>
                )}
                {dayEarn !== null && (revenue ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground basis-full sm:basis-auto">
                    этого дня: касса {formatTenge(revenue ?? 0)}
                    {bonusHit ? " → бонус" : ""}
                    {", итого "}
                    <span className="font-bold text-foreground">{formatTenge(dayEarn)}</span>
                  </span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
