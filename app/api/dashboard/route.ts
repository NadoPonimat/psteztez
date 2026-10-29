import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const [devices, packages, promos, customers, vrGames, clubName] = await Promise.all([
    db.device.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { number: "asc" }],
      include: {
        sessions: {
          where: { status: "ACTIVE" },
          include: { createdBy: { select: { name: true } } },
          take: 1,
        },
      },
    }),
    db.package.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    db.promo.findMany({ where: { active: true } }),
    db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.vrGame.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    (async () => {
      const row = await db.setting.findUnique({ where: { key: "club_name" } });
      return row?.value ?? "PlayZone CRM";
    })(),
  ]);

  let adminStats: {
    todayRevenue: number;
    todayCash: number;
    todayKaspi: number;
    todaySessions: number;
  } | null = null;

  if (user.role === "ADMIN") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    // Деньги берутся в момент «Принять оплату и запустить таймер», поэтому
    // в выручке дня учитываем ВСЕ сеансы, запущенные сегодня (в том числе
    // ещё идущие) — без фильтра по статусу. Удалённый сеанс исчезает отсюда сам.
    const agg = await db.session.aggregate({
      where: { startedAt: { gte: startOfDay } },
      _sum: { price: true, cashAmount: true, kaspiAmount: true },
      _count: true,
    });
    adminStats = {
      todayRevenue: agg._sum.price ?? 0,
      todayCash: agg._sum.cashAmount ?? 0,
      todayKaspi: agg._sum.kaspiAmount ?? 0,
      todaySessions: agg._count ?? 0,
    };
  }

  return NextResponse.json({
    serverNow: new Date().toISOString(),
    clubName,
    devices: devices.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      activeSession: d.sessions[0]
        ? {
            id: d.sessions[0].id,
            packageName: d.sessions[0].packageName,
            durationMinutes: d.sessions[0].durationMinutes,
            startedAt: d.sessions[0].startedAt.toISOString(),
            plannedEndAt: d.sessions[0].plannedEndAt.toISOString(),
            price: d.sessions[0].price,
            paymentMethod: d.sessions[0].paymentMethod,
            cashAmount: d.sessions[0].cashAmount,
            kaspiAmount: d.sessions[0].kaspiAmount,
            notified: d.sessions[0].notified,
            createdByName: d.sessions[0].createdBy.name,
          }
        : null,
    })),
    packages,
    promos,
    customers,
    vrGames,
    adminStats,
    user,
  });
}
