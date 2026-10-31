import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildBracket } from "@/lib/tournament-server";

// Начать турнир: построить сетку/календарь по выбранному формату
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tournament = await db.tournament.findUnique({
    where: { id: Number(id) },
    include: { participants: true },
  });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  if (tournament.status !== "REGISTRATION")
    return NextResponse.json({ error: "Турнир уже идёт или завершён" }, { status: 400 });

  const count = tournament.participants.length;
  if (count < 2)
    return NextResponse.json(
      { error: "Нужно минимум 2 участника" },
      { status: 400 }
    );
  if (tournament.format === "ROUND_ROBIN" && count < 3)
    return NextResponse.json(
      { error: "Для круговой системы нужно минимум 3 участника" },
      { status: 400 }
    );

  try {
    const body = await req.json().catch(() => ({}));
    const shuffle = Boolean(body.shuffle);

    // Порядок участников = посев. Жребий — случайный порядок.
    let ordered = [...tournament.participants];
    if (shuffle) {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    } else {
      // явные посевы (1 = фаворит) вверх, затем по регистрации
      ordered.sort(
        (a, b) =>
          (a.seed > 0 ? a.seed : Number.MAX_SAFE_INTEGER) -
            (b.seed > 0 ? b.seed : Number.MAX_SAFE_INTEGER) || 0
      );
    }

    await buildBracket(
      tournament.id,
      ordered.map((p) => ({ id: p.id, name: p.name }))
    );
    await db.tournament.update({
      where: { id: tournament.id },
      data: { status: "ONGOING" },
    });

    return NextResponse.json({ ok: true, message: "Турнир начался! Сетка построена." });
  } catch (e) {
    console.error("start tournament error:", e);
    return NextResponse.json({ error: "Не удалось построить сетку" }, { status: 500 });
  }
}
