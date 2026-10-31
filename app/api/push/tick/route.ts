import { NextResponse } from "next/server";
import { flushOverduePushes } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * «Тик» доставки push: находит сеансы, у которых время вышло, а push ещё
 * не отправлялся, и рассылает уведомления на все подписанные устройства.
 * Публичный и идемпотентный (один сеанс — один push): предназначен для
 * внешнего cron-пинга раз в минуту (cron-job.org — бесплатно, в браузере),
 * чтобы уведомления приходили, даже когда ВСЕ приложения свёрнуты.
 */
export async function GET() {
  const sent = await flushOverduePushes();
  return NextResponse.json({ ok: true, sent });
}
