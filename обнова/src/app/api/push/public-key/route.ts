import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Публичный VAPID-ключ для подписки браузера на push. */
export async function GET() {
  return NextResponse.json({ key: vapidPublicKey() });
}
