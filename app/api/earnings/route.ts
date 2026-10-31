import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Расчёт заработка за месяц.
// Админ видит всех сотрудников, сотрудник — только себя.
// Заработок = ставка × рабочие дни + Σ(% от кассы за день, если касса ≥ порога)
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Укажите месяц YYYY-MM" }, { status: 400 });
    }

    const users = await db.user.findMany({
      where: user.role === "ADMIN" ? { active: true } : { id: user.id },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    const result = await Promise.all(
      users.map(async (u) => {
        const workDays = await db.workDay.findMany({
          where: { userId: u.id, day: { startsWith: month } },
          orderBy: { day: "asc" },
          select: { day: true },
        });
        const days = workDays.map((w) => w.day);

        // Выручка кассы по каждому рабочему дню
        const dayRevenues: { day: string; revenue: number }[] = await Promise.all(
          days.map(async (day) => {
            const start = new Date(`${day}T00:00:00`);
            const end = new Date(`${day}T23:59:59.999`);
            const agg = await db.session.aggregate({
              where: {
                // Выручка дня = все сеансы, запущенные в этот день (оплата
                // берётся при старте таймера), включая ещё идущие
                startedAt: { gte: start, lte: end },
              },
              _sum: { price: true },
            });
            return { day, revenue: agg._sum.price ?? 0 };
          })
        );

        const rateEarned = (u.dailyRate ?? 0) * days.length;
        const bonusEarned = dayRevenues
          .filter(
            (d) =>
              (u.bonusThreshold ?? 0) > 0 &&
              d.revenue >= (u.bonusThreshold ?? 0) &&
              (u.bonusPercent ?? 0) > 0
          )
          .reduce((sum, d) => sum + (d.revenue * (u.bonusPercent ?? 0)) / 100, 0);

        return {
          userId: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
          dailyRate: u.dailyRate,
          bonusPercent: u.bonusPercent,
          bonusThreshold: u.bonusThreshold,
          workDays: days,
          dayRevenues,
          rateEarned: Math.round(rateEarned),
          bonusEarned: Math.round(bonusEarned),
          totalEarned: Math.round(rateEarned + bonusEarned),
        };
      })
    );

    return NextResponse.json({ month, employees: result });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
