// Серверная логика турниров: построение сетки, запись счёта, продвижение
// победителей/проигравших, сброс матчей, пересчёт статусов и статистики.
import { db } from "@/lib/db";
import {
  generateBracket,
  validateElimScore,
  type TournamentFormat,
} from "@/lib/tournament";

type MatchRow = {
  id: number;
  bracket: string;
  round: number;
  matchIndex: number;
  p1Id: number | null;
  p1Name: string | null;
  p2Id: number | null;
  p2Name: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: number | null;
  status: string;
  nextMatchId: number | null;
  nextSlot: number | null;
  losersMatchId: number | null;
  losersSlot: number | null;
};

const refKey = (bracket: string, round: number, matchIndex: number) =>
  `${bracket}:${round}:${matchIndex}`;

/** Пересчёт статусов матчей: READY = оба игрока на месте */
async function recalcStatuses(tournamentId: number) {
  const matches = await db.tournamentMatch.findMany({ where: { tournamentId } });
  const updates = matches
    .filter((m) => m.status !== "DONE")
    .map((m) => ({
      id: m.id,
      status: m.p1Id && m.p2Id ? "READY" : "PENDING",
    }))
    .filter((u, i, arr) => {
      const orig = matches.find((m) => m.id === u.id);
      return orig && orig.status !== u.status;
    });
  for (const u of updates) {
    await db.tournamentMatch.update({
      where: { id: u.id },
      data: { status: u.status },
    });
  }
}

/** Участник выбыл = турнир идёт, он уже играл и не имеет будущих матчей */
async function recalcEliminated(tournamentId: number) {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t || t.status !== "ONGOING") return;
  const [matches, participants] = await Promise.all([
    db.tournamentMatch.findMany({ where: { tournamentId } }),
    db.tournamentParticipant.findMany({ where: { tournamentId } }),
  ]);
  for (const p of participants) {
    const hasUpcoming = matches.some(
      (m) =>
        m.status !== "DONE" && (m.p1Id === p.id || m.p2Id === p.id)
    );
    const played = matches.some(
      (m) => m.status === "DONE" && (m.p1Id === p.id || m.p2Id === p.id)
    );
    const eliminated = !hasUpcoming && played;
    if (p.eliminated !== eliminated) {
      await db.tournamentParticipant.update({
        where: { id: p.id },
        data: { eliminated },
      });
    }
  }
}

/** Пересчёт очков круговой системы из всех завершённых матчей */
async function recalcRRStats(tournamentId: number) {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t || t.format !== "ROUND_ROBIN") return;
  const [matches, participants] = await Promise.all([
    db.tournamentMatch.findMany({ where: { tournamentId } }),
    db.tournamentParticipant.findMany({ where: { tournamentId } }),
  ]);
  const stats = new Map<number, { points: number; wins: number; draws: number; losses: number; diff: number }>();
  for (const p of participants)
    stats.set(p.id, { points: 0, wins: 0, draws: 0, losses: 0, diff: 0 });
  for (const m of matches) {
    if (m.bracket !== "RR" || m.status !== "DONE") continue;
    if (m.p1Id == null || m.p2Id == null) continue;
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;
    const st1 = stats.get(m.p1Id);
    const st2 = stats.get(m.p2Id);
    if (!st1 || !st2) continue;
    st1.diff += s1 - s2;
    st2.diff += s2 - s1;
    if (s1 === s2) {
      st1.draws += 1;
      st2.draws += 1;
      st1.points += 1;
      st2.points += 1;
    } else if (s1 > s2) {
      st1.wins += 1;
      st2.losses += 1;
      st1.points += 3;
    } else {
      st2.wins += 1;
      st1.losses += 1;
      st2.points += 3;
    }
  }
  for (const p of participants) {
    const st = stats.get(p.id);
    if (!st) continue;
    await db.tournamentParticipant.update({
      where: { id: p.id },
      data: {
        points: st.points,
        wins: st.wins,
        draws: st.draws,
        losses: st.losses,
        diff: st.diff,
      },
    });
  }
}

/**
 * Сброс всех матчей ниже по сетке (рекурсивно): очищаем слоты, куда этот
 * матч отправляет участников, их результаты и т.д. Гранд-финал: удаляем сброс.
 */
async function clearDownstream(match: MatchRow) {
  const targets: { id: number; slot: number }[] = [];
  if (match.nextMatchId && match.nextSlot)
    targets.push({ id: match.nextMatchId, slot: match.nextSlot });
  if (match.losersMatchId && match.losersSlot)
    targets.push({ id: match.losersMatchId, slot: match.losersSlot });

  for (const t of targets) {
    const child = (await db.tournamentMatch.findUnique({
      where: { id: t.id },
    })) as MatchRow | null;
    if (!child) continue;

    // Гранд-финал со сбросом: удаляем матч сброса
    if (child.bracket === "GF" && child.nextMatchId) {
      await db.tournamentMatch.deleteMany({ where: { id: child.nextMatchId } });
      await db.tournamentMatch.update({
        where: { id: child.id },
        data: { nextMatchId: null },
      });
    }

    const slotData =
      t.slot === 1 ? { p1Id: null, p1Name: null } : { p2Id: null, p2Name: null };
    const hadResult = child.status === "DONE";
    await db.tournamentMatch.update({
      where: { id: child.id },
      data: {
        ...slotData,
        ...(hadResult
          ? { score1: null, score2: null, winnerId: null, status: "PENDING" }
          : {}),
      },
    });
    if (hadResult) await clearDownstream(child);
  }
}

/**
 * Каскад байев: (а) победители бай-матчей (DONE без счёта) продвигаются в следующий
 * слот; (б) матч с одним участником, у которого второй слот «мёртвый» (dead1/dead2,
 * туда никто никогда не попадёт из-за бая соперника), автопроходит дальше.
 * Вызывается после построения сетки и после каждого результата.
 */
async function cascadeAutoAdvance(tournamentId: number) {
  for (let pass = 0; pass < 24; pass++) {
    const matches = (await db.tournamentMatch.findMany({
      where: { tournamentId },
    })) as MatchRow[];
    let changed = false;

    // (а) автопродвижение победителей бай-матчей
    for (const m of matches) {
      if (m.status !== "DONE" || m.winnerId == null) continue;
      if (m.score1 != null || m.score2 != null) continue; // реальный результат уже разослан
      if (m.bracket === "GF" || m.bracket === "GF_RESET") continue;
      if (!m.nextMatchId || !m.nextSlot) continue;
      const child = matches.find((x) => x.id === m.nextMatchId);
      if (!child) continue;
      if (child.p1Id === m.winnerId || child.p2Id === m.winnerId) continue;
      const slotData =
        m.nextSlot === 1
          ? { p1Id: m.winnerId, p1Name: m.p1Name }
          : { p2Id: m.winnerId, p2Name: m.p2Name };
      await db.tournamentMatch.update({ where: { id: child.id }, data: slotData });
      Object.assign(child, slotData);
      changed = true;
    }

    // (б) автопроход одиночек с «мёртвым» слотом
    for (const m of matches) {
      if (m.status === "DONE") continue;
      if (m.bracket === "GF" || m.bracket === "GF_RESET") continue;
      const solo =
        (m.p1Id != null && m.p2Id == null && m.dead2) ||
        (m.p2Id != null && m.p1Id == null && m.dead1);
      if (!solo) continue;
      const winnerId = (m.p1Id ?? m.p2Id) as number;
      await db.tournamentMatch.update({
        where: { id: m.id },
        data: { status: "DONE", winnerId },
      });
      m.status = "DONE";
      m.winnerId = winnerId;
      // у автопрошедшего нет проигравшего — его слот тоже «мёртвый»
      if (m.losersMatchId && m.losersSlot) {
        await db.tournamentMatch.update({
          where: { id: m.losersMatchId },
          data: m.losersSlot === 1 ? { dead1: true } : { dead2: true },
        });
      }
      changed = true;
    }

    if (!changed) break;
  }
}

/**
 * Записать результат матча (score1/score2) или сбросить (null/null).
 * Продвигает победителя и проигравшего по сетке, создаёт/удаляет сброс
 * гранд-финала, пересчитывает статусы и статистику.
 */
export async function reportMatchResult(
  tournamentId: number,
  matchId: number,
  score1: number | null,
  score2: number | null
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { ok: false, error: "Турнир не найден" };
  if (tournament.status !== "ONGOING")
    return { ok: false, error: "Турнир не в стадии игры" };
  const match = (await db.tournamentMatch.findUnique({
    where: { id: matchId },
  })) as MatchRow | null;
  if (!match || match.tournamentId !== tournamentId)
    return { ok: false, error: "Матч не найден" };

  const participants = await db.tournamentParticipant.findMany({
    where: { tournamentId },
  });
  const nameOf = (id: number | null) =>
    participants.find((p) => id === p.id)?.name ?? null;

  // ==== Сброс результата ====
  if (score1 == null || score2 == null) {
    if (match.status !== "DONE") return { ok: false, error: "У матча нет результата" };
    if (match.score1 == null && match.score2 == null)
      return { ok: false, error: "Автопроход (бай) нельзя сбросить" };
    // GF: удалить сброс, снять ссылки
    if (match.bracket === "GF" && match.nextMatchId) {
      await db.tournamentMatch.deleteMany({ where: { id: match.nextMatchId } });
      await db.tournamentMatch.update({
        where: { id: match.id },
        data: { nextMatchId: null },
      });
    }
    await clearDownstream(match);
    await db.tournamentMatch.update({
      where: { id: match.id },
      data: { score1: null, score2: null, winnerId: null, status: "PENDING" },
    });
    await cascadeAutoAdvance(tournamentId);
    await recalcStatuses(tournamentId);
    await recalcEliminated(tournamentId);
    await recalcRRStats(tournamentId);
    return { ok: true, message: "Результат сброшен" };
  }

  // ==== Запись результата ====
  if (match.p1Id == null || match.p2Id == null)
    return { ok: false, error: "В матче ещё не определены оба участника" };

  const s1 = Math.round(Number(score1));
  const s2 = Math.round(Number(score2));

  let winnerId: number;
  if (match.bracket === "RR") {
    // Круговая: счёт = голы/раунды, ничья допустима
    if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0)
      return { ok: false, error: "Счёт должен быть неотрицательным" };
    winnerId = s1 === s2 ? 0 : s1 > s2 ? match.p1Id : match.p2Id;
  } else {
    const v = validateElimScore(s1, s2, tournament.bestOf);
    if (!v.ok) return { ok: false, error: v.error };
    winnerId = v.winner === 1 ? match.p1Id : match.p2Id;
  }

  const winnerName = nameOf(winnerId);
  const loserId = winnerId === 0 ? null : winnerId === match.p1Id ? match.p2Id : match.p1Id;
  const loserName = loserId == null ? null : nameOf(loserId);

  // Гранд-финал (и матч-сброс): победитель из нижней сетки (слот 2) в первом GF →
  // нужен матч-сброс; в GF_RESET победитель — чемпион.
  if (match.bracket === "GF" || match.bracket === "GF_RESET") {
    const isReset = match.bracket === "GF_RESET";
    const needReset = !isReset && winnerId === match.p2Id;
    if (match.nextMatchId) {
      await db.tournamentMatch.deleteMany({ where: { id: match.nextMatchId } });
    }
    if (needReset) {
      const reset = await db.tournamentMatch.create({
        data: {
          tournamentId,
          bracket: "GF_RESET",
          round: match.round + 1,
          matchIndex: 0,
          p1Id: match.p1Id,
          p1Name: match.p1Name,
          p2Id: match.p2Id,
          p2Name: match.p2Name,
          status: "READY",
        },
      });
      await db.tournamentMatch.update({
        where: { id: match.id },
        data: {
          score1: s1,
          score2: s2,
          winnerId,
          status: "DONE",
          nextMatchId: reset.id,
        },
      });
      await recalcStatuses(tournamentId);
      await recalcEliminated(tournamentId);
      return {
        ok: true,
        message: `Победил ${winnerName} — но он из нижней сетки: нужен решающий матч-сброс!`,
      };
    }
    await db.tournamentMatch.update({
      where: { id: match.id },
      data: { score1: s1, score2: s2, winnerId, status: "DONE", nextMatchId: null },
    });
    await recalcStatuses(tournamentId);
    await recalcEliminated(tournamentId);
    return {
      ok: true,
      message: isReset
        ? `Чемпион после сброса: ${winnerName}!`
        : `Чемпион: ${winnerName}!`,
    };
  }

  // Обычный матч: сначала чистим устаревшие результаты ниже по сетке
  await clearDownstream(match);

  const data: Record<string, unknown> = {
    score1: s1,
    score2: s2,
    winnerId: winnerId === 0 ? null : winnerId,
    status: "DONE",
  };

  // Продвижение победителя
  if (match.nextMatchId && match.nextSlot) {
    const slotData =
      match.nextSlot === 1
        ? { p1Id: winnerId === 0 ? null : winnerId, p1Name: winnerName }
        : { p2Id: winnerId === 0 ? null : winnerId, p2Name: winnerName };
    await db.tournamentMatch.update({
      where: { id: match.nextMatchId },
      data: slotData,
    });
  }
  // Проигравший падает ниже (upper → lower, полуфинал → матч за 3-е)
  if (match.losersMatchId && match.losersSlot && loserId != null) {
    const slotData =
      match.losersSlot === 1
        ? { p1Id: loserId, p1Name: loserName }
        : { p2Id: loserId, p2Name: loserName };
    await db.tournamentMatch.update({
      where: { id: match.losersMatchId },
      data: slotData,
    });
  }

  await db.tournamentMatch.update({ where: { id: match.id }, data });
  await cascadeAutoAdvance(tournamentId);
  await recalcStatuses(tournamentId);
  await recalcEliminated(tournamentId);
  await recalcRRStats(tournamentId);
  return {
    ok: true,
    message:
      winnerId === 0
        ? "Ничья зафиксирована"
        : `Победа ${winnerName}${match.bracket === "RR" ? "" : " — участник продвинулся"}`,
  };
}

/**
 * Построение сетки при старте турнира. participants — уже в нужном порядке
 * (перемешаны при жребии). Байи автопродвигаются.
 */
export async function buildBracket(
  tournamentId: number,
  orderedParticipants: { id: number; name: string }[]
): Promise<void> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Турнир не найден");

  const gen = generateBracket(
    tournament.format as TournamentFormat,
    orderedParticipants.length,
    tournament.thirdPlace
  );

  // 1. Создаём все матчи, запоминаем id по ключу bracket:round:matchIndex
  const idByKey = new Map<string, number>();
  for (const g of gen) {
    const created = await db.tournamentMatch.create({
      data: {
        tournamentId,
        bracket: g.bracket,
        round: g.round,
        matchIndex: g.matchIndex,
      },
    });
    idByKey.set(refKey(g.bracket, g.round, g.matchIndex), created.id);
  }

  // 2. Участники в слоты первого раунда + связи
  for (const g of gen) {
    const id = idByKey.get(refKey(g.bracket, g.round, g.matchIndex));
    if (!id) continue;
    const data: Record<string, unknown> = {};
    if (g.nextRef) {
      data.nextMatchId = idByKey.get(refKey(g.nextRef.bracket, g.nextRef.round, g.nextRef.matchIndex)) ?? null;
      data.nextSlot = g.nextSlot;
    }
    if (g.losersRef) {
      data.losersMatchId =
        idByKey.get(refKey(g.losersRef.bracket, g.losersRef.round, g.losersRef.matchIndex)) ?? null;
      data.losersSlot = g.losersSlot;
    }
    // Слоты участников: первый раунд сеток И все матчи круговой системы
    if (g.p1Seed != null || g.p2Seed != null) {
      const p1 = g.p1Seed != null ? orderedParticipants[g.p1Seed] : null;
      const p2 = g.p2Seed != null ? orderedParticipants[g.p2Seed] : null;
      if (p1) {
        data.p1Id = p1.id;
        data.p1Name = p1.name;
      }
      if (p2) {
        data.p2Id = p2.id;
        data.p2Name = p2.name;
      }
      // Бай (только в сетках): соперника нет — автопроход, а слот проигравшего внизу «мёртвый»
      if (g.bracket === "UPPER") {
        if (p1 && !p2) {
          data.status = "DONE";
          data.winnerId = p1.id;
        } else if (!p1 && p2) {
          data.status = "DONE";
          data.winnerId = p2.id;
        }
      }
    }
    await db.tournamentMatch.update({ where: { id }, data });

    // Слот проигравшего бай-матча никогда не заполнится
    if (g.bracket === "UPPER" && g.round === 1 && g.losersRef && data.status === "DONE") {
      const losersId = idByKey.get(refKey(g.losersRef.bracket, g.losersRef.round, g.losersRef.matchIndex));
      if (losersId) {
        await db.tournamentMatch.update({
          where: { id: losersId },
          data: g.losersSlot === 1 ? { dead1: true } : { dead2: true },
        });
      }
    }
  }

  // 3. Каскад байев (общая функция, работает и после результатов матчей)
  await cascadeAutoAdvance(tournamentId);

  await recalcStatuses(tournamentId);
  await recalcEliminated(tournamentId);
}
