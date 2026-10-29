import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Список турниров (все роли): активные сверху, затем по дате создания
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const tournaments = await db.tournament.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      game: { select: { name: true, genre: true } },
      _count: { select: { participants: true, matches: true } },
    },
  });

  const rank = (s: string) => (s === "ONGOING" ? 0 : s === "REGISTRATION" ? 1 : 2);
  const sorted = [...tournaments].sort((a, b) => rank(a.status) - rank(b.status));

  return NextResponse.json({
    tournaments: sorted.map((t) => ({
      id: t.id,
      name: t.name,
      game: t.game,
      format: t.format,
      bestOf: t.bestOf,
      entryFee: t.entryFee,
      prizeFund: t.prizeFund,
      prizeSplit: t.prizeSplit,
      status: t.status,
      maxParticipants: t.maxParticipants,
      participantsCount: t._count.participants,
      matchesCount: t._count.matches,
      championName: t.championName,
      startsAt: t.startsAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

// Создание турнира (все роли — проведение турнира это работа смены)
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Укажите название турнира" }, { status: 400 });

    const gameId = Math.round(Number(body.gameId));
    if (!gameId) return NextResponse.json({ error: "Выберите игру" }, { status: 400 });
    const game = await db.tournamentGame.findUnique({ where: { id: gameId } });
    if (!game || !game.active)
      return NextResponse.json({ error: "Игра не найдена в каталоге" }, { status: 400 });

    const format = String(body.format ?? "");
    if (!["SINGLE_ELIM", "DOUBLE_ELIM", "ROUND_ROBIN"].includes(format))
      return NextResponse.json({ error: "Неизвестный формат" }, { status: 400 });

    const bestOfRaw = Math.round(Number(body.bestOf) || 1);
    const bestOf = [1, 3, 5].includes(bestOfRaw) ? bestOfRaw : 1;
    if (format === "ROUND_ROBIN" && bestOf > 1) {
      return NextResponse.json(
        { error: "В круговой системе матчи Bo1 (счёт = голы/раунды)" },
        { status: 400 }
      );
    }

    const entryFee = Math.max(0, Math.round(Number(body.entryFee) || 0));
    const prizeFund = Math.max(0, Math.round(Number(body.prizeFund) || 0));
    const maxParticipants = Math.min(
      64,
      Math.max(2, Math.round(Number(body.maxParticipants) || 16))
    );
    const thirdPlace = format === "SINGLE_ELIM" && Boolean(body.thirdPlace);

    // Призовые проценты: строка вида "60,30,10"
    let prizeSplit = "60,30,10";
    if (typeof body.prizeSplit === "string") {
      const parts = body.prizeSplit
        .split(",")
        .map((s: string) => Math.max(0, Math.min(100, Number(s.trim()) || 0)))
        .filter((v: number) => v > 0);
      if (parts.length > 0) prizeSplit = parts.join(",");
    }

    let startsAt: Date | null = null;
    if (body.startsAt) {
      const d = new Date(String(body.startsAt));
      if (!isNaN(d.getTime())) startsAt = d;
    }

    const tournament = await db.tournament.create({
      data: {
        name,
        gameId,
        format,
        bestOf,
        entryFee,
        prizeFund,
        prizeSplit,
        thirdPlace,
        maxParticipants,
        startsAt,
        createdById: user.id,
      },
    });
    return NextResponse.json({ tournament });
  } catch (e) {
    console.error("POST /api/tournaments error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
