import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Изменить участника: оплата взноса, имя/телефон, посев
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id, pid } = await params;
  const tournament = await db.tournament.findUnique({ where: { id: Number(id) } });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });

  const participant = await db.tournamentParticipant.findUnique({
    where: { id: Number(pid) },
  });
  if (!participant || participant.tournamentId !== tournament.id)
    return NextResponse.json({ error: "Участник не найден" }, { status: 404 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.paid !== undefined) {
      if (tournament.status === "COMPLETED")
        return NextResponse.json({ error: "Турнир завершён" }, { status: 400 });
      data.paid = Boolean(body.paid);
    }
    if (body.name !== undefined) {
      if (tournament.status !== "REGISTRATION")
        return NextResponse.json(
          { error: "Имя можно менять только до построения сетки" },
          { status: 400 }
        );
      const name = String(body.name).trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: "Имя не может быть пустым" }, { status: 400 });
      data.name = name;
    }
    if (body.phone !== undefined && tournament.status === "REGISTRATION") {
      data.phone = String(body.phone).trim().slice(0, 30) || null;
    }
    if (body.seed !== undefined && tournament.status === "REGISTRATION") {
      data.seed = Math.max(0, Math.min(64, Math.round(Number(body.seed) || 0)));
    }

    const updated = await db.tournamentParticipant.update({
      where: { id: participant.id },
      data,
    });
    return NextResponse.json({ participant: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Убрать участника (только до старта)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id, pid } = await params;
  const tournament = await db.tournament.findUnique({ where: { id: Number(id) } });
  if (!tournament) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  if (tournament.status !== "REGISTRATION")
    return NextResponse.json(
      { error: "Нельзя убрать участника после построения сетки" },
      { status: 400 }
    );

  try {
    await db.tournamentParticipant.delete({ where: { id: Number(pid) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
  }
}
