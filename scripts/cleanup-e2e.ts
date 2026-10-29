import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
// Удаляем только тестовые записи авансов, созданные e2e-проверкой (ids 3,4)
const res = await db.cashEntry.deleteMany({ where: { id: { in: [3, 4] }, note: { contains: "тест e2e" } } });
console.log("deleted entries:", res.count);
await db.user.update({ where: { username: "admin" }, data: { theme: "", alarmSound: "siren" } });
console.log("admin prefs reset");
await db.$disconnect();
