import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyCompletionPassword } from "@/lib/auth";

// Завершение сеанса — требуется пароль завершения (по умолчанию 0000)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const { id } = await params;
    const sessionId = Number(id);
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
    }

    const valid = await verifyCompletionPassword(String(password));
    if (!valid) {
      return NextResponse.json({ error: "Неверный пароль" }, { status: 403 });
    }

    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: "Сеанс не найден" }, { status: 404 });
    }
    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Сеанс уже завершён" }, { status: 409 });
    }

    const updated = await db.session.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        completedById: user.id,
      },
    });

    return NextResponse.json({ session: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
