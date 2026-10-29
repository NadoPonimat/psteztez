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
import { Loader2, Pencil, Plus, Sparkles, Swords, Trash2 } from "lucide-react";
import type { TournamentGameItem } from "@/lib/crm-types";

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

// Каталог игр для турниров (главный аккаунт): MK, UFC, EA FC и т.д.
export function TournamentGamesManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ games: TournamentGameItem[] }>({
    queryKey: ["admin-tournament-games"],
    queryFn: () => api("/api/admin/tournament-games"),
  });
  const [form, setForm] = useState<{ id?: number; name: string; genre: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      onToast("Укажите название игры");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/tournament-games/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name.trim(), genre: form.genre.trim() }),
        });
        onToast("Игра обновлена");
      } else {
        await api("/api/admin/tournament-games", {
          method: "POST",
          body: JSON.stringify({ name: form.name.trim(), genre: form.genre.trim() }),
        });
        onToast("Игра добавлена в каталог турниров");
      }
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-tournament-games"] });
      void queryClient.invalidateQueries({ queryKey: ["tournament-games"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function seedDefaults() {
    setSeeding(true);
    try {
      const res = await api<{ added: number; message?: string }>("/api/admin/tournament-games", {
        method: "POST",
        body: JSON.stringify({ seedDefaults: true }),
      });
      onToast(res.added > 0 ? `Добавлено популярных игр: ${res.added}` : res.message ?? "Готово");
      void queryClient.invalidateQueries({ queryKey: ["admin-tournament-games"] });
      void queryClient.invalidateQueries({ queryKey: ["tournament-games"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSeeding(false);
    }
  }

  async function remove(g: TournamentGameItem) {
    try {
      const res = await api<{ message?: string }>(`/api/admin/tournament-games/${g.id}`, {
        method: "DELETE",
      });
      onToast(res.message ?? "Игра удалена");
      void queryClient.invalidateQueries({ queryKey: ["admin-tournament-games"] });
      void queryClient.invalidateQueries({ queryKey: ["tournament-games"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const games = data?.games ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Игры, по которым проводятся турниры в клубе: Mortal Kombat, UFC, EA SPORTS FC (FIFA),
          Tekken и другие. Сотрудники выбирают игру из этого списка при создании турнира.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={seedDefaults} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Популярные
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setForm({ name: "", genre: "" })}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>Игра</TableHead>
                <TableHead>Жанр</TableHead>
                <TableHead>Турниров</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Каталог пуст. Нажмите «Популярные», чтобы добавить MK, UFC, EA FC, Tekken и т.д.
                  </TableCell>
                </TableRow>
              ) : (
                games.map((g) => (
                  <TableRow key={g.id} className={g.active ? undefined : "opacity-55"}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {g.genre ? (
                        <Badge variant="outline">{g.genre}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{g.tournamentsCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={g.active ? "" : "opacity-60"}>
                        {g.active ? "да" : "нет"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Изменить"
                          onClick={() => setForm({ id: g.id, name: g.name, genre: g.genre })}
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

      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить игру" : "Новая игра для турниров"}</DialogTitle>
            <DialogDescription>
              Название и жанр видны сотрудникам при создании турнира.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tgame-name">Название</Label>
                <Input
                  id="tgame-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mortal Kombat 1"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tgame-genre">Жанр (необязательно)</Label>
                <Input
                  id="tgame-genre"
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  placeholder="Драки 1×1 / Футбол / Гонки"
                />
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Сохранить" : "Добавить игру"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
