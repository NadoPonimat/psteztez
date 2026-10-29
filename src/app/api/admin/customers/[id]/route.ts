import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Изменение постоянного клиента
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "Имя не может быть пустым" }, { status: 400 });
      data.name = name;
    }
    if (body.phone !== undefined) {
      data.phone =
        body.phone && String(body.phone).trim() ? String(body.phone).trim().slice(0, 30) : null;
    }
    if (body.discountPercent !== undefined) {
      const discount = Number(body.discountPercent) || 0;
      if (discount < 0 || discount > 100) {
        return NextResponse.json({ error: "Скидка — от 0 до 100%" }, { status: 400 });
      }
      data.discountPercent = discount;
    }
    if (body.note !== undefined) {
      data.note =
        body.note && String(body.note).trim() ? String(body.note).trim().slice(0, 200) : null;
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const customer = await db.customer.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление клиента (если использовался в сеансах — отключается)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const used = await db.session.count({ where: { customerId: Number(id) } });
    if (used > 0) {
      await db.customer.update({
        where: { id: Number(id) },
        data: { active: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Клиент есть в истории сеансов — он отключён вместо удаления",
      });
    }
    await db.customer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
