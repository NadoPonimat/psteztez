import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Удаление сеанса (только главный аккаунт). Применяется для ошибочных
// операций: сеанс и связанная проводка кассы удаляются, касса наличных
// и касса Каспи автоматически уменьшаются (баланс = сумма всех проводок).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "Неверный идентификатор" }, { status: 400 });
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { device: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Сеанс не найден" }, { status: 404 });
    }

    const refundedCash = session.cashAmount;
    const refundedKaspi = session.kaspiAmount;

    await db.$transaction(async (tx) => {
      // Проводка кассы удаляется — баланс кассы пересчитывается сам
      await tx.cashEntry.deleteMany({ where: { sessionId } });
      await tx.session.delete({ where: { id: sessionId } });
    });

    const label = `${session.device.type === "VR" ? "VR" : "PS"} ${session.device.number}`;
    return NextResponse.json({
      ok: true,
      message: `Сеанс ${label} удалён. Касса уменьшена на ${refundedCash.toLocaleString("ru-RU")} ₸ наличных и ${refundedKaspi.toLocaleString("ru-RU")} ₸ Каспи`,
    });
  } catch (e) {
    console.error("DELETE /api/sessions/[id] error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
