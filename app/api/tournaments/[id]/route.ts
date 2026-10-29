import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { roundLabel } from "@/lib/tournament";

// Детали турнира: участники + сетка/матчи
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tournament = await db.tournament.findUnique({
    where: { id: Number(id) },
    include: {
      game: true,
      participants: { orderBy: [{ createdAt: "asc" }] },
      matches: { orderBy: [{ round: "asc" }, { matchIndex: "asc" }] },
      createdBy: { select: { name: true } },
    },
  });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });

  const upperRounds = Math.max(
    1,
    ...tournament.matches.filter((m) => m.bracket === "UPPER").map((m) => m.round)
  );

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      game: tournament.game,
      format: tournament.format,
      bestOf: tournament.bestOf,
      entryFee: tournament.entryFee,
      prizeFund: tournament.prizeFund,
      prizeSplit: tournament.prizeSplit,
      thirdPlace: tournament.thirdPlace,
      maxParticipants: tournament.maxParticipants,
      status: tournament.status,
      startsAt: tournament.startsAt?.toISOString() ?? null,
      championName: tournament.championName,
      createdByName: tournament.createdBy.name,
      createdAt: tournament.createdAt.toISOString(),
    },
    participants: tournament.participants,
    matches: tournament.matches.map((m) => ({
      ...m,
      roundLabel: roundLabel(m.bracket, m.round, upperRounds),
    })),
  });
}

// Изменение турнира: название/время — в регистрации; фонд — до завершения
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tournament = await db.tournament.findUnique({ where: { id: Number(id) } });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 120);
      if (!name) return NextResponse.json({ error: "Название пустое" }, { status: 400 });
      data.name = name;
    }
    if (body.startsAt !== undefined) {
      if (body.startsAt === null || body.startsAt === "") data.startsAt = null;
      else {
        const d = new Date(String(body.startsAt));
        if (!isNaN(d.getTime())) data.startsAt = d;
      }
    }
    if (body.prizeFund !== undefined) {
      if (tournament.status === "COMPLETED")
        return NextResponse.json(
          { error: "Турнир завершён — фонд изменить нельзя" },
          { status: 400 }
        );
      data.prizeFund = Math.max(0, Math.round(Number(body.prizeFund) || 0));
    }
    if (body.prizeSplit !== undefined && tournament.status === "REGISTRATION") {
      const parts = String(body.prizeSplit)
        .split(",")
        .map((s) => Math.max(0, Math.min(100, Number(s.trim()) || 0)))
        .filter((v) => v > 0);
      if (parts.length > 0) data.prizeSplit = parts.join(",");
    }
    if (body.maxParticipants !== undefined && tournament.status === "REGISTRATION") {
      const max = Math.min(64, Math.max(2, Math.round(Number(body.maxParticipants) || 16)));
      const count = await db.tournamentParticipant.count({ where: { tournamentId: tournament.id } });
      if (max < count)
        return NextResponse.json(
          { error: `Уже зарегистрировано ${count} участников` },
          { status: 400 }
        );
      data.maxParticipants = max;
    }

    const updated = await db.tournament.update({ where: { id: tournament.id }, data });
    return NextResponse.json({ tournament: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление турнира — только главный аккаунт
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await db.tournament.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  }
}
