import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { reportMatchResult } from "@/lib/tournament-server";

// Записать счёт матча (или сбросить: score1/score2 = null)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id, mid } = await params;
  try {
    const body = await req.json();
    const s1 = body.score1 === null || body.score1 === undefined ? null : Number(body.score1);
    const s2 = body.score2 === null || body.score2 === undefined ? null : Number(body.score2);

    const result = await reportMatchResult(Number(id), Number(mid), s1, s2);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("report match error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
