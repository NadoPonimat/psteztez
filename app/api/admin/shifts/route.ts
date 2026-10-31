import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface IncomingShift {
  day: string;
  slot: number; // 1 | 2
  isFullDay: boolean;
  userId: string | null;
  startsAt: string;
  endsAt: string;
}

// PUT /api/admin/shifts
// Сохранение графика смен за диапазон дат (неделя).
// Тело: { from, to, syncWorkDays, shifts: [...] }
// Все смены диапазона заменяются присланными.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const from: string = body?.from;
    const to: string = body?.to;
    const syncWorkDays: boolean = body?.syncWorkDays !== false;
    const incoming: IncomingShift[] = Array.isArray(body?.shifts) ? body.shifts : [];

    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to) || from > to) {
      return NextResponse.json({ error: "Нужны корректные from и to" }, { status: 400 });
    }
    if (incoming.length > 0) {
      const msPerDay = 24 * 60 * 60 * 1000;
      if ((Date.parse(to) - Date.parse(from)) / msPerDay > 31) {
        return NextResponse.json({ error: "Диапазон не больше 31 дня" }, { status: 400 });
      }
    }

    // Валидация смен
    const clean: Required<Pick<IncomingShift, "day" | "slot" | "isFullDay">> & {
      userId: string | null;
      startsAt: string;
      endsAt: string;
    }[] = [];
    for (const s of incoming) {
      if (!s || !DAY_RE.test(s.day ?? "") || s.day < from || s.day > to) {
        return NextResponse.json({ error: `Некорректная дата смены` }, { status: 400 });
      }
      if (s.slot !== 1 && s.slot !== 2) {
        return NextResponse.json({ error: "Смена должна быть 1 или 2" }, { status: 400 });
      }
      if (!TIME_RE.test(s.startsAt ?? "") || !TIME_RE.test(s.endsAt ?? "")) {
        return NextResponse.json(
          { error: `Некорректное время смены (${s.startsAt}–${s.endsAt})` },
          { status: 400 }
        );
      }
      if (s.userId) {
        const u = await db.user.findUnique({ where: { id: s.userId } });
        if (!u || !u.active) {
          return NextResponse.json(
            { error: "Смена назначена неактивному или несуществующему сотруднику" },
            { status: 400 }
          );
        }
      }
      clean.push({
        day: s.day,
        slot: s.slot,
        isFullDay: Boolean(s.isFullDay),
        userId: s.userId || null,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      });
    }

    // Дубликаты slot в один день — ошибка
    const seen = new Set<string>();
    for (const s of clean) {
      const key = `${s.day}#${s.slot}`;
      if (seen.has(key)) {
        return NextResponse.json(
          { error: `Дубликат смены ${s.slot} за ${s.day}` },
          { status: 400 }
        );
      }
      seen.add(key);
    }

    const days = clean.map((s) => s.day);
    const managedUserIds = [...new Set(clean.map((s) => s.userId).filter((v): v is string => !!v))];

    await db.$transaction(async (tx) => {
      // Полная замена смен в диапазоне
      await tx.shift.deleteMany({ where: { day: { gte: from, lte: to } } });
      if (clean.length > 0) {
        await tx.shift.createMany({ data: clean });
      }

      // Синхронизация с рабочими днями (для расчёта зарплаты):
      // у управляемых сотрудников день со сменой = рабочий, без смены — нет.
      if (syncWorkDays && managedUserIds.length > 0) {
        await tx.workDay.deleteMany({
          where: { day: { gte: from, lte: to }, userId: { in: managedUserIds } },
        });
        const pairs = clean
          .filter((s) => s.userId)
          .map((s) => ({ userId: s.userId as string, day: s.day }));
        const uniquePairs = Array.from(
          new Map(pairs.map((p) => [`${p.userId}|${p.day}`, p])).values()
        );
        if (uniquePairs.length > 0) {
          await tx.workDay.createMany({ data: uniquePairs });
        }
      }
    });

    return NextResponse.json({
      message: `График сохранён (${clean.length} смен)`,
      count: clean.length,
    });
  } catch (e) {
    console.error("PUT /api/admin/shifts error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
