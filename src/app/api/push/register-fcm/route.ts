import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Регистрация FCM-токена нативного APK-приложения. Вызывается самим
 * приложением при каждом запуске и при смене токена — так сервер знает,
 * на какие телефоны слать «время вышло» через Firebase (FCM).
 * Публичный и безопасный: токен бесполезен без нашего Firebase-проекта.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      token?: unknown;
      label?: unknown;
    } | null;
    const token =
      typeof body?.token === "string" ? body.token.trim().slice(0, 500) : "";
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "token required" },
        { status: 400 }
      );
    }
    const label =
      typeof body?.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 100)
        : "android";

    await db.fcmToken.upsert({
      where: { token },
      create: { token, label },
      update: { label, lastError: null, lastSeenAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err).slice(0, 200) },
      { status: 500 }
    );
  }
}
