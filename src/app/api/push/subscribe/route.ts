import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Сохранить push-подписку этого устройства (вызывается после «Включить»). */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    label?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const subAuth = body.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !subAuth) {
    return NextResponse.json(
      { error: "Неполная подписка (endpoint/keys)" },
      { status: 400 }
    );
  }

  const label = typeof body.label === "string" && body.label.trim()
    ? body.label.trim().slice(0, 100)
    : null;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth: subAuth, label },
    update: { p256dh, auth: subAuth, label, lastError: null },
  });

  return NextResponse.json({ ok: true });
}
