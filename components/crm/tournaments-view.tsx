"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Trophy,
  Plus,
  Loader2,
  Users,
  Coins,
  CalendarClock,
  Crown,
  ChevronRight,
} from "lucide-react";
import type {
  CurrentUser,
  TournamentFormat,
  TournamentGameItem,
  TournamentListItem,
} from "@/lib/crm-types";
import { formatTenge } from "@/lib/crm-types";
import { FORMAT_LABELS, FORMAT_SHORT, FORMAT_HINTS } from "@/lib/tournament";
import { TournamentDetailDialog } from "./tournament-detail";

type ApiError = { error?: string };

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as ApiError).error ?? "Ошибка сервера");
  return data as T;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  REGISTRATION: {
    label: "Регистрация",
    className: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  },
  ONGOING: {
    label: "Идёт сейчас",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  },
  COMPLETED: {
    label: "Завершён",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function TournamentsView({
  currentUser,
  onToast,
}: {
  currentUser: CurrentUser;
  onToast: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ tournaments: TournamentListItem[] }>({
    queryKey: ["tournaments"],
    queryFn: () => api("/api/tournaments"),
    refetchInterval: 15000,
  });
  const { data: gamesData } = useQuery<{ games: TournamentGameItem[] }>({
    queryKey: ["tournament-games"],
    queryFn: () => api("/api/tournament-games"),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const tournaments = data?.tournaments ?? [];

  function refreshList() {
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Турниры
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Официальные форматы: олимпийская система, двухсеточная (как на EVO) и круговая.
            Игры: Mortal Kombat, UFC, EA FC и другие.
          </p>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Новый турнир
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Турниров пока нет. Создайте первый: «Кубок клуба по Mortal Kombat».
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            Создать турнир
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {tournaments.map((t) => {
            const badge = STATUS_BADGE[t.status];
            return (
              <button
                key={t.id}
                onClick={() => setDetailId(t.id)}
                className="text-left rounded-xl border bg-card p-4 hover:border-ring hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-tight truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.game.name}
                      {t.game.genre ? ` · ${t.game.genre}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${badge.className}`}>
                    {badge.label}
                  </Badge>
                </div>

                {t.status === "COMPLETED" && t.championName ? (
                  <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    <Crown className="h-4 w-4" /> Чемпион: {t.championName}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {t.participantsCount}/{t.maxParticipants}
                    </span>
                    {t.entryFee > 0 && (
                      <span className="flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        взнос {formatTenge(t.entryFee)}
                      </span>
                    )}
                    {t.startsAt && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(t.startsAt).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {FORMAT_SHORT[t.format] ?? t.format}
                    {t.format !== "ROUND_ROBIN" && t.bestOf > 1 ? ` · Bo${t.bestOf}` : ""}
                    {t.prizeFund > 0 ? ` · фонд ${formatTenge(t.prizeFund)}` : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateTournamentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        games={gamesData?.games ?? []}
        onCreated={(m) => {
          onToast(m);
          refreshList();
        }}
        onError={onToast}
      />

      <TournamentDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
        currentUser={currentUser}
        onToast={onToast}
        onChanged={refreshList}
      />
    </div>
  );
}

function CreateTournamentDialog({
  open,
  onOpenChange,
  games,
  onCreated,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  games: TournamentGameItem[];
  onCreated: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState<string>("");
  const [format, setFormat] = useState<TournamentFormat>("SINGLE_ELIM");
  const [bestOf, setBestOf] = useState(1);
  const [entryFee, setEntryFee] = useState("");
  const [prizeFund, setPrizeFund] = useState("");
  const [prizeSplit, setPrizeSplit] = useState("60,30,10");
  const [maxParticipants, setMaxParticipants] = useState("16");
  const [startsAt, setStartsAt] = useState("");
  const [thirdPlace, setThirdPlace] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setGameId("");
    setFormat("SINGLE_ELIM");
    setBestOf(1);
    setEntryFee("");
    setPrizeFund("");
    setPrizeSplit("60,30,10");
    setMaxParticipants("16");
    setStartsAt("");
    setThirdPlace(false);
    setSaving(false);
  }

  async function create() {
    if (!name.trim()) return onError("Укажите название турнира");
    if (!gameId) return onError("Выберите игру");
    setSaving(true);
    try {
      await api("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          gameId: Number(gameId),
          format,
          bestOf: format === "ROUND_ROBIN" ? 1 : bestOf,
          entryFee: Number(entryFee) || 0,
          prizeFund: Number(prizeFund) || 0,
          prizeSplit,
          maxParticipants: Number(maxParticipants) || 16,
          startsAt: startsAt || null,
          thirdPlace: format === "SINGLE_ELIM" ? thirdPlace : false,
        }),
      });
      onCreated("Турнир создан — добавьте участников");
      reset();
      onOpenChange(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const formatOptions: TournamentFormat[] = ["SINGLE_ELIM", "DOUBLE_ELIM", "ROUND_ROBIN"];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Новый турнир
          </DialogTitle>
          <DialogDescription>
            Как на официальных турнирах: выберите игру, формат проведения и призовой фонд.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Название</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Кубок PlayZone по Mortal Kombat"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Игра</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={games.length ? "Выберите игру" : "Каталог пуст — добавьте игры в Настройках"} />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                    {g.genre ? ` · ${g.genre}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Формат проведения</Label>
            <div className="grid grid-cols-1 gap-2">
              {formatOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    format === f ? "border-primary bg-primary/10" : "border-border hover:border-ring"
                  }`}
                >
                  <div className="text-sm font-semibold">{FORMAT_LABELS[f]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{FORMAT_HINTS[f]}</div>
                </button>
              ))}
            </div>
          </div>

          {format !== "ROUND_ROBIN" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Матч</Label>
                <Select value={String(bestOf)} onValueChange={(v) => setBestOf(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Bo1 — до 1 победы</SelectItem>
                    <SelectItem value="3">Bo3 — до 2 побед</SelectItem>
                    <SelectItem value="5">Bo5 — до 3 побед</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Лимит участников</Label>
                <Input
                  type="number"
                  min={2}
                  max={64}
                  inputMode="numeric"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                />
              </div>
            </div>
          )}

          {format === "SINGLE_ELIM" && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Матч за 3-е место</p>
                <p className="text-xs text-muted-foreground">
                  Проигравшие полуфиналы играют бронзовый матч
                </p>
              </div>
              <Switch checked={thirdPlace} onCheckedChange={setThirdPlace} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-fee">Взнос с участника, ₸</Label>
              <Input
                id="t-fee"
                type="number"
                min={0}
                inputMode="numeric"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-fund">Призовой фонд, ₸</Label>
              <Input
                id="t-fund"
                type="number"
                min={0}
                inputMode="numeric"
                value={prizeFund}
                onChange={(e) => setPrizeFund(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {prizeFund !== "" && Number(prizeFund) > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="t-split">Распределение фонда по местам, %</Label>
              <Input
                id="t-split"
                value={prizeSplit}
                onChange={(e) => setPrizeSplit(e.target.value)}
                placeholder="60,30,10"
              />
              <p className="text-xs text-muted-foreground">
                1-е место 60%, 2-е 30%, 3-е 10% (порядок через запятую)
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="t-starts">Дата и время начала (необязательно)</Label>
            <Input
              id="t-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={create} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Создать турнир
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
