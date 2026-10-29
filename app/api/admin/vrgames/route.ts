import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Список всех VR-игр (включая неактивные)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const games = await db.vrGame.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ games });
}

// Создание VR-игры
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { name, durationMinutes, minAge, price, active, sortOrder, number, description } =
      await req.json();

    const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    if (!cleanName) {
      return NextResponse.json({ error: "Укажите название игры" }, { status: 400 });
    }
    const gameNumber = Math.max(0, Math.min(9999, Math.round(Number(number) || 0)));
    const cleanDescription =
      typeof description === "string" ? description.trim().slice(0, 300) : "";
    const duration = Math.round(Number(durationMinutes));
    if (isNaN(duration) || duration < 1 || duration > 24 * 60) {
      return NextResponse.json(
        { error: "Длительность — от 1 до 1440 минут" },
        { status: 400 }
      );
    }
    const age = Math.round(Number(minAge) || 0);
    if (isNaN(age) || age < 0 || age > 21) {
      return NextResponse.json({ error: "Возраст — от 0 (без ограничения) до 21" }, { status: 400 });
    }
    const gamePrice = Math.round(Number(price));
    if (isNaN(gamePrice) || gamePrice < 0) {
      return NextResponse.json({ error: "Цена должна быть неотрицательной" }, { status: 400 });
    }

    const game = await db.vrGame.create({
      data: {
        name: cleanName,
        number: gameNumber,
        description: cleanDescription,
        durationMinutes: duration,
        minAge: age,
        price: gamePrice,
        active: active ?? true,
        sortOrder: Math.round(Number(sortOrder) || 0),
      },
    });
    return NextResponse.json({ game });
  } catch (e) {
    console.error("POST /api/admin/vrgames error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
