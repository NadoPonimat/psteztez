import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdmin,
  setSetting,
  getSetting,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const clubName = await getSetting("club_name", "PlayZone CRM");
  return NextResponse.json({ clubName });
}

// Обновление настроек:
//  - { clubName } — название клуба
//  - { completionPassword } — пароль завершения сеанса
//  - { currentPassword, newPassword } — смена пароля собственного (главного) аккаунта
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  try {
    const body = await req.json();

    if (body.clubName !== undefined) {
      const name = String(body.clubName).trim();
      if (!name) {
        return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
      }
      await setSetting("club_name", name);
      return NextResponse.json({ ok: true, message: "Название клуба обновлено" });
    }

    if (body.completionPassword !== undefined) {
      const pwd = String(body.completionPassword).trim();
      if (pwd.length < 3) {
        return NextResponse.json(
          { error: "Пароль завершения — минимум 3 символа" },
          { status: 400 }
        );
      }
      await setSetting("completion_password", hashPassword(pwd));
      return NextResponse.json({ ok: true, message: "Пароль завершения обновлён" });
    }

    if (body.currentPassword !== undefined && body.newPassword !== undefined) {
      const dbUser = await db.user.findUnique({ where: { id: admin.id } });
      if (!dbUser || !verifyPassword(String(body.currentPassword), dbUser.passwordHash)) {
        return NextResponse.json(
          { error: "Текущий пароль неверен" },
          { status: 403 }
        );
      }
      if (String(body.newPassword).length < 3) {
        return NextResponse.json(
          { error: "Новый пароль минимум 3 символа" },
          { status: 400 }
        );
      }
      await db.user.update({
        where: { id: admin.id },
        data: { passwordHash: hashPassword(String(body.newPassword)) },
      });
      return NextResponse.json({ ok: true, message: "Пароль аккаунта изменён" });
    }

    return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
