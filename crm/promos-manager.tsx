"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import type { PromoItem } from "@/lib/crm-types";
import { formatTenge } from "@/lib/crm-types";

type ApiError = { error?: string };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ApiError).error ?? "Ошибка сервера");
  }
  return data as T;
}

const DAYS = [
  { value: 1, short: "Пн", full: "Понедельник" },
  { value: 2, short: "Вт", full: "Вторник" },
  { value: 3, short: "Ср", full: "Среда" },
  { value: 4, short: "Чт", full: "Четверг" },
  { value: 5, short: "Пт", full: "Пятница" },
  { value: 6, short: "Сб", full: "Суббота" },
  { value: 0, short: "Вс", full: "Воскресенье" },
];

type PromoForm = {
  id?: number;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  timeFrom: string;
  timeTo: string;
  days: number[];
  deviceType: string; // "ALL" | "PLAYSTATION" | "VR"
  active: boolean;
};

const emptyPromoForm: PromoForm = {
  name: "",
  discountType: "PERCENT",
  discountValue: 20,
  timeFrom: "10:00",
  timeTo: "16:00",
  days: [1, 2, 3, 4, 5],
  deviceType: "ALL",
  active: true,
};

function daysLabel(csv: string): string {
  const set = new Set(csv.split(",").map((s) => s.trim()).map(Number));
  if (set.size === 7) return "ежедневно";
  return DAYS.filter((d) => set.has(d.value))
    .map((d) => d.short)
    .join(", ");
}

// Управление акциями и скидками (только главный аккаунт): интервал времени,
// дни недели, устройства. Скидка применяется автоматически при старте сеанса.
export function PromosManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ promos: PromoItem[] }>({
    queryKey: ["admin-promos"],
    queryFn: () => api("/api/admin/promos"),
  });
  const [form, setForm] = useState<PromoForm | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    if (!form) return;
    const has = form.days.includes(day);
    setForm({
      ...form,
      days: has ? form.days.filter((d) => d !== day) : [...form.days, day],
    });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      onToast("Укажите название акции");
      return;
    }
    if (form.days.length === 0) {
      onToast("Выберите хотя бы один день недели");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        discountType: form.discountType,
        discountValue: form.discountValue,
        timeFrom: form.timeFrom,
        timeTo: form.timeTo,
        days: [...form.days].sort().join(","),
        deviceType: form.deviceType === "ALL" ? null : form.deviceType,
        active: form.active,
      };
      if (form.id) {
        await api(`/api/admin/promos/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onToast("Акция обновлена");
      } else {
        await api("/api/admin/promos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onToast("Акция создана — скидка будет применяться автоматически");
      }
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PromoItem) {
    try {
      await api(`/api/admin/promos/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !p.active }),
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(p: PromoItem) {
    try {
      await api(`/api/admin/promos/${p.id}`, { method: "DELETE" });
      onToast("Акция удалена");
      void queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const promos = data?.promos ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Скидки применяются автоматически, когда подходит день, время и тип устройства.
          Сотрудник на кассе видит цену уже со скидкой.
        </p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setForm({ ...emptyPromoForm })}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>Акция</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Время</TableHead>
                <TableHead>Дни</TableHead>
                <TableHead>Устройства</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : promos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Акций пока нет. Например: «Счастливые часы», −20%, 10:00–16:00, Пн–Пт.
                  </TableCell>
                </TableRow>
              ) : (
                promos.map((p) => (
                  <TableRow key={p.id} className={p.active ? undefined : "opacity-55"}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {p.discountType === "PERCENT"
                          ? `−${p.discountValue}%`
                          : `−${formatTenge(p.discountValue)}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {p.timeFrom}–{p.timeTo}
                      {p.timeTo <= p.timeFrom && (
                        <span className="block text-[10px] text-muted-foreground">через полночь</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{daysLabel(p.days)}</TableCell>
                    <TableCell className="text-sm">
                      {p.deviceType === "PLAYSTATION"
                        ? "PlayStation"
                        : p.deviceType === "VR"
                          ? "VR кресла"
                          : "Все"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Изменить"
                          onClick={() =>
                            setForm({
                              id: p.id,
                              name: p.name,
                              discountType: p.discountType,
                              discountValue: p.discountValue,
                              timeFrom: p.timeFrom,
                              timeTo: p.timeTo,
                              days: p.days.split(",").map((s) => Number(s.trim())),
                              deviceType: p.deviceType ?? "ALL",
                              active: p.active,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                          title="Удалить"
                          onClick={() => remove(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Форма акции */}
      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить акцию" : "Новая акция"}</DialogTitle>
            <DialogDescription>
              Скидка действует в выбранные дни с указанного времени и до указанного.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="promo-name">Название</Label>
                <Input
                  id="promo-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Счастливые часы"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Тип скидки</Label>
                  <Select
                    value={form.discountType}
                    onValueChange={(v) =>
                      setForm({ ...form, discountType: v as "PERCENT" | "FIXED" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Процент, %</SelectItem>
                      <SelectItem value="FIXED">Фикс. сумма, ₸</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-value">
                    {form.discountType === "PERCENT" ? "Скидка, %" : "Скидка, ₸"}
                  </Label>
                  <Input
                    id="promo-value"
                    type="number"
                    min={1}
                    max={form.discountType === "PERCENT" ? 100 : undefined}
                    inputMode="numeric"
                    value={form.discountValue}
                    onChange={(e) =>
                      setForm({ ...form, discountValue: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-from">Действует с</Label>
                  <Input
                    id="promo-from"
                    type="time"
                    value={form.timeFrom}
                    onChange={(e) => setForm({ ...form, timeFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-to">До</Label>
                  <Input
                    id="promo-to"
                    type="time"
                    value={form.timeTo}
                    onChange={(e) => setForm({ ...form, timeTo: e.target.value })}
                  />
                </div>
              </div>
              {form.timeTo <= form.timeFrom && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Время «до» меньше или равно «с» — акция действует через полночь.
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Дни недели</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = form.days.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        title={d.full}
                        onClick={() => toggleDay(d.value)}
                        className={`h-9 w-11 rounded-lg border-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          on
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-ring"
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Устройства</Label>
                <Select
                  value={form.deviceType}
                  onValueChange={(v) => setForm({ ...form, deviceType: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Все устройства</SelectItem>
                    <SelectItem value="PLAYSTATION">Только PlayStation</SelectItem>
                    <SelectItem value="VR">Только VR кресла</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Акция активна</p>
                  <p className="text-xs text-muted-foreground">Неактивные акции не применяются</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>

              <Button className="w-full" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Сохранить изменения" : "Создать акцию"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
