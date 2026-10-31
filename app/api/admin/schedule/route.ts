import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// График работы за месяц: GET /api/admin/schedule?month=YYYY-MM
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Укажите месяц YYYY-MM" }, { status: 400 });
    }
    const workDays = await db.workDay.findMany({
      where: { day: { startsWith: month } },
      select: { userId: true, day: true },
    });
    return NextResponse.json({ workDays });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Отметить/снять рабочий день: POST { userId, day }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { userId, day } = await req.json();
    if (!userId || !day || !DAY_RE.test(day)) {
      return NextResponse.json({ error: "Нужны userId и день YYYY-MM-DD" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }
    const existing = await db.workDay.findUnique({
      where: { userId_day: { userId, day } },
    });
    if (existing) {
      await db.workDay.delete({ where: { id: existing.id } });
      return NextResponse.json({ marked: false });
    }
    await db.workDay.create({ data: { userId, day } });
    return NextResponse.json({ marked: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
