import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "crm_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 дней

// ---------- Пароли ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ---------- Настройки (key-value) ----------

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function verifyCompletionPassword(input: string): Promise<boolean> {
  const stored = await getSetting("completion_password", hashPassword("0000"));
  if (stored.includes(":")) return verifyPassword(input, stored);
  // fallback: пароль хранится как sha256
  return createHash("sha256").update(input).digest("hex") === stored;
}

// ---------- Cookie-сессии ----------

export async function createAuthSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.authSession.create({ data: { token, userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return token;
}

export async function destroyAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.authSession.deleteMany({ where: { token } });
  }
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "STAFF";
  theme: string;
  alarmSound: string;
  phone: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const authSession = await db.authSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!authSession) return null;
    if (authSession.expiresAt < new Date()) {
      await db.authSession.delete({ where: { id: authSession.id } }).catch(() => {});
      return null;
    }
    if (!authSession.user.active) return null;
    return {
      id: authSession.user.id,
      username: authSession.user.username,
      name: authSession.user.name,
      role: authSession.user.role as "ADMIN" | "STAFF",
      theme: authSession.user.theme,
      alarmSound: authSession.user.alarmSound,
      phone: authSession.user.phone,
    };
  } catch {
    return null;
  }
}

// Ответ 401 для API
export async function requireUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Требуется авторизация" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export async function requireAdmin(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: Response }
> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (result.user.role !== "ADMIN") {
    return {
      ok: false,
      response: Response.json(
        { error: "Доступ только для главного аккаунта" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: result.user };
}
