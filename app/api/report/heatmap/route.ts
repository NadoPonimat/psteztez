import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Тепловая карта продаж: выручка по дням недели × часам за период.
// Показывает, когда в клубе чаще всего покупают время.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const days = [7, 30, 90].includes(Number(searchParams.get("days")))
      ? Number(searchParams.get("days"))
      : 30;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const sessions = await db.session.findMany({
      where: { startedAt: { gte: start } },
      select: { startedAt: true, price: true },
    });

    // 0 = Пн .. 6 = Вс (порядок строк карты), часы 0..23
    const map = new Map<string, { revenue: number; count: number }>();
    let totalRevenue = 0;
    for (const s of sessions) {
      const dow = (s.startedAt.getDay() + 6) % 7;
      const hour = s.startedAt.getHours();
      const key = `${dow}-${hour}`;
      const cur = map.get(key) ?? { revenue: 0, count: 0 };
      cur.revenue += s.price;
      cur.count += 1;
      map.set(key, cur);
      totalRevenue += s.price;
    }

    const cells = [...map.entries()].map(([key, v]) => {
      const [dow, hour] = key.split("-").map(Number);
      return { dow, hour, revenue: v.revenue, count: v.count };
    });
    const maxRevenue = cells.reduce((m, c) => Math.max(m, c.revenue), 0);

    return NextResponse.json({
      days,
      maxRevenue,
      totalRevenue,
      totalCount: sessions.length,
      cells,
    });
  } catch (e) {
    console.error("GET /api/report/heatmap error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
