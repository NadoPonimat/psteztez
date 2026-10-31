import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Изменение пакета
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { name, durationMinutes, price, deviceType, active, sortOrder } =
      await req.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (durationMinutes !== undefined)
      data.durationMinutes = Math.max(1, Math.round(durationMinutes));
    if (price !== undefined) data.price = Math.max(0, Math.round(price));
    if (deviceType !== undefined) data.deviceType = deviceType || null;
    if (active !== undefined) data.active = Boolean(active);
    if (sortOrder !== undefined) data.sortOrder = Math.round(sortOrder);

    const pkg = await db.package.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ package: pkg });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление пакета (если не использовался в сеансах)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const usedCount = await db.session.count({
      where: { packageId: Number(id) },
    });
    if (usedCount > 0) {
      // Пакет используется в истории — отключаем вместо удаления
      await db.package.update({
        where: { id: Number(id) },
        data: { active: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Пакет используется в истории — он отключён вместо удаления",
      });
    }
    await db.package.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
