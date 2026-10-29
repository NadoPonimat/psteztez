import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Список всех пакетов (включая неактивные)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const packages = await db.package.findMany({
    orderBy: [{ deviceType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ packages });
}

// Создание пакета
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { name, durationMinutes, price, deviceType, sortOrder } = await req.json();
    if (!name || !durationMinutes || !price) {
      return NextResponse.json(
        { error: "Укажите название, длительность и цену" },
        { status: 400 }
      );
    }
    if (durationMinutes < 1 || price < 0) {
      return NextResponse.json({ error: "Некорректные значения" }, { status: 400 });
    }
    const pkg = await db.package.create({
      data: {
        name: String(name).trim(),
        durationMinutes: Math.round(durationMinutes),
        price: Math.round(price),
        deviceType: deviceType || null,
        sortOrder: sortOrder ?? 0,
      },
    });
    return NextResponse.json({ package: pkg });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
