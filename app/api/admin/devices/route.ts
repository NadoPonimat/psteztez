import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Список всех устройств (включая скрытые) с активными сеансами
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const devices = await db.device.findMany({
    orderBy: [{ type: "asc" }, { number: "asc" }],
    include: {
      sessions: {
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1,
      },
      _count: { select: { sessions: true } },
    },
  });
  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      active: d.active,
      hasActiveSession: d.sessions.length > 0,
      totalSessions: d._count.sessions,
    })),
  });
}

// Добавление устройства (PlayStation или VR кресло)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { type, number } = await req.json();
    if (type !== "PLAYSTATION" && type !== "VR") {
      return NextResponse.json({ error: "Неверный тип устройства" }, { status: 400 });
    }
    const num = Math.round(Number(number));
    if (!num || num < 1) {
      return NextResponse.json({ error: "Укажите номер устройства" }, { status: 400 });
    }
    const exists = await db.device.findUnique({
      where: { type_number: { type, number: num } },
    });
    if (exists) {
      return NextResponse.json(
        { error: `Устройство с номером ${num} уже существует` },
        { status: 409 }
      );
    }
    const device = await db.device.create({ data: { type, number: num } });
    return NextResponse.json({ device });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
