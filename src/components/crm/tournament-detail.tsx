"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trophy,
  Users,
  Coins,
  Crown,
  Loader2,
  UserPlus,
  Trash2,
  Play,
  Flag,
  Shuffle,
  Coins as CoinsIcon,
  HandCoins,
} from "lucide-react";
import type {
  CurrentUser,
  TournamentDetailData,
  TournamentMatchItem,
  TournamentParticipantItem,
} from "@/lib/crm-types";
import { formatTenge } from "@/lib/crm-types";
import { FORMAT_LABELS, prizeForPlace } from "@/lib/tournament";
import { api } from "./tournaments-view";

// ==== Диалог турнира: участники, сетка, таблица, призовые ====

export function TournamentDetailDialog({
  id,
  onClose,
  currentUser,
  onToast,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  currentUser: CurrentUser;
  onToast: (m: string) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const open = id !== null;
  const { data, isLoading } = useQuery<TournamentDetailData>({
    queryKey: ["tournament", id],
    queryFn: () => api(`/api/tournaments/${id}`),
    enabled: open,
    refetchInterval: 10000,
  });

  const [scoreMatch, setScoreMatch] = useState<TournamentMatchItem | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["tournament", id] });
    onChanged();
  }

  async function startTournament(shuffle: boolean) {
    if (!id) return;
    setBusy(true);
    try {
      const res = await api<{ message: string }>(`/api/tournaments/${id}/start`, {
        method: "POST",
        body: JSON.stringify({ shuffle }),
      });
      onToast(res.message);
      refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function finishTournament() {
    if (!id) return;
    setBusy(true);
    try {
      const res = await api<{ championName: string | null }>(`/api/tournaments/${id}/finish`, {
        method: "POST",
      });
      onToast(res.championName ? `Турнир завершён! Чемпион: ${res.championName}` : "Турнир завершён");
      refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTournament() {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/tournaments/${id}`, { method: "DELETE" });
      onToast("Турнир удалён");
      onClose();
      onChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const t = data?.tournament;
  const participants = data?.participants ?? [];
  const matches = data?.matches ?? [];
  const paidCount = participants.filter((p) => p.paid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        {isLoading || !t ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-2 text-base sm:text-lg">
                <Trophy className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
                <span className="min-w-0">{t.name}</span>
                <StatusChip status={t.status} />
              </DialogTitle>
              <DialogDescription>
                {t.game.name}
                {t.game.genre ? ` · ${t.game.genre}` : ""} · {FORMAT_LABELS[t.format]}
                {t.format !== "ROUND_ROBIN" ? ` · Bo${t.bestOf}` : ""}
                {t.entryFee > 0
                  ? ` · взнос ${formatTenge(t.entryFee)} (оплатили ${paidCount})`
                  : ""}
                {t.prizeFund > 0 ? ` · фонд ${formatTenge(t.prizeFund)}` : ""}
                {" · создал "}
                {t.createdByName}
              </DialogDescription>
            </DialogHeader>

            {t.status === "COMPLETED" && t.championName && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-center gap-3">
                <Crown className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Чемпион турнира</p>
                  <p className="text-lg font-bold">{t.championName}</p>
                </div>
              </div>
            )}

            <Tabs defaultValue={t.status === "REGISTRATION" ? "participants" : "bracket"} className="gap-4">
              <TabsList className="bg-muted/60 flex-wrap h-auto">
                <TabsTrigger value="participants" className="gap-1.5">
                  <Users className="h-4 w-4" /> Участники ({participants.length})
                </TabsTrigger>
                <TabsTrigger value="bracket" className="gap-1.5">
                  <Trophy className="h-4 w-4" />
                  {t.format === "ROUND_ROBIN" ? "Матчи" : "Сетка"}
                </TabsTrigger>
                {t.format === "ROUND_ROBIN" && (
                  <TabsTrigger value="standings" className="gap-1.5">
                    <Flag className="h-4 w-4" /> Таблица
                  </TabsTrigger>
                )}
                <TabsTrigger value="prizes" className="gap-1.5">
                  <HandCoins className="h-4 w-4" /> Призовые
                </TabsTrigger>
              </TabsList>

              <TabsContent value="participants">
                <ParticipantsPanel
                  tournament={t}
                  participants={participants}
                  busy={busy}
                  onStart={startTournament}
                  onToast={onToast}
                  onRefresh={refresh}
                />
              </TabsContent>

              <TabsContent value="bracket">
                <BracketPanel
                  tournament={t}
                  matches={matches}
                  onOpenScore={setScoreMatch}
                />
              </TabsContent>

              {t.format === "ROUND_ROBIN" && (
                <TabsContent value="standings">
                  <StandingsPanel participants={participants} />
                </TabsContent>
              )}

              <TabsContent value="prizes">
                <PrizesPanel tournament={t} participants={participants} />
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              {t.status === "ONGOING" && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={finishTournament}
                  disabled={busy || matches.some((m) => m.status !== "DONE")}
                >
                  <Flag className="h-4 w-4" /> Завершить турнир
                </Button>
              )}
              {t.status === "ONGOING" && matches.some((m) => m.status !== "DONE") && (
                <span className="text-xs text-muted-foreground">
                  Осталось сыграть: {matches.filter((m) => m.status !== "DONE").length}
                </span>
              )}
              <span className="flex-1" />
              {currentUser.role === "ADMIN" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-500/10 border-red-200 dark:border-red-900"
                  onClick={deleteTournament}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" /> Удалить турнир
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>

      {scoreMatch && t && (
        <ScoreDialog
          tournament={t}
          match={scoreMatch}
          onClose={() => setScoreMatch(null)}
          onSaved={(m) => {
            onToast(m);
            setScoreMatch(null);
            refresh();
          }}
          onError={onToast}
        />
      )}
    </Dialog>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    REGISTRATION: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    ONGOING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    COMPLETED: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    REGISTRATION: "Регистрация",
    ONGOING: "Идёт",
    COMPLETED: "Завершён",
  };
  return (
    <Badge variant="outline" className={`shrink-0 ${map[status]}`}>
      {label[status]}
    </Badge>
  );
}

// ==== Участники ====

function ParticipantsPanel({
  tournament,
  participants,
  busy,
  onStart,
  onToast,
  onRefresh,
}: {
  tournament: TournamentDetailData["tournament"];
  participants: TournamentParticipantItem[];
  busy: boolean;
  onStart: (shuffle: boolean) => void;
  onToast: (m: string) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [adding, setAdding] = useState(false);
  const regOpen = tournament.status === "REGISTRATION";
  const paidCount = participants.filter((p) => p.paid).length;

  async function add() {
    if (!name.trim()) return onToast("Укажите имя или ник игрока");
    setAdding(true);
    try {
      await api(`/api/tournaments/${tournament.id}/participants`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      setName("");
      setPhone("");
      onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  }

  async function togglePaid(p: TournamentParticipantItem) {
    try {
      await api(`/api/tournaments/${tournament.id}/participants/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paid: !p.paid }),
      });
      onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(p: TournamentParticipantItem) {
    try {
      await api(`/api/tournaments/${tournament.id}/participants/${p.id}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-3">
      {regOpen && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя или ник игрока"
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон (необязательно)"
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="sm:w-44"
          />
          <Button onClick={add} disabled={adding} className="gap-1.5 shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Добавить
          </Button>
        </div>
      )}

      {participants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Участников пока нет. Добавьте игроков — по клику на карточку кассы они играют
          на устройствах клуба как обычно, турнир ведёт учёт результатов.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-xs text-muted-foreground w-5 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {p.name}
                    {p.eliminated && tournament.status === "ONGOING" && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        выбыл
                      </Badge>
                    )}
                    {p.place && tournament.status === "COMPLETED" && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-600">
                        {p.place} место
                      </Badge>
                    )}
                  </p>
                  {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                </div>
                {tournament.entryFee > 0 && (
                  <button
                    onClick={() => togglePaid(p)}
                    className={`rounded-md px-2 py-1 text-xs font-medium border transition-colors ${
                      p.paid
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                    title={p.paid ? "Взнос оплачен — нажмите чтобы отменить" : "Отметить взнос оплаченным"}
                  >
                    <Coins className="h-3 w-3 inline mr-1" />
                    {p.paid ? "оплатил" : "не оплатил"}
                  </button>
                )}
                {regOpen && (
                  <button
                    onClick={() => remove(p)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                    title="Убрать участника"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {regOpen && participants.length >= 2 && (
        <div className="rounded-xl border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Play className="h-4 w-4" /> Начать турнир
              </p>
              <p className="text-xs text-muted-foreground">
                Будет построена {FORMAT_LABELS[tournament.format].toLowerCase()}
              </p>
            </div>
            <Button size="sm" onClick={() => onStart(shuffle)} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Начать
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm">
              <Shuffle className="h-4 w-4 text-muted-foreground" />
              Случайный жребий
            </div>
            <Switch checked={shuffle} onCheckedChange={setShuffle} />
          </div>
          {!shuffle && (
            <p className="text-xs text-muted-foreground">
              Без жребия: порядок сетки = порядок списка выше (первые — фавориты).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ==== Сетка / матчи ====

function BracketPanel({
  tournament,
  matches,
  onOpenScore,
}: {
  tournament: TournamentDetailData["tournament"];
  matches: TournamentMatchItem[];
  onOpenScore: (m: TournamentMatchItem) => void;
}) {
  const canEdit = tournament.status === "ONGOING";

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Сетка появится после старта турнира.
      </div>
    );
  }

  if (tournament.format === "ROUND_ROBIN") {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Круговая система: каждый с каждым. Очки: победа 3, ничья 1, поражение 0.
          {canEdit && " Нажмите на матч, чтобы ввести счёт."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Тур {r}
              </p>
              {matches
                .filter((m) => m.round === r)
                .sort((a, b) => a.matchIndex - b.matchIndex)
                .map((m) => (
                  <MatchCard key={m.id} match={m} canEdit={canEdit} bestOf={tournament.bestOf} onOpen={onOpenScore} />
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const upper = matches.filter((m) => m.bracket === "UPPER");
  const lower = matches.filter((m) => m.bracket === "LOWER");
  const others = matches.filter((m) => m.bracket === "GF" || m.bracket === "GF_RESET" || m.bracket === "THIRD");
  const upperRounds = [...new Set(upper.map((m) => m.round))].sort((a, b) => a - b);
  const lowerRounds = [...new Set(lower.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Нажмите на матч, чтобы ввести счёт. Победитель и проигравший продвигаются автоматически.
        </p>
      )}

      {/* Верхняя сетка */}
      <div>
        {lower.length > 0 && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Верхняя сетка
          </p>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {upperRounds.map((r) => (
            <div key={r} className="min-w-44 flex-1 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground text-center">
                {roundTitle(upper, r)}
              </p>
              {upper
                .filter((m) => m.round === r)
                .sort((a, b) => a.matchIndex - b.matchIndex)
                .map((m) => (
                  <MatchCard key={m.id} match={m} canEdit={canEdit} bestOf={tournament.bestOf} onOpen={onOpenScore} />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Нижняя сетка */}
      {lower.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Нижняя сетка (проигравшие имеют вторую жизнь)
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {lowerRounds.map((r) => (
              <div key={r} className="min-w-44 flex-1 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground text-center">Раунд {r}</p>
                {lower
                  .filter((m) => m.round === r)
                  .sort((a, b) => a.matchIndex - b.matchIndex)
                  .map((m) => (
                    <MatchCard key={m.id} match={m} canEdit={canEdit} bestOf={tournament.bestOf} onOpen={onOpenScore} />
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Гранд-финал и матч за 3-е */}
      {others.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Решающие матчи
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
            {others
              .sort((a, b) => (a.bracket === "THIRD" ? -1 : b.bracket === "THIRD" ? 1 : a.round - b.round))
              .map((m) => (
                <MatchCard key={m.id} match={m} canEdit={canEdit} bestOf={tournament.bestOf} onOpen={onOpenScore} wide />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function roundTitle(matches: TournamentMatchItem[], round: number): string {
  const label = matches.find((m) => m.round === round)?.roundLabel;
  return label ?? `Раунд ${round}`;
}

function MatchCard({
  match,
  canEdit,
  bestOf,
  onOpen,
  wide,
}: {
  match: TournamentMatchItem;
  canEdit: boolean;
  bestOf: number;
  onOpen: (m: TournamentMatchItem) => void;
  wide?: boolean;
}) {
  const isDone = match.status === "DONE";
  const isBye = isDone && match.score1 == null && match.score2 == null && match.winnerId != null;
  const clickable = canEdit && (match.status === "READY" || isDone);
  const label = match.bracket === "GF" ? "Гранд-финал" : match.bracket === "GF_RESET" ? "Гранд-финал · сброс" : match.bracket === "THIRD" ? "Матч за 3-е место" : match.roundLabel;

  return (
    <button
      onClick={() => clickable && onOpen(match)}
      disabled={!clickable}
      className={`w-full ${wide ? "" : ""} rounded-lg border bg-card p-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        clickable ? "hover:border-ring cursor-pointer" : "cursor-default"
      } ${isDone ? "border-border" : match.status === "READY" ? "border-emerald-400/60 dark:border-emerald-700" : "border-dashed opacity-80"}`}
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
        {label}
        {bestOf > 1 && match.bracket !== "RR" ? ` · Bo${bestOf}` : ""}
      </p>
      <div className="mt-1 space-y-0.5">
        <PlayerRow name={match.p1Name} score={match.score1} isWinner={isDone && match.winnerId === match.p1Id && match.winnerId != null} />
        <PlayerRow name={match.p2Name} score={match.score2} isWinner={isDone && match.winnerId === match.p2Id && match.winnerId != null} />
      </div>
      {isBye ? (
        <p className="text-[10px] text-muted-foreground mt-1">проход без игры (бай)</p>
      ) : match.status === "PENDING" ? (
        <p className="text-[10px] text-muted-foreground mt-1">ожидание участников</p>
      ) : match.status === "READY" ? (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">можно играть</p>
      ) : null}
    </button>
  );
}

function PlayerRow({
  name,
  score,
  isWinner,
}: {
  name: string | null;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className={`truncate ${name ? "" : "text-muted-foreground italic"} ${isWinner ? "font-bold" : ""}`}>
        {name ?? "—"}
      </span>
      {score != null && (
        <span className={`tabular-nums shrink-0 ${isWinner ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

// ==== Ввод счёта ====

function ScoreDialog({
  tournament,
  match,
  onClose,
  onSaved,
  onError,
}: {
  tournament: TournamentDetailData["tournament"];
  match: TournamentMatchItem;
  onClose: () => void;
  onSaved: (m: string) => void;
  onError: (m: string) => void;
}) {
  const isRR = match.bracket === "RR";
  const [s1, setS1] = useState(match.score1?.toString() ?? "");
  const [s2, setS2] = useState(match.score2?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n1 = Number(s1);
    const n2 = Number(s2);
    if (s1 === "" || s2 === "" || isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) {
      return onError("Введите счёт обоих игроков");
    }
    setSaving(true);
    try {
      const res = await api<{ message: string }>(
        `/api/tournaments/${tournament.id}/matches/${match.id}`,
        { method: "POST", body: JSON.stringify({ score1: n1, score2: n2 }) }
      );
      onSaved(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
      setSaving(false);
    }
  }

  async function resetResult() {
    setSaving(true);
    try {
      const res = await api<{ message: string }>(
        `/api/tournaments/${tournament.id}/matches/${match.id}`,
        { method: "POST", body: JSON.stringify({ score1: null, score2: null }) }
      );
      onSaved(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{match.roundLabel}</DialogTitle>
          <DialogDescription>
            {isRR
              ? "Счёт: голы/раунды. Ничья допустима (1 очко каждому)."
              : `Матч до ${Math.ceil(tournament.bestOf / 2)} побед (Bo${tournament.bestOf}). Ничьей не бывает.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Счёт</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={s1}
                onChange={(e) => setS1(e.target.value)}
                autoFocus
              />
              <p className="text-sm font-medium truncate">{match.p1Name ?? "—"}</p>
            </div>
            <span className="text-muted-foreground font-bold">:</span>
            <div className="space-y-1.5">
              <Label className="text-xs">Счёт</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={s2}
                onChange={(e) => setS2(e.target.value)}
              />
              <p className="text-sm font-medium truncate text-right">{match.p2Name ?? "—"}</p>
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Записать результат
          </Button>
          {match.status === "DONE" && (
            <Button variant="outline" className="w-full" onClick={resetResult} disabled={saving}>
              Сбросить результат (откатить сетку)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==== Таблица (круговая) ====

function StandingsPanel({ participants }: { participants: TournamentParticipantItem[] }) {
  const sorted = useMemo(
    () =>
      [...participants].sort(
        (a, b) =>
          b.points - a.points || b.diff - a.diff || b.wins - a.wins ||
          a.name.localeCompare(b.name, "ru")
      ),
    [participants]
  );
  const played = participants.some((p) => p.wins + p.losses + p.draws > 0);

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/95 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Игрок</th>
              <th className="px-2 py-2 text-center font-medium">И</th>
              <th className="px-2 py-2 text-center font-medium">В</th>
              <th className="px-2 py-2 text-center font-medium">Н</th>
              <th className="px-2 py-2 text-center font-medium">П</th>
              <th className="px-2 py-2 text-center font-medium">±</th>
              <th className="px-3 py-2 text-center font-bold">Очки</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((p, i) => (
              <tr key={p.id} className={p.eliminated ? "opacity-50" : undefined}>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">
                  {p.name}
                  {i === 0 && played && <Crown className="h-3.5 w-3.5 inline ml-1.5 text-amber-500" />}
                </td>
                <td className="px-2 py-2 text-center tabular-nums">{p.wins + p.losses + p.draws}</td>
                <td className="px-2 py-2 text-center tabular-nums">{p.wins}</td>
                <td className="px-2 py-2 text-center tabular-nums">{p.draws}</td>
                <td className="px-2 py-2 text-center tabular-nums">{p.losses}</td>
                <td className="px-2 py-2 text-center tabular-nums">{p.diff > 0 ? `+${p.diff}` : p.diff}</td>
                <td className="px-3 py-2 text-center font-bold tabular-nums">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==== Призовые ====

function PrizesPanel({
  tournament,
  participants,
}: {
  tournament: TournamentDetailData["tournament"];
  participants: TournamentParticipantItem[];
}) {
  const split = tournament.prizeSplit.split(",").map((s) => Number(s) || 0);
  const paidCount = participants.filter((p) => p.paid).length;
  const feesCollected = paidCount * tournament.entryFee;
  const placeName = (place: number) =>
    participants.find((p) => p.place === place)?.name ?? null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CoinsIcon className="h-3.5 w-3.5" /> Призовой фонд
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatTenge(tournament.prizeFund)}</p>
        </div>
        {tournament.entryFee > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> Собрано взносов ({paidCount} × {formatTenge(tournament.entryFee)})
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatTenge(feesCollected)}</p>
          </div>
        )}
      </div>

      {tournament.prizeFund > 0 ? (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/95">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Место</th>
                <th className="px-3 py-2 text-right font-medium">Доля</th>
                <th className="px-3 py-2 text-right font-medium">Выплата</th>
                <th className="px-3 py-2 text-right font-medium">Победитель</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {split.map((pct, i) => {
                const place = i + 1;
                const amount = prizeForPlace(tournament.prizeFund, tournament.prizeSplit, place);
                const name = placeName(place) ?? (tournament.status === "COMPLETED" ? "—" : "определяется");
                return (
                  <tr key={place}>
                    <td className="px-3 py-2 font-medium">
                      {place === 1 && <Crown className="h-3.5 w-3.5 inline mr-1 text-amber-500" />}
                      {place} место
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct}%</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatTenge(amount)}</td>
                    <td className="px-3 py-2 text-right">{name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Призовой фонд не задан — турнир без денежных призов.
        </p>
      )}
    </div>
  );
}
