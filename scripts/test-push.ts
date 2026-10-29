/**
 * Интеграционный тест Web Push (VAPID):
 *  1) поднимает встроенный Postgres на :5433;
 *  2) применяет схему (prisma db push) и создаёт admin/admin + overdue-сеанс;
 *  3) поднимает собранный standalone-сервер Next с VAPID-ключами;
 *  4) проверяет: /api/push/public-key, логин, /api/push/subscribe,
 *     /api/push/tick (идемпотентность), поведение с фейковым endpoint,
 *     /api/dashboard с включённым push-модулем.
 *
 * Запуск: bunx tsx scripts/test-push.ts
 */
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "child_process";
import { rmSync } from "fs";

const PORT = 5433;
const DB = "push_test";
const DATABASE_URL = `postgresql://postgres:password@localhost:${PORT}/${DB}`;
const BASE = `http://localhost:3000`;

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  rmSync(".pgdata-push-test", { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: ".pgdata-push-test",
    user: "postgres",
    password: "password",
    port: PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);
  console.log("Postgres запущен на :" + PORT);

  try {
    // Схема
    execSync(`bunx prisma db push --skip-generate`, {
      env: { ...process.env, DATABASE_URL },
      stdio: "pipe",
    });
    console.log("Схема применена");

    // Prisma-клиент с нужным DATABASE_URL
    process.env.DATABASE_URL = DATABASE_URL;
    const { PrismaClient } = await import("@prisma/client");
    const { hashPassword } = await import("../src/lib/auth");
    const db = new PrismaClient();

    const admin = await db.user.create({
      data: {
        username: "admin",
        passwordHash: hashPassword("admin"),
        name: "Главный",
        role: "ADMIN",
      },
    });
    const device = await db.device.create({
      data: { type: "PLAYSTATION", number: 1 },
    });
    const pkg = await db.package.create({
      data: { name: "1 час", durationMinutes: 60, price: 1000 },
    });
    await db.session.create({
      data: {
        deviceId: device.id,
        packageId: pkg.id,
        packageName: "1 час",
        durationMinutes: 60,
        startedAt: new Date(Date.now() - 90 * 60 * 1000),
        plannedEndAt: new Date(Date.now() - 30 * 60 * 1000), // 30 мин назад
        price: 1000,
        paymentMethod: "CASH",
        createdById: admin.id,
      },
    });
    console.log("admin, устройство, пакет и overdue-сеанс созданы");

    // Сервер (standalone уже собран) с VAPID-ключами
    const vapid = {
      VAPID_PUBLIC_KEY:
        "BL-yTyFVxpnwBV-A3abzsBmnfj_pRtczmdJhsEbPojM1R26WQt-oyxhZgvj97v_LtreWR6Hot-II94NcfIrxPJg",
      VAPID_PRIVATE_KEY: "JsbI7UjXSom5r__t2eRlDxEIiB6G4MqHde1zbOUQ-hE",
      VAPID_SUBJECT: "mailto:test@example.com",
    };
    const server = spawn("bun", [".next/standalone/server.js"], {
      env: {
        ...process.env,
        DATABASE_URL,
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        ...vapid,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stderr.on("data", (d) => process.stderr.write(d));

    // Ждём готовности
    let up = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const r = await fetch(`${BASE}/api/push/public-key`);
        if (r.ok) { up = true; break; }
      } catch { /* ещё не поднялся */ }
    }
    check("сервер поднялся", up);
    if (!up) throw new Error("сервер не поднялся");

    // 1. Публичный ключ
    const pk = await (await fetch(`${BASE}/api/push/public-key`)).json();
    check("public-key отдаёт VAPID", pk.key === vapid.VAPID_PUBLIC_KEY);

    // 2. Логин → cookie
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    check("логин admin/admin", loginRes.ok);
    const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];

    // 3. Подписка с фейковым endpoint (реального FCM нет в песочнице)
    const subRes = await fetch(`${BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint-test",
          keys: {
            p256dh: "BPk2x0V3ExampleKey_justForStorageTest-aaaaaaaaaaaaaaaaaaaaa",
            auth: "authTestKey123",
          },
        },
        label: "тестовый телефон",
      }),
    });
    check("subscribe сохраняет подписку", subRes.ok);

    // 4. Tick: рассылка на фейковый endpoint — ошибка доставки не должна
    //    ломать поток; pushedAt должен проставиться
    const tick1 = await (await fetch(`${BASE}/api/push/tick`)).json();
    check("tick отвечает ok", tick1.ok === true, `sent=${tick1.sent}`);

    // 5. Идемпотентность: второй tick не должен повторять рассылку
    const tick2 = await (await fetch(`${BASE}/api/push/tick`)).json();
    check("pushedAt проставлен (идемпотентность)", tick2.sent === 0);

    const session = await db.session.findFirst();
    check("session.pushedAt записан", session?.pushedAt !== null);
    const subRow = await db.pushSubscription.findFirst();
    check(
      "подписка в базе с lastError (фейковый endpoint отклонён)",
      Boolean(subRow) && Boolean(subRow!.lastError),
      `label=${subRow?.label}`
    );

    // 6. Dashboard с включённым push-модулем (попутный flush не мешает)
    const dash = await fetch(`${BASE}/api/dashboard`, { headers: { cookie } });
    check("dashboard 200 с push-модулем", dash.ok);
    const dashData = await dash.json();
    check("dashboard отдаёт устройства", Array.isArray(dashData.devices) && dashData.devices.length === 1);

    // 7. Выключение подписки
    const unsub = await fetch(`${BASE}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint-test" }),
    });
    check("unsubscribe удаляет подписку", unsub.ok);
    const subsLeft = await db.pushSubscription.count();
    check("таблица подписок пуста", subsLeft === 0);

    await db.$disconnect();
    server.kill("SIGTERM");
  } finally {
    await pg.stop();
    rmSync(".pgdata-push-test", { recursive: true, force: true });
  }

  console.log(failures === 0 ? "\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ✓" : `\nПРОВАЛЕНО: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ОШИБКА ТЕСТА:", e);
  process.exit(1);
});
