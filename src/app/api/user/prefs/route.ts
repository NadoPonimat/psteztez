import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { THEMES } from "@/lib/themes";
import { DEFAULT_SOUND_ID, soundById } from "@/lib/sounds";

// Личные настройки аккаунта: тема оформления и звук уведомлений.
// Доступно каждому аккаунту (и главный, и сотрудники).
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = await req.json();
    const data: { theme?: string; alarmSound?: string } = {};

    if (body.theme !== undefined) {
      const theme = typeof body.theme === "string" ? body.theme : "";
      if (theme !== "" && !THEMES.some((t) => t.id === theme)) {
        return NextResponse.json({ error: "Неизвестная тема" }, { status: 400 });
      }
      data.theme = theme;
    }

    if (body.alarmSound !== undefined) {
      const sound = typeof body.alarmSound === "string" ? body.alarmSound : DEFAULT_SOUND_ID;
      if (!soundById(sound)) {
        return NextResponse.json({ error: "Неизвестный звук" }, { status: 400 });
      }
      data.alarmSound = sound;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      select: { theme: true, alarmSound: true },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (e) {
    console.error("PATCH /api/user/prefs error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
