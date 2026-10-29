import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Изменить игру каталога турниров
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: "Название пустое" }, { status: 400 });
      data.name = name;
    }
    if (body.genre !== undefined) {
      data.genre = String(body.genre).trim().slice(0, 40);
    }
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);

    const game = await db.tournamentGame.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление: если игра использовалась в турнирах — деактивация
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const used = await db.tournament.count({ where: { gameId: Number(id) } });
    if (used > 0) {
      await db.tournamentGame.update({
        where: { id: Number(id) },
        data: { active: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Игра есть в турнирах — она отключена вместо удаления",
      });
    }
    await db.tournamentGame.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
