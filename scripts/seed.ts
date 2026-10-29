import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  // ---- Главный аккаунт ----
  const adminExists = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash: hashPassword("admin"),
        name: "Главный администратор",
        role: "ADMIN",
      },
    });
    console.log("✓ Создан главный аккаунт: admin / admin");
  }

  // ---- Демо-сотрудник ----
  const staffExists = await prisma.user.findUnique({ where: { username: "kassir" } });
  if (!staffExists) {
    await prisma.user.create({
      data: {
        username: "kassir",
        passwordHash: hashPassword("1234"),
        name: "Айдар (сменa)",
        role: "STAFF",
        dailyRate: 15000,
        bonusPercent: 5,
        bonusThreshold: 60000,
      },
    });
    console.log("✓ Создан демо-сотрудник: kassir / 1234 (ставка 15 000 ₸, +5% от кассы при пороге 60 000 ₸)");
  }

  // ---- Устройства ----
  const deviceCount = await prisma.device.count();
  if (deviceCount === 0) {
    const devices: { type: string; number: number }[] = [];
    for (let i = 1; i <= 6; i++) devices.push({ type: "PLAYSTATION", number: i });
    for (let i = 1; i <= 3; i++) devices.push({ type: "VR", number: i });
    await prisma.device.createMany({ data: devices });
    console.log("✓ Созданы устройства: 6 PlayStation, 3 VR кресла");
  }

  // ---- Пакеты ----
  const packageCount = await prisma.package.count();
  if (packageCount === 0) {
    await prisma.package.createMany({
      data: [
        { name: "30 минут", durationMinutes: 30, price: 1500, deviceType: "PLAYSTATION", sortOrder: 1 },
        { name: "1 час", durationMinutes: 60, price: 2500, deviceType: "PLAYSTATION", sortOrder: 2 },
        { name: "2 часа", durationMinutes: 120, price: 4500, deviceType: "PLAYSTATION", sortOrder: 3 },
        { name: "3 часа", durationMinutes: 180, price: 6000, deviceType: "PLAYSTATION", sortOrder: 4 },
        { name: "5 часов", durationMinutes: 300, price: 9000, deviceType: "PLAYSTATION", sortOrder: 5 },
        { name: "15 минут", durationMinutes: 15, price: 2000, deviceType: "VR", sortOrder: 1 },
        { name: "30 минут", durationMinutes: 30, price: 3500, deviceType: "VR", sortOrder: 2 },
        { name: "1 час", durationMinutes: 60, price: 6000, deviceType: "VR", sortOrder: 3 },
      ],
    });
    console.log("✓ Созданы пакеты времени для PlayStation и VR");
  }

  // ---- Настройки ----
  const completionPwd = await prisma.setting.findUnique({ where: { key: "completion_password" } });
  if (!completionPwd) {
    await prisma.setting.create({
      data: { key: "completion_password", value: hashPassword("0000") },
    });
    console.log("✓ Пароль завершения сеанса: 0000");
  }
  const clubName = await prisma.setting.findUnique({ where: { key: "club_name" } });
  if (!clubName) {
    await prisma.setting.create({ data: { key: "club_name", value: "PlayZone CRM" } });
  }

  console.log("Сидинг завершён.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
