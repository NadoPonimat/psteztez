import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
// График смен за период — доступен всем авторизованным (просмотр)
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to) || from > to) {
      return NextResponse.json({ error: "Нужны корректные from и to" }, { status: 400 });
    }

    const [shifts, employees] = await Promise.all([
      db.shift.findMany({
        where: { day: { gte: from, lte: to } },
        orderBy: [{ day: "asc" }, { slot: "asc" }],
        include: { user: { select: { name: true } } },
      }),
      db.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, role: true, active: true },
      }),
    ]);

    return NextResponse.json({
      from,
      to,
      shifts: shifts.map((s) => ({
        id: s.id,
        day: s.day,
        slot: s.slot,
        isFullDay: s.isFullDay,
        userId: s.userId,
        userName: s.user?.name ?? null,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
      employees,
    });
  } catch (e) {
    console.error("GET /api/schedule error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
