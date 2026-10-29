import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Изменение VR-игры
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
      const name = String(body.name).trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
      data.name = name;
    }
    if (body.number !== undefined) {
      data.number = Math.max(0, Math.min(9999, Math.round(Number(body.number) || 0)));
    }
    if (body.description !== undefined) {
      data.description = String(body.description).trim().slice(0, 300);
    }
    if (body.durationMinutes !== undefined) {
      const duration = Math.round(Number(body.durationMinutes));
      if (isNaN(duration) || duration < 1 || duration > 24 * 60) {
        return NextResponse.json({ error: "Длительность — от 1 до 1440 минут" }, { status: 400 });
      }
      data.durationMinutes = duration;
    }
    if (body.minAge !== undefined) {
      const age = Math.round(Number(body.minAge) || 0);
      if (isNaN(age) || age < 0 || age > 21) {
        return NextResponse.json({ error: "Возраст — от 0 до 21" }, { status: 400 });
      }
      data.minAge = age;
    }
    if (body.price !== undefined) {
      const gamePrice = Math.round(Number(body.price));
      if (isNaN(gamePrice) || gamePrice < 0) {
        return NextResponse.json({ error: "Цена должна быть неотрицательной" }, { status: 400 });
      }
      data.price = gamePrice;
    }
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);

    const game = await db.vrGame.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление VR-игры (если использовалась в сеансах — отключается)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const used = await db.session.count({ where: { vrGameId: Number(id) } });
    if (used > 0) {
      await db.vrGame.update({
        where: { id: Number(id) },
        data: { active: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Игра есть в истории сеансов — она отключена вместо удаления",
      });
    }
    await db.vrGame.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
