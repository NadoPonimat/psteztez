import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Изменение устройства
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { number, active } = await req.json();
    const data: Record<string, unknown> = {};
    if (number !== undefined) data.number = Math.max(1, Math.round(Number(number)));
    if (active !== undefined) data.active = Boolean(active);
    const device = await db.device.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ device });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление устройства (если нет сеансов в истории)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const deviceId = Number(id);
    const activeSession = await db.session.findFirst({
      where: { deviceId, status: "ACTIVE" },
    });
    if (activeSession) {
      return NextResponse.json(
        { error: "На устройстве идёт сеанс — сначала завершите его" },
        { status: 409 }
      );
    }
    const usedCount = await db.session.count({ where: { deviceId } });
    if (usedCount > 0) {
      await db.device.update({ where: { id: deviceId }, data: { active: false } });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Устройство есть в истории — оно скрыто вместо удаления",
      });
    }
    await db.device.delete({ where: { id: deviceId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
