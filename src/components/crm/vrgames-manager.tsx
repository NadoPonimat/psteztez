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
import { Textarea } from "@/components/ui/textarea";
import { Gamepad2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { VrGameItem } from "@/lib/crm-types";
import { formatTenge, minutesHuman } from "@/lib/crm-types";

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

type GameForm = {
  id?: number;
  number: number;
  name: string;
  description: string;
  durationMinutes: number;
  minAge: number;
  price: number;
  active: boolean;
};

const emptyGameForm: GameForm = {
  number: 0,
  name: "",
  description: "",
  durationMinutes: 20,
  minAge: 6,
  price: 2000,
  active: true,
};

// Каталог VR-игр: длительность, возрастное ограничение, цена.
// В диалоге сеанса кроме игр всегда есть «свободный запуск» (пакеты времени).
export function VrGamesManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ games: VrGameItem[] }>({
    queryKey: ["admin-vrgames"],
    queryFn: () => api("/api/admin/vrgames"),
  });
  const [form, setForm] = useState<GameForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      onToast("Укажите название игры");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        number: form.number,
        name: form.name.trim(),
        description: form.description.trim(),
        durationMinutes: form.durationMinutes,
        minAge: form.minAge,
        price: form.price,
        active: form.active,
      };
      if (form.id) {
        await api(`/api/admin/vrgames/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onToast("Игра обновлена");
      } else {
        await api("/api/admin/vrgames", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onToast("Игра добавлена в каталог VR");
      }
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-vrgames"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(g: VrGameItem) {
    try {
      await api(`/api/admin/vrgames/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !g.active }),
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-vrgames"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(g: VrGameItem) {
    try {
      const res = await api<{ message?: string }>(`/api/admin/vrgames/${g.id}`, {
        method: "DELETE",
      });
      onToast(res.message ?? "Игра удалена");
      void queryClient.invalidateQueries({ queryKey: ["admin-vrgames"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const games = data?.games ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Список VR-игр: номер на стенде, описание, длительность, возраст (0 = без ограничения)
          и цена. Номер и описание видят сотрудники в диалоге сеанса — например «№26,
          американские горки, ночью, хоррор».
        </p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setForm({ ...emptyGameForm })}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Игра</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Возраст</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Игр пока нет. Например: №26 «Американские горки» — ночью, хоррор, 20 мин, 6+, 2 000 ₸.
                  </TableCell>
                </TableRow>
              ) : (
                games.map((g) => (
                  <TableRow key={g.id} className={g.active ? undefined : "opacity-55"}>
                    <TableCell className="tabular-nums">
                      {g.number > 0 ? <Badge variant="outline">№{g.number}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48">
                      <span className="line-clamp-2">{g.description || "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {minutesHuman(g.durationMinutes)}{" "}
                      <span className="text-muted-foreground">({g.durationMinutes} мин)</span>
                    </TableCell>
                    <TableCell>
                      {g.minAge > 0 ? (
                        <Badge variant="outline">{g.minAge}+</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">любой</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold tabular-nums">
                      {formatTenge(g.price)}
                    </TableCell>
                    <TableCell>
                      <Switch checked={g.active} onCheckedChange={() => toggleActive(g)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Изменить"
                          onClick={() =>
                            setForm({
                              id: g.id,
                              number: g.number,
                              name: g.name,
                              description: g.description,
                              durationMinutes: g.durationMinutes,
                              minAge: g.minAge,
                              price: g.price,
                              active: g.active,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                          title="Удалить"
                          onClick={() => remove(g)}
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

      {/* Форма игры */}
      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить игру" : "Новая VR-игра"}</DialogTitle>
            <DialogDescription>
              Номер, описание, цена и длительность игры видны сотрудникам на кассе.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vrgame-number">Номер</Label>
                  <Input
                    id="vrgame-number"
                    type="number"
                    min={0}
                    max={9999}
                    inputMode="numeric"
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: Number(e.target.value) || 0 })}
                    placeholder="26"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vrgame-name">Название игры</Label>
                  <Input
                    id="vrgame-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Американские горки"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vrgame-desc">Описание (видят сотрудники на кассе)</Label>
                <Textarea
                  id="vrgame-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="американские горки, ночью, хоррор"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vrgame-duration">Длительность, мин</Label>
                  <Input
                    id="vrgame-duration"
                    type="number"
                    min={1}
                    max={1440}
                    inputMode="numeric"
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm({ ...form, durationMinutes: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vrgame-age">Возраст, лет (0 — любой)</Label>
                  <Input
                    id="vrgame-age"
                    type="number"
                    min={0}
                    max={21}
                    inputMode="numeric"
                    value={form.minAge}
                    onChange={(e) => setForm({ ...form, minAge: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vrgame-price">Цена, ₸</Label>
                <Input
                  id="vrgame-price"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Игра активна</p>
                  <p className="text-xs text-muted-foreground">Неактивные не видны на кассе</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Сохранить изменения" : "Добавить игру"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
