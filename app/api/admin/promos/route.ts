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

// Список всех акций (включая неактивные)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const promos = await db.promo.findMany({ orderBy: { id: "desc" } });
  return NextResponse.json({ promos });
}

// Создание акции
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { name, discountType, discountValue, timeFrom, timeTo, days, deviceType, active } =
      await req.json();

    const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    if (!cleanName) {
      return NextResponse.json({ error: "Укажите название акции" }, { status: 400 });
    }
    if (discountType !== "PERCENT" && discountType !== "FIXED") {
      return NextResponse.json(
        { error: "Тип скидки: процент или фиксированная сумма" },
        { status: 400 }
      );
    }
    const value = Math.round(Number(discountValue));
    if (isNaN(value) || value <= 0 || (discountType === "PERCENT" && value > 100)) {
      return NextResponse.json(
        { error: "Скидка: процент 1–100 или положительная сумма в тенге" },
        { status: 400 }
      );
    }
    if (!TIME_RE.test(timeFrom ?? "") || !TIME_RE.test(timeTo ?? "")) {
      return NextResponse.json(
        { error: "Укажите время действия в формате ЧЧ:ММ" },
        { status: 400 }
      );
    }
    const daysStr = typeof days === "string" ? days : "";
    if (!daysStr || !validateDays(daysStr)) {
      return NextResponse.json({ error: "Выберите хотя бы один день недели" }, { status: 400 });
    }
    if (deviceType != null && deviceType !== "PLAYSTATION" && deviceType !== "VR") {
      return NextResponse.json({ error: "Неверный тип устройств" }, { status: 400 });
    }

    const promo = await db.promo.create({
      data: {
        name: cleanName,
        discountType,
        discountValue: value,
        timeFrom,
        timeTo,
        days: daysStr,
        deviceType: deviceType || null,
        active: active ?? true,
      },
    });
    return NextResponse.json({ promo });
  } catch (e) {
    console.error("POST /api/admin/promos error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
