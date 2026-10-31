import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Добавить участника (в стадии регистрации)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tournament = await db.tournament.findUnique({ where: { id: Number(id) } });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  if (tournament.status !== "REGISTRATION")
    return NextResponse.json(
      { error: "Регистрация закрыта — сетка уже построена" },
      { status: 400 }
    );

  const count = await db.tournamentParticipant.count({ where: { tournamentId: tournament.id } });
  if (count >= tournament.maxParticipants)
    return NextResponse.json(
      { error: `Достигнут лимит — ${tournament.maxParticipants} участников` },
      { status: 400 }
    );

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (!name) return NextResponse.json({ error: "Укажите имя или ник игрока" }, { status: 400 });
    const phone =
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim().slice(0, 30)
        : null;

    const participant = await db.tournamentParticipant.create({
      data: { tournamentId: tournament.id, name, phone },
    });
    return NextResponse.json({ participant });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
