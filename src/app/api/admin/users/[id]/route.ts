import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

// Изменение сотрудника (имя, пароль, активность, роль)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  try {
    const { id } = await params;
    const userId = String(id);
    const { name, password, active, role, phone, dailyRate, bonusPercent, bonusThreshold } =
      await req.json();

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (phone !== undefined) {
      data.phone = phone && String(phone).trim() ? String(phone).trim().slice(0, 30) : null;
    }
    if (dailyRate !== undefined) data.dailyRate = Math.max(0, Number(dailyRate) || 0);
    if (bonusPercent !== undefined)
      data.bonusPercent = Math.min(100, Math.max(0, Number(bonusPercent) || 0));
    if (bonusThreshold !== undefined)
      data.bonusThreshold = Math.max(0, Number(bonusThreshold) || 0);
    if (password !== undefined && password !== "") {
      if (String(password).length < 3) {
        return NextResponse.json({ error: "Пароль минимум 3 символа" }, { status: 400 });
      }
      data.passwordHash = hashPassword(String(password));
    }

    if (role !== undefined && role !== target.role) {
      if (userId === admin.id) {
        return NextResponse.json(
          { error: "Нельзя менять собственную роль" },
          { status: 400 }
        );
      }
      data.role = role === "ADMIN" ? "ADMIN" : "STAFF";
    }

    if (active !== undefined && Boolean(active) !== target.active) {
      if (userId === admin.id && !active) {
        return NextResponse.json(
          { error: "Нельзя отключить собственный аккаунт" },
          { status: 400 }
        );
      }
      if (!active && target.role === "ADMIN") {
        const activeAdmins = await db.user.count({
          where: { role: "ADMIN", active: true },
        });
        if (activeAdmins <= 1) {
          return NextResponse.json(
            { error: "Нельзя отключить последнего активного администратора" },
            { status: 400 }
          );
        }
      }
      data.active = Boolean(active);
    }

    const user = await db.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        phone: true,
      },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление сотрудника (только главный аккаунт).
// История не пропадает: сеансы, записи кассы и расходы переписываются на
// главного, который удаляет (отчёты и балансы остаются корректными).
// Смены в графике освобождаются (SetNull), личные рабочие дни и логины
// удаляются (Cascade) — вход сотрудника отключается сразу на всех устройствах.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  try {
    const { id } = await params;
    const userId = String(id);

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "Нельзя удалить собственный аккаунт" },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    if (target.role === "ADMIN" && target.active) {
      const activeAdmins = await db.user.count({
        where: { role: "ADMIN", active: true },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "Нельзя удалить последнего главного администратора" },
          { status: 400 }
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      const started = await tx.session.updateMany({
        where: { createdById: userId },
        data: { createdById: admin.id },
      });
      const completed = await tx.session.updateMany({
        where: { completedById: userId },
        data: { completedById: admin.id },
      });
      const cash = await tx.cashEntry.updateMany({
        where: { userId },
        data: { userId: admin.id },
      });
      const expenses = await tx.expense.updateMany({
        where: { userId },
        data: { userId: admin.id },
      });
      // authSessions и workDays удалятся по Cascade, смены очистятся по SetNull
      await tx.user.delete({ where: { id: userId } });
      return {
        sessions: started.count + completed.count,
        cash: cash.count,
        expenses: expenses.count,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
