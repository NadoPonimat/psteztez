import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Завершить турнир: расставить места и чемпиона
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tournament = await db.tournament.findUnique({
    where: { id: Number(id) },
    include: { matches: true, participants: true },
  });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  if (tournament.status !== "ONGOING")
    return NextResponse.json({ error: "Турнир не идёт" }, { status: 400 });

  const unfinished = tournament.matches.filter((m) => m.status !== "DONE");
  if (unfinished.length > 0)
    return NextResponse.json(
      { error: `Осталось сыграть матчей: ${unfinished.length}` },
      { status: 400 }
    );

  const nameOf = (pid: number | null) =>
    tournament.participants.find((p) => p.id === pid)?.name ?? null;

  // places: participantId → место
  const places = new Map<number, number>();

  if (tournament.format === "ROUND_ROBIN") {
    const standings = [...tournament.participants].sort(
      (a, b) =>
        b.points - a.points || b.diff - a.diff || b.wins - a.wins ||
        a.name.localeCompare(b.name, "ru")
    );
    standings.forEach((p, i) => places.set(p.id, i + 1));
  } else {
    const final = tournament.matches
      .filter((m) => m.bracket === "UPPER" && m.status === "DONE")
      .sort((a, b) => b.round - a.round)[0];
    if (!final?.winnerId)
      return NextResponse.json({ error: "Финал не сыгран" }, { status: 400 });
    const runnerUp =
      final.winnerId === final.p1Id ? final.p2Id : final.p1Id;
    if (final.winnerId) places.set(final.winnerId, 1);
    if (runnerUp) places.set(runnerUp, 2);

    if (tournament.format === "SINGLE_ELIM") {
      const third = tournament.matches.find((m) => m.bracket === "THIRD");
      if (third?.winnerId) {
        places.set(third.winnerId, 3);
        const fourth = third.winnerId === third.p1Id ? third.p2Id : third.p1Id;
        if (fourth) places.set(fourth, 4);
      } else {
        // без матча за 3-е: оба проигравших полуфинала делят 3-е место
        const semis = tournament.matches.filter(
          (m) => m.bracket === "UPPER" && m.round === final.round - 1 && final.round >= 2
        );
        for (const s of semis) {
          const loser = s.winnerId === s.p1Id ? s.p2Id : s.winnerId == null ? null : s.p1Id;
          if (loser) places.set(loser, 3);
        }
      }
    } else {
      // Двухсеточная: проигравший LB-финала — 3-е, проигравший LB-полуфинала — 4-е
      const lbMatches = tournament.matches.filter((m) => m.bracket === "LOWER");
      const lbFinal = lbMatches.sort((a, b) => b.round - a.round)[0];
      if (lbFinal && lbFinal.winnerId) {
        const third = lbFinal.winnerId === lbFinal.p1Id ? lbFinal.p2Id : lbFinal.p1Id;
        if (third) places.set(third, 3);
        // 4-е место: проигравший полуфинала нижней сетки (матч, кормивший LB-финал снизу)
        const lbSemi = lbMatches.find(
          (m) => m.nextMatchId === lbFinal.id && m.nextSlot === 2
        );
        if (lbSemi && lbSemi.winnerId) {
          const fourth = lbSemi.winnerId === lbSemi.p1Id ? lbSemi.p2Id : lbSemi.p1Id;
          if (fourth) places.set(fourth, 4);
        }
      }
      if (final.p1Id && final.winnerId !== final.p1Id && final.p1Id !== runnerUp)
        places.set(final.p1Id, 4);
      if (final.p2Id && final.winnerId !== final.p2Id && final.p2Id !== runnerUp)
        places.set(final.p2Id, 4);
    }
  }

  const championName = places.size
    ? nameOf([...places.entries()].find(([, place]) => place === 1)?.[0] ?? null)
    : null;

  for (const p of tournament.participants) {
    const place = places.get(p.id) ?? null;
    if (place !== p.place || p.eliminated !== true) {
      await db.tournamentParticipant.update({
        where: { id: p.id },
        data: { place, eliminated: place ? place > 1 : true },
      });
    }
  }
  await db.tournament.update({
    where: { id: tournament.id },
    data: { status: "COMPLETED", championName },
  });

  return NextResponse.json({ ok: true, championName });
}
