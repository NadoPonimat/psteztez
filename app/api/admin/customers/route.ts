import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Список всех постоянных клиентов (включая неактивных)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const customers = await db.customer.findMany({ orderBy: { id: "desc" } });
  return NextResponse.json({ customers });
}

// Создание постоянного клиента
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { name, phone, discountPercent, note, active } = await req.json();

    const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    if (!cleanName) {
      return NextResponse.json({ error: "Укажите имя клиента" }, { status: 400 });
    }
    const discount = Number(discountPercent) || 0;
    if (discount < 0 || discount > 100) {
      return NextResponse.json({ error: "Скидка — от 0 до 100%" }, { status: 400 });
    }
    const phoneStr =
      typeof phone === "string" && phone.trim() ? phone.trim().slice(0, 30) : null;

    const customer = await db.customer.create({
      data: {
        name: cleanName,
        phone: phoneStr,
        discountPercent: discount,
        note: typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null,
        active: active ?? true,
      },
    });
    return NextResponse.json({ customer });
  } catch (e) {
    console.error("POST /api/admin/customers error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
