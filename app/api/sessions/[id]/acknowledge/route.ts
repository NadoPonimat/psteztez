import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Подтверждение уведомления «время вышло» — глушит сирену на всех устройствах
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const sessionId = Number(id);
    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ ok: true });
    }
    await db.session.update({
      where: { id: sessionId },
      data: { notified: true },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
