import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Игры, которые обычно проводят на официальных турнирах PlayStation-клубов
const DEFAULT_GAMES: { name: string; genre: string }[] = [
  { name: "Mortal Kombat 1", genre: "Драки 1×1" },
  { name: "Mortal Kombat 11", genre: "Драки 1×1" },
  { name: "Tekken 8", genre: "Драки 1×1" },
  { name: "Street Fighter 6", genre: "Драки 1×1" },
  { name: "UFC 5", genre: "Драки 1×1" },
  { name: "EA SPORTS FC 25", genre: "Футбол" },
  { name: "EA SPORTS FC 26", genre: "Футбол" },
  { name: "eFootball 2025", genre: "Футбол" },
  { name: "NBA 2K25", genre: "Баскетбол" },
  { name: "Gran Turismo 7", genre: "Гонки" },
  { name: "Rocket League", genre: "Футбол на машинах" },
  { name: "Call of Duty: Black Ops 6", genre: "Шутер" },
];

// Каталог игр для турниров (главный аккаунт)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const games = await db.tournamentGame.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { tournaments: true } } },
  });
  return NextResponse.json({
    games: games.map((g) => ({
      id: g.id,
      name: g.name,
      genre: g.genre,
      active: g.active,
      sortOrder: g.sortOrder,
      tournamentsCount: g._count.tournaments,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // Массовое добавление стандартного набора (кнопка «Добавить популярные»)
    if (body.seedDefaults) {
      const existing = await db.tournamentGame.findMany({ select: { name: true } });
      const have = new Set(existing.map((g) => g.name.toLowerCase()));
      const missing = DEFAULT_GAMES.filter((g) => !have.has(g.name.toLowerCase()));
      if (missing.length === 0)
        return NextResponse.json({ ok: true, added: 0, message: "Все популярные игры уже есть" });
      await db.tournamentGame.createMany({
        data: missing.map((g, i) => ({ ...g, sortOrder: 100 + i })),
      });
      return NextResponse.json({ ok: true, added: missing.length });
    }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!name) return NextResponse.json({ error: "Укажите название игры" }, { status: 400 });
    const genre =
      typeof body.genre === "string" && body.genre.trim() ? body.genre.trim().slice(0, 40) : "";

    const game = await db.tournamentGame.create({
      data: { name, genre, sortOrder: Math.round(Number(body.sortOrder) || 0) },
    });
    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
