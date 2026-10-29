import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// История сеансов: ?from=YYYY-MM-DD&to=YYYY-MM-DD (по умолчанию — сегодня)
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromDate = from ? new Date(`${from}T00:00:00`) : new Date();
    if (!from) fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(`${to}T23:59:59.999`) : new Date();
    if (!to) toDate.setHours(23, 59, 59, 999);

    const sessions = await db.session.findMany({
      where: {
        startedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { startedAt: "desc" },
      include: {
        device: true,
        createdBy: { select: { name: true } },
        completedBy: { select: { name: true } },
      },
      take: 500,
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

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        deviceType: s.device.type,
        deviceNumber: s.device.number,
        packageName: s.packageName,
        durationMinutes: s.durationMinutes,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        plannedEndAt: s.plannedEndAt.toISOString(),
        price: s.price,
        originalPrice: s.originalPrice,
        discountLabel: s.discountLabel,
        paymentMethod: s.paymentMethod,
        cashAmount: s.cashAmount,
        kaspiAmount: s.kaspiAmount,
        createdByName: s.createdBy.name,
        completedByName: s.completedBy?.name ?? null,
      })),
      totals,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
