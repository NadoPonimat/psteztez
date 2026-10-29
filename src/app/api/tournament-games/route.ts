import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Активные игры для турниров — доступно всем ролям (сотрудники создают турниры)
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const games = await db.tournamentGame.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ games });
}
