import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_RE = /^(\d)(,\d)*$/;

function validateDays(days: string): boolean {
  if (!DAYS_RE.test(days)) return false;
  const arr = days.split(",").map(Number);
  return arr.every((d) => d >= 0 && d <= 6);
}

// Изменение акции
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
      if (!name) return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
      data.name = name;
    }
    if (body.discountType !== undefined) {
      if (body.discountType !== "PERCENT" && body.discountType !== "FIXED") {
        return NextResponse.json({ error: "Неверный тип скидки" }, { status: 400 });
      }
      data.discountType = body.discountType;
    }
    if (body.discountValue !== undefined) {
      const value = Math.round(Number(body.discountValue));
      if (isNaN(value) || value <= 0) {
        return NextResponse.json({ error: "Некорректное значение скидки" }, { status: 400 });
      }
      if (body.discountType === "PERCENT" && value > 100) {
        return NextResponse.json({ error: "Процент скидки — от 1 до 100" }, { status: 400 });
      }
      data.discountValue = value;
    }
    if (body.timeFrom !== undefined) {
      if (!TIME_RE.test(body.timeFrom)) {
        return NextResponse.json({ error: "Время «с» — в формате ЧЧ:ММ" }, { status: 400 });
      }
      data.timeFrom = body.timeFrom;
    }
    if (body.timeTo !== undefined) {
      if (!TIME_RE.test(body.timeTo)) {
        return NextResponse.json({ error: "Время «до» — в формате ЧЧ:ММ" }, { status: 400 });
      }
      data.timeTo = body.timeTo;
    }
    if (body.days !== undefined) {
      const daysStr = String(body.days);
      if (!validateDays(daysStr)) {
        return NextResponse.json({ error: "Неверный список дней недели" }, { status: 400 });
      }
      data.days = daysStr;
    }
    if (body.deviceType !== undefined) {
      if (body.deviceType != null && body.deviceType !== "PLAYSTATION" && body.deviceType !== "VR") {
        return NextResponse.json({ error: "Неверный тип устройств" }, { status: 400 });
      }
      data.deviceType = body.deviceType || null;
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const promo = await db.promo.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ promo });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление акции
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await db.promo.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
