import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Контакты клуба для кнопки «Связаться» (доступно всем ролям):
// главный аккаунт + активные сотрудники с телефонами.
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: [{ role: "desc" }, { name: "asc" }], // ADMIN первыми
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
    },
  });

  return NextResponse.json({ contacts: users });
}
