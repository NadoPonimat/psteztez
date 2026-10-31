import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

// Список сотрудников
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      phone: true,
      dailyRate: true,
      bonusPercent: true,
      bonusThreshold: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

// Создание сотрудника
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { username, name, password, role, phone } = await req.json();
    if (!username || !name || !password) {
      return NextResponse.json(
        { error: "Укажите логин, имя и пароль" },
        { status: 400 }
      );
    }
    if (String(password).length < 3) {
      return NextResponse.json(
        { error: "Пароль минимум 3 символа" },
        { status: 400 }
      );
    }
    const exists = await db.user.findUnique({
      where: { username: String(username).trim() },
    });
    if (exists) {
      return NextResponse.json({ error: "Логин уже занят" }, { status: 409 });
    }
    const user = await db.user.create({
      data: {
        username: String(username).trim(),
        name: String(name).trim(),
        passwordHash: hashPassword(String(password)),
        role: role === "ADMIN" ? "ADMIN" : "STAFF",
        phone:
          typeof phone === "string" && phone.trim() ? phone.trim().slice(0, 30) : null,
      },
      select: { id: true, username: true, name: true, role: true, active: true, phone: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
