import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Удалить push-подписку этого устройства (после «Выключить»). */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (body.endpoint) {
    await db.pushSubscription
      .deleteMany({ where: { endpoint: body.endpoint } })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
