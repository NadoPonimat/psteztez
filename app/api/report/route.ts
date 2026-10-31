import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getSetting } from "@/lib/auth";
import type { CashEntryKind } from "@/lib/crm-types";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Отчёты: за день (?type=day&date=YYYY-MM-DD) или за период (?type=period&from=&to=)
// Сотрудник смены — только отчёт за сегодняшний день. Главный — все отчёты.
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "period" ? "period" : "day";
    const today = localDayStr(new Date());

    let from: string;
    let to: string;

    if (type === "day") {
      from = searchParams.get("date") ?? today;
      to = from;
    } else {
      from = searchParams.get("from") ?? today;
      to = searchParams.get("to") ?? today;
    }

    if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
      return NextResponse.json({ error: "Неверный формат даты" }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json(
        { error: "Дата начала позже даты окончания" },
        { status: 400 }
      );
    }

    // Права: сотрудник — только сегодняшний день
    if (user.role !== "ADMIN") {
      if (type === "period" || from !== today || to !== today) {
        return NextResponse.json(
          { error: "Сотрудник может смотреть отчёт только за сегодняшний день" },
          { status: 403 }
        );
      }
    }

    const startDate = new Date(`${from}T00:00:00`);
    const endDate = new Date(`${to}T23:59:59.999`);

    const sessions = await db.session.findMany({
      where: {
        startedAt: { gte: startDate, lte: endDate },
        // Оплата принимается при запуске таймера, поэтому в отчёт попадают
        // и ещё идущие сеансы (статус не фильтруем). Удалённые — исчезают.
      },
      orderBy: { startedAt: "asc" },
      include: {
        device: true,
        createdBy: { select: { name: true } },
      },
    });

    const totals = sessions.reduce(
      (acc, s) => {
        acc.revenue += s.price;
        acc.cash += s.cashAmount;
        acc.kaspi += s.kaspiAmount;
        acc.count += 1;
        return acc;
      },
      { revenue: 0, cash: 0, kaspi: 0, count: 0 }
    );

    // Разбивка по типам устройств
    const byType = { PLAYSTATION: { revenue: 0, count: 0 }, VR: { revenue: 0, count: 0 } };
    for (const s of sessions) {
      const key = s.device.type === "VR" ? "VR" : "PLAYSTATION";
      byType[key].revenue += s.price;
      byType[key].count += 1;
    }

    // Разбивка по дням
    const dayMap = new Map<string, { revenue: number; cash: number; kaspi: number; count: number }>();
    for (const s of sessions) {
      const day = localDayStr(s.startedAt);
      const cur = dayMap.get(day) ?? { revenue: 0, cash: 0, kaspi: 0, count: 0 };
      cur.revenue += s.price;
      cur.cash += s.cashAmount;
      cur.kaspi += s.kaspiAmount;
      cur.count += 1;
      dayMap.set(day, cur);
    }
    const byDay = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));

    const clubName = await getSetting("club_name", "PlayZone CRM");

    // Расходы за период (все, включая оплаченные из своего кармана)
    const expensesRaw = await db.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    });
    const expenses = expensesRaw.map((e) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      source: e.source as "CASH" | "POCKET",
      note: e.note,
      userName: e.user.name,
      createdAt: e.createdAt.toISOString(),
    }));
    const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);
    const expensesCashTotal = expenses
      .filter((e) => e.source === "CASH")
      .reduce((a, e) => a + e.amount, 0);

    // Движение кассы за период: открытия, приход от оплат (записи SALE создаются
    // при старте сеанса), авансы; остаток на конец периода — накопительный итог
    const cashEntriesRaw = await db.cashEntry.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, kind: { not: "SALE" } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    });
    const closingAgg = await db.cashEntry.aggregate({
      where: { createdAt: { lte: endDate } },
      _sum: { cashPart: true, kaspiPart: true },
    });

    const cash = {
      openingCash: 0,
      openingKaspi: 0,
      salesCash: totals.cash,
      salesKaspi: totals.kaspi,
      advancesCash: 0,
      advancesKaspi: 0,
      expensesCash: expensesCashTotal,
      closingCash: closingAgg._sum.cashPart ?? 0,
      closingKaspi: closingAgg._sum.kaspiPart ?? 0,
    };
    for (const e of cashEntriesRaw) {
      if (e.kind === "OPENING_CASH") cash.openingCash += e.amount;
      if (e.kind === "OPENING_KASPI") cash.openingKaspi += e.amount;
      if (e.kind === "ADVANCE_CASH") cash.advancesCash += e.amount;
      if (e.kind === "ADVANCE_KASPI") cash.advancesKaspi += e.amount;
    }

    const cashEntries = cashEntriesRaw.map((e) => ({
      id: e.id,
      kind: e.kind as CashEntryKind,
      amount: e.amount,
      cashPart: e.cashPart,
      kaspiPart: e.kaspiPart,
      note: e.note,
      userName: e.user.name,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      type,
      from,
      to,
      clubName,
      generatedAt: new Date().toISOString(),
      generatedByName: user.name,
      generatedByRole: user.role,
      totals: {
        ...totals,
        avgCheck: totals.count > 0 ? Math.round(totals.revenue / totals.count) : 0,
      },
      byType,
      byDay,
      cash,
      cashEntries,
      expenses,
      expensesTotal,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceType: s.device.type,
        deviceNumber: s.device.number,
        packageName: s.packageName,
        durationMinutes: s.durationMinutes,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        price: s.price,
        paymentMethod: s.paymentMethod,
        cashAmount: s.cashAmount,
        kaspiAmount: s.kaspiAmount,
        createdByName: s.createdBy.name,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
